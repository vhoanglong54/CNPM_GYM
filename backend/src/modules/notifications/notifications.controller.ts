import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.service.list(user) };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.service.markAllRead(user),
      message: 'Đã đọc tất cả thông báo.',
    };
  }

  @Patch(':id/read')
  async read(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.service.markRead(id, user),
    };
  }
}
