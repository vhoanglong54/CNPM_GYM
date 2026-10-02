import { HttpStatus, Injectable } from '@nestjs/common';
import { RoleCode, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { ApiError } from '../../common/api-error.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthUser } from '../../common/auth.types.js';
import type { CreateStaffDto, UpdateProfileDto } from './users.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
        memberProfile: {
          include: {
            memberships: {
              include: { plan: true },
              orderBy: { createdAt: 'desc' },
            },
            ptPackages: {
              include: { package: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        trainerProfile: true,
      },
    });
    if (!user)
      throw new ApiError(
        'USER_NOT_FOUND',
        'Không tìm thấy tài khoản.',
        HttpStatus.NOT_FOUND,
      );
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberProfile: true },
    });
    if (!user)
      throw new ApiError(
        'USER_NOT_FOUND',
        'Không tìm thấy tài khoản.',
        HttpStatus.NOT_FOUND,
      );
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
      },
    });
    if (
      user.memberProfile &&
      (dto.address !== undefined || dto.dateOfBirth !== undefined)
    ) {
      await this.prisma.memberProfile.update({
        where: { id: user.memberProfile.id },
        data: {
          ...(dto.address !== undefined
            ? { address: dto.address.trim() || null }
            : {}),
          ...(dto.dateOfBirth !== undefined
            ? {
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
              }
            : {}),
        },
      });
    }
    return this.profile(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await compare(currentPassword, user.passwordHash)))
      throw new ApiError(
        'CURRENT_PASSWORD_INVALID',
        'Mật khẩu hiện tại không đúng.',
      );
    if (await compare(newPassword, user.passwordHash))
      throw new ApiError(
        'PASSWORD_UNCHANGED',
        'Mật khẩu mới phải khác mật khẩu hiện tại.',
      );
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(newPassword, 12) },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'CHANGE_PASSWORD',
        entityType: 'User',
        entityId: userId,
      },
    });
    return { changed: true };
  }

  listMembers() {
    return this.prisma.user.findMany({
      where: { roles: { some: { role: { code: RoleCode.MEMBER } } } },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        memberProfile: {
          include: {
            memberships: { include: { plan: true } },
            ptPackages: { include: { package: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listStaff() {
    return this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: {
                in: [RoleCode.OWNER, RoleCode.RECEPTIONIST, RoleCode.TRAINER],
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
        trainerProfile: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async deleteMember(id: string, actor: AuthUser) {
    if (id === actor.id)
      throw new ApiError(
        'CANNOT_DELETE_SELF',
        'Không thể tự xóa tài khoản đang đăng nhập.',
      );

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        memberProfile: {
          include: {
            _count: {
              select: {
                memberships: true,
                ptPackages: true,
                bookings: true,
                checkins: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            confirmedPayments: true,
            auditLogs: true,
          },
        },
      },
    });
    const isMember = user?.roles.some(
      (item) => item.role.code === RoleCode.MEMBER,
    );
    if (!user || !isMember || !user.memberProfile)
      throw new ApiError(
        'MEMBER_NOT_FOUND',
        'Không tìm thấy tài khoản hội viên.',
        HttpStatus.NOT_FOUND,
      );

    const historyCount =
      user._count.orders +
      user._count.confirmedPayments +
      user._count.auditLogs +
      user.memberProfile._count.memberships +
      user.memberProfile._count.ptPackages +
      user.memberProfile._count.bookings +
      user.memberProfile._count.checkins;
    if (historyCount > 0)
      throw new ApiError(
        'MEMBER_HAS_HISTORY',
        'Không thể xóa tài khoản đã có giao dịch hoặc lịch sử sử dụng. Hãy khóa tài khoản để bảo toàn dữ liệu.',
        HttpStatus.CONFLICT,
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.memberProfile.delete({
        where: { id: user.memberProfile!.id },
      });
      await tx.user.delete({ where: { id: user.id } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DELETE_MEMBER',
          entityType: 'User',
          entityId: user.id,
          metadata: { email: user.email },
        },
      });
      return { id: user.id, email: user.email, deleted: true };
    });
  }

  async createStaff(dto: CreateStaffDto, actor: AuthUser) {
    if (dto.role !== RoleCode.RECEPTIONIST && dto.role !== RoleCode.TRAINER) {
      throw new ApiError(
        'INVALID_STAFF_ROLE',
        'Owner chỉ có thể tạo tài khoản Lễ tân hoặc Trainer.',
      );
    }
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ApiError(
        'EMAIL_ALREADY_EXISTS',
        'Email này đã được sử dụng.',
        HttpStatus.CONFLICT,
      );
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { code: dto.role },
    });
    const trainerCount =
      dto.role === RoleCode.TRAINER
        ? await this.prisma.trainerProfile.count()
        : 0;
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim(),
          passwordHash: await hash(dto.password, 12),
          status: UserStatus.ACTIVE,
          roles: { create: { roleId: role.id } },
          ...(dto.role === RoleCode.TRAINER
            ? {
                trainerProfile: {
                  create: {
                    trainerCode: `PT-${String(trainerCount + 1).padStart(5, '0')}`,
                    specialties: dto.specialties,
                  },
                },
              }
            : {}),
        },
        select: { id: true, email: true, fullName: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'CREATE_STAFF',
          entityType: 'User',
          entityId: user.id,
          metadata: { role: dto.role },
        },
      });
      return user;
    });
  }

  async updateStatus(id: string, status: UserStatus, actor: AuthUser) {
    if (id === actor.id && status === UserStatus.INACTIVE)
      throw new ApiError(
        'CANNOT_DISABLE_SELF',
        'Không thể tự khóa tài khoản đang đăng nhập.',
      );
    const user = await this.prisma.user
      .update({
        where: { id },
        data: { status },
        select: { id: true, email: true, status: true },
      })
      .catch(() => null);
    if (!user)
      throw new ApiError(
        'USER_NOT_FOUND',
        'Không tìm thấy tài khoản.',
        HttpStatus.NOT_FOUND,
      );
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'UPDATE_USER_STATUS',
        entityType: 'User',
        entityId: id,
        metadata: { status },
      },
    });
    return user;
  }
}
