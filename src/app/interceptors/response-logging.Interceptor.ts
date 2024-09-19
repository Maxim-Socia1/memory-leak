import {CallHandler, ExecutionContext, Injectable, NestInterceptor} from "@nestjs/common";
import {catchError, Observable, tap} from "rxjs";
import {JaegerLoggerService} from "../../modules/jaeger-logger/jaeger-logger.service";

@Injectable()
export class ResponseLoggingInterceptor implements NestInterceptor {
    constructor(private readonly jaegerLoggerService: JaegerLoggerService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            tap(data => {
                this.jaegerLoggerService.tracer().startSpan('Response').log(data).finish();
            }),
            catchError((error) => {
                this.jaegerLoggerService.tracer().startSpan('Exception').log({error: error.toString()}).setTag('error', true).finish();
                this.jaegerLoggerService.tracer().startSpan('Response').log({error}).setTag('error', true).finish();
                throw error;
            }),
        );
    }
}