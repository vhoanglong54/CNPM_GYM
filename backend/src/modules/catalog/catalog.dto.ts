import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { MembershipType } from '@prisma/client';

export class CreateMembershipPlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(MembershipType) type!: MembershipType;
  @IsNumber({}, { message: 'Giá gói tập phải là số.' })
  @Min(1, { message: 'Giá gói tập phải lớn hơn 0.' })
  price!: number;
  @ValidateIf(
    (value: CreateMembershipPlanDto) => value.type === MembershipType.DURATION,
  )
  @IsInt()
  @Min(1)
  durationDays?: number;
  @ValidateIf(
    (value: CreateMembershipPlanDto) => value.type === MembershipType.VISITS,
  )
  @IsInt()
  @Min(1)
  visitLimit?: number;
}

export class CreatePtPackageDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1) sessionCount!: number;
  @IsNumber() @Min(1, { message: 'Giá gói PT phải lớn hơn 0.' }) price!: number;
}

export class UpdateAvailabilityDto {
  @IsBoolean() isActive!: boolean;
}
