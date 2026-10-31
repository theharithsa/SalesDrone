import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { observableStore } from '../src/observable-store.js';
import { path } from '../src/policy.js';
import { cleanupAttachments, validateBytes } from '../src/attachments.js';
async function setup(observe = false) {
  const raw = memoryStore();
  const t = {
    enabled: true,
    span: (_name, fn) => fn(),
    capture: () => ({
      operation: 'files.test',
      actorId: 'synthetic',
      operationId: 'test-operation',
      requestId: 'test-request',
      traceparent: null,
    }),
  };
  const store = observe ? observableStore(raw, () => t) : raw,
    objects = new Map();
  let clock = '2026-10-26T10:00:00.000Z',
    afterSave = () => {};
  const files = {
    save: async (p, b, t, hash) => {
      if (objects.has(p) && objects.get(p).hash !== hash)
        throw Error('immutable');
      objects.set(p, { bytes: Buffer.from(b), hash });
      await afterSave();
    },
    read: async (p) => objects.get(p).bytes,
    delete: async (p) => {
      objects.delete(p);
    },
  };
  const app = createApp({
    store,
    files,
    now: () => clock,
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.invalid',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
    verifyAppCheck: async (v) => {
      if (v !== 'test')
        throw Object.assign(Error('App Check required'), { status: 403 });
    },
  });
  const call = (who, method, url, body, key) => {
    let r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + who)
      .set('X-Firebase-AppCheck', 'test');
    if (key) r = r.set('Idempotency-Key', key);
    return body === undefined ? r : r.send(body);
  };
  await call('admin', 'get', '/me').expect(200);
  for (const role of ['sdr', 'viewer', 'other'])
    await store.run((tx) =>
      tx.set(path('members', role), {
        id: role,
        uid: role,
        name: role,
        role: role === 'viewer' ? 'Viewer' : 'SDR',
        active: true,
        scope: 'assigned',
        version: 1,
        capabilities:
          role === 'viewer'
            ? ['leads:read']
            : [
                'leads:read',
                'leads:edit',
                'leads:create',
                'activities:write',
                'tasks:write',
              ],
      }),
    );
  const leads = [];
  for (const name of ['Alpha', 'Beta'])
    leads.push(
      (
        await call(
          'admin',
          'post',
          '/leads',
          {
            name,
            phone: '+1202555010' + leads.length,
            enquiryDate: '2026-10-26',
          },
          randomUUID(),
        ).expect(200)
      ).body,
    );
  return {
    store,
    objects,
    files,
    app,
    call,
    leads,
    now: () => clock,
    setClock: (v) => (clock = v),
    setAfterSave: (fn) => (afterSave = fn),
  };
}
test('batch preview is read only; apply is atomic, records journey, preserves conversations and safely replays', async () => {
  const { call, store, leads } = await setup();
  const input = {
    items: leads.map((l) => ({ id: l.id, expectedVersion: l.version })),
    changes: { stage: 'Working', company: 'Shared company' },
  };
  const before = store.dump();
  const preview = (
    await call('admin', 'post', '/leads/batch/preview', input).expect(200)
  ).body;
  assert.equal(preview.changedCount, 2);
  assert.deepEqual(store.dump(), before);
  const bad = {
    ...input,
    items: [input.items[0], { ...input.items[1], expectedVersion: 999 }],
  };
  await call('admin', 'post', '/leads/batch', bad, randomUUID()).expect(409);
  assert.equal((await store.get(path('leads', leads[0].id))).stage, 'New');
  const key = randomUUID();
  const result = (
    await call('admin', 'post', '/leads/batch', input, key).expect(200)
  ).body;
  assert.equal(result.changedCount, 2);
  const snapshot = store.dump();
  assert.deepEqual(
    (await call('admin', 'post', '/leads/batch', input, key).expect(200)).body,
    result,
  );
  assert.deepEqual(store.dump(), snapshot);
  for (const l of leads) {
    const saved = await store.get(path('leads', l.id));
    assert.equal(saved.stage, 'Working');
    assert.equal(saved.version, 2);
    assert.equal(saved.phone, l.phone);
    const history = await store.query(path('leadTransitions'), {
      filters: [['leadId', '==', l.id]],
      limit: 10,
    });
    assert.ok(history.some((h) => h.to === 'Working'));
  }
  await call('admin', 'post', '/leads/batch', input, key)
    .send({ ...input, changes: { stage: 'Won' } })
    .expect(409);
});
test('batch permission, scope, strict fields and limits are enforced before any lead changes', async () => {
  const { call, store, leads } = await setup();
  const input = {
    items: leads.map((l) => ({ id: l.id, expectedVersion: l.version })),
    changes: { stage: 'Working' },
  };
  for (const who of ['viewer', 'outsider'])
    await call(who, 'post', '/leads/batch/preview', input).expect(403);
  await call('sdr', 'post', '/leads/batch', input, randomUUID()).expect(404);
  for (const changes of [
    { phone: '123456789' },
    { comments: 'overwrite history' },
    { stage: 'Invented stage' },
    { customFields: { cf_unknown: 'bad' } },
  ])
    await call('admin', 'post', '/leads/batch/preview', {
      ...input,
      changes,
    }).expect(400);
  await call('admin', 'post', '/leads/batch/preview', {
    ...input,
    items: [input.items[0], input.items[0]],
  }).expect(400);
  await call('admin', 'post', '/leads/batch/preview', {
    ...input,
    items: Array.from({ length: 26 }, (_, i) => ({
      id: 'lead' + i,
      expectedVersion: 1,
    })),
  }).expect(400);
  assert.equal((await store.get(path('leads', leads[0].id))).version, 1);
});
test('batch reassignment requires permission, cancels pending work and creates one recipient alert', async () => {
  const { call, store, leads } = await setup();
  const l = leads[0];
  await call(
    'admin',
    'post',
    '/tasks',
    { leadId: l.id, title: 'Call', dueAt: '2026-10-27T10:00:00.000Z' },
    randomUUID(),
  ).expect(200);
  const input = {
    items: [{ id: l.id, expectedVersion: l.version }],
    changes: {},
    assignedToUid: 'sdr',
  };
  const key = randomUUID();
  await call('admin', 'post', '/leads/batch', input, key).expect(200);
  assert.equal((await store.get(path('leads', l.id))).assignmentRevision, 2);
  assert.ok(
    (
      await store.query(path('tasks'), {
        filters: [['leadId', '==', l.id]],
        limit: 10,
      })
    ).every((t) => t.state === 'Cancelled'),
  );
  const notifications = await store.query('users/sdr/notifications', {
    limit: 10,
  });
  assert.equal(notifications.filter((n) => n.leadId === l.id).length, 1);
  await call('admin', 'post', '/leads/batch', input, key).expect(200);
  assert.equal(
    (await store.query('users/sdr/notifications', { limit: 10 })).length,
    notifications.length,
  );
  const version = (await store.get(path('leads', l.id))).version;
  await call('sdr', 'post', '/leads/batch/preview', {
    items: [{ id: l.id, expectedVersion: version }],
    changes: {},
    assignedToUid: 'other',
  }).expect(403);
});
const bytes = Buffer.from('%PDF-1.7\nFictional contract content');
async function reserve(ctx, who = 'admin', lead = ctx.leads[0]) {
  return (
    await ctx
      .call(
        who,
        'post',
        `/leads/${lead.id}/attachments`,
        {
          name: 'fictional-contract.pdf',
          size: bytes.length,
          contentType: 'application/pdf',
        },
        randomUUID(),
      )
      .expect(200)
  ).body;
}
function put(ctx, id, file, who = 'admin', lead = ctx.leads[0]) {
  return ctx
    .call(who, 'put', `/leads/${lead.id}/attachments/${id}/content`)
    .set('Content-Type', 'application/octet-stream')
    .send(file);
}
test('private file flow validates bytes, supports retry, forces download and removes access immediately', async () => {
  const c = await setup(),
    record = await reserve(c),
    base = `/leads/${c.leads[0].id}/attachments`;
  assert.equal(
    (await c.call('admin', 'get', base).expect(200)).body.items.length,
    0,
  );
  await put(c, record.id, Buffer.alloc(bytes.length)).expect(400);
  const ready = (await put(c, record.id, bytes).expect(200)).body;
  assert.equal(ready.state, 'Ready');
  assert.ok(!('objectPath' in ready));
  assert.equal(c.objects.size, 1);
  await put(c, record.id, bytes).expect(200);
  assert.equal(c.objects.size, 1);
  const changed = Buffer.from(bytes);
  changed[changed.length - 1] = 65;
  await put(c, record.id, changed).expect(409);
  const download = await c
    .call('admin', 'get', base + '/' + record.id + '/content')
    .expect(200);
  assert.deepEqual(download.body, bytes);
  assert.match(download.headers['content-disposition'], /^attachment;/);
  assert.equal(download.headers['cache-control'], 'no-store');
  assert.equal(download.headers['x-content-type-options'], 'nosniff');
  await c
    .call('admin', 'delete', base + '/' + record.id, { expectedVersion: 1 })
    .expect(409);
  await c
    .call('admin', 'delete', base + '/' + record.id, {
      expectedVersion: ready.version,
    })
    .expect(200);
  await c.call('admin', 'get', base + '/' + record.id + '/content').expect(404);
  assert.equal(c.objects.size, 1);
  c.setClock('2026-10-26T12:01:00.000Z');
  assert.equal((await cleanupAttachments({ ...c, now: c.now })).removed, 1);
  assert.equal(c.objects.size, 0);
  assert.equal((await cleanupAttachments({ ...c, now: c.now })).removed, 0);
});
test('file authorization, byte limits, filename/type validation and cross-lead isolation', async () => {
  const c = await setup(),
    l = c.leads[0],
    base = `/leads/${l.id}/attachments`;
  for (const who of ['viewer', 'outsider'])
    await c
      .call(
        who,
        'post',
        base,
        { name: 'a.pdf', size: bytes.length, contentType: 'application/pdf' },
        randomUUID(),
      )
      .expect(403);
  for (const v of [
    { name: '../a.pdf', size: 5, contentType: 'application/pdf' },
    { name: 'a.html', size: 5, contentType: 'text/html' },
    { name: 'a.pdf', size: 8388609, contentType: 'application/pdf' },
  ])
    await c.call('admin', 'post', base, v, randomUUID()).expect(400);
  const r = await reserve(c);
  await put(c, r.id, Buffer.from('bad')).expect(400);
  await put(c, r.id, bytes, 'other').expect(404);
  await put(c, r.id, bytes, 'admin', c.leads[1]).expect(404);
  await c
    .call('admin', 'put', base + '/' + r.id + '/content', {
      data: 'not binary',
    })
    .expect(415);
  const saved = await c.store.get(path('leads', l.id));
  await c.store.run((tx) =>
    tx.set(path('leads', l.id), { ...saved, attachmentCount: 50 }),
  );
  await reserveAttempt(c, base).expect(409);
});
function reserveAttempt(c, base) {
  return c.call(
    'admin',
    'post',
    base,
    { name: 'a.pdf', size: bytes.length, contentType: 'application/pdf' },
    randomUUID(),
  );
}
test('revocation during storage upload never publishes a downloadable file; abandoned uploads clean up with a grace window', async () => {
  const c = await setup(),
    l = c.leads[0];
  await c.store.run((tx) =>
    tx.set(path('leads', l.id), { ...l, assignedToUid: 'sdr' }),
  );
  const r = await reserve(c, 'sdr');
  c.setAfterSave(async () =>
    c.store.run(async (tx) => {
      const m = await tx.get(path('members', 'sdr'));
      tx.set(path('members', 'sdr'), {
        ...m,
        active: false,
        version: m.version + 1,
      });
    }),
  );
  await put(c, r.id, bytes, 'sdr').expect(403);
  assert.equal(
    (await c.store.get(path('leadAttachments', r.id))).state,
    'Pending',
  );
  assert.equal(
    (await c.call('admin', 'get', `/leads/${l.id}/attachments`).expect(200))
      .body.items.length,
    0,
  );
  c.setClock('2026-10-26T11:01:00.000Z');
  await cleanupAttachments({ ...c, now: c.now });
  assert.equal(c.objects.size, 1);
  assert.equal(
    (await c.store.get(path('leadAttachments', r.id))).state,
    'Deleting',
  );
  c.setClock('2026-10-26T12:02:00.000Z');
  await cleanupAttachments({ ...c, now: c.now });
  assert.equal(c.objects.size, 0);
  assert.equal((await c.store.get(path('leads', l.id))).attachmentCount, 0);
});

