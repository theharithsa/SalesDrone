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
  'delivered',
  'retried',
  'rejected',
  'processed',
  'ready',
  'failed',
  'sent',
  'created',
  'cancelled',
  'skipped',
  'duration.ms',
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
  const spanProcessor = new BatchSpanProcessor({
    exporter:
      exporters.traces ||
      new OTLPTraceExporter({
        url: origin + '/api/v2/otlp/v1/traces',
        headers,
        timeoutMillis,
      }),
    maxQueueSize: 512,
    maxExportBatchSize: 64,
    scheduledDelayMillis: 500,
    exportTimeoutMillis: 1500,
  });
  const logProcessor = new BatchLogRecordProcessor({
    exporter:
      exporters.logs ||
      new OTLPLogExporter({
        url: origin + '/api/v2/otlp/v1/logs',
        headers,
        timeoutMillis,
      }),
    maxQueueSize: 256,
    maxExportBatchSize: 64,
    scheduledDelayMillis: 500,
    exportTimeoutMillis: 1500,
  });
  const metricReader = new PeriodicExportingMetricReader({
    exporter:
      exporters.metrics ||
      new OTLPMetricExporter({
        url: origin + '/api/v2/otlp/v1/metrics',
        headers,
        timeoutMillis,
        temporalityPreference: AggregationTemporality.DELTA,
      }),
    exportIntervalMillis: 60000,
    exportTimeoutMillis: 1500,
    cardinalityLimits: { default: 256 },
    maxExportBatchSize: 256,
  });
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': service,
      'service.namespace': 'avinyatech',
      'service.version': APP_VERSION,
      'deployment.environment.name': environment,
      'build.commit': BUILD_COMMIT,
    }),
    autoDetectResources: false,
    contextManager: new AsyncLocalStorageContextManager(),
    textMapPropagator: new W3CTraceContextPropagator(),
    spanProcessors: [spanProcessor],
    logRecordProcessors: [logProcessor],
    metricReaders: [metricReader],
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
  let flushing;
  const self = {
    enabled: true,
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
          kind: /^(firestore\.|gemini\.|fcm\.)/.test(name)
            ? SpanKind.CLIENT
            : SpanKind.INTERNAL,
        },
        async (span) => {
          try {
            return await fn();
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
                  method = ['GET', 'POST', 'PATCH', 'DELETE'].includes(
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
                  };
                span.updateName(operation);
                span.setAttributes({
                  'http.route': route,
                  'http.response.status_code': status,
                  'actor.id': state.actorId,
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
        let timer;
        await Promise.race([
          Promise.allSettled([
            spanProcessor.forceFlush(),
            logProcessor.forceFlush(),
            metricReader.forceFlush(),
          ]),
          new Promise((resolve) => {
            timer = setTimeout(resolve, 2000);
          }),
        ]);
        clearTimeout(timer);
      })()
        .catch(() => {})
        .finally(() => {
          flushing = null;
        });
      return flushing;
    },
    async shutdown() {
      await sdk.shutdown();
      context.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
    },
  };
  return self;
}
