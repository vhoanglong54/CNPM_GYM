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
import { CurrentUser } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CheckinDto,
  CreateBookingDto,
  CreateSlotDto,
  ListSlotsQueryDto,
  UpdateBookingStatusDto,
} from './operations.dto.js';
import { OperationsService } from './operations.service.js';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly service: OperationsService) {}
  @Get('slots') slots(@Query() query: ListSlotsQueryDto) {
    return this.wrap(this.service.listSlots(query));
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
  @Patch('bookings/:id/status') async updateBooking(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.updateBooking(id, dto, user);
    const message =
      data.status === 'CANCEL_REQUESTED'
        ? 'Đã gửi yêu cầu hủy muộn đến PT và Chủ phòng.'
        : data.status === 'CANCELLED'
          ? 'Đã hủy lịch và hoàn lại buổi PT.'
          : data.status === 'CONFIRMED' &&
              data.resolutionReason?.startsWith('Yêu cầu hủy bị từ chối')
            ? 'Đã từ chối yêu cầu hủy và giữ nguyên lịch tập.'
            : 'Cập nhật lịch PT thành công.';
    return { success: true, data, message };
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
