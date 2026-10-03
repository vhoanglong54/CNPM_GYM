import { HttpStatus, Injectable } from '@nestjs/common';
import { type Prisma, RoleCode } from '@prisma/client';
import { ApiError } from '../../common/api-error.js';
import type { AuthUser } from '../../common/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);
    return { items, unreadCount };
  }

  async markRead(id: string, user: AuthUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!notification)
      throw new ApiError(
        'NOTIFICATION_NOT_FOUND',
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
      );
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  markAllRead(user: AuthUser) {
    return this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async notifyRoles(
    tx: Prisma.TransactionClient,
    roles: RoleCode[],
    input: NotificationInput,
  ) {
    const users = await tx.user.findMany({
      where: { roles: { some: { role: { code: { in: roles } } } } },
      select: { id: true },
    });
    return this.notifyUsers(
      tx,
      users.map((user) => user.id),
      input,
    );
  }

  notifyUsers(
    tx: Prisma.TransactionClient,
    userIds: string[],
    input: NotificationInput,
  ) {
    const uniqueUserIds = [...new Set(userIds)];
    if (!uniqueUserIds.length) return Promise.resolve({ count: 0 });
    return tx.notification.createMany({
      data: uniqueUserIds.map((userId) => ({ userId, ...input })),
    });
  }
}
