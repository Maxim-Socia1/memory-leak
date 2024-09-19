import {Injectable, Scope} from '@nestjs/common';
import {initTracer, JaegerTracer} from "jaeger-client";
import {Span, SpanOptions} from "opentracing";
import {AsyncLocalStorage} from "async_hooks";

@Injectable({scope: Scope.TRANSIENT})
export class JaegerLoggerService {
    constructor(private readonly als?: AsyncLocalStorage<any>) {}
    tracer(): JGTracer {
        if (this.als && this.als.getStore() !== undefined && this.als.getStore()['tracer']){
            return this.als.getStore()['tracer'] as JGTracer;
        }
        const newJGTracer = new JGTracer();
        if (this.als && this.als.getStore() !== undefined){
            let store = this.als.getStore();
            store['tracer'] = newJGTracer;
            this.als.run(store, () => {});
        }else{
            setTimeout(()=> {
                console.log('Tracer Close');
                newJGTracer.close();
            }, 20000);
        }

        return newJGTracer;
    }
}
@Injectable({scope: Scope.TRANSIENT})
export class JGTracer {
    private readonly agentHost: string = process.env.LOGGER_HOST;
    private readonly serviceName: string = process.env.LOGGER_SERVICE_NAME;
    public activeTracer: JaegerTracer = null;
    public activeSpans: JGSpan[] = [];

    constructor() {
        this.activeTracer = this.init();
    }

    private init(): JaegerTracer {
        return this.initTracer();
    }

    startSpan(name: string, options: SpanOptions = {}) : JGSpan {
        if (options.childOf === undefined && this.activeSpans.length > 0){
            options.childOf = this.activeSpans[this.activeSpans.length - 1].activeSpan;
        }
        const span = new JGSpan(name, options, this);
        this.activeSpans.push(span);
        return span;
    }

    finishSpan(jgSpan : JGSpan){
        const filteredActiveSpans = this.activeSpans.filter((span) => span !== jgSpan);
        this.activeSpans = filteredActiveSpans;
    }

    inject(span: JGSpan, format: string, carrier: any): void {
        this.activeTracer.inject(span.activeSpan, format, carrier);
    }

    close() {
        this.activeTracer.close();
        this.activeTracer = null;
    }

    private initTracer(){
        if (this.activeTracer !== null) {
            return this.activeTracer;
        }

        const newTracer =  initTracer(
            {
                serviceName: this.serviceName,
                sampler: {
                    type: 'const',
                    param: 1,
                },
                reporter: {
                    agentHost: this.agentHost,
                    logSpans: true,
                },
            },
            {}
        );
        this.activeTracer = newTracer;
        return newTracer;

    }
}

@Injectable({scope: Scope.TRANSIENT})
class JGSpan {
    private activeTracer : JGTracer = null;
    public activeSpan: Span = null;

    constructor(name: string, options: SpanOptions = {}, tracer : JGTracer) {
        const span = tracer.activeTracer.startSpan(name, options);
        this.activeTracer = tracer;
        this.activeSpan = span;
    }

    log(keyValuePairs: { [key: string]: any }, timestamp?: number){
        keyValuePairs = this.truncateLongStrings(keyValuePairs, 5000);
        this.activeSpan.log(keyValuePairs, timestamp);
        keyValuePairs = null;
        return this;
    }

    setTag(key: string, value: any){
        this.activeSpan.setTag(key, value);
        return this;
    }


    finish() {
        this.activeSpan.finish();
        this.activeTracer.finishSpan(this);
        this.activeSpan = null;
    }

    // Удаляем строки большого размера, чтобы не сохранять их в jaeger
    truncateLongStrings(obj, maxLength, depth = 0) {
        if (depth > 20) {
            return '{...}';
        }

        let newObj = {};
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                if (obj[key].length > maxLength) {
                    newObj[key] = '{...}';
                } else {
                    newObj[key] = obj[key];
                }
            } else if (typeof obj[key] === 'object') {
                newObj[key] = this.truncateLongStrings(obj[key], maxLength, depth + 1);
            } else {
                newObj[key] = obj[key];
            }
        }
        return newObj;
    }
}
