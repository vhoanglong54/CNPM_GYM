import { IsEnum, IsString } from 'class-validator';
import { PaymentMethod, ProductType } from '@prisma/client';

export class CreateOrderDto {
  @IsEnum(ProductType)
  productType!: ProductType;

  @IsString()
  productId!: string;
}

export class PayOrderDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
