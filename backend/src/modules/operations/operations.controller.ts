import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CheckinDto,
  CreateBookingDto,
  CreateSlotDto,
  UpdateBookingStatusDto,
} from './operations.dto.js';
import { OperationsService } from './operations.service.js';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly service: OperationsService) {}
  @Get('slots') slots() {
    return this.wrap(this.service.listSlots());
  }
  @Post('slots') createSlot(
    @Body() dto: CreateSlotDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(this.service.createSlot(dto, user), 'Đã mở khung giờ PT.');
  }
  @Patch('slots/:id/close') closeSlot(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(this.service.closeSlot(id, user), 'Đã đóng khung giờ PT.');
  }
  @Get('bookings') bookings(@CurrentUser() user: AuthUser) {
    return this.wrap(this.service.listBookings(user));
  }
  @Post('bookings') booking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.createBooking(dto, user),
      'Đặt lịch PT thành công.',
    );
  }
  @Patch('bookings/:id/status') updateBooking(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.updateBooking(id, dto.status, user),
      'Cập nhật lịch PT thành công.',
    );
  }
  @Get('checkins') checkins(@CurrentUser() user: AuthUser) {
    return this.wrap(this.service.listCheckins(user));
  }
  @Get('checkins/eligibility/:memberCode') checkinEligibility(
    @Param('memberCode') memberCode: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(this.service.checkinEligibility(memberCode, user));
  }
  @Post('checkins') checkin(
    @Body() dto: CheckinDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.checkin(dto, user),
      'Check-in thành công. Chúc bạn tập luyện hiệu quả!',
    );
  }
  private async wrap(data: unknown, message?: string) {
    return { success: true, data: await data, ...(message ? { message } : {}) };
  }
}
