import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  OrderStatus,
  PaymentStatus,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async ownerDashboard() {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);
    const [
      paid,
      activeMembers,
      activeMemberships,
      checkins,
      bookings,
      expiring,
      recentTransactions,
      pendingOrders,
    ] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        select: { amount: true, method: true },
      }),
      this.prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          roles: { some: { role: { code: RoleCode.MEMBER } } },
        },
      }),
      this.prisma.memberMembership.count({
        where: {
          isPaused: false,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      this.prisma.checkin.count(),
      this.prisma.ptBooking.count({
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      }),
      this.prisma.memberMembership.count({
        where: { endDate: { gte: now, lte: inSevenDays }, isPaused: false },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        include: {
          order: { include: { member: { select: { fullName: true } } } },
          receipt: true,
        },
        orderBy: { paidAt: 'desc' },
        take: 8,
      }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    ]);
    const revenueByMethod = paid.reduce<Record<string, number>>(
      (result, item) => {
        result[item.method] = (result[item.method] || 0) + Number(item.amount);
        return result;
      },
      {},
    );
    const totalRevenue = paid.reduce(
      (total, item) => total + Number(item.amount),
      0,
    );
    return {
      totalRevenue,
      revenueByMethod,
      activeMembers,
      activeMemberships,
      totalCheckins: checkins,
      activeBookings: bookings,
      expiringMemberships: expiring,
      pendingOrders,
      recentTransactions,
    };
  }
}