test('file writes produce canonical privacy-safe events without names, contents or storage paths', async () => {
  const c = await setup(true);
  const record = await reserve(c);
  await put(c, record.id, bytes).expect(200);
  const events = await c.store.query(path('telemetryOutbox'), { limit: 1000 });
  assert.ok(
    events.some((e) => e.event.data['record.domain'] === 'leadAttachments'),
  );
  const payload = JSON.stringify(events.map((e) => e.event));
  assert.ok(!payload.includes('fictional-contract.pdf'));
  assert.ok(!payload.includes('Fictional contract content'));
  assert.ok(!payload.includes('lead-files/'));
});
test('new PAT scopes are explicit; batch reassignment needs assignment scope and file scopes do not grant lead editing', async () => {
  const c = await setup(),
    l = c.leads[0];
  async function issue(scopes) {
    return (
      await c
        .call('admin', 'post', '/personal-access-tokens', {
          name: 'Synthetic scope test',
          scopes,
          expiresInDays: 7,
        })
        .expect(200)
    ).body.token;
  }
  const plain = await issue(['leads:edit']);
  await request(c.app)
    .post('/api/v1/leads/batch/preview')
    .set('Authorization', 'Bearer ' + plain)
    .send({
      items: [{ id: l.id, expectedVersion: l.version }],
      changes: { stage: 'Working' },
    })
    .expect(403);
  const bulk = await issue(['leads:bulk-edit']);
  await request(c.app)
    .post('/api/v1/leads/batch/preview')
    .set('Authorization', 'Bearer ' + bulk)
    .send({
      items: [{ id: l.id, expectedVersion: l.version }],
      changes: { stage: 'Working' },
    })
    .expect(200);
  await request(c.app)
    .post('/api/v1/leads/batch/preview')
    .set('Authorization', 'Bearer ' + bulk)
    .send({
      items: [{ id: l.id, expectedVersion: l.version }],
      changes: {},
      assignedToUid: 'sdr',
    })
    .expect(403);
  const read = await issue(['attachments:read']);
  await request(c.app)
    .get('/api/v1/leads/' + l.id + '/attachments')
    .set('Authorization', 'Bearer ' + read)
    .expect(200);
  await request(c.app)
    .post('/api/v1/leads/' + l.id + '/attachments')
    .set('Authorization', 'Bearer ' + read)
    .set('Idempotency-Key', randomUUID())
    .send({ name: 'a.pdf', size: bytes.length, contentType: 'application/pdf' })
    .expect(403);
});

