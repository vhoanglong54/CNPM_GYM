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
import { CreateOrderDto, PayOrderDto } from './orders.dto.js';
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
      'Xác nhận thanh toán thành công.',
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
