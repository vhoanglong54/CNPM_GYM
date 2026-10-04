import { RoleCode, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReviewsService } from './reviews.service.js';

describe('ReviewsService', () => {
  it('cho phép Hội viên tạo hoặc cập nhật đúng một đánh giá cho nhân viên', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'review-1', rating: 5 });
    const createAudit = vi.fn().mockResolvedValue({});
    const notifyUsers = vi.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      staffReview: { upsert },
      auditLog: { create: createAudit },
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'staff-1',
          fullName: 'PT Test',
          status: UserStatus.ACTIVE,
        }),
      },
      staffReview: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((callback) => callback(transactionClient)),
    };
    const service = new ReviewsService(
      prisma as never,
      {
        notifyUsers,
      } as never,
    );

    await service.save(
      'staff-1',
      { rating: 5, comment: 'Hỗ trợ rất nhiệt tình.' },
      {
        id: 'member-user-1',
        email: 'member@gym.local',
        fullName: 'Member Test',
        roles: [RoleCode.MEMBER],
        memberProfileId: 'member-1',
      },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_memberId: { staffId: 'staff-1', memberId: 'member-1' },
        },
      }),
    );
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATE_STAFF_REVIEW' }),
      }),
    );
    expect(notifyUsers).toHaveBeenCalledWith(
      transactionClient,
      ['staff-1'],
      expect.objectContaining({ type: 'STAFF_REVIEWED' }),
    );
  });

  it('không cho đánh giá nhân viên đã nghỉ việc', async () => {
    const service = new ReviewsService(
      {
        user: { findFirst: vi.fn().mockResolvedValue(null) },
      } as never,
      {} as never,
    );

    await expect(
      service.save(
        'inactive-staff',
        { rating: 4, comment: 'Nhận xét hợp lệ.' },
        {
          id: 'member-user-1',
          email: 'member@gym.local',
          fullName: 'Member Test',
          roles: [RoleCode.MEMBER],
          memberProfileId: 'member-1',
        },
      ),
    ).rejects.toMatchObject({ errorCode: 'STAFF_NOT_REVIEWABLE' });
  });
});
