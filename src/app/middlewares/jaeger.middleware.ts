import {Injectable, NestMiddleware, Scope} from '@nestjs/common';
import {NextFunction, Request, Response} from 'express';
import {JaegerLoggerService, JGTracer} from "../../modules/jaeger-logger/jaeger-logger.service";
import {FORMAT_HTTP_HEADERS} from "opentracing";
import {AsyncLocalStorage} from "async_hooks";
import * as jwt from 'jsonwebtoken'

@Injectable({scope: Scope.REQUEST})
export class JaegerMiddleware implements NestMiddleware {
    private tracer : JGTracer = null;
    constructor(
        private readonly jaegerLoggerService : JaegerLoggerService,
        private readonly als: AsyncLocalStorage<any>
    ) {
        this.tracer = this.jaegerLoggerService.tracer();
    }

    public use(req: Request, res: Response, next: NextFunction): void {
        let statusReq = true;
        const operationName = `${req.method} ${req.baseUrl}`;

        let mainSpan = this.tracer.startSpan(operationName);

        this.tracer.inject(mainSpan, FORMAT_HTTP_HEADERS, req.headers);
        const ips = req?.headers['x-forwarded-for'] as string;
        const userIp = typeof ips === "string" ? ips.split(",")[0] : 'null';

        mainSpan.setTag('http.client_ip', userIp);

        mainSpan.log({
            ip: userIp,
            headers: req.headers,
            query: req.query,
            body: req.body,
        })

        let store = this.als.getStore();
        store['tracer'] = this.tracer;
        this.als.run(store, () => {});

        // Завершаем span после выполнения запроса
        res.on('finish', () => {
            try {
                mainSpan.finish();
                mainSpan = undefined;
                this.tracer.close();
                this.tracer = undefined;
            }catch (e) {
                console.error(e);
            } finally {
                store = null;
                this.als.enterWith(undefined);
            }
            statusReq = false;
        });

        res.on('close', async () => {
            if (statusReq === true){
                await new Promise(r => setTimeout(r, 10000));
                try {
                    mainSpan.finish();
                    mainSpan = undefined;
                    this.tracer.close();
                    this.tracer = undefined;
                }catch (e) {
                    console.error(e);
                } finally {
                    store = null;
                    this.als.enterWith(undefined);
                }
            }
        });

        next();
    }
}