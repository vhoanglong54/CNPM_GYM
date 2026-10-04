import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentMethod, ProductType } from '@prisma/client';

export class CreateOrderDto {
  @IsEnum(ProductType)
  productType!: ProductType;

  @IsString()
  productId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Khóa xác nhận mua hàng không hợp lệ.' })
  idempotencyKey?: string;
}

export class PayOrderDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

export class RejectPaymentDto {
  @IsString()
  @MinLength(3, { message: 'Lý do từ chối phải có ít nhất 3 ký tự.' })
  @MaxLength(500, { message: 'Lý do từ chối không được quá 500 ký tự.' })
  reason!: string;
}
