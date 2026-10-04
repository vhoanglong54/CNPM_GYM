import { BookingStatus, MembershipType, RoleCode } from '@prisma/client';
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

describe('OperationsService PT completion attendance', () => {
  const trainerUser = {
    id: 'trainer-user-1',
    email: 'trainer@gym.local',
    fullName: 'Trainer Test',
    roles: [RoleCode.TRAINER],
    trainerProfileId: 'trainer-1',
  };

  function confirmedBooking() {
    return {
      id: 'booking-1',
      slotId: 'slot-1',
      memberId: 'member-1',
      memberPtPackageId: 'member-package-1',
      status: BookingStatus.CONFIRMED,
      slot: {
        trainerId: 'trainer-1',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    };
  }

  it('chặn hoàn thành khi Hội viên chưa check-in trước giờ PT', async () => {
    const booking = confirmedBooking();
    const prisma = {
      ptBooking: { findUnique: vi.fn().mockResolvedValue(booking) },
      checkin: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    };
    const service = new OperationsService(prisma as never, {} as never);

    await expect(
      service.updateBooking(
        booking.id,
        { status: BookingStatus.COMPLETED },
        trainerUser,
      ),
    ).rejects.toMatchObject({ errorCode: 'PT_COMPLETION_CHECKIN_REQUIRED' });
    expect(prisma.checkin.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: booking.memberId,
          checkedInAt: expect.objectContaining({
            lte: booking.slot.startsAt,
          }),
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cho PT hoàn thành khi Hội viên đã check-in trước giờ tập', async () => {
    const booking = confirmedBooking();
    const updatePackage = vi.fn().mockResolvedValue({});
    const updateBooking = vi.fn().mockResolvedValue({
      id: booking.id,
      status: BookingStatus.COMPLETED,
    });
    const notifyUsers = vi.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      ptBooking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(booking),
        update: updateBooking,
      },
      memberPtPackage: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: booking.memberPtPackageId,
          sessionsReserved: 1,
          sessionsUsed: 0,
          sessionsTotal: 10,
        }),
        update: updatePackage,
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      memberProfile: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ userId: 'member-user-1' }),
      },
    };
    const prisma = {
      ptBooking: { findUnique: vi.fn().mockResolvedValue(booking) },
      checkin: {
        findFirst: vi.fn().mockResolvedValue({ id: 'checkin-1' }),
      },
      $transaction: vi.fn((callback) => callback(transactionClient)),
    };
    const service = new OperationsService(
      prisma as never,
      { notifyUsers } as never,
    );

    const result = await service.updateBooking(
      booking.id,
      { status: BookingStatus.COMPLETED },
      trainerUser,
    );

    expect(result).toMatchObject({ status: BookingStatus.COMPLETED });
    expect(updatePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          sessionsUsed: { increment: 1 },
          sessionsReserved: { decrement: 1 },
        },
      }),
    );
    expect(updateBooking).toHaveBeenCalledOnce();
    expect(notifyUsers).toHaveBeenCalledWith(
      transactionClient,
      ['member-user-1'],
      expect.objectContaining({ type: 'BOOKING_COMPLETED' }),
    );
  });
});

