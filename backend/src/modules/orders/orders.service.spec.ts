import {
  MembershipType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductType,
  RoleCode,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';

const staffUser = {
  id: 'receptionist-1',
  email: 'receptionist@gym.local',
  fullName: 'Lễ tân Test',
  roles: [RoleCode.RECEPTIONIST],
};

function pendingPayment() {
  return {
    id: 'payment-1',
    orderId: 'order-1',
    amount: 690_000,
    status: PaymentStatus.AWAITING_CONFIRMATION,
    expiresAt: new Date(Date.now() + 60_000),
    receipt: null,
    order: {
      id: 'order-1',
      memberId: 'member-user-1',
      orderNumber: 'ORD-TEST-1',
      status: OrderStatus.PENDING,
    },
  };
}

describe('OrdersService payment confirmation', () => {
  it('tự thử lại transaction khi database báo xung đột tạm thời', async () => {
    const transactionClient = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(pendingPayment()),
        update: vi.fn().mockResolvedValue({
          ...pendingPayment(),
          status: PaymentStatus.PAID,
          receipt: { id: 'receipt-1', receiptNumber: 'RCT-TEST-1' },
        }),
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.PENDING,
          member: { memberProfile: { id: 'member-profile-1' } },
          items: [
            {
              id: 'item-1',
              productType: ProductType.MEMBERSHIP,
              productId: 'plan-1',
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ status: OrderStatus.PAID }),
      },
      membershipPlan: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'plan-1',
          type: MembershipType.DURATION,
          durationDays: 30,
          visitLimit: null,
        }),
      },
      memberMembership: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const transientError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict.',
      { code: 'P2034', clientVersion: '6.12.0' },
    );
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockImplementationOnce((callback) => callback(transactionClient));
    const service = new OrdersService(
      {
        $transaction: transaction,
        payment: { findFirst: vi.fn() },
      } as never,
      {
        notifyUsers: vi.fn((tx) => tx.notification.createMany()),
      } as never,
    );

    const result = await service.confirmPayment(
      'order-1',
      'payment-1',
      staffUser,
    );

    expect(result).toMatchObject({
      orderId: 'order-1',
      status: OrderStatus.PAID,
      receipt: { id: 'receipt-1' },
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({ maxWait: 10_000, timeout: 20_000 }),
    );
    expect(transactionClient.memberMembership.create).toHaveBeenCalledOnce();
  });

  it('trả kết quả thành công khi cùng yêu cầu đã được xác nhận trước đó', async () => {
    const payment = {
      ...pendingPayment(),
      status: PaymentStatus.PAID,
      receipt: { id: 'receipt-1', receiptNumber: 'RCT-TEST-1' },
      order: {
        ...pendingPayment().order,
        status: OrderStatus.PAID,
      },
    };
    const transactionClient = {
      payment: { findFirst: vi.fn().mockResolvedValue(payment) },
    };
    const service = new OrdersService(
      {
        $transaction: vi.fn((callback) => callback(transactionClient)),
      } as never,
      {} as never,
    );

    const result = await service.confirmPayment(
      'order-1',
      'payment-1',
      staffUser,
    );

    expect(result).toMatchObject({
      status: OrderStatus.PAID,
      receipt: { id: 'receipt-1' },
    });
  });
});
