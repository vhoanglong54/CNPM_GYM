import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  APP_TIME_ZONE,
  appDayBounds,
  appYear,
  appYearBounds,
} from '../../common/date-time.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async monthlyRevenue(year = appYear()) {
    const { start, end } = appYearBounds(year);
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: start, lt: end },
      },
      select: { amount: true, method: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });
    const monthFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIME_ZONE,
      month: 'numeric',
    });
    const months = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      label: `Tháng ${index + 1}`,
      amount: 0,
      count: 0,
      cash: 0,
      transfer: 0,
    }));

    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const month = Number(monthFormatter.format(payment.paidAt));
      const summary = months[month - 1];
      const amount = Number(payment.amount);
      summary.amount += amount;
      summary.count += 1;
      if (payment.method === PaymentMethod.CASH) summary.cash += amount;
      if (payment.method === PaymentMethod.TRANSFER_DEMO)
        summary.transfer += amount;
    }

    const totalRevenue = months.reduce(
      (total, month) => total + month.amount,
      0,
    );
    const bestMonth = totalRevenue
      ? months.reduce((best, month) =>
          month.amount > best.amount ? month : best,
        )
      : null;

    return {
      year,
      totalRevenue,
      totalTransactions: months.reduce(
        (total, month) => total + month.count,
        0,
      ),
      averageMonthlyRevenue: totalRevenue / 12,
      bestMonth: bestMonth
        ? { month: bestMonth.month, amount: bestMonth.amount }
        : null,
      months,
    };
  }

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
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.AWAITING_COMPLETION,
            ],
          },
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

  async operationsReport() {
    const { start, end } = appDayBounds();
    const now = new Date();
    const [
      awaitingPayments,
      paidPayments,
      todayCashPayments,
      bookingGroups,
      trainers,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.AWAITING_CONFIRMATION,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        select: {
          amount: true,
          method: true,
          confirmedBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PAID,
          method: 'CASH',
          paidAt: { gte: start, lt: end },
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          transactionCode: true,
          confirmedBy: { select: { fullName: true, email: true } },
          order: {
            select: {
              orderNumber: true,
              member: { select: { fullName: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),
      this.prisma.ptBooking.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.trainerProfile.findMany({
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              staffReviewsReceived: { select: { rating: true } },
            },
          },
          slots: {
            select: {
              bookings: { select: { status: true } },
            },
          },
        },
        orderBy: { user: { fullName: 'asc' } },
      }),
      this.prisma.auditLog.findMany({
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const revenueByMethod = paidPayments.reduce<Record<string, number>>(
      (totals, payment) => {
        totals[payment.method] =
          (totals[payment.method] ?? 0) + Number(payment.amount);
        return totals;
      },
      {},
    );
    const revenueByConfirmer = Object.values(
      paidPayments.reduce<
        Record<
          string,
          {
            id: string;
            fullName: string;
            email: string;
            amount: number;
            count: number;
          }
        >
      >((totals, payment) => {
        const confirmer = payment.confirmedBy;
        if (!confirmer) return totals;
        const current = totals[confirmer.id] ?? {
          ...confirmer,
          amount: 0,
          count: 0,
        };
        current.amount += Number(payment.amount);
        current.count += 1;
        totals[confirmer.id] = current;
        return totals;
      }, {}),
    ).sort((first, second) => second.amount - first.amount);
    const bookingStatusCounts = Object.fromEntries(
      bookingGroups.map((group) => [group.status, group._count.status]),
    );
    const trainerPerformance = trainers.map((trainer) => {
      const ratings = trainer.user.staffReviewsReceived.map(
        (review) => review.rating,
      );
      const bookings = trainer.slots.flatMap((slot) => slot.bookings);
      const countStatus = (status: BookingStatus) =>
        bookings.filter((booking) => booking.status === status).length;
      return {
        id: trainer.id,
        trainerCode: trainer.trainerCode,
        fullName: trainer.user.fullName,
        email: trainer.user.email,
        ratingAverage: ratings.length
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null,
        ratingCount: ratings.length,
        completed: countStatus(BookingStatus.COMPLETED),
        cancelled: countStatus(BookingStatus.CANCELLED),
        rejected: countStatus(BookingStatus.REJECTED),
        noShow: countStatus(BookingStatus.NO_SHOW),
      };
    });

    return {
      awaitingPayments,
      totalRevenue: paidPayments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      ),
      revenueByMethod,
      revenueByConfirmer,
      todayCash: {
        amount: todayCashPayments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ),
        count: todayCashPayments.length,
        transactions: todayCashPayments,
      },
      bookingStatusCounts,
      trainerPerformance,
      recentAuditLogs,
    };
  }
}
