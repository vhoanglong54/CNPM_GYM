import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Vui lòng nhập họ tên.' })
  @Length(2, 100, { message: 'Họ tên phải từ 2 đến 100 ký tự.' })
  fullName!: string;

  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email!: string;

  @IsString()
  password!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'OTP phải gồm 6 chữ số.' })
  otp!: string;
}

export class ResendOtpDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email!: string;
}
