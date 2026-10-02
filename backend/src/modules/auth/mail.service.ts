import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(email: string, fullName: string, otp: string) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) {
      if (this.config.get('NODE_ENV') === 'production')
        throw new Error('SMTP chưa được cấu hình.');
      this.logger.warn(
        `SMTP chưa cấu hình; OTP development cho ${email}: ${otp}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure: this.config.get('SMTP_SECURE', 'false') === 'true',
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: this.config.get('SMTP_FROM', 'Titan Gym <no-reply@example.com>'),
      to: email,
      subject: 'Mã xác thực tài khoản Titan Gym',
      text: `Xin chào ${fullName}, mã OTP của bạn là ${otp}. Mã có hiệu lực trong ${this.config.get('OTP_EXPIRES_MINUTES', 5)} phút.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>TITAN GYM</h2><p>Xin chào <b>${fullName}</b>,</p><p>Mã xác thực tài khoản của bạn:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${otp}</p><p>Mã có hiệu lực trong ${this.config.get('OTP_EXPIRES_MINUTES', 5)} phút. Không chia sẻ mã này cho người khác.</p></div>`,
    });
  }
}
