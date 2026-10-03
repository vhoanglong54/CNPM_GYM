import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
