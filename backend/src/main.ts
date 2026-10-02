import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { RequestHandler } from 'express';
import * as helmetModule from 'helmet';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

const helmet = helmetModule.default as unknown as () => RequestHandler;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const configuredOrigins = config
    .get('FRONTEND_URL', 'http://localhost:5173')
    .split(',')
    .map((origin: string) => origin.trim());
  const isDevelopment = config.get('NODE_ENV', 'development') !== 'production';
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || configuredOrigins.includes(origin))
        return callback(null, true);
      try {
        const url = new URL(origin);
        const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(
          url.hostname,
        );
        const isPrivateIpv4 =
          /^10\./.test(url.hostname) ||
          /^192\.168\./.test(url.hostname) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
        return callback(
          null,
          isDevelopment &&
            url.protocol === 'http:' &&
            url.port === '5173' &&
            (isLocalHost || isPrivateIpv4),
        );
      } catch {
        return callback(null, false);
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Titan Gym Management API')
    .setDescription(
      'REST API cho hệ thống quản lý phòng Gym – dữ liệu thanh toán hoàn toàn mô phỏng.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
