import { HttpStatus, Injectable } from '@nestjs/common';
import { BookingStatus, MembershipType, RoleCode } from '@prisma/client';
import { ApiError } from '../../common/api-error.js';
import type { AuthUser } from '../../common/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CheckinDto,
  CreateBookingDto,
  CreateSlotDto,
} from './operations.dto.js';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  listSlots() {
    return this.prisma.ptSlot.findMany({
      where: { isOpen: true, startsAt: { gt: new Date() } },
      include: {
        trainer: { include: { user: { select: { fullName: true } } } },
        bookings: {
          where: {
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async closeSlot(id: string, user: AuthUser) {
    const slot = await this.prisma.ptSlot.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
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
        if (!slot || !slot.isOpen || slot.startsAt <= new Date())
          throw new ApiError(
            'BOOKING_SLOT_UNAVAILABLE',
            'Vui lòng chọn khung giờ còn khả dụng.',
          );
        const held = await tx.ptBooking.findFirst({
          where: {
            slotId: slot.id,
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
        });
        if (held)
          throw new ApiError(
            'BOOKING_SLOT_TAKEN',
            'Khung giờ này đã được đặt. Vui lòng chọn giờ khác.',
            HttpStatus.CONFLICT,
          );
        const pkg = await tx.memberPtPackage.findFirst({
          where: { id: dto.memberPtPackageId, memberId: memberProfileId },
        });
        if (
          !pkg ||
          pkg.sessionsUsed >= pkg.sessionsTotal ||
          (pkg.expiresAt && pkg.expiresAt < new Date())
        )
          throw new ApiError(
            'PT_SESSIONS_EXHAUSTED',
            'Số buổi PT còn lại không đủ.',
          );
        return tx.ptBooking.create({
          data: {
            slotId: slot.id,
            memberId: memberProfileId,
            memberPtPackageId: pkg.id,
            note: dto.note,
            holdKey: slot.id,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async listBookings(user: AuthUser) {
    const where = user.roles.includes(RoleCode.OWNER)
      ? {}
      : user.trainerProfileId
        ? { slot: { trainerId: user.trainerProfileId } }
        : user.memberProfileId
          ? { memberId: user.memberProfileId }
          : { id: '__none__' };
    return this.prisma.ptBooking.findMany({
      where,
      include: {
        slot: {
          include: {
            trainer: { include: { user: { select: { fullName: true } } } },
          },
        },
        member: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        memberPtPackage: { include: { package: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateBooking(id: string, next: BookingStatus, user: AuthUser) {
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
    if (next === BookingStatus.CANCELLED) {
      if (
        !ownsAsTrainer &&
        !ownsAsMember &&
        !user.roles.includes(RoleCode.OWNER)
      )
        throw new ApiError(
          'FORBIDDEN',
          'Bạn không có quyền xử lý lịch này.',
          HttpStatus.FORBIDDEN,
        );
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
      return this.prisma.ptBooking.update({
        where: { id },
        data: { status: next, holdKey: null },
      });
    }
    if (!ownsAsTrainer)
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền xử lý lịch này.',
        HttpStatus.FORBIDDEN,
      );
    if (
      next === BookingStatus.CONFIRMED &&
      booking.status === BookingStatus.PENDING
    ) {
      return this.prisma.ptBooking.update({
        where: { id },
        data: { status: next },
      });
    }
    if (
      next === BookingStatus.COMPLETED &&
      booking.status === BookingStatus.CONFIRMED
    ) {
      return this.prisma.$transaction(
        async (tx) => {
          const current = await tx.ptBooking.findUniqueOrThrow({
            where: { id },
          });
          if (current.status !== BookingStatus.CONFIRMED)
            throw new ApiError(
              'BOOKING_STATE_INVALID',
              'Buổi tập này không thể cập nhật trạng thái.',
            );
          const pkg = await tx.memberPtPackage.findUniqueOrThrow({
            where: { id: current.memberPtPackageId },
          });
          if (pkg.sessionsUsed >= pkg.sessionsTotal)
            throw new ApiError(
              'PT_SESSIONS_EXHAUSTED',
              'Số buổi PT còn lại không đủ.',
            );
          await tx.memberPtPackage.update({
            where: { id: pkg.id },
            data: { sessionsUsed: { increment: 1 } },
          });
          return tx.ptBooking.update({
            where: { id },
            data: { status: next, completedAt: new Date(), holdKey: null },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    }
    throw new ApiError(
      'BOOKING_STATE_INVALID',
      'Buổi tập này không thể cập nhật trạng thái.',
    );
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
    const existing = await this.prisma.checkin.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing)
      throw new ApiError(
        'CHECKIN_DUPLICATE',
        'Lượt check-in này đã được ghi nhận.',
        HttpStatus.CONFLICT,
      );
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const checkedInToday = await this.prisma.checkin.findFirst({
      where: {
        memberId: member.id,
        checkedInAt: { gte: startOfToday },
      },
    });
    if (checkedInToday)
      throw new ApiError(
        'CHECKIN_ALREADY_TODAY',
        'Hội viên này đã check-in trong ngày hôm nay.',
        HttpStatus.CONFLICT,
      );

    return this.prisma.$transaction(
      async (tx) => {
        const memberships = await tx.memberMembership.findMany({
          where: {
            memberId: member.id,
            isPaused: false,
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
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
          ? eligibleMemberships.find(
              (item) => item.id === dto.memberMembershipId,
            )
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
        };
      },
      { isolationLevel: 'Serializable' },
    );
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
    if (!memberships.length)
      throw new ApiError(
        'MEMBERSHIP_INELIGIBLE',
        'Hội viên không có gói Gym đang hiệu lực.',
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
      recommendedMembershipId: memberships[0].id,
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
