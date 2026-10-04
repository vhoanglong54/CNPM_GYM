import { BookingStatus, RoleCode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OperationsService } from './operations.service.js';

describe('OperationsService cancellation', () => {
  it('chuyển hủy muộn của Hội viên thành yêu cầu chờ PT hoặc Chủ phòng duyệt', async () => {
    const update = vi.fn().mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.CANCEL_REQUESTED,
    });
    const notifyUsers = vi.fn().mockResolvedValue({ count: 2 });
    const transactionClient = {
      ptBooking: { update },
      trainerProfile: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ userId: 'trainer-user-1' }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 'owner-user-1' }]),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      ptBooking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          slotId: 'slot-1',
          memberId: 'member-1',
          status: BookingStatus.CONFIRMED,
          cancellationReason: null,
          slot: {
            trainerId: 'trainer-1',
            startsAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        }),
      },
      $transaction: vi.fn((callback) => callback(transactionClient)),
    };
    const service = new OperationsService(
      prisma as never,
      {
        notifyUsers,
      } as never,
    );

    const result = await service.updateBooking(
      'booking-1',
      { status: BookingStatus.CANCELLED, reason: 'Có việc gia đình đột xuất.' },
      {
        id: 'member-user-1',
        email: 'member@gym.local',
        fullName: 'Member Test',
        roles: [RoleCode.MEMBER],
        memberProfileId: 'member-1',
      },
    );

    expect(result).toMatchObject({ status: BookingStatus.CANCEL_REQUESTED });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.CANCEL_REQUESTED,
          cancellationRequestedById: 'member-user-1',
        }),
      }),
    );
    expect(notifyUsers).toHaveBeenCalledWith(
      transactionClient,
      ['trainer-user-1', 'owner-user-1'],
      expect.objectContaining({ type: 'BOOKING_CANCELLATION_REQUESTED' }),
    );
  });
});
