import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
test('journey records committed creation and stage changes, never notes, rejected writes or replay', async () => {
  const store = memoryStore(),
    app = createApp({
      store,
      verifyToken: async (uid) => ({
        uid,
        email:
          uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.invalid',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      }),
    });
  const call = (uid, m, p, b, key = randomUUID()) => {
    const r = request(app)
      [m]('/api/v1' + p)
      .set('Authorization', 'Bearer ' + uid)
      .set('Idempotency-Key', key);
    return b ? r.send(b) : r;
  };
  await call('admin', 'get', '/me').expect(200);
  const key = randomUUID(),
    body = {
      name: 'Synthetic journey',
      phone: '+12025550123',
      enquiryDate: '2026-10-25',
    };
  let lead = (await call('admin', 'post', '/leads', body, key).expect(200))
    .body;
  await call('admin', 'post', '/leads', body, key).expect(200);
  let journey = (
    await call('admin', 'get', '/leads/' + lead.id + '/journey').expect(200)
  ).body;
  assert.equal(journey.items.length, 1);
  assert.equal(journey.items[0].from, null);
  assert.equal(journey.historyComplete, true);
  lead = (
    await call('admin', 'patch', '/leads/' + lead.id, {
      expectedVersion: lead.version,
      stage: 'Working',
    }).expect(200)
  ).body;
  await call('admin', 'patch', '/leads/' + lead.id, {
    expectedVersion: 1,
    stage: 'Won',
  }).expect(409);
  const saved = (
    await call('admin', 'post', '/leads/' + lead.id + '/activities', {
      type: 'call',
      outcome: 'Connected',
      stage: 'Qualified',
      expectedVersion: lead.version,
      notes: 'Synthetic call',
    }).expect(200)
  ).body;
  lead = saved.lead;
  await call('admin', 'post', '/leads/' + lead.id + '/activities', {
    type: 'note',
    notes: 'Just a note',
    expectedVersion: lead.version,
  }).expect(200);
  journey = (
    await call('admin', 'get', '/leads/' + lead.id + '/journey?limit=2').expect(
      200,
    )
  ).body;
  assert.deepEqual(
    journey.items.map((v) => v.to),
    ['Qualified', 'Working'],
  );
  assert.ok(journey.nextCursor);
  const last = (
    await call(
      'admin',
      'get',
      '/leads/' +
        lead.id +
        '/journey?limit=2&cursor=' +
        encodeURIComponent(journey.nextCursor),
    ).expect(200)
  ).body;
  assert.equal(last.items.length, 1);
  await store.run(async (tx) => {
    tx.set(path('members', 'rep'), {
      uid: 'rep',
      id: 'rep',
      active: true,
      version: 1,
      scope: 'assigned',
      role: 'Viewer',
      capabilities: ['leads:read'],
    });
    tx.set(path('leads', 'legacy'), {
      id: 'legacy',
      version: 20,
      archived: false,
      stage: 'Working',
      assignedToUid: 'admin',
    });
  });
  await call('rep', 'get', '/leads/' + lead.id + '/journey').expect(404);
  const legacy = (
    await call('admin', 'get', '/leads/legacy/journey').expect(200)
  ).body;
  assert.equal(legacy.historyComplete, false);
  assert.equal(legacy.items.length, 0);
  assert.equal(legacy.currentStage, 'Working');
});
