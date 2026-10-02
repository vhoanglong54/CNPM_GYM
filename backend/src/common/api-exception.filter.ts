import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const payload = typeof body === 'object' && body !== null ? body : {};
    const messageValue = (payload as { message?: string | string[] }).message;
    const message = Array.isArray(messageValue)
      ? messageValue[0]
      : messageValue;

    response.status(status).json({
      success: false,
      errorCode:
        (payload as { errorCode?: string }).errorCode ||
        (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message:
        message ||
        (status === 500
          ? 'Đã có lỗi hệ thống. Vui lòng thử lại.'
          : 'Yêu cầu không hợp lệ.'),
    });
  }
}
