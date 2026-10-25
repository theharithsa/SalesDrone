import { APP_VERSION } from '../src/version.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import protobuf from 'protobufjs';
import request from 'supertest';
import { createTelemetry, actorId, validParent } from '../src/telemetry.js';
import { observableStore } from '../src/observable-store.js';
import { deliverTelemetry, tenantOrigin } from '../src/telemetry-outbox.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { createApp } from '../src/app.js';
const attr = (values) =>
  Object.fromEntries(
    values.map((a) => {
      const key = Object.keys(a.value).find((k) =>
        ['stringValue', 'intValue', 'doubleValue', 'boolValue'].includes(k),
      );
      const value = a.value[key];
      return [a.key, value?.toNumber?.() ?? value];
    }),
  );
test('independent protobuf receiver verifies concurrent request traces, correlated logs, delta metrics, commit events and resilient export', async () => {
  const schemas = protobuf.parse(
    await readFile(
      new URL('./fixtures/otlp-subset.proto', import.meta.url),
      'utf8',
    ),
  ).root;
  const received = [],
    biz = [];
  let rejectExport = false;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    if (req.url === '/api/v2/bizevents/ingest') {
      assert.equal(req.headers['content-type'], 'application/cloudevent+json');
      biz.push(JSON.parse(raw));
      res.writeHead(202);
      res.end();
      return;
    }
    const name = req.url.endsWith('traces')
      ? 'ExportTraceServiceRequest'
      : req.url.endsWith('logs')
        ? 'ExportLogsServiceRequest'
        : 'ExportMetricsServiceRequest';
    received.push({
      path: req.url,
      header: req.headers['content-type'],
      authorization: req.headers.authorization,
      decoded: schemas.lookupType('wire.' + name).decode(raw),
    });
    res.writeHead(rejectExport ? 503 : 200, {
      'Content-Type': 'application/x-protobuf',
    });
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const tenant = 'http://127.0.0.1:' + server.address().port,
    t = createTelemetry({
      tenant,
      key: 'synthetic-credential',
      service: 'salesdrone-test',
      environment: 'test',
      allowLocalTest: true,
    });
  try {
    const base = memoryStore(),
      store = observableStore(base, () => t);
    const app = createApp({
      store,
      telemetry: () => t,
      verifyToken: async (uid) => {
        await new Promise((r) => setTimeout(r, uid === 'alice' ? 20 : 1));
        return {
          uid,
          email:
            uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.invalid',
          email_verified: true,
          firebase: { sign_in_provider: 'google.com' },
        };
      },
    });
    await request(app).get('/api/v1/me').set('Authorization', 'Bearer admin');
    for (const uid of ['alice', 'bob'])
      await base.run(async (tx) =>
        tx.set(path('members', uid), {
          id: uid,
          uid,
          active: true,
          version: 1,
          scope: 'all',
          role: 'SDR',
          capabilities: [
            'leads:read',
            'leads:create',
            'leads:edit',
            'activities:write',
            'tasks:write',
          ],
        }),
      );
    const post = (uid, body, key) =>
      request(app)
        .post('/api/v1/leads')
        .set('Authorization', 'Bearer ' + uid)
        .set('Idempotency-Key', key)
        .send(body);
    const body = {
        name: 'PRIVATE SYNTHETIC CONTACT',
        phone: '+12025550123',
        enquiryDate: '2026-10-25',
      },
      key = randomUUID();
    const [a, b] = await Promise.all([
      post('alice', body, key).expect(200),
      post(
        'bob',
        { ...body, name: 'OTHER PRIVATE CONTACT', phone: '+12025550124' },
        randomUUID(),
      ).expect(200),
    ]);
    assert.equal(a.headers['x-app-version'], APP_VERSION);
    const events = await base.query(path('telemetryOutbox'), { limit: 100 });
    const count = events.length;
    assert.equal(
      events.filter((e) => e.event.type.endsWith('leads.committed')).length,
      2,
    );
    await post('alice', body, key).expect(200);
    assert.equal(
      (await base.query(path('telemetryOutbox'), { limit: 100 })).length,
      count,
    );
    await request(app)
      .post('/api/v1/leads/' + a.body.id + '/activities')
      .set('Authorization', 'Bearer alice')
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'note',
        expectedVersion: a.body.version,
        notes:
          'PRIVATE NOTE: secret_contact@example.invalid must never be exported.',
      })
      .expect(200);
    await request(app)
      .patch('/api/v1/me')
      .set('Authorization', 'Bearer alice')
      .send({ timezone: 'Asia/Kolkata', appearance: 'dark', bookMode: true })
      .expect(200);
    const before = (await base.query(path('leads'), { limit: 100 })).length;
    await assert.rejects(
      store.run(async (tx) => {
        tx.set(path('leads', 'rolled-back'), {
          id: 'rolled-back',
          name: 'PRIVATE FAILED CONTACT',
        });
        throw Error('rollback');
      }),
    );
    assert.equal(
      (await base.query(path('leads'), { limit: 100 })).length,
      before,
    );
    await t.flush();
    const traces = received
      .filter((r) => r.path.endsWith('traces'))
      .flatMap((r) =>
        r.decoded.resourceSpans.flatMap((rs) => {
          assert.equal(
            attr(rs.resource.attributes)['service.name'],
            'salesdrone-test',
          );
          assert.equal(
            attr(rs.resource.attributes)['service.version'],
            APP_VERSION,
          );
          return rs.scopeSpans.flatMap((s) => s.spans);
        }),
      );
    const requests = traces.filter((s) => s.name === 'POST /leads');
    assert.ok(
      requests.some((s) => attr(s.attributes)['actor.id'] === actorId('alice')),
    );
    assert.ok(
      requests.some((s) => attr(s.attributes)['actor.id'] === actorId('bob')),
    );
    const logs = received
      .filter((r) => r.path.endsWith('logs'))
      .flatMap((r) =>
        r.decoded.resourceLogs.flatMap((rs) =>
          rs.scopeLogs.flatMap((s) => s.logRecords),
        ),
      );
    assert.ok(
      logs.some(
        (l) =>
          l.body.stringValue === 'http.completed' &&
          Buffer.from(l.traceId).length === 16 &&
          Buffer.from(l.spanId).length === 8,
      ),
    );
    const metrics = received
      .filter((r) => r.path.endsWith('metrics'))
      .flatMap((r) =>
        r.decoded.resourceMetrics.flatMap((rs) =>
          rs.scopeMetrics.flatMap((s) => s.metrics),
        ),
      );
    const counter = metrics.find((m) => m.name === 'salesdrone.http.requests'),
      hist = metrics.find((m) => m.name === 'salesdrone.http.duration');
    assert.equal(counter.sum.aggregationTemporality, 1);
    assert.equal(hist.unit, 's');
    assert.ok(
      hist.histogram.dataPoints.some((p) => p.explicitBounds.length > 0),
    );
    for (const metric of [counter, hist])
      for (const point of metric.sum?.dataPoints ||
        metric.histogram.dataPoints) {
        const keys = Object.keys(attr(point.attributes));
        assert.ok(
          keys.every((k) =>
            [
              'operation',
              'http.request.method',
              'http.response.status_code',
            ].includes(k),
          ),
        );
      }
    assert.ok(
      received.every(
        (r) =>
          r.header === 'application/x-protobuf' &&
          r.authorization === 'Api-Token synthetic-credential',
      ),
    );
    const exported = JSON.stringify(received.map((r) => r.decoded));
    assert.ok(
      !exported.includes('PRIVATE') &&
        !exported.includes('secret_contact') &&
        !exported.includes('synthetic-credential'),
    );
    let clock = Date.now() + 10000;
    const now = () => new Date(clock).toISOString();
    const [first, second] = await Promise.all([
      deliverTelemetry({
        store,
        tenant,
        key: 'synthetic-credential',
        telemetry: t,
        now,
        allowLocalTest: true,
      }),
      deliverTelemetry({
        store,
        tenant,
        key: 'synthetic-credential',
        telemetry: t,
        now,
        allowLocalTest: true,
      }),
    ]);
    assert.equal(first.delivered + second.delivered, biz.length);
    assert.equal(new Set(biz.map((e) => e.id)).size, biz.length);
    assert.ok(
      biz.every(
        (e) =>
          e.traceparent && e.data['event.authority'] === 'server-confirmed',
      ),
    );
    assert.ok(!JSON.stringify(biz).includes('PRIVATE'));
    assert.ok(
      biz.every(
        (e) =>
          e.specversion === '1.0' &&
          e.source.startsWith('com.avinyatech.salesdrone') &&
          e.type.startsWith('com.avinyatech.salesdrone') &&
          e.id === e.data['event.id'],
      ),
    );
    await t.flush();
    const deliveryMetric = received
      .filter((r) => r.path.endsWith('metrics'))
      .flatMap((r) =>
        r.decoded.resourceMetrics.flatMap((rs) =>
          rs.scopeMetrics.flatMap((s) => s.metrics),
        ),
      )
      .find((m) => m.name === 'salesdrone.bizevents.delivery');
    assert.ok(deliveryMetric);
    assert.ok(
      deliveryMetric.sum.dataPoints.every((p) =>
        Object.keys(attr(p.attributes)).every((k) =>
          ['outcome', 'http.status_class'].includes(k),
        ),
      ),
    );
    const deliveredAuditLogs = received
      .filter((r) => r.path.endsWith('logs'))
      .flatMap((r) =>
        r.decoded.resourceLogs.flatMap((rs) =>
          rs.scopeLogs.flatMap((s) => s.logRecords),
        ),
      );
    assert.ok(
      deliveredAuditLogs.some(
        (l) =>
          l.body.stringValue === 'settings.audit.delivered' &&
          attr(l.attributes)['settings.section'] === 'appearance' &&
          attr(l.attributes)['settings.changed_count'] === 2 &&
          attr(l.attributes)['actor.id'] === actorId('alice'),
      ),
      'Decoded audit delivery log preserves numeric counts and the hashed actor',
    );
    assert.ok(
      deliveryMetric.sum.dataPoints.some(
        (p) => attr(p.attributes).outcome === 'delivered',
      ),
    );

    await store.run(async (tx) =>
      tx.set(path('tasks', 'retry-test'), {
        id: 'retry-test',
        state: 'Pending',
        recipientUid: 'alice',
      }),
    );
    const pending = (
      await base.query(path('telemetryOutbox'), {
        filters: [['status', '==', 'Pending']],
        limit: 100,
      })
    )[0];
    assert.ok(pending);
    const lost = async () => {
      throw Error('lost response');
    };
    await deliverTelemetry({
      store,
      tenant,
      key: 'synthetic-credential',
      fetchImpl: lost,
      now,
      allowLocalTest: true,
    });
    assert.equal(
      (await base.get(path('telemetryOutbox', pending.id))).status,
      'Pending',
    );
    clock += 3600000;
    await deliverTelemetry({
      store,
      tenant,
      key: 'synthetic-credential',
      now,
      allowLocalTest: true,
    });
    assert.equal(
      (await base.get(path('telemetryOutbox', pending.id))).status,
      'Delivered',
    );
    assert.equal(
      (await base.get(path('telemetryOutbox', pending.id))).deliveryFormat,
      'cloudevent-v1',
    );
    await store.run(async (tx) =>
      tx.set(path('tasks', 'rejected-test'), {
        id: 'rejected-test',
        state: 'Pending',
        recipientUid: 'alice',
      }),
    );
    await deliverTelemetry({
      store,
      tenant,
      key: 'synthetic-credential',
      fetchImpl: async () => ({ status: 403, headers: new Headers() }),
      now,
      allowLocalTest: true,
    });
    assert.ok(
      (
        await base.query(path('telemetryOutbox'), {
          filters: [['status', '==', 'Rejected']],
          limit: 100,
        })
      ).length,
    );
    rejectExport = true;
    const still = await post(
      'bob',
      { ...body, phone: '+12025550125' },
      randomUUID(),
    ).expect(200);
    assert.ok(still.body.id);
    await t.flush();
  } finally {
    await t.shutdown();
    server.close();
    await once(server, 'close');
  }
});
test('context and endpoint validation rejects malformed parents and credential redirects', () => {
  assert.equal(
    validParent('00-' + '0'.repeat(32) + '-' + '1'.repeat(16) + '-01'),
    null,
  );
  assert.equal(validParent('evil'), null);
  assert.throws(() => tenantOrigin('https://attacker.example'));
  assert.throws(() =>
    tenantOrigin('https://user:password@indiacs.live.dynatrace.com'),
  );
  assert.throws(() => tenantOrigin('http://127.0.0.1:4318'));
  assert.equal(
    tenantOrigin('https://indiacs.live.dynatrace.com'),
    'https://indiacs.live.dynatrace.com',
  );
});

