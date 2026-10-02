import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller()
export class AppController {
  @Get()
  health() {
    return {
      success: true,
      data: { service: 'Titan Gym API', status: 'ok', timestamp: new Date() },
    };
  }
}
