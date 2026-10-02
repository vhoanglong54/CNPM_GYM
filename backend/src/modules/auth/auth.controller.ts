import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth.decorators.js';
import type { AuthUser } from '../../common/auth.types.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import {
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  VerifyOtpDto,
} from './auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.service.register(dto);
    return {
      success: true,
      data,
      message: data.resumedRegistration
        ? 'Đã cập nhật đăng ký chưa xác thực. Vui lòng kiểm tra email để lấy OTP.'
        : 'Đăng ký thành công. Vui lòng kiểm tra email để lấy OTP.',
    };
  }

  @Post('verify-email')
  async verify(@Body() dto: VerifyOtpDto) {
    return {
      success: true,
      data: await this.service.verifyOtp(dto),
      message: 'Xác thực email thành công.',
    };
  }

  @Post('resend-otp')
  async resend(@Body() dto: ResendOtpDto) {
    return {
      success: true,
      data: await this.service.resendOtp(dto.email),
      message: 'Mã xác thực đã được gửi lại.',
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return { success: true, data: await this.service.login(dto) };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { success: true, data: user };
  }
}
