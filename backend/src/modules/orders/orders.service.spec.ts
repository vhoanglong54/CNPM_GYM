import {
  MembershipType,
  OrderStatus,
  PaymentMethod,
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

const memberUser = {
  id: 'member-user-1',
  email: 'member@gym.local',
  fullName: 'Hội viên Test',
  roles: [RoleCode.MEMBER],
  memberProfileId: 'member-profile-1',
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

function payableOrder() {
  return {
    id: 'order-1',
    memberId: memberUser.id,
    orderNumber: 'ORD-TEST-1',
    status: OrderStatus.PENDING,
    totalAmount: 690_000,
    items: [{ id: 'item-1' }],
    member: { memberProfile: { id: memberUser.memberProfileId } },
  };
}

describe('OrdersService payment request', () => {
  it('không cho nhân viên tự thu tiền khi Hội viên chưa xác nhận thanh toán', async () => {
    const transaction = vi.fn();
    const service = new OrdersService(
      {
        order: { findUnique: vi.fn().mockResolvedValue(payableOrder()) },
        $transaction: transaction,
      } as never,
      {} as never,
    );

    await expect(
      service.pay('order-1', { method: PaymentMethod.CASH }, staffUser),
    ).rejects.toMatchObject({
      errorCode: 'PAYMENT_MEMBER_CONFIRMATION_REQUIRED',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([PaymentMethod.TRANSFER_DEMO, PaymentMethod.CASH])(
    'chỉ tạo yêu cầu chờ duyệt khi Hội viên xác nhận bằng %s',
    async (method) => {
      const createdPayment = {
        id: 'payment-new',
        orderId: 'order-1',
        method,
        status: PaymentStatus.AWAITING_CONFIRMATION,
        amount: 690_000,
        expiresAt: new Date(Date.now() + 60_000),
      };
      const transactionClient = {
        payment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(createdPayment),
        },
        order: { findUniqueOrThrow: vi.fn().mockResolvedValue(payableOrder()) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      const notifyRoles = vi.fn().mockResolvedValue(undefined);
      const service = new OrdersService(
        {
          order: { findUnique: vi.fn().mockResolvedValue(payableOrder()) },
          $transaction: vi.fn((callback) => callback(transactionClient)),
        } as never,
        { notifyRoles } as never,
      );

      const result = await service.pay('order-1', { method }, memberUser);

      expect(result).toMatchObject({
        orderId: 'order-1',
        status: OrderStatus.PENDING,
        confirmationRequired: true,
        payment: {
          method,
          status: PaymentStatus.AWAITING_CONFIRMATION,
        },
      });
      expect(transactionClient.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method,
          status: PaymentStatus.AWAITING_CONFIRMATION,
        }),
      });
      expect(notifyRoles).toHaveBeenCalledOnce();
    },
  );
});

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

describe('OrdersService order idempotency', () => {
  it('trả lại cùng đơn khi trình duyệt gửi lặp khóa xác nhận mua', async () => {
    const existingOrder = {
      id: 'order-1',
      memberId: memberUser.id,
      status: OrderStatus.PENDING,
      items: [{ id: 'item-1' }],
    };
    const create = vi.fn();
    const service = new OrdersService(
      {
        order: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
          create,
        },
      } as never,
      {} as never,
    );

    const result = await service.create(
      {
        productType: ProductType.MEMBERSHIP,
        productId: 'plan-1',
        idempotencyKey: '4b9c5460-fb62-4a55-b58d-13bc75d53d50',
      },
      memberUser,
    );

    expect(result).toBe(existingOrder);
    expect(create).not.toHaveBeenCalled();
  });

  it('trả lại đơn vừa được request song song tạo trước khi unique constraint chặn request sau', async () => {
    const existingOrder = {
      id: 'order-1',
      memberId: memberUser.id,
      status: OrderStatus.PENDING,
      items: [{ id: 'item-1' }],
    };
    const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed.',
      { code: 'P2002', clientVersion: '6.12.0' },
    );
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'plan-1',
        name: 'Gym 1 Tháng',
        description: 'Tập không giới hạn',
        price: 690_000,
        isActive: true,
      })
      .mockResolvedValueOnce(existingOrder);
    const service = new OrdersService(
      {
        order: {
          findUnique,
          create: vi.fn().mockRejectedValue(duplicateKeyError),
        },
        membershipPlan: { findUnique },
      } as never,
      {} as never,
    );

    const result = await service.create(
      {
        productType: ProductType.MEMBERSHIP,
        productId: 'plan-1',
        idempotencyKey: '4b9c5460-fb62-4a55-b58d-13bc75d53d50',
      },
      memberUser,
    );

    expect(result).toBe(existingOrder);
  });

  it('coi yêu cầu hủy lặp là thành công nếu đơn đã được hủy', async () => {
    const cancelledOrder = {
      id: 'order-1',
      memberId: memberUser.id,
      status: OrderStatus.CANCELLED,
    };
    const transaction = vi.fn();
    const service = new OrdersService(
      {
        order: { findUnique: vi.fn().mockResolvedValue(cancelledOrder) },
        $transaction: transaction,
      } as never,
      {} as never,
    );

    const result = await service.cancel('order-1', memberUser);

    expect(result).toBe(cancelledOrder);
    expect(transaction).not.toHaveBeenCalled();
  });
});
