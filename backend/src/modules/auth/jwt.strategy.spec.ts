import { UnauthorizedException } from '@nestjs/common';
import { RoleCode, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy.js';

const config = {
  getOrThrow: () => 'test-secret-at-least-32-characters',
};

describe('JwtStrategy', () => {
  it('nạp lại trạng thái và quyền hiện tại của tài khoản', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'trainer@gym.local',
      fullName: 'PT Test',
      status: UserStatus.ACTIVE,
      roles: [{ role: { code: RoleCode.TRAINER } }],
      memberProfile: null,
      trainerProfile: { id: 'trainer-1' },
    });
    const strategy = new JwtStrategy(config as never, {
      user: { findUnique },
    } as never);

    const result = await strategy.validate({
      sub: 'user-1',
      id: 'stale-id',
      email: 'stale@gym.local',
      fullName: 'Stale',
      roles: [RoleCode.OWNER],
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'trainer@gym.local',
      fullName: 'PT Test',
      roles: [RoleCode.TRAINER],
      memberProfileId: undefined,
      trainerProfileId: 'trainer-1',
    });
  });

  it('từ chối JWT cũ ngay khi nhân viên đã nghỉ việc', async () => {
    const strategy = new JwtStrategy(config as never, {
      user: {
        findUnique: vi.fn().mockResolvedValue({ status: UserStatus.INACTIVE }),
      },
    } as never);

    await expect(
      strategy.validate({
        sub: 'user-2',
        id: 'user-2',
        email: 'former@gym.local',
        fullName: 'Former Staff',
        roles: [RoleCode.RECEPTIONIST],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
