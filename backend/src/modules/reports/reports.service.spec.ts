import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service.js';

describe('ReportsService monthly revenue', () => {
  it('tổng hợp đúng doanh thu PAID theo từng tháng và phương thức', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        amount: '690000',
        method: PaymentMethod.CASH,
        paidAt: new Date('2026-01-15T03:00:00.000Z'),
      },
      {
        amount: '1790000',
        method: PaymentMethod.TRANSFER_DEMO,
        paidAt: new Date('2026-01-31T18:30:00.000Z'),
      },
      {
        amount: '990000',
        method: PaymentMethod.CASH,
        paidAt: new Date('2026-03-10T03:00:00.000Z'),
      },
    ]);
    const service = new ReportsService({ payment: { findMany } } as never);

    const result = await service.monthlyRevenue(2026);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: PaymentStatus.PAID,
          paidAt: {
            gte: new Date('2025-12-31T17:00:00.000Z'),
            lt: new Date('2026-12-31T17:00:00.000Z'),
          },
        },
      }),
    );
    expect(result).toMatchObject({
      year: 2026,
      totalRevenue: 3_470_000,
      totalTransactions: 3,
      averageMonthlyRevenue: 3_470_000 / 12,
      bestMonth: { month: 2, amount: 1_790_000 },
    });
    expect(result.months[0]).toMatchObject({
      amount: 690_000,
      count: 1,
      cash: 690_000,
      transfer: 0,
    });
    expect(result.months[1]).toMatchObject({
      amount: 1_790_000,
      count: 1,
      cash: 0,
      transfer: 1_790_000,
    });
    expect(result.months[2]).toMatchObject({
      amount: 990_000,
      count: 1,
      cash: 990_000,
      transfer: 0,
    });
  });

  it('trả đủ 12 tháng và không chọn tháng cao nhất khi chưa có doanh thu', async () => {
    const service = new ReportsService({
      payment: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);

    const result = await service.monthlyRevenue(2026);

    expect(result.months).toHaveLength(12);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalTransactions).toBe(0);
    expect(result.bestMonth).toBeNull();
  });
});
