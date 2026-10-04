import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SaveStaffReviewDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reviews/staff')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get()
  @Roles(RoleCode.OWNER, RoleCode.MEMBER)
  list(@CurrentUser() user: AuthUser) {
    return this.wrap(this.service.listStaff(user));
  }

  @Get(':staffId')
  @Roles(RoleCode.OWNER, RoleCode.MEMBER)
  detail(@Param('staffId') staffId: string, @CurrentUser() user: AuthUser) {
    return this.wrap(this.service.detail(staffId, user));
  }

  @Post(':staffId')
  @Roles(RoleCode.MEMBER)
  save(
    @Param('staffId') staffId: string,
    @Body() dto: SaveStaffReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.save(staffId, dto, user),
      'Đã lưu đánh giá nhân viên.',
    );
  }

  private async wrap(data: unknown, message?: string) {
    return { success: true, data: await data, ...(message ? { message } : {}) };
  }
}
