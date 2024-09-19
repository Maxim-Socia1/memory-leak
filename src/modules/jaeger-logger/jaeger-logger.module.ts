import {Global, Module} from '@nestjs/common';
import {JaegerLoggerService} from './jaeger-logger.service';
@Global()
@Module({
  providers: [
      JaegerLoggerService
  ],
  exports: [JaegerLoggerService]
})
export class JaegerLoggerModule {}
