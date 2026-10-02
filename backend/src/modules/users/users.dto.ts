import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RoleCode, UserStatus } from '@prisma/client';

export class CreateStaffDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu khởi tạo phải có ít nhất 8 ký tự.' })
  password!: string;

  @IsEnum(RoleCode)
  role!: RoleCode;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  specialties?: string;
}

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  newPassword!: string;
}
