import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { randomInt } from 'crypto';
import { ApiError } from '../../common/api-error.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { LoginDto, RegisterDto, VerifyOtpDto } from './auth.dto.js';
import { MailService } from './mail.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async issueOtp(userId: string, email: string, fullName: string) {
    const expiresMinutes = Number(this.config.get('OTP_EXPIRES_MINUTES', 5));
    const useDevOtp =
      this.config.get('NODE_ENV') !== 'production' &&
      this.config.get('DEV_OTP_ENABLED', 'false') === 'true';
    const otp = useDevOtp
      ? this.config.get('DEV_OTP_CODE', '123456')
      : String(randomInt(100000, 1000000));
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: await hash(otp, 10),
        expiresAt: new Date(Date.now() + expiresMinutes * 60_000),
      },
    });
    await this.mail.sendOtp(email, fullName, otp);
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser && existingUser.status !== UserStatus.UNVERIFIED) {
      throw new ApiError(
        'EMAIL_ALREADY_EXISTS',
        'Email này đã được sử dụng.',
        HttpStatus.CONFLICT,
      );
    }

    if (existingUser) {
      const waitSeconds = Number(this.config.get('OTP_RESEND_SECONDS', 60));
      const latestToken = await this.prisma.emailVerificationToken.findFirst({
        where: { userId: existingUser.id, usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      const elapsedSeconds = latestToken
        ? Math.floor((Date.now() - latestToken.createdAt.getTime()) / 1000)
        : waitSeconds;
      const resendAfterSeconds = Math.max(0, waitSeconds - elapsedSeconds);
      const user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          passwordHash: await hash(dto.password, 12),
        },
      });

      if (resendAfterSeconds === 0) {
        await this.prisma.emailVerificationToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await this.issueOtp(user.id, user.email, user.fullName);
      }

      return {
        email: user.email,
        status: user.status,
        resendAfterSeconds:
          resendAfterSeconds === 0 ? waitSeconds : resendAfterSeconds,
        resumedRegistration: true,
      };
    }

    const role = await this.prisma.role.findUnique({
      where: { code: RoleCode.MEMBER },
    });
    if (!role)
      throw new ApiError(
        'SYSTEM_NOT_READY',
        'Hệ thống chưa được khởi tạo dữ liệu vai trò.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );

    const latestMember = await this.prisma.memberProfile.findFirst({
      orderBy: { memberCode: 'desc' },
      select: { memberCode: true },
    });
    const latestMemberNumber = Number(latestMember?.memberCode.slice(3)) || 0;
    const memberCode = `MB-${String(latestMemberNumber + 1).padStart(6, '0')}`;
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim(),
        passwordHash: await hash(dto.password, 12),
        roles: { create: { roleId: role.id } },
        memberProfile: { create: { memberCode } },
      },
    });
    await this.issueOtp(user.id, user.email, user.fullName);
    return {
      email: user.email,
      status: user.status,
      resendAfterSeconds: Number(this.config.get('OTP_RESEND_SECONDS', 60)),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    if (!user)
      throw new ApiError(
        'OTP_INVALID',
        'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      );
    const token = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !token ||
      token.expiresAt < new Date() ||
      token.attempts >= 5 ||
      !(await compare(dto.otp, token.tokenHash))
    ) {
      if (token)
        await this.prisma.emailVerificationToken.update({
          where: { id: token.id },
          data: { attempts: { increment: 1 } },
        });
      throw new ApiError(
        'OTP_INVALID',
        'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      }),
    ]);
    return { verified: true };
  }

  async resendOtp(emailValue: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(emailValue) },
    });
    if (!user || user.status !== UserStatus.UNVERIFIED) return { sent: true };
    const latest = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const waitSeconds = Number(this.config.get('OTP_RESEND_SECONDS', 60));
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < waitSeconds * 1000
    ) {
      throw new ApiError(
        'OTP_RESEND_TOO_SOON',
        `Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.issueOtp(user.id, user.email, user.fullName);
    return { sent: true, resendAfterSeconds: waitSeconds };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
      include: {
        roles: { include: { role: true } },
        memberProfile: true,
        trainerProfile: true,
      },
    });
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new ApiError(
        'INVALID_CREDENTIALS',
        'Email hoặc mật khẩu không đúng.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (user.status === UserStatus.UNVERIFIED)
      throw new ApiError(
        'EMAIL_NOT_VERIFIED',
        'Vui lòng xác thực email.',
        HttpStatus.FORBIDDEN,
      );
    if (user.status === UserStatus.INACTIVE)
      throw new ApiError(
        'ACCOUNT_INACTIVE',
        'Tài khoản đã bị khóa.',
        HttpStatus.FORBIDDEN,
      );
    const roles = user.roles.map((item) => item.role.code);
    const profile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      memberProfileId: user.memberProfile?.id,
      trainerProfileId: user.trainerProfile?.id,
    };
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, ...profile }),
      user: profile,
    };
  }
}
