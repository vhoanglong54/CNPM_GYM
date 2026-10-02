import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../../common/auth.decorators.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CatalogService } from './catalog.service.js';
import {
  CreateMembershipPlanDto,
  CreatePtPackageDto,
  UpdateAvailabilityDto,
} from './catalog.dto.js';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @Get('memberships') membershipPlans(@Query('all') all?: string) {
    return this.wrap(this.service.listMemberships(all === 'true'));
  }
  @Get('pt-packages') ptPackages(@Query('all') all?: string) {
    return this.wrap(this.service.listPtPackages(all === 'true'));
  }
  @Post('memberships') @Roles(RoleCode.OWNER) createMembership(
    @Body() dto: CreateMembershipPlanDto,
  ) {
    return this.wrap(this.service.createMembership(dto), 'Đã tạo gói Gym.');
  }
  @Post('pt-packages') @Roles(RoleCode.OWNER) createPt(
    @Body() dto: CreatePtPackageDto,
  ) {
    return this.wrap(this.service.createPtPackage(dto), 'Đã tạo gói PT.');
  }
  @Patch('memberships/:id/availability')
  @Roles(RoleCode.OWNER)
  toggleMembership(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.wrap(this.service.toggleMembership(id, dto.isActive));
  }
  @Patch('pt-packages/:id/availability') @Roles(RoleCode.OWNER) togglePt(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.wrap(this.service.togglePtPackage(id, dto.isActive));
  }
  private async wrap(data: unknown, message?: string) {
    return { success: true, data: await data, ...(message ? { message } : {}) };
  }
}
