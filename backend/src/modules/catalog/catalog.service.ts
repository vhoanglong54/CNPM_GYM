import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiError } from '../../common/api-error.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateMembershipPlanDto,
  CreatePtPackageDto,
} from './catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}
  listMemberships(all = false) {
    return this.prisma.membershipPlan.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { price: 'asc' },
    });
  }
  listPtPackages(all = false) {
    return this.prisma.ptPackage.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { price: 'asc' },
    });
  }
  createMembership(dto: CreateMembershipPlanDto) {
    return this.prisma.membershipPlan.create({ data: dto });
  }
  createPtPackage(dto: CreatePtPackageDto) {
    return this.prisma.ptPackage.create({ data: dto });
  }
  async toggleMembership(id: string, isActive: boolean) {
    const value = await this.prisma.membershipPlan
      .update({ where: { id }, data: { isActive } })
      .catch(() => null);
    if (!value)
      throw new ApiError(
        'PLAN_NOT_FOUND',
        'Không tìm thấy gói tập.',
        HttpStatus.NOT_FOUND,
      );
    return value;
  }
  async togglePtPackage(id: string, isActive: boolean) {
    const value = await this.prisma.ptPackage
      .update({ where: { id }, data: { isActive } })
      .catch(() => null);
    if (!value)
      throw new ApiError(
        'PLAN_NOT_FOUND',
        'Không tìm thấy gói PT.',
        HttpStatus.NOT_FOUND,
      );
    return value;
  }
}
