import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MonthlyRevenueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm báo cáo phải là số nguyên.' })
  @Min(2000, { message: 'Năm báo cáo phải từ 2000 trở đi.' })
  @Max(2100, { message: 'Năm báo cáo không được vượt quá 2100.' })
  year?: number;
}
