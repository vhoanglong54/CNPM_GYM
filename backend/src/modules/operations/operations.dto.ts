import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class CreateSlotDto {
  @IsDateString({}, { message: 'Thời gian bắt đầu không hợp lệ.' })
  startsAt!: string;
  @IsDateString({}, { message: 'Thời gian kết thúc không hợp lệ.' })
  endsAt!: string;
}

export class CreateBookingDto {
  @IsString() slotId!: string;
  @IsString() memberPtPackageId!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus) status!: BookingStatus;
}

export class CheckinDto {
  @IsString() memberCode!: string;
  @IsOptional() @IsString() memberMembershipId?: string;
  @IsString() idempotencyKey!: string;
}
