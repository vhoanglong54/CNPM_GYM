import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  ChangePasswordDto,
  CreateStaffDto,
  UpdateProfileDto,
  UpdateStatusDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me/profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.wrap(this.service.profile(user.id));
  }

  @Patch('me/profile')
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.wrap(
      this.service.updateProfile(user.id, dto),
      'Cập nhật hồ sơ thành công.',
    );
  }

  @Post('me/change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.changePassword(
        user.id,
        dto.currentPassword,
        dto.newPassword,
      ),
      'Đổi mật khẩu thành công.',
    );
  }

  @Get('members')
  @Roles(RoleCode.OWNER, RoleCode.RECEPTIONIST)
  members() {
    return this.wrap(this.service.listMembers());
  }

  @Get('staff')
  @Roles(RoleCode.OWNER)
  staff() {
    return this.wrap(this.service.listStaff());
  }

  @Delete('members/:id')
  @Roles(RoleCode.OWNER)
  deleteMember(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.wrap(
      this.service.deleteMember(id, user),
      'Xóa tài khoản hội viên thành công.',
    );
  }

  @Post('staff')
  @Roles(RoleCode.OWNER)
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthUser) {
    return this.wrap(
      this.service.createStaff(dto, user),
      'Tạo tài khoản nhân sự thành công.',
    );
  }

  @Patch(':id/status')
  @Roles(RoleCode.OWNER)
  status(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.updateStatus(id, dto.status, user),
      'Cập nhật trạng thái thành công.',
    );
  }

  private async wrap(data: unknown, message?: string) {
    return { success: true, data: await data, ...(message ? { message } : {}) };
  }
}
