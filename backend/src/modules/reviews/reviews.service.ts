import { HttpStatus, Injectable } from '@nestjs/common';
import { RoleCode, UserStatus } from '@prisma/client';
import { ApiError } from '../../common/api-error.js';
import type { AuthUser } from '../../common/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { SaveStaffReviewDto } from './reviews.dto.js';

const REVIEWABLE_ROLES = [RoleCode.RECEPTIONIST, RoleCode.TRAINER];

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listStaff(user: AuthUser) {
    const staff = await this.prisma.user.findMany({
      where: {
        ...(user.roles.includes(RoleCode.MEMBER)
          ? { status: UserStatus.ACTIVE }
          : {}),
        roles: { some: { role: { code: { in: REVIEWABLE_ROLES } } } },
      },
      select: {
        id: true,
        fullName: true,
        status: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
        trainerProfile: {
          select: {
            trainerCode: true,
            bio: true,
            specialties: true,
            yearsExperience: true,
          },
        },
        staffReviewsReceived: {
          select: { memberId: true, rating: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return staff.map(({ staffReviewsReceived, ...item }) => ({
      ...item,
      rating: this.ratingSummary(staffReviewsReceived),
      reviewedByCurrentMember: user.memberProfileId
        ? staffReviewsReceived.some(
            (review) => review.memberId === user.memberProfileId,
          )
        : false,
    }));
  }

  async detail(staffId: string, user: AuthUser) {
    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        roles: { some: { role: { code: { in: REVIEWABLE_ROLES } } } },
      },
      select: {
        id: true,
        fullName: true,
        status: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
        trainerProfile: {
          select: {
            trainerCode: true,
            bio: true,
            specialties: true,
            yearsExperience: true,
          },
        },
        staffReviewsReceived: {
          select: {
            id: true,
            memberId: true,
            rating: true,
            comment: true,
            createdAt: true,
            updatedAt: true,
            member: { select: { user: { select: { fullName: true } } } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!staff)
      throw new ApiError(
        'STAFF_NOT_FOUND',
        'Không tìm thấy nhân viên.',
        HttpStatus.NOT_FOUND,
      );
    if (
      user.roles.includes(RoleCode.MEMBER) &&
      staff.status !== UserStatus.ACTIVE
    )
      throw new ApiError(
        'STAFF_INACTIVE',
        'Nhân viên này hiện không còn làm việc.',
        HttpStatus.NOT_FOUND,
      );

    const { staffReviewsReceived, ...profile } = staff;
    return {
      ...profile,
      rating: this.ratingSummary(staffReviewsReceived),
      myReview: user.memberProfileId
        ? (staffReviewsReceived.find(
            (review) => review.memberId === user.memberProfileId,
          ) ?? null)
        : null,
      reviews: staffReviewsReceived.map(
        ({ memberId: _memberId, ...review }) => ({
          ...review,
          member: { fullName: review.member.user.fullName },
        }),
      ),
    };
  }

  async save(staffId: string, dto: SaveStaffReviewDto, user: AuthUser) {
    if (!user.memberProfileId)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Chỉ Hội viên mới có thể đánh giá nhân viên.',
        HttpStatus.FORBIDDEN,
      );
    const target = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: { in: REVIEWABLE_ROLES } } } },
      },
      select: { id: true, fullName: true },
    });
    if (!target)
      throw new ApiError(
        'STAFF_NOT_REVIEWABLE',
        'Chỉ có thể đánh giá Lễ tân hoặc PT đang làm việc.',
        HttpStatus.NOT_FOUND,
      );

    const memberId = user.memberProfileId;
    const existing = await this.prisma.staffReview.findUnique({
      where: { staffId_memberId: { staffId, memberId } },
      select: { id: true },
    });
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.staffReview.upsert({
        where: { staffId_memberId: { staffId, memberId } },
        create: {
          staffId,
          memberId,
          rating: dto.rating,
          comment: dto.comment.trim(),
        },
        update: { rating: dto.rating, comment: dto.comment.trim() },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: existing ? 'UPDATE_STAFF_REVIEW' : 'CREATE_STAFF_REVIEW',
          entityType: 'StaffReview',
          entityId: review.id,
          metadata: { staffId, rating: dto.rating },
        },
      });
      await this.notifications.notifyUsers(tx, [staffId], {
        type: 'STAFF_REVIEWED',
        title: existing
          ? 'Đánh giá của bạn được cập nhật'
          : 'Bạn có đánh giá mới',
        message: `Hội viên đã đánh giá ${dto.rating}/5 sao và để lại nhận xét.`,
        metadata: { reviewId: review.id },
      });
      return review;
    });
  }

  private ratingSummary(reviews: Array<{ rating: number }>) {
    return {
      average: reviews.length
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : null,
      count: reviews.length,
    };
  }
}