test('batch task/write budget rejects oversized cancellation work without a partial update', async () => {
  const c = await setup();
  const third = (
    await c
      .call(
        'admin',
        'post',
        '/leads',
        { name: 'Gamma', phone: '+12025550199', enquiryDate: '2026-10-26' },
        randomUUID(),
      )
      .expect(200)
  ).body;
  const leads = [...c.leads, third];
  await c.store.run((tx) => {
    for (const l of leads)
      for (let i = 0; i < 80; i++) {
        const id = l.id + '_' + i;
        tx.set(path('tasks', id), {
          id,
          leadId: l.id,
          kind: 'outreach',
          state: 'Pending',
          version: 1,
        });
      }
  });
  await c
    .call(
      'admin',
      'post',
      '/leads/batch',
      {
        items: leads.map((l) => ({ id: l.id, expectedVersion: 1 })),
        changes: {},
        assignedToUid: 'sdr',
      },
      randomUUID(),
    )
    .expect(409);
  for (const l of leads)
    assert.equal(
      (await c.store.get(path('leads', l.id))).assignedToUid,
      'admin',
    );
});

test('failed physical cleanup remains retryable and concurrent cleanup counts one committed deletion', async () => {
  const c = await setup(),
    pending = await reserve(c),
    ready = (await put(c, pending.id, bytes).expect(200)).body;
  await c
    .call(
      'admin',
      'delete',
      `/leads/${c.leads[0].id}/attachments/${ready.id}`,
      { expectedVersion: ready.version },
    )
    .expect(200);
  c.setClock('2026-10-26T12:00:00.000Z');
  const failed = await cleanupAttachments({
    ...c,
    files: {
      ...c.files,
      delete: async () => {
        throw Error('Synthetic storage failure');
      },
    },
    now: c.now,
  });
  assert.equal(failed.failed, 1);
  assert.equal(
    (await c.store.get(path('leadAttachments', ready.id))).state,
    'Deleting',
  );
  const results = await Promise.all([
    cleanupAttachments({ ...c, now: c.now }),
    cleanupAttachments({ ...c, now: c.now }),
  ]);
  assert.equal(
    results.reduce((n, r) => n + r.removed, 0),
    1,
  );
  assert.equal(c.objects.size, 0);
});

