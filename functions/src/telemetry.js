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
const safeKeys = new Set([
  'audit.id',
  'settings.section',
  'settings.changed_count',
  'operation',
  'outcome',
  'error.type',
  'http.status_code',
  'request.id',
  'transaction.id',
  'operation.id',
  'actor.id',
  'event.id',
  'worker',
  'examined',
  'removed',
  'delivered',
  'retried',
  'rejected',
  'processed',
  'ready',
  'failed',
  'sent',
  'created',
  'cancelled',
  'blocked',
  'skipped',
  'duration.ms',
  'ci.check',
  'ci.case.id',
  'ci.run.id',
]);
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
const errorType = (e) =>
  /^[A-Z0-9_]{1,40}$/.test(e?.code || '') ? e.code : 'APPLICATION_ERROR';
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
    log(name, attributes = {}, failed = false) {
      try {
        const safe = Object.fromEntries(
          Object.entries(attributes).filter(
            ([k, v]) =>
              safeKeys.has(k) &&
              (typeof v === 'number' ||
                typeof v === 'boolean' ||
                (typeof v === 'string' && v.length <= 180)),
          ),
        );
        logger.emit({
          body: name,
          severityNumber: failed ? SeverityNumber.ERROR : SeverityNumber.INFO,
          severityText: failed ? 'ERROR' : 'INFO',
          attributes: safe,
          context: context.active(),
        });
      } catch {}
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
            return await fn(span);
          } catch (e) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.setAttribute('error.type', errorType(e));
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
              { traceparent: parent },
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
                    ...(req.ingressError ? {'error.type':req.ingressError} : {}),
                  };
                span.updateName(operation);
                span.setAttributes({
                  'http.route': route,
                  'http.response.status_code': status,
                  'actor.id': state.actorId,
                  ...(req.ingressError ? {'error.type':req.ingressError} : {}),
                });
                if (status >= 500)
                  span.setStatus({ code: SpanStatusCode.ERROR });
                requests.add(1, attrs);
                duration.record((performance.now() - start) / 1000, attrs);
                self.log(
                  'http.completed',
                  {
                    'request.id': requestId,
                    operation,
                    'actor.id': state.actorId,
                    'http.status_code': status,
                    outcome: status < 400 ? 'success' : 'failure',
                    ...(req.ingressError ? {'error.type':req.ingressError} : {}),
                  },
                  status >= 500,
                );
                span.end();
              });
            res.once('finish', finish);
            res.once('close', finish);
            next();
          },
        ),
      );
    },
    async worker(name, fn) {
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
              self.log('worker.completed', {
                worker: name,
                outcome: 'success',
                ...result,
              });
              workers.add(1, { worker: name, outcome: 'success' });
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
