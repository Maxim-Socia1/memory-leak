import { Injectable } from '@nestjs/common';
import { JaegerLoggerService } from './modules/jaeger-logger/jaeger-logger.service';

@Injectable()
export class AppService {
  constructor(
    private readonly jaegerLoggerService: JaegerLoggerService,
  ) {}
  async checkMemory() {
    const bytesToMb = (bytes: number) => Math.round(bytes / 1000) / 1000;
    setInterval(() => {
      console.clear();
      const usage = process.memoryUsage();
      const row = {
        rss: bytesToMb(usage.rss),
        heapTotal: bytesToMb(usage.heapTotal),
        heapUsed: bytesToMb(usage.heapUsed),
        external: bytesToMb(usage.external),
        stack: bytesToMb(usage.rss - usage.heapTotal),
      };
      console.table(row);
    }, 1000);

    return true;
  }

  async complexRequest() {
    const tracer = this.jaegerLoggerService.tracer();
    const mainSpanReq = tracer.startSpan('Генерация объекта');
    const largeObject = await this.createLargeObject(10);
    const response = {test: 'test', largeObject: largeObject};
    mainSpanReq.log(response)

    const mainSpanReq2 = tracer.startSpan('Генерация второго объекта');
    const largeObject2 = await this.createLargeObject(10);
    mainSpanReq2.log({test: 'test', largeObject2: largeObject2}).finish();
    
    mainSpanReq.finish();
    return largeObject;
  }

  async createLargeObject(size: number) {
    const largeObject = {};
    for (let i = 0; i < size; i++) {
      const key = `key${i}`;
      const value = 'x'.repeat(1024);
      largeObject[key] = value;
    }
    return largeObject;
  }
}