test('file signatures reject spoofed images and accept supported binary/text envelopes', () => {
  const samples = [
    ['image/jpeg', Buffer.from([255, 216, 255, 224, 0, 1])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/gif', Buffer.from('GIF89a')],
    ['image/webp', Buffer.from('RIFF1234WEBP')],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from([80, 75, 3, 4]),
    ],
    ['application/msword', Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])],
    ['text/plain', Buffer.from('Fictional text')],
  ];
  for (const [contentType, bytes] of samples) {
    assert.equal(
      validateBytes(bytes, { contentType, size: bytes.length }).length,
      64,
    );
    if (contentType !== 'text/plain')
      assert.throws(() =>
        validateBytes(Buffer.from('Not a supported image'), {
          contentType,
          size: 21,
        }),
      );
  }
  assert.throws(() =>
    validateBytes(Buffer.from([0, 1, 2]), {
      contentType: 'text/plain',
      size: 3,
    }),
  );
});
test('batch stored-data budget rejects oversized aggregate records before changing any lead', async () => {
  const c = await setup(),
    customFields = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [
        'cf_legacy_' + i,
        'x'.repeat(2000),
      ]),
    );
  const items = Array.from({ length: 25 }, (_, i) => ({
    id: 'large-batch-' + i,
    expectedVersion: 1,
  }));
  await c.store.run((tx) => {
    for (const { id } of items)
      tx.set(path('leads', id), { ...c.leads[0], id, customFields });
  });
  await c
    .call(
      'admin',
      'post',
      '/leads/batch',
      { items, changes: { stage: 'Working' } },
      randomUUID(),
    )
    .expect(413);
  for (const { id } of items)
    assert.equal((await c.store.get(path('leads', id))).version, 1);
});

