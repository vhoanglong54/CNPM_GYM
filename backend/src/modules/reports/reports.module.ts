import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, RolesGuard],
})
export class ReportsModule {}
