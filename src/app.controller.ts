import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
    this.appService.checkMemory().catch((e) => console.error(e));
  }

  @Get('complex-request')
  async complexRequest() {
    return await this.appService.complexRequest();
  }
}