test('PAT attachment reserve, binary upload, download and delete require their explicit scopes', async () => {
  const s = await setup();
  const issue = async (scopes) =>
    (
      await s
        .call('admin', 'post', '/personal-access-tokens', {
          name: 'Synthetic file integration',
          scopes,
          expiresInDays: 7,
        })
        .expect(200)
    ).body.token;
  const token = await issue(['attachments:read', 'attachments:write']);
  const readOnly = await issue(['attachments:read']);
  const base = '/leads/' + s.leads[0].id + '/attachments';
  const bytes = Buffer.from('Synthetic token upload');
  const pending = (
    await s
      .call(
        token,
        'post',
        base,
        {
          name: 'synthetic.txt',
          contentType: 'text/plain',
          size: bytes.length,
        },
        randomUUID(),
      )
      .expect(200)
  ).body;
  const content = base + '/' + pending.id + '/content';
  await s
    .call(readOnly, 'put', content, bytes)
    .set('Content-Type', 'application/octet-stream')
    .expect(403);
  assert.equal(s.objects.size, 0);
  const ready = (
    await s
      .call(token, 'put', content, bytes)
      .set('Content-Type', 'application/octet-stream')
      .expect(200)
  ).body;
  assert.equal(ready.state, 'Ready');
  const downloaded = await s.call(token, 'get', content).expect(200);
  assert.deepEqual(downloaded.body, bytes);
  await s
    .call(readOnly, 'delete', base + '/' + pending.id, {
      expectedVersion: ready.version,
    })
    .expect(403);
  await s
    .call(token, 'delete', base + '/' + pending.id, {
      expectedVersion: ready.version,
    })
    .expect(200);
  await s.call(token, 'get', content).expect(404);
});
