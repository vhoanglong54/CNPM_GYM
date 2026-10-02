import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@prisma/client';
import { ApiError } from './api-error.js';
import { ROLES_KEY } from './auth.decorators.js';
import type { AuthUser } from './auth.types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest<{ user: AuthUser }>().user;
    if (!user || !required.some((role) => user.roles.includes(role))) {
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền thực hiện thao tác này.',
        403,
      );
    }
    return true;
  }
}
