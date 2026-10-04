import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SaveStaffReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(3, { message: 'Nhận xét phải có ít nhất 3 ký tự.' })
  @MaxLength(1000)
  comment!: string;
}
