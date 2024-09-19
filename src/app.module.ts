import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AsyncLocalStorage } from 'async_hooks';
import { JaegerMiddleware } from './app/middlewares/jaeger.middleware';
import { ResponseLoggingInterceptor } from './app/interceptors/response-logging.Interceptor';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AlsModule } from './modules/als/als.module';
import { JaegerLoggerModule } from './modules/jaeger-logger/jaeger-logger.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AlsModule,
    JaegerLoggerModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseLoggingInterceptor,
    }],
})
export class AppModule {
  constructor(private readonly als: AsyncLocalStorage<any>) {}
  configure(consumer: MiddlewareConsumer) {
    consumer.apply((req, res, next) => {this.als.run({}, () => next())}).forRoutes('*');
    consumer.apply(JaegerMiddleware).forRoutes('*');
  }
}