describe('OperationsService check-in', () => {
  const staffUser = {
    id: 'reception-user-1',
    email: 'reception@gym.local',
    fullName: 'Reception Test',
    roles: [RoleCode.RECEPTIONIST],
  };
  const member = {
    id: 'member-1',
    memberCode: 'MB-000101',
    user: { fullName: 'Member Test', status: 'ACTIVE' },
  };
  const membership = {
    id: 'membership-1',
    memberId: 'member-1',
    planId: 'plan-1',
    orderItemId: 'order-item-1',
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    endDate: new Date('2026-11-01T00:00:00.000Z'),
    visitsTotal: null,
    visitsUsed: 0,
    isPaused: false,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    plan: { id: 'plan-1', name: 'Gym 1 Tháng', type: MembershipType.DURATION },
  };
  const appointment = {
    id: 'booking-1',
    status: BookingStatus.CONFIRMED,
    slot: {
      startsAt: new Date('2026-10-04T02:00:00.000Z'),
      endsAt: new Date('2026-10-04T03:00:00.000Z'),
      trainer: {
        user: { id: 'trainer-user-1', fullName: 'Trainer Test' },
      },
    },
  };

  function createService(transactionClient: Record<string, unknown>) {
    const prisma = {
      memberProfile: { findUnique: vi.fn().mockResolvedValue(member) },
      ptBooking: { findMany: vi.fn().mockResolvedValue([appointment]) },
      $transaction: vi.fn((callback) => callback(transactionClient)),
    };
    return {
      prisma,
      service: new OperationsService(prisma as never, {} as never),
    };
  }

  it('ghi một lượt mới và trả lịch PT trong ngày', async () => {
    const createdAt = new Date('2026-10-04T01:00:00.000Z');
    const transactionClient = {
      checkin: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'checkin-1',
          memberId: member.id,
          memberMembershipId: membership.id,
          idempotencyKey: 'checkin-key-1',
          checkedInAt: createdAt,
          recordedById: staffUser.id,
        }),
      },
      memberMembership: {
        findMany: vi.fn().mockResolvedValue([membership]),
        update: vi.fn(),
      },
    };
    const { service } = createService(transactionClient);

    const result = await service.checkin(
      {
        memberCode: member.memberCode,
        memberMembershipId: membership.id,
        idempotencyKey: 'checkin-key-1',
      },
      staffUser,
    );

    expect(result).toMatchObject({
      id: 'checkin-1',
      alreadyCheckedIn: false,
      replayed: false,
      plan: 'Gym 1 Tháng',
      todayPtAppointments: [
        {
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          trainer: { fullName: 'Trainer Test' },
        },
      ],
    });
    expect(transactionClient.checkin.create).toHaveBeenCalledOnce();
    expect(transactionClient.memberMembership.update).not.toHaveBeenCalled();
  });

  it('trả lượt đầu tiên khi quét lại trong ngày mà không ghi hoặc trừ thêm', async () => {
    const firstCheckin = {
      id: 'checkin-1',
      memberId: member.id,
      memberMembershipId: membership.id,
      idempotencyKey: 'first-key',
      checkedInAt: new Date('2026-10-04T01:00:00.000Z'),
      recordedById: staffUser.id,
      memberMembership: membership,
    };
    const transactionClient = {
      checkin: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(firstCheckin),
        create: vi.fn(),
      },
      memberMembership: { findMany: vi.fn(), update: vi.fn() },
    };
    const { service } = createService(transactionClient);

    const result = await service.checkin(
      {
        memberCode: member.memberCode,
        memberMembershipId: membership.id,
        idempotencyKey: 'repeat-key',
      },
      staffUser,
    );

    expect(result).toMatchObject({
      id: 'checkin-1',
      alreadyCheckedIn: true,
      replayed: false,
      todayPtAppointments: [{ id: 'booking-1' }],
    });
    expect(transactionClient.checkin.create).not.toHaveBeenCalled();
    expect(transactionClient.memberMembership.findMany).not.toHaveBeenCalled();
    expect(transactionClient.memberMembership.update).not.toHaveBeenCalled();
  });

  it('phát lại an toàn cùng một yêu cầu check-in', async () => {
    const originalCheckin = {
      id: 'checkin-1',
      memberId: member.id,
      memberMembershipId: membership.id,
      idempotencyKey: 'same-key',
      checkedInAt: new Date('2026-10-04T01:00:00.000Z'),
      recordedById: staffUser.id,
      memberMembership: membership,
    };
    const transactionClient = {
      checkin: {
        findUnique: vi.fn().mockResolvedValue(originalCheckin),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      memberMembership: { findMany: vi.fn(), update: vi.fn() },
    };
    const { service } = createService(transactionClient);

    const result = await service.checkin(
      {
        memberCode: member.memberCode,
        memberMembershipId: membership.id,
        idempotencyKey: 'same-key',
      },
      staffUser,
    );

    expect(result).toMatchObject({
      id: 'checkin-1',
      alreadyCheckedIn: false,
      replayed: true,
    });
    expect(transactionClient.checkin.findFirst).not.toHaveBeenCalled();
    expect(transactionClient.checkin.create).not.toHaveBeenCalled();
  });

  it('vẫn cho kiểm tra lượt check-in cũ khi gói theo lượt vừa hết', async () => {
    const depletedMembership = {
      ...membership,
      visitsTotal: 1,
      visitsUsed: 1,
      plan: { ...membership.plan, type: MembershipType.VISITS },
    };
    const prisma = {
      memberProfile: {
        findUnique: vi.fn().mockResolvedValue({
          ...member,
          user: {
            fullName: member.user.fullName,
            email: 'member@gym.local',
            status: 'ACTIVE',
          },
          memberships: [depletedMembership],
          checkins: [
            {
              memberMembershipId: depletedMembership.id,
              memberMembership: depletedMembership,
            },
          ],
        }),
      },
      ptBooking: { findMany: vi.fn().mockResolvedValue([appointment]) },
    };
    const service = new OperationsService(prisma as never, {} as never);

    const result = await service.checkinEligibility(
      member.memberCode,
      staffUser,
    );

    expect(result).toMatchObject({
      recommendedMembershipId: depletedMembership.id,
      alreadyCheckedIn: true,
      todayPtAppointments: [{ id: appointment.id }],
      memberships: [
        {
          id: depletedMembership.id,
          visitsTotal: 1,
          visitsUsed: 1,
        },
      ],
    });
  });

  it('vẫn trả nhắc lịch PT ngay khi quét dù không có gói Gym', async () => {
    const prisma = {
      memberProfile: {
        findUnique: vi.fn().mockResolvedValue({
          ...member,
          user: {
            fullName: member.user.fullName,
            email: 'member@gym.local',
            status: 'ACTIVE',
          },
          memberships: [],
          checkins: [],
        }),
      },
      ptBooking: { findMany: vi.fn().mockResolvedValue([appointment]) },
    };
    const service = new OperationsService(prisma as never, {} as never);

    const result = await service.checkinEligibility(
      member.memberCode,
      staffUser,
    );

    expect(result).toMatchObject({
      recommendedMembershipId: null,
      eligibleForGymCheckin: false,
      ineligibilityReason: 'Hội viên không có gói Gym đang hiệu lực.',
      todayPtAppointments: [{ id: appointment.id }],
    });
  });
});
