import type { RoleCode } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  memberProfileId?: string;
  trainerProfileId?: string;
}
