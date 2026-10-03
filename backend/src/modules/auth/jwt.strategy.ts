import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../../common/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: AuthUser & { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: true } },
        memberProfile: { select: { id: true } },
        trainerProfile: { select: { id: true } },
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map((item) => item.role.code),
      memberProfileId: user.memberProfile?.id,
      trainerProfileId: user.trainerProfile?.id,
    };
  }
}
