import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BookingStatus,
  MembershipType,
  Prisma,
  RoleCode,
} from '@prisma/client';
import { ApiError } from '../../common/api-error.js';
import type { AuthUser } from '../../common/auth.types.js';
import { appDayBounds, formatAppDateTime } from '../../common/date-time.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CheckinDto,
  CreateBookingDto,
  CreateSlotDto,
  ListSlotsQueryDto,
  UpdateBookingStatusDto,
} from './operations.dto.js';
import { SlotSort } from './operations.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const MEMBER_CANCELLATION_CUTOFF_MS = 4 * 60 * 60 * 1000;
const PT_CHECKIN_EARLY_MS = 60 * 60 * 1000;
const PT_CHECKIN_GRACE_MS = 5 * 60 * 1000;
const CHECKIN_TRANSACTION_MAX_ATTEMPTS = 3;
const CHECKIN_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable' as const,
  maxWait: 10_000,
  timeout: 20_000,
};

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createSlot(dto: CreateSlotDto, user: AuthUser) {
    if (!user.trainerProfileId)
      throw new ApiError(
        'TRAINER_PROFILE_REQUIRED',
        'Chỉ Trainer mới có thể mở khung giờ.',
        HttpStatus.FORBIDDEN,
      );
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt <= new Date() || endsAt <= startsAt)
      throw new ApiError(
        'INVALID_SLOT_TIME',
        'Khung giờ phải ở tương lai và giờ kết thúc phải sau giờ bắt đầu.',
      );
    const overlap = await this.prisma.ptSlot.findFirst({
      where: {
        trainerId: user.trainerProfileId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap)
      throw new ApiError('SLOT_OVERLAP', 'Khung giờ bị trùng với lịch đã có.');
    return this.prisma.ptSlot.create({
      data: { trainerId: user.trainerProfileId, startsAt, endsAt },
      include: {
        trainer: { include: { user: { select: { fullName: true } } } },
      },
    });
  }

  async listSlots(query: ListSlotsQueryDto) {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new ApiError(
        'INVALID_SLOT_RANGE',
        'Khoảng thời gian tìm lịch trống không hợp lệ.',
      );
    const startsAt = {
      gt: new Date(),
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lt: new Date(query.to) } : {}),
    };
    const slots = await this.prisma.ptSlot.findMany({
      where: {
        isOpen: true,
        startsAt,
        trainer: { user: { status: 'ACTIVE' } },
      },
      include: {
        trainer: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        bookings: {
          where: {
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CANCEL_REQUESTED,
                BookingStatus.AWAITING_COMPLETION,
              ],
            },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
    const trainerUserIds = [
      ...new Set(slots.map((slot) => slot.trainer.user.id)),
    ];
    const ratings = trainerUserIds.length
      ? await this.prisma.staffReview.groupBy({
          by: ['staffId'],
          where: { staffId: { in: trainerUserIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];
    const ratingByTrainer = new Map(
      ratings.map((rating) => [
        rating.staffId,
        {
          average: rating._avg.rating ?? null,
          count: rating._count.rating,
        },
      ]),
    );
    const result = slots.map((slot) => ({
      ...slot,
      trainer: {
        ...slot.trainer,
        rating: ratingByTrainer.get(slot.trainer.user.id) ?? {
          average: null,
          count: 0,
        },
      },
    }));
    if (query.sort === SlotSort.RATING)
      result.sort((first, second) => {
        const ratingDifference =
          (second.trainer.rating.average ?? -1) -
          (first.trainer.rating.average ?? -1);
        if (ratingDifference) return ratingDifference;
        const countDifference =
          second.trainer.rating.count - first.trainer.rating.count;
        if (countDifference) return countDifference;
        return first.startsAt.getTime() - second.startsAt.getTime();
      });
    if (query.sort === SlotSort.REVIEW_COUNT)
      result.sort((first, second) => {
        const countDifference =
          second.trainer.rating.count - first.trainer.rating.count;
        if (countDifference) return countDifference;
        return first.startsAt.getTime() - second.startsAt.getTime();
      });
    return result;
  }

  async closeSlot(id: string, user: AuthUser) {
    const slot = await this.prisma.ptSlot.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CANCEL_REQUESTED,
                BookingStatus.AWAITING_COMPLETION,
              ],
            },
          },
          select: { id: true },
        },
      },
    });
    if (!slot)
      throw new ApiError(
        'SLOT_NOT_FOUND',
        'Không tìm thấy khung giờ PT.',
        HttpStatus.NOT_FOUND,
      );
    const canManage =
      user.roles.includes(RoleCode.OWNER) ||
      user.trainerProfileId === slot.trainerId;
    if (!canManage)
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền đóng khung giờ này.',
        HttpStatus.FORBIDDEN,
      );
    if (slot.bookings.length > 0)
      throw new ApiError(
        'SLOT_HAS_ACTIVE_BOOKING',
        'Khung giờ đã có lịch hẹn. Hãy hủy lịch hẹn trước khi đóng khung giờ.',
        HttpStatus.CONFLICT,
      );
    return this.prisma.ptSlot.update({
      where: { id },
      data: { isOpen: false },
    });
  }

  async createBooking(dto: CreateBookingDto, user: AuthUser) {
    if (!user.memberProfileId)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Chỉ hội viên mới có thể đặt lịch PT.',
        HttpStatus.FORBIDDEN,
      );
    const memberProfileId = user.memberProfileId;
    return this.prisma.$transaction(
      async (tx) => {
        const slot = await tx.ptSlot.findUnique({ where: { id: dto.slotId } });
        const activeTrainer = slot
          ? await tx.trainerProfile.findFirst({
              where: { id: slot.trainerId, user: { status: 'ACTIVE' } },
              select: { id: true },
            })
          : null;
        if (
          !slot ||
          !activeTrainer ||
          !slot.isOpen ||
          slot.startsAt <= new Date()
        )
          throw new ApiError(
            'BOOKING_SLOT_UNAVAILABLE',
            'Vui lòng chọn khung giờ còn khả dụng.',
          );
        const held = await tx.ptBooking.findFirst({
          where: {
            slotId: slot.id,
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CANCEL_REQUESTED,
                BookingStatus.AWAITING_COMPLETION,
              ],
            },
          },
        });
        if (held)
          throw new ApiError(
            'BOOKING_SLOT_TAKEN',
            'Khung giờ này đã được đặt. Vui lòng chọn giờ khác.',
            HttpStatus.CONFLICT,
          );
        const memberOverlap = await tx.ptBooking.findFirst({
          where: {
            memberId: memberProfileId,
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CANCEL_REQUESTED,
                BookingStatus.AWAITING_COMPLETION,
              ],
            },
            slot: {
              startsAt: { lt: slot.endsAt },
              endsAt: { gt: slot.startsAt },
            },
          },
        });
        if (memberOverlap)
          throw new ApiError(
            'MEMBER_BOOKING_OVERLAP',
            'Bạn đã có lịch PT trùng với khung giờ này.',
            HttpStatus.CONFLICT,
          );
        const pkg = await tx.memberPtPackage.findFirst({
          where: { id: dto.memberPtPackageId, memberId: memberProfileId },
        });
        if (
          !pkg ||
          pkg.sessionsUsed + pkg.sessionsReserved >= pkg.sessionsTotal ||
          (pkg.expiresAt && pkg.expiresAt < new Date())
        )
          throw new ApiError(
            'PT_SESSIONS_EXHAUSTED',
            'Số buổi PT còn lại không đủ.',
          );
        const booking = await tx.ptBooking.create({
          data: {
            slotId: slot.id,
            memberId: memberProfileId,
            memberPtPackageId: pkg.id,
            note: dto.note,
            holdKey: slot.id,
          },
        });
        await tx.memberPtPackage.update({
          where: { id: pkg.id },
          data: { sessionsReserved: { increment: 1 } },
        });
        const trainer = await tx.trainerProfile.findUniqueOrThrow({
          where: { id: slot.trainerId },
          select: { userId: true },
        });
        await this.notifications.notifyUsers(tx, [trainer.userId], {
          type: 'BOOKING_REQUESTED',
          title: 'Có yêu cầu đặt lịch PT mới',
          message: `Hội viên vừa đặt khung giờ ${formatAppDateTime(slot.startsAt)}.`,
          metadata: { bookingId: booking.id, slotId: slot.id },
        });
        return booking;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private ptCheckinWindow(slot: { startsAt: Date; endsAt: Date }) {
    return {
      opensAt: new Date(slot.startsAt.getTime() - PT_CHECKIN_EARLY_MS),
      closesAt: new Date(slot.endsAt.getTime() + PT_CHECKIN_GRACE_MS),
    };
  }

  private async reconcileEndedBookings() {
    const latestEndedAt = new Date();
    const candidates = await this.prisma.ptBooking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        slot: { endsAt: { lte: latestEndedAt } },
      },
      select: { id: true },
    });

    for (const candidate of candidates) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const booking = await tx.ptBooking.findUniqueOrThrow({
              where: { id: candidate.id },
              include: {
                slot: {
                  include: {
                    trainer: { select: { userId: true } },
                  },
                },
                member: { select: { userId: true } },
              },
            });
            if (booking.status !== BookingStatus.CONFIRMED) return;
            const { opensAt, closesAt } = this.ptCheckinWindow(booking.slot);

            if (booking.attendanceCheckedInAt) {
              await tx.ptBooking.update({
                where: { id: booking.id },
                data: {
                  status: BookingStatus.AWAITING_COMPLETION,
                  resolutionReason: null,
                  resolvedById: null,
                  resolvedAt: null,
                },
              });
              await tx.auditLog.create({
                data: {
                  action: 'QUEUE_PT_COMPLETION',
                  entityType: 'PtBooking',
                  entityId: booking.id,
                  metadata: {
                    checkedInAt: booking.attendanceCheckedInAt,
                    windowOpenedAt: opensAt,
                    windowClosedAt: closesAt,
                  },
                },
              });
              await this.notifications.notifyUsers(
                tx,
                [booking.slot.trainer.userId],
                {
                  type: 'BOOKING_COMPLETION_REQUIRED',
                  title: 'Buổi PT chờ xác nhận hoàn thành',
                  message: `Buổi PT lúc ${formatAppDateTime(booking.slot.startsAt)} đã kết thúc và có check-in hợp lệ.`,
                  metadata: { bookingId: booking.id },
                },
              );
              return;
            }

            if (closesAt > new Date()) return;

            const pkg = await tx.memberPtPackage.findUniqueOrThrow({
              where: { id: booking.memberPtPackageId },
            });
            if (
              pkg.sessionsReserved < 1 ||
              pkg.sessionsUsed >= pkg.sessionsTotal
            )
              throw new ApiError(
                'PT_RESERVATION_INCONSISTENT',
                'Dữ liệu lượt PT đang giữ không hợp lệ.',
                HttpStatus.CONFLICT,
              );
            await tx.memberPtPackage.update({
              where: { id: pkg.id },
              data: {
                sessionsUsed: { increment: 1 },
                sessionsReserved: { decrement: 1 },
              },
            });
            const reason =
              'Tự động ghi nhận vắng mặt vì không có check-in hợp lệ trước khi hết thời gian đệm.';
            await tx.ptBooking.update({
              where: { id: booking.id },
              data: {
                status: BookingStatus.NO_SHOW,
                holdKey: null,
                resolutionReason: reason,
                resolvedAt: new Date(),
              },
            });
            await tx.auditLog.create({
              data: {
                action: 'AUTO_MARK_PT_NO_SHOW',
                entityType: 'PtBooking',
                entityId: booking.id,
                metadata: {
                  memberPtPackageId: pkg.id,
                  windowOpenedAt: opensAt,
                  windowClosedAt: closesAt,
                },
              },
            });
            await this.notifications.notifyUsers(
              tx,
              [booking.member.userId, booking.slot.trainer.userId],
              {
                type: 'BOOKING_NO_SHOW',
                title: 'Buổi PT được ghi nhận vắng mặt',
                message:
                  'Không có check-in hợp lệ trước khi hết thời gian đệm; hệ thống đã trừ một buổi PT.',
                metadata: { bookingId: booking.id, automatic: true },
              },
            );
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        console.error('Unable to reconcile ended PT booking.', {
          bookingId: candidate.id,
          error,
        });
      }
    }
  }

  async listBookings(user: AuthUser) {
    await this.reconcileEndedBookings();
    const where = user.roles.includes(RoleCode.OWNER)
      ? {}
      : user.trainerProfileId
        ? { slot: { trainerId: user.trainerProfileId } }
        : user.memberProfileId
          ? { memberId: user.memberProfileId }
          : { id: '__none__' };
    const bookings = await this.prisma.ptBooking.findMany({
      where,
      include: {
        slot: {
          include: {
            trainer: {
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        },
        member: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        memberPtPackage: { include: { package: true } },
        resolvedBy: { select: { fullName: true, email: true } },
        cancellationRequestedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((booking) => {
      if (
        booking.status !== BookingStatus.CONFIRMED &&
        booking.status !== BookingStatus.AWAITING_COMPLETION
      )
        return { ...booking, completionCheckinAt: null };
      return {
        ...booking,
        completionCheckinAt: booking.attendanceCheckedInAt,
      };
    });
  }

  async updateBooking(id: string, dto: UpdateBookingStatusDto, user: AuthUser) {
    const next = dto.status;
    if (next === BookingStatus.COMPLETED) await this.reconcileEndedBookings();
    const booking = await this.prisma.ptBooking.findUnique({
      where: { id },
      include: { slot: true },
    });
    if (!booking)
      throw new ApiError(
        'BOOKING_NOT_FOUND',
        'Không tìm thấy lịch PT.',
        HttpStatus.NOT_FOUND,
      );
    const ownsAsTrainer = user.trainerProfileId === booking.slot.trainerId;
    const ownsAsMember = user.memberProfileId === booking.memberId;
    const isOwner = user.roles.includes(RoleCode.OWNER);
    if (next === BookingStatus.CANCELLED) {
      if (!ownsAsTrainer && !ownsAsMember && !isOwner)
        throw new ApiError(
          'FORBIDDEN',
          'Bạn không có quyền xử lý lịch này.',
          HttpStatus.FORBIDDEN,
        );
      if (booking.status === BookingStatus.CANCEL_REQUESTED) {
        if (!ownsAsTrainer && !isOwner)
          throw new ApiError(
            'BOOKING_CANCELLATION_APPROVAL_REQUIRED',
            'Yêu cầu hủy muộn phải được PT hoặc Chủ phòng xử lý.',
            HttpStatus.FORBIDDEN,
          );
        return this.releaseReservedSession(
          id,
          BookingStatus.CANCELLED,
          booking.cancellationReason ?? 'Đã chấp nhận yêu cầu hủy muộn.',
          user,
        );
      }
      if (
        booking.status !== BookingStatus.PENDING &&
        booking.status !== BookingStatus.CONFIRMED
      )
        throw new ApiError(
          'BOOKING_STATE_INVALID',
          'Buổi tập này không thể cập nhật trạng thái.',
        );
      if (booking.slot.startsAt <= new Date())
        throw new ApiError(
          'BOOKING_CANCEL_TOO_LATE',
          'Không thể hủy lịch đã bắt đầu.',
        );
      const suppliedReason = dto.reason?.trim() ?? '';
      if (
        ownsAsMember &&
        booking.status === BookingStatus.CONFIRMED &&
        booking.slot.startsAt.getTime() - Date.now() <
          MEMBER_CANCELLATION_CUTOFF_MS
      ) {
        if (suppliedReason.length < 3)
          throw new ApiError(
            'BOOKING_REASON_REQUIRED',
            'Vui lòng nhập lý do yêu cầu hủy muộn.',
          );
        return this.requestLateCancellation(booking, suppliedReason, user);
      }
      if ((ownsAsTrainer || isOwner) && suppliedReason.length < 3)
        throw new ApiError(
          'BOOKING_REASON_REQUIRED',
          'Vui lòng nhập lý do hủy lịch.',
        );
      const reason = suppliedReason || 'Hội viên chủ động hủy lịch.';
      return this.releaseReservedSession(
        id,
        BookingStatus.CANCELLED,
        reason,
        user,
      );
    }
    if (!ownsAsTrainer && !isOwner)
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền xử lý lịch này.',
        HttpStatus.FORBIDDEN,
      );
    if (
      next === BookingStatus.CONFIRMED &&
      booking.status === BookingStatus.CANCEL_REQUESTED
    ) {
      const reason = dto.reason?.trim() ?? '';
      if (reason.length < 3)
        throw new ApiError(
          'BOOKING_REASON_REQUIRED',
          'Vui lòng nhập lý do từ chối yêu cầu hủy.',
        );
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.ptBooking.update({
          where: { id },
          data: {
            status: BookingStatus.CONFIRMED,
            resolutionReason: `Yêu cầu hủy bị từ chối: ${reason}`,
            resolvedById: user.id,
            resolvedAt: new Date(),
            cancellationRequestedById: null,
            cancellationRequestedAt: null,
            cancellationReason: null,
          },
        });
        const member = await tx.memberProfile.findUniqueOrThrow({
          where: { id: booking.memberId },
          select: { userId: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'REJECT_BOOKING_CANCELLATION',
            entityType: 'PtBooking',
            entityId: id,
            metadata: { reason },
          },
        });
        await this.notifications.notifyUsers(tx, [member.userId], {
          type: 'BOOKING_CANCELLATION_REJECTED',
          title: 'Yêu cầu hủy lịch chưa được chấp nhận',
          message: reason,
          metadata: { bookingId: id },
        });
        return updated;
      });
    }
    if (
      next === BookingStatus.CONFIRMED &&
      booking.status === BookingStatus.PENDING
    ) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.ptBooking.update({
          where: { id },
          data: {
            status: next,
            resolvedById: user.id,
            resolvedAt: new Date(),
          },
        });
        const member = await tx.memberProfile.findUniqueOrThrow({
          where: { id: booking.memberId },
          select: { userId: true },
        });
        await this.notifications.notifyUsers(tx, [member.userId], {
          type: 'BOOKING_CONFIRMED',
          title: 'PT đã xác nhận lịch',
          message: `Lịch tập ${formatAppDateTime(booking.slot.startsAt)} đã được xác nhận.`,
          metadata: { bookingId: id, slotId: booking.slotId },
        });
        return updated;
      });
    }
    if (
      next === BookingStatus.REJECTED &&
      booking.status === BookingStatus.PENDING
    ) {
      const reason = dto.reason?.trim() ?? '';
      if (reason.length < 3)
        throw new ApiError(
          'BOOKING_REASON_REQUIRED',
          'Vui lòng nhập lý do từ chối lịch.',
        );
      return this.releaseReservedSession(
        id,
        BookingStatus.REJECTED,
        reason,
        user,
      );
    }
    if (
      next === BookingStatus.COMPLETED &&
      booking.status === BookingStatus.AWAITING_COMPLETION
    ) {
      if (booking.slot.endsAt > new Date())
        throw new ApiError(
          'BOOKING_NOT_ENDED',
          `Chỉ có thể xác nhận hoàn thành sau giờ kết thúc ${formatAppDateTime(booking.slot.endsAt)}.`,
        );
      if (!booking.attendanceCheckedInAt)
        throw new ApiError(
          'PT_COMPLETION_CHECKIN_REQUIRED',
          'Buổi tập không có check-in hợp lệ trong khoảng 60 phút trước giờ bắt đầu đến hết 5 phút đệm.',
        );
      return this.prisma.$transaction(
        async (tx) => {
          const current = await tx.ptBooking.findUniqueOrThrow({
            where: { id },
          });
          if (current.status !== BookingStatus.AWAITING_COMPLETION)
            throw new ApiError(
              'BOOKING_STATE_INVALID',
              'Buổi tập này không thể cập nhật trạng thái.',
            );
          const pkg = await tx.memberPtPackage.findUniqueOrThrow({
            where: { id: current.memberPtPackageId },
          });
          if (pkg.sessionsReserved < 1 || pkg.sessionsUsed >= pkg.sessionsTotal)
            throw new ApiError(
              'PT_SESSIONS_EXHAUSTED',
              'Số buổi PT còn lại không đủ.',
            );
          await tx.memberPtPackage.update({
            where: { id: pkg.id },
            data: {
              sessionsUsed: { increment: 1 },
              sessionsReserved: { decrement: 1 },
            },
          });
          const updated = await tx.ptBooking.update({
            where: { id },
            data: {
              status: next,
              completedAt: new Date(),
              holdKey: null,
              resolutionReason: dto.reason?.trim() || null,
              resolvedById: user.id,
              resolvedAt: new Date(),
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: 'COMPLETE_PT_BOOKING',
              entityType: 'PtBooking',
              entityId: id,
              metadata: { memberPtPackageId: pkg.id },
            },
          });
          const member = await tx.memberProfile.findUniqueOrThrow({
            where: { id: current.memberId },
            select: { userId: true },
          });
          await this.notifications.notifyUsers(tx, [member.userId], {
            type: 'BOOKING_COMPLETED',
            title: 'Buổi PT đã hoàn thành',
            message:
              'Buổi tập đã được ghi nhận. Bạn có thể đánh giá nhân viên tại trang Đánh giá nhân viên.',
            metadata: { bookingId: id },
          });
          return updated;
        },
        { isolationLevel: 'Serializable' },
      );
    }
    if (
      next === BookingStatus.COMPLETED &&
      booking.status === BookingStatus.CONFIRMED
    ) {
      const now = new Date();
      if (booking.slot.endsAt > now)
        throw new ApiError(
          'BOOKING_NOT_ENDED',
          `Chỉ có thể xác nhận hoàn thành sau giờ kết thúc ${formatAppDateTime(booking.slot.endsAt)}.`,
        );
      const { closesAt } = this.ptCheckinWindow(booking.slot);
      throw new ApiError(
        'PT_COMPLETION_CHECKIN_REQUIRED',
        `Chưa có điểm danh PT hợp lệ. Hệ thống sẽ chờ điểm danh đến ${formatAppDateTime(closesAt)} trước khi ghi nhận vắng mặt.`,
      );
    }
    throw new ApiError(
      'BOOKING_STATE_INVALID',
      'Buổi tập này không thể cập nhật trạng thái.',
    );
  }

  private async requestLateCancellation(
    booking: {
      id: string;
      memberId: string;
      slotId: string;
      slot: { trainerId: string; startsAt: Date };
    },
    reason: string,
    user: AuthUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ptBooking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCEL_REQUESTED,
          cancellationRequestedById: user.id,
          cancellationRequestedAt: new Date(),
          cancellationReason: reason,
        },
      });
      const [trainer, owners] = await Promise.all([
        tx.trainerProfile.findUniqueOrThrow({
          where: { id: booking.slot.trainerId },
          select: { userId: true },
        }),
        tx.user.findMany({
          where: { roles: { some: { role: { code: RoleCode.OWNER } } } },
          select: { id: true },
        }),
      ]);
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'REQUEST_LATE_BOOKING_CANCELLATION',
          entityType: 'PtBooking',
          entityId: booking.id,
          metadata: { reason },
        },
      });
      await this.notifications.notifyUsers(
        tx,
        [trainer.userId, ...owners.map((owner) => owner.id)],
        {
          type: 'BOOKING_CANCELLATION_REQUESTED',
          title: 'Có yêu cầu hủy lịch PT muộn',
          message: `${formatAppDateTime(booking.slot.startsAt)} · ${reason}`,
          metadata: { bookingId: booking.id, slotId: booking.slotId },
        },
      );
      return updated;
    });
  }

  private async releaseReservedSession(
    bookingId: string,
    status: 'CANCELLED' | 'REJECTED',
    reason: string,
    user: AuthUser,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.ptBooking.findUniqueOrThrow({
          where: { id: bookingId },
          include: {
            member: { select: { userId: true } },
            slot: {
              include: {
                trainer: { select: { userId: true } },
              },
            },
          },
        });
        if (
          current.status !== BookingStatus.PENDING &&
          current.status !== BookingStatus.CONFIRMED &&
          current.status !== BookingStatus.CANCEL_REQUESTED
        )
          throw new ApiError(
            'BOOKING_STATE_INVALID',
            'Buổi tập này không thể cập nhật trạng thái.',
          );
        const pkg = await tx.memberPtPackage.findUniqueOrThrow({
          where: { id: current.memberPtPackageId },
        });
        if (pkg.sessionsReserved < 1)
          throw new ApiError(
            'PT_RESERVATION_INCONSISTENT',
            'Dữ liệu giữ buổi PT không hợp lệ. Vui lòng liên hệ Chủ phòng.',
            HttpStatus.CONFLICT,
          );
        await tx.memberPtPackage.update({
          where: { id: pkg.id },
          data: { sessionsReserved: { decrement: 1 } },
        });
        const updated = await tx.ptBooking.update({
          where: { id: bookingId },
          data: {
            status,
            holdKey: null,
            resolutionReason: reason,
            resolvedById: user.id,
            resolvedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action:
              status === BookingStatus.REJECTED
                ? 'REJECT_PT_BOOKING'
                : 'CANCEL_PT_BOOKING',
            entityType: 'PtBooking',
            entityId: bookingId,
            metadata: { reason },
          },
        });
        const recipients = [
          current.member.userId,
          current.slot.trainer.userId,
        ].filter((userId) => userId !== user.id);
        await this.notifications.notifyUsers(tx, recipients, {
          type:
            status === BookingStatus.REJECTED
              ? 'BOOKING_REJECTED'
              : 'BOOKING_CANCELLED',
          title:
            status === BookingStatus.REJECTED
              ? 'Yêu cầu đặt lịch bị từ chối'
              : 'Lịch PT đã bị hủy',
          message: reason,
          metadata: { bookingId },
        });
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async recordPtAttendanceCheckin(
    memberId: string,
    recordedById: string,
  ) {
    const checkedInAt = new Date();
    const latestStart = new Date(checkedInAt.getTime() + PT_CHECKIN_EARLY_MS);
    const earliestEnd = new Date(checkedInAt.getTime() - PT_CHECKIN_GRACE_MS);
    return this.prisma.$transaction(async (tx) => {
      const bookings = await tx.ptBooking.findMany({
        where: {
          memberId,
          status: BookingStatus.CONFIRMED,
          attendanceCheckedInAt: null,
          slot: {
            startsAt: { lte: latestStart },
            endsAt: { gte: earliestEnd },
          },
        },
        select: { id: true },
      });
      for (const booking of bookings) {
        const updated = await tx.ptBooking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.CONFIRMED,
            attendanceCheckedInAt: null,
          },
          data: { attendanceCheckedInAt: checkedInAt },
        });
        if (!updated.count) continue;
        await tx.auditLog.create({
          data: {
            actorId: recordedById,
            action: 'RECORD_PT_ATTENDANCE_CHECKIN',
            entityType: 'PtBooking',
            entityId: booking.id,
            metadata: { checkedInAt },
          },
        });
      }
      return bookings.length;
    });
  }

  async checkin(dto: CheckinDto, user: AuthUser) {
    const isStaff =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    if (!isStaff)
      throw new ApiError(
        'CHECKIN_STAFF_REQUIRED',
        'Chỉ Chủ phòng hoặc Lễ tân mới có thể ghi nhận check-in.',
        HttpStatus.FORBIDDEN,
      );
    const member = await this.prisma.memberProfile.findUnique({
      where: { memberCode: dto.memberCode },
      include: { user: true },
    });
    if (!member)
      throw new ApiError(
        'MEMBER_NOT_FOUND',
        'Không tìm thấy hội viên.',
        HttpStatus.NOT_FOUND,
      );
    if (member.user.status !== 'ACTIVE')
      throw new ApiError(
        'MEMBERSHIP_INELIGIBLE',
        'Tài khoản hội viên không hoạt động.',
      );
    const { start: startOfToday, end: startOfTomorrow } = appDayBounds();
    const result = await this.runCheckinTransaction(async (tx) => {
      const replayedCheckin = await tx.checkin.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { memberMembership: { include: { plan: true } } },
      });
      if (replayedCheckin) {
        if (replayedCheckin.memberId !== member.id)
          throw new ApiError(
            'CHECKIN_IDEMPOTENCY_CONFLICT',
            'Khóa xác nhận check-in đã được sử dụng.',
            HttpStatus.CONFLICT,
          );
        return {
          ...replayedCheckin,
          member: {
            memberCode: member.memberCode,
            fullName: member.user.fullName,
          },
          plan: replayedCheckin.memberMembership.plan.name,
          alreadyCheckedIn: false,
          replayed: true,
        };
      }

      const checkedInToday = await tx.checkin.findFirst({
        where: {
          memberId: member.id,
          checkedInAt: { gte: startOfToday, lt: startOfTomorrow },
        },
        include: { memberMembership: { include: { plan: true } } },
        orderBy: { checkedInAt: 'asc' },
      });
      if (checkedInToday)
        return {
          ...checkedInToday,
          member: {
            memberCode: member.memberCode,
            fullName: member.user.fullName,
          },
          plan: checkedInToday.memberMembership.plan.name,
          alreadyCheckedIn: true,
          replayed: false,
        };

      const now = new Date();
      const memberships = await tx.memberMembership.findMany({
        where: {
          memberId: member.id,
          isPaused: false,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      const eligibleMemberships = memberships
        .filter(
          (item) =>
            item.plan.type === MembershipType.DURATION ||
            item.visitsTotal === null ||
            item.visitsUsed < item.visitsTotal,
        )
        .sort((first, second) => {
          const typeDifference =
            Number(first.plan.type !== MembershipType.DURATION) -
            Number(second.plan.type !== MembershipType.DURATION);
          if (typeDifference) return typeDifference;
          return (
            (first.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (second.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
          );
        });
      const membership = dto.memberMembershipId
        ? eligibleMemberships.find((item) => item.id === dto.memberMembershipId)
        : eligibleMemberships[0];
      if (!membership)
        throw new ApiError(
          'MEMBERSHIP_INELIGIBLE',
          'Gói được chọn không đủ điều kiện check-in.',
        );
      const checkin = await tx.checkin.create({
        data: {
          memberId: member.id,
          memberMembershipId: membership.id,
          idempotencyKey: dto.idempotencyKey,
          recordedById: user.id,
        },
      });
      if (membership.visitsTotal !== null)
        await tx.memberMembership.update({
          where: { id: membership.id },
          data: { visitsUsed: { increment: 1 } },
        });
      return {
        ...checkin,
        member: {
          memberCode: member.memberCode,
          fullName: member.user.fullName,
        },
        plan: membership.plan.name,
        alreadyCheckedIn: false,
        replayed: false,
      };
    });

    await this.recordPtAttendanceCheckin(member.id, user.id);
    await this.reconcileEndedBookings();
    const todayPtAppointments = await this.listTodayPtAppointments(
      member.id,
      startOfToday,
      startOfTomorrow,
    );
    return { ...result, todayPtAppointments };
  }

  private async listTodayPtAppointments(
    memberId: string,
    startOfToday: Date,
    startOfTomorrow: Date,
  ) {
    const now = new Date();
    const bookings = await this.prisma.ptBooking.findMany({
      where: {
        memberId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CANCEL_REQUESTED,
            BookingStatus.AWAITING_COMPLETION,
          ],
        },
        slot: {
          startsAt: { gte: startOfToday, lt: startOfTomorrow },
        },
      },
      include: {
        slot: {
          include: {
            trainer: {
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
    });
    return bookings
      .sort(
        (first, second) =>
          first.slot.startsAt.getTime() - second.slot.startsAt.getTime(),
      )
      .map((booking) => ({
        id: booking.id,
        status: booking.status,
        startsAt: booking.slot.startsAt,
        endsAt: booking.slot.endsAt,
        attendanceCheckedInAt: booking.attendanceCheckedInAt,
        attendanceWindowOpen:
          booking.status === BookingStatus.CONFIRMED &&
          !booking.attendanceCheckedInAt &&
          now >= this.ptCheckinWindow(booking.slot).opensAt &&
          now <= this.ptCheckinWindow(booking.slot).closesAt,
        trainer: booking.slot.trainer.user,
      }));
  }

  private async runCheckinTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= CHECKIN_TRANSACTION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          operation,
          CHECKIN_TRANSACTION_OPTIONS,
        );
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034');
        if (!retryable || attempt === CHECKIN_TRANSACTION_MAX_ATTEMPTS)
          throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
    throw new Error('Check-in transaction retry loop ended unexpectedly.');
  }

  async checkinEligibility(memberCodeValue: string, user: AuthUser) {
    const isStaff =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    if (!isStaff)
      throw new ApiError(
        'CHECKIN_STAFF_REQUIRED',
        'Chỉ Chủ phòng hoặc Lễ tân mới có thể kiểm tra quyền lợi.',
        HttpStatus.FORBIDDEN,
      );
    const memberCode = memberCodeValue.trim().toUpperCase();
    const { start: startOfToday, end: startOfTomorrow } = appDayBounds();
    const member = await this.prisma.memberProfile.findUnique({
      where: { memberCode },
      include: {
        user: { select: { fullName: true, email: true, status: true } },
        memberships: {
          where: {
            isPaused: false,
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
          include: { plan: true },
        },
        checkins: {
          where: {
            checkedInAt: { gte: startOfToday, lt: startOfTomorrow },
          },
          include: { memberMembership: { include: { plan: true } } },
          orderBy: { checkedInAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!member)
      throw new ApiError(
        'MEMBER_NOT_FOUND',
        'Không tìm thấy hội viên.',
        HttpStatus.NOT_FOUND,
      );
    if (member.user.status !== 'ACTIVE')
      throw new ApiError(
        'MEMBERSHIP_INELIGIBLE',
        'Tài khoản hội viên không hoạt động.',
      );
    const checkedInToday = member.checkins[0];
    const memberships = member.memberships
      .filter(
        (item) =>
          item.plan.type === MembershipType.DURATION ||
          item.visitsTotal === null ||
          item.visitsUsed < item.visitsTotal,
      )
      .sort((first, second) => {
        const typeDifference =
          Number(first.plan.type !== MembershipType.DURATION) -
          Number(second.plan.type !== MembershipType.DURATION);
        if (typeDifference) return typeDifference;
        return (
          (first.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (second.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
        );
      });
    if (
      checkedInToday &&
      !memberships.some(
        (membership) => membership.id === checkedInToday.memberMembershipId,
      )
    )
      memberships.unshift(checkedInToday.memberMembership);
    const todayPtAppointments = await this.listTodayPtAppointments(
      member.id,
      startOfToday,
      startOfTomorrow,
    );
    return {
      member: {
        fullName: member.user.fullName,
        email: member.user.email,
        memberCode: member.memberCode,
      },
      memberships: memberships.map((membership) => ({
        id: membership.id,
        planName: membership.plan.name,
        type: membership.plan.type,
        startDate: membership.startDate,
        endDate: membership.endDate,
        visitsTotal: membership.visitsTotal,
        visitsUsed: membership.visitsUsed,
        remainingDays: membership.endDate
          ? Math.max(
              0,
              Math.ceil(
                (membership.endDate.getTime() - Date.now()) / 86_400_000,
              ),
            )
          : null,
      })),
      recommendedMembershipId:
        checkedInToday?.memberMembershipId ?? memberships[0]?.id ?? null,
      alreadyCheckedIn: Boolean(checkedInToday),
      eligibleForGymCheckin: memberships.length > 0,
      ineligibilityReason: memberships.length
        ? null
        : 'Hội viên không có gói Gym đang hiệu lực.',
      todayPtAppointments,
    };
  }

  listCheckins(user: AuthUser) {
    const where =
      user.memberProfileId &&
      !user.roles.includes(RoleCode.OWNER) &&
      !user.roles.includes(RoleCode.RECEPTIONIST)
        ? { memberId: user.memberProfileId }
        : {};
    return this.prisma.checkin.findMany({
      where,
      include: {
        member: { include: { user: { select: { fullName: true } } } },
        memberMembership: { include: { plan: true } },
      },
      orderBy: { checkedInAt: 'desc' },
      take: 100,
    });
  }
}