test('a worker that loses its delivery lease cannot finalize or count another worker outcome', async () => {
  const store = memoryStore();
  const p = path('telemetryOutbox', 'lease-fixture');
  await store.run(async (tx) =>
    tx.set(p, {
      id: 'lease-fixture',
      status: 'Pending',
      attemptCount: 0,
      nextAttemptAt: '2026-10-01T00:00:00.000Z',
      event: {
        specversion: '1.0',
        id: 'lease-fixture',
        source: 'com.avinyatech.salesdrone.test',
        type: 'test',
        data: {},
      },
    }),
  );
  let metrics = 0;
  const result = await deliverTelemetry({
    store,
    tenant: 'https://fixture.live.dynatrace.com',
    key: 'synthetic',
    telemetry: {
      span: async (_name, fn) => fn(),
      capture: () => ({}),
      businessDelivery: () => metrics++,
    },
    fetchImpl: async (_url, options) => {
      assert.equal(
        options.headers['Content-Type'],
        'application/cloudevent+json',
      );
      await store.run(async (tx) => {
        const current = await tx.get(p);
        tx.set(p, { ...current, lease: 'replacement-worker' });
      });
      return { status: 202, headers: new Headers() };
    },
  });
  assert.equal(result.delivered, 0);
  assert.equal(metrics, 0);
  assert.equal((await store.get(p)).lease, 'replacement-worker');
  assert.equal((await store.get(p)).status, 'Sending');
});
