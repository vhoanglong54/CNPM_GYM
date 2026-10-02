import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../../common/auth.decorators.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.OWNER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('dashboard') async dashboard() {
    return { success: true, data: await this.service.ownerDashboard() };
  }
}
