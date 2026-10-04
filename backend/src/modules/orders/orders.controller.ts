import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CreateOrderDto,
  PayOrderDto,
  RejectPaymentDto,
} from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.wrap(this.service.list(user));
  }
  @Post() create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.wrap(this.service.create(dto, user), 'Đã tạo đơn hàng.');
  }
  @Post(':id/pay') pay(
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.pay(id, dto, user),
      'Đã gửi yêu cầu thanh toán để Lễ tân/Chủ phòng xác nhận.',
    );
  }
  @Patch(':orderId/payments/:paymentId/confirm') confirmPayment(
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.confirmPayment(orderId, paymentId, user),
      'Đã xác nhận thanh toán và kích hoạt quyền lợi.',
    );
  }
  @Patch(':orderId/payments/:paymentId/reject') rejectPayment(
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(
      this.service.rejectPayment(orderId, paymentId, dto, user),
      'Đã từ chối yêu cầu xác nhận thanh toán.',
    );
  }
  @Patch(':id/cancel') cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.wrap(this.service.cancel(id, user), 'Đã hủy đơn hàng.');
  }
  @Get(':id/receipt') receipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    return this.service.streamReceipt(id, user, response);
  }
  private async wrap(data: unknown, message?: string) {
    return { success: true, data: await data, ...(message ? { message } : {}) };
  }
}
