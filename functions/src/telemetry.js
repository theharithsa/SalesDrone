import { errorType, dependencyErrorType, policyRejection, WORK_STATS, COLLECTIONS, OPERATIONS, WORKERS, LOG_EVENTS, safeLogFields } from './observability-contract.js';
import { CI_CHECKS, CI_STATUSES } from './ci-contract.js';
import { performance } from 'node:perf_hooks';
import { monitorExporter, boundedFlush } from './telemetry-health.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, createHash } from 'node:crypto';
import {
  context,
  trace,
  metrics,
  logs,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  SeverityNumber,
  isSpanContextValid,
} from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { APP_VERSION, BUILD_COMMIT } from './version.js';
import { tenantOrigin } from './telemetry-outbox.js';
export const actorId = (uid) =>
  'user:' +
  createHash('sha256')
    .update('salesdrone:' + uid)
    .digest('hex')
    .slice(0, 32);
export function validParent(value) {
  return typeof value === 'string' &&
    /^00-(?!0{32}-)[a-f0-9]{32}-(?!0{16}-)[a-f0-9]{16}-[a-f0-9]{2}$/.test(value)
    ? value
    : null;
}
// Propagator validates W3C format/limits. Vendor trace state is forwarded only as
// trace context, never copied into logs, metrics or business payloads.
export function incomingTraceHeaders(headers) {
  const parent=validParent(headers.traceparent);
  if(!parent)return {};
  const carrier={traceparent:parent,...(typeof headers.tracestate==='string'?{tracestate:headers.tracestate}:{})};
  const extracted=new W3CTraceContextPropagator().extract(ROOT_CONTEXT,carrier,{keys:o=>Object.keys(o),get:(o,k)=>o[k]});
  const state=trace.getSpanContext(extracted)?.traceState?.serialize();
  return {traceparent:parent,...(state?{tracestate:state}:{})};
}
// Explicit instrumentation: initialized once before a function handles business work.
// No automatic HTTP hooks are installed, so exporter requests cannot recurse.
export function createTelemetry({
  tenant,
  key,
  service = 'salesdrone-api',
  environment = 'production',
  allowLocalTest = false,
  exporters = {},
}) {
  const origin = tenantOrigin(tenant, { allowLocalTest }),
    headers = { Authorization: 'Api-Token ' + key },
    timeoutMillis = 1500;
  const health = Object.fromEntries(
    ['traces', 'logs', 'metrics'].map((s) => [s, { success: 0, failure: 0 }]),
  );
  const observed = (signal, exporter) =>
    monitorExporter(exporter, signal, health, () => {
      // Use the platform log for failure of the exporter itself; never export its error text.
      console.warn(
        JSON.stringify({ event: 'telemetry.export.failed', signal }),
      );
    });
  const resource = resourceFromAttributes({
    'service.name': service,
    'service.namespace': 'avinyatech',
    'service.version': APP_VERSION,
    'deployment.environment.name': environment,
    'build.commit': BUILD_COMMIT,
    'service.instance.id': randomUUID(),
    ...(process.env.K_SERVICE ? { 'cloud.provider':'gcp', 'cloud.platform':'gcp_cloud_run', 'cloud.region':'asia-south1', 'faas.name':process.env.K_SERVICE, 'faas.version':process.env.K_REVISION || 'unknown' } : {}),
  });
  const metricReader = new PeriodicExportingMetricReader({
    exporter: observed(
      'metrics',
      exporters.metrics ||
        new OTLPMetricExporter({
          url: origin + '/api/v2/otlp/v1/metrics',
          headers,
          timeoutMillis,
          temporalityPreference: AggregationTemporality.DELTA,
        }),
    ),
    exportIntervalMillis: 60000,
    exportTimeoutMillis: 1500,
    cardinalityLimits: { default: 256 },
    maxExportBatchSize: 256,
  });
  const meterProvider = new MeterProvider({
    resource,
    readers: [metricReader],
  });
  metrics.setGlobalMeterProvider(meterProvider);
  const spanProcessor = new BatchSpanProcessor({
    exporter: observed(
      'traces',
      exporters.traces ||
        new OTLPTraceExporter({
          url: origin + '/api/v2/otlp/v1/traces',
          headers,
          timeoutMillis,
        }),
    ),
    selfObsMeterProvider: meterProvider,
    maxQueueSize: 512,
    maxExportBatchSize: 64,
    scheduledDelayMillis: 500,
    exportTimeoutMillis: 1500,
  });
  const logProcessor = new BatchLogRecordProcessor({
    exporter: observed(
      'logs',
      exporters.logs ||
        new OTLPLogExporter({
          url: origin + '/api/v2/otlp/v1/logs',
          headers,
          timeoutMillis,
        }),
    ),
    selfObsMeterProvider: meterProvider,
    maxQueueSize: 256,
    maxExportBatchSize: 64,
    scheduledDelayMillis: 500,
    exportTimeoutMillis: 1500,
  });
  const sdk = new NodeSDK({
    resource,
    autoDetectResources: false,
    contextManager: new AsyncLocalStorageContextManager(),
    textMapPropagator: new W3CTraceContextPropagator(),
    spanProcessors: [spanProcessor],
    logRecordProcessors: [logProcessor],
    metricReaders: [],
    instrumentations: [],
  });
  sdk.start();
  const tracer = trace.getTracer('salesdrone', APP_VERSION),
    logger = logs.getLogger('salesdrone', APP_VERSION),
    meter = metrics.getMeter('salesdrone', APP_VERSION),
    scope = new AsyncLocalStorage(),
    propagator = new W3CTraceContextPropagator();
  const requests = meter.createCounter('salesdrone.http.requests', {
      description: 'Completed server HTTP attempts',
    }),
    duration = meter.createHistogram('salesdrone.http.duration', {
      unit: 's',
      description: 'Server request duration',
      advice: {
        explicitBucketBoundaries: [
          0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60,
        ],
      },
    }),
    workers = meter.createCounter('salesdrone.worker.runs'),
    businessDeliveries = meter.createCounter('salesdrone.bizevents.delivery', {
      description:
        'Finalized outbox delivery attempts, not unique business outcomes',
      unit: '{attempt}',
    });
  const flushes = meter.createCounter('salesdrone.telemetry.flushes', {
    unit: '{flush}',
  });
  const memory = meter.createObservableGauge('salesdrone.runtime.memory', {
    unit: 'By',
  });
  memory.addCallback((result) => {
    const usage = process.memoryUsage();
    for (const kind of ['rss', 'heapUsed', 'heapTotal', 'external'])
      result.observe(usage[kind], { kind });
  });
  meter
    .createObservableCounter('salesdrone.runtime.cpu', { unit: 's' })
    .addCallback((result) => {
      const cpu = process.cpuUsage();
      for (const mode of ['user', 'system'])
        result.observe(cpu[mode] / 1e6, { mode });
    });
  let previousLoop = performance.eventLoopUtilization();
  meter
    .createObservableGauge('salesdrone.runtime.event_loop_utilization', {
      unit: '1',
    })
    .addCallback((result) => {
      const current = performance.eventLoopUtilization();
      result.observe(
        performance.eventLoopUtilization(current, previousLoop).utilization,
      );
      previousLoop = current;
    });
  const exportsMetric = meter.createObservableCounter(
    'salesdrone.telemetry.exports',
    { unit: '{batch}' },
  );
  exportsMetric.addCallback((result) => {
    for (const signal of ['traces', 'logs', 'metrics'])
      for (const outcome of ['success', 'failure'])
        result.observe(health[signal][outcome], { signal, outcome });
  });
  let outboxSnapshot = null;
  meter
    .createObservableGauge('salesdrone.outbox.records', { unit: '{record}' })
    .addCallback((result) => {
      if (outboxSnapshot)
        for (const state of ['Pending', 'Sending', 'Rejected'])
          result.observe(outboxSnapshot.counts[state], { state });
    });
  meter
    .createObservableGauge('salesdrone.outbox.oldest_due_age', { unit: 's' })
    .addCallback((result) => {
      if (outboxSnapshot) result.observe(outboxSnapshot.age);
    });
  const ciResults = meter.createCounter('salesdrone.ci.results', {
    unit: '{result}',
  });
  const ciDuration = meter.createHistogram('salesdrone.ci.duration', {
    unit: 's',
  });
  const researchOperations=meter.createCounter('salesdrone.research.operations',{unit:'{operation}'});
  const researchDuration=meter.createHistogram('salesdrone.research.duration',{unit:'s'});
  const dbOperations = meter.createCounter('salesdrone.db.operations');
  const dbDuration = meter.createHistogram('salesdrone.db.duration', {unit:'s'});
  const workerItems = meter.createCounter('salesdrone.worker.items', {unit:'{item}'});
  const queueDepth = new Map();
  meter.createObservableGauge('salesdrone.queue.backlog',{unit:'{item}'}).addCallback(result=>{
    for(const [queue,value] of queueDepth) result.observe(value.count,{queue});
  });
  meter.createObservableGauge('salesdrone.queue.oldest_due_age',{unit:'s'}).addCallback(result=>{
    for(const [queue,value] of queueDepth) if(value.age!==null) result.observe(value.age,{queue});
  });
  const jobLag=meter.createHistogram('salesdrone.worker.lag',{unit:'s'});
  const droppedLogs=meter.createCounter('salesdrone.telemetry.dropped',{unit:'{record}'});
  let flushing;
  const self = {
    enabled: true,
    diagnostics: () => structuredClone(health),
    researchOperation(kind,outcome,seconds) {
      if(!['plan','themes','embedding','batch'].includes(kind)||!['success','failure'].includes(outcome)||!Number.isFinite(seconds)||seconds<0)return;
      try {researchOperations.add(1,{kind,outcome});researchDuration.record(seconds,{kind,outcome});} catch {}
    },
    outboxHealth(counts, age) {
      if (
        ['Pending', 'Sending', 'Rejected'].every(
          (s) => Number.isFinite(counts[s]) && counts[s] >= 0,
        ) &&
        Number.isFinite(age)
      )
        outboxSnapshot = { counts, age: Math.max(0, age) };
    },
    quality(check, outcome, durationMs, caseId, runId) {
      if (!CI_CHECKS.includes(check) || !CI_STATUSES.includes(outcome)) return;
      const attributes = { check, outcome, kind: caseId ? 'case' : 'check' };
      ciResults.add(1, attributes);
      if (Number.isFinite(durationMs) && durationMs >= 0)
        ciDuration.record(durationMs / 1000, attributes);
      self.log('ci.result', {
        'ci.check': check,
        outcome,
        'duration.ms': durationMs,
        ...(caseId ? { 'ci.case.id': caseId } : {}),
        'ci.run.id': runId,
      });
    },
    capture() {
      const s = scope.getStore() || {};
      const c = trace.getActiveSpan()?.spanContext();
      return {
        serviceName:service,environmentName:environment,
        ...(c?.traceState?.serialize()?{tracestate:c.traceState.serialize()}:{}),
        actorId: s.actorId || 'system',
        requestId: s.requestId || '',
        operationId: s.operationId || '',
        operation: s.operation || 'background',
        traceparent:
          c && isSpanContextValid(c)
            ? `00-${c.traceId}-${c.spanId}-${c.traceFlags & 1 ? '01' : '00'}`
            : null,
      };
    },
    businessDelivery(outcome, status) {
      if (!['delivered', 'retried', 'rejected'].includes(outcome)) return;
      businessDeliveries.add(1, {
        outcome,
        'http.status_class':
          status >= 100 && status < 600
            ? Math.floor(status / 100) + 'xx'
            : 'network',
      });
    },
    identify(uid) {
      const s = scope.getStore();
      if (s) s.actorId = actorId(uid);
      trace.getActiveSpan()?.setAttribute('actor.id', actorId(uid));
    },
    operation(value) {
      const s = scope.getStore();
      if (s) s.operation = value;
    },
    stage(stage, attributes = {}) {
      self.log('operation.stage', {...attributes, 'operation.stage':stage});
    },
    failure(error, attributes = {}) {
      trace.getActiveSpan()?.setAttribute('error.type',errorType(error));
      self.log('operation.failed', {...attributes,'error.type':errorType(error)}, 'ERROR');
    },
    log(name, attributes = {}, severity = 'INFO') {
      try {
        if(!LOG_EVENTS.has(name)) {droppedLogs.add(1,{reason:'event'});return;}
        const level=severity===true?'ERROR':severity===false?'INFO':severity;
        if(!['DEBUG','INFO','WARN','ERROR'].includes(level)) return;
        const debugUntil=Date.parse(process.env.TELEMETRY_DEBUG_UNTIL||'');
        if(level==='DEBUG'&&!(debugUntil>Date.now()&&debugUntil-Date.now()<=900000)) return;
        const state=scope.getStore();
        const {fields:safe,dropped}=safeLogFields({...attributes,...(state?{
          'request.id':state.requestId,'operation.id':state.operationId,
          'actor.id':attributes['actor.id']||state.actorId,operation:state.operation,
          ...(state.transactionId?{'transaction.id':state.transactionId}:{}),
        }:{} )});
        if(dropped) droppedLogs.add(dropped,{reason:'attribute'});
        if(Buffer.byteLength(JSON.stringify(safe))>8192){droppedLogs.add(1,{reason:'size'});return;}
        const active=context.active(), span=trace.getSpanContext(active);
        logger.emit({body:name, severityNumber:SeverityNumber[level],severityText:level,attributes:{'event.name':name,...safe},context:active});
        // A single source-owned record goes to the platform sink and OTLP; never forward
        // these platform copies into Dynatrace a second time.
        const project=process.env.GCLOUD_PROJECT;
        const record={event:name,level,severity:level,'service.name':service,'service.namespace':'avinyatech','service.version':APP_VERSION,'build.commit':BUILD_COMMIT,'deployment.environment.name':environment,...safe,...(span&&isSpanContextValid(span)?{trace_id:span.traceId,span_id:span.spanId,...(project&&/^[a-z][a-z0-9-]{4,62}$/.test(project)?{'logging.googleapis.com/trace':'projects/'+project+'/traces/'+span.traceId,'logging.googleapis.com/spanId':span.spanId,'logging.googleapis.com/trace_sampled':!!(span.traceFlags&1)}:{})}:{})};
        const write=level==='ERROR'?console.error:level==='WARN'?console.warn:console.info;
        write(JSON.stringify(record));
      } catch {droppedLogs.add(1,{reason:'logger'});}
    },
    async database(operation, collection, fn) {
      const op=OPERATIONS.has(operation)?operation:'get';
      const name=COLLECTIONS.has(collection)?collection:'other';
      const started=performance.now(); let outcome='success';
      try {return await self.span('firestore.'+op,async span=>{
        const value=await fn(span);
        if(Array.isArray(value)) span.setAttribute('db.query.result_count',value.length);
        return value;
      },{'db.system.name':'gcp.firestore','db.operation.name':op,'db.collection.name':name});}
      catch(error){outcome=op==='transaction'&&policyRejection(error)?'rejected':'failure';throw error;}
      finally{const attrs={operation:op,collection:name,outcome};dbOperations.add(1,attrs);dbDuration.record((performance.now()-started)/1000,{operation:op,collection:name});}
    },
    async transaction(id, fn) {
      return scope.run({...scope.getStore(),transactionId:id},()=>self.database('transaction','multiple',fn));
    },
    queueHealth(queue,count,oldestAt) {
      if(!['reminders','analysis','scoring','research'].includes(queue)||!Number.isFinite(count))return;
      const timestamp=Date.parse(oldestAt);
      queueDepth.set(queue,{count:Math.max(0,count),age:Number.isFinite(timestamp)?Math.max(0,(Date.now()-timestamp)/1000):count===0?0:null});
    },
    workItem(worker,outcome,dueAt) {
      if(!WORKERS.has(worker)||!WORK_STATS.includes(outcome))return;
      workerItems.add(1,{worker,outcome});
      const at=Date.parse(dueAt);if(Number.isFinite(at))jobLag.record(Math.max(0,(Date.now()-at)/1000),{worker});
    },
    workSummary(worker,stats) {
      if(!WORKERS.has(worker))return;
      for(const key of WORK_STATS)if(key!=='claimed'&&Number.isFinite(stats[key])&&stats[key]>0)workerItems.add(stats[key],{worker,outcome:key});
    },
    async span(name, fn, attributes = {}, linkedParent) {
      let links = [];
      if (validParent(linkedParent)) {
        const c = propagator.extract(
          ROOT_CONTEXT,
          { traceparent: linkedParent },
          { keys: (o) => Object.keys(o), get: (o, k) => o[k] },
        );
        const parent = trace.getSpanContext(c);
        if (parent) links = [{ context: parent }];
      }
      return tracer.startActiveSpan(
        name,
        {
          attributes,
          links,
          kind: /^(firestore\.|gemini\.|fcm\.|api\.forward$)/.test(name)
            ? SpanKind.CLIENT
            : SpanKind.INTERNAL,
        },
        async (span) => {
          try {
            if(name.startsWith('fcm.'))span.setAttributes({'messaging.system':'gcp.fcm','messaging.operation.name':'send','server.address':'fcm.googleapis.com'});
            return await fn(span);
          } catch (e) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.setAttribute('error.type', dependencyErrorType(e));
            const rejected=name==='firestore.transaction'&&policyRejection(e);
            self.log(rejected?'operation.failed':'dependency.failed',{'dependency.name':name,'error.type':dependencyErrorType(e)},rejected?'WARN':'ERROR');
            throw e;
          } finally {
            span.end();
          }
        },
      );
    },
    http(req, res, next) {
      const parent = validParent(req.headers.traceparent),
        parentContext = parent
          ? propagator.extract(
              ROOT_CONTEXT,
              incomingTraceHeaders(req.headers),
              { keys: (o) => Object.keys(o), get: (o, k) => o[k] },
            )
          : ROOT_CONTEXT;
      const requestId = req.requestId || randomUUID(),
        idempotency = req.headers['idempotency-key'];
      const state = {
        requestId,
        operationId:
          typeof idempotency === 'string' &&
          /^[a-f0-9-]{36}$/i.test(idempotency)
            ? idempotency
            : requestId,
        actorId: 'anonymous',
        operation: 'unmatched',
      };
      return scope.run(state, () =>
        tracer.startActiveSpan(
          'HTTP request',
          {
            kind: SpanKind.SERVER,
            attributes: {
              'http.request.method': [
                'GET',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
              ].includes(req.method)
                ? req.method
                : 'OTHER',
              'request.id': requestId,
            },
          },
          parentContext,
          (span) => {
            const start = performance.now(),
              active = context.active();
            let done = false;
            const finish = () =>
              context.with(active, () => {
                if (done) return;
                done = true;
                const route = req.route?.path || 'unmatched',
                  method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(
                    req.method,
                  )
                    ? req.method
                    : 'OTHER',
                  status = res.statusCode || 499,
                  operation =
                    typeof route === 'string' && route.startsWith('/')
                      ? method + ' ' + route
                      : 'unmatched',
                  attrs = {
                    operation,
                    'http.request.method': method,
                    'http.response.status_code': status,
                    ...(req.telemetryErrorType||req.ingressError ? {'error.type':req.telemetryErrorType||req.ingressError} : {}),
                  };
                state.operation=operation;
                span.updateName(operation);
                span.setAttributes({
                  'http.route': route,
                  'http.response.status_code': status,
                  'actor.id': state.actorId,
                  ...(req.telemetryErrorType||req.ingressError ? {'error.type':req.telemetryErrorType||req.ingressError} : {}),
                });
                if (status >= 500)
                  span.setStatus({ code: SpanStatusCode.ERROR });
                requests.add(1, {...attrs,'error.type':req.telemetryErrorType||req.ingressError||'none'});
                const {'error.type':_errorType,...latencyAttrs}=attrs;
                duration.record((performance.now() - start) / 1000, latencyAttrs);
                self.log(
                  'http.completed',
                  {
                    'request.id': requestId,
                    operation,
                    'actor.id': state.actorId,
                    'http.status_code': status,
                    outcome: status < 400 ? 'success' : 'failure',
                    ...(req.telemetryErrorType||req.ingressError ? {'error.type':req.telemetryErrorType||req.ingressError} : {}),
                  },
                  status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO',
                );
                span.end();
              });
            self.log('http.received',{'request.has_body':Number(req.headers['content-length'])>0,'request.size':Math.max(0,Math.min(12582913,Number(req.headers['content-length'])||0)),'correlation.has_parent':!!parent});
            res.once('finish', finish);
            res.once('close', finish);
            next();
          },
        ),
      );
    },
    async worker(name, fn) {
      name=WORKERS.has(name)?name:'other';
      const requestId = randomUUID();
      return scope.run(
        {
          requestId,
          operationId: requestId,
          actorId: 'system',
          operation: 'worker.' + name,
        },
        () =>
          self.span('worker.' + name, async () => {
            try {
              const result = await fn();
              self.workSummary(name,result||{});
              const activeWork=WORK_STATS.some(key=>Number(result?.[key])>0);
              self.log('worker.completed', {
                worker: name,
                outcome:result?.failed>0?'partial_failure':'success',
                ...result,
              }, result?.failed>0?'WARN':activeWork?'INFO':'DEBUG');
              workers.add(1, { worker: name, outcome:result?.failed>0?'partial_failure':'success' });
              return result;
            } catch (e) {
              self.log(
                'worker.failed',
                {
                  worker: name,
                  outcome: 'failure',
                  'error.type': errorType(e),
                },
                true,
              );
              workers.add(1, { worker: name, outcome: 'failure' });
              throw e;
            }
          }),
      );
    },
    async flush() {
      if (flushing) return flushing;
      flushing = (async () => {
        const result = await boundedFlush([
          spanProcessor,
          logProcessor,
          metricReader,
        ]);
        flushes.add(1, { outcome: result.outcome });
        if (result.outcome !== 'success')
          console.warn(
            JSON.stringify({ event: 'telemetry.flush.' + result.outcome }),
          );
        return result;
      })()
        .catch(() => {})
        .finally(() => {
          flushing = null;
        });
      return flushing;
    },
    async shutdown() {
      await sdk.shutdown();
      await meterProvider.shutdown();
      context.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
    },
  };
  return self;
}
