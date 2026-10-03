import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export enum SlotSort {
  SOONEST = 'SOONEST',
  RATING = 'RATING',
  REVIEW_COUNT = 'REVIEW_COUNT',
}

export class ListSlotsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(SlotSort) sort: SlotSort = SlotSort.SOONEST;
}

export class CreateTrainerReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class CheckinDto {
  @IsString() memberCode!: string;
  @IsOptional() @IsString() memberMembershipId?: string;
  @IsString() idempotencyKey!: string;
}
