import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { PRESETS } from '../src/contracts.js';

async function setup() {
  const store = memoryStore();
  const app = createApp({
    store,
    now: () => '2026-10-29T10:00:00.000Z',
    verifyToken: async (uid) => ({
      uid,
      email: `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  const call = (uid, method, url, body) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + uid);
    return body ? r.send(body) : r;
  };
  await store.run(async (tx) => {
    for (const uid of ['admin', 'rep', 'other'])
      tx.set(path('members', uid), {
        id: uid,
        uid,
        active: true,
        version: 1,
        role: uid === 'admin' ? 'Admin' : 'SDR',
        scope: 'all',
        capabilities: uid === 'admin' ? PRESETS.Admin : PRESETS.SDR,
      });
    for (let i = 0; i < 35; i++)
      tx.set(path('leads', 'a' + String(i).padStart(2, '0')), {
        id: 'a' + String(i).padStart(2, '0'),
        name: 'Fictional archive',
        stage: 'New',
        archived: true,
        assignedToUid: i < 33 ? 'rep' : 'other',
        version: 1,
      });
    tx.set(path('leads', 'live'), {
      id: 'live',
      name: 'Fictional live',
      stage: 'New',
      archived: false,
      assignedToUid: 'rep',
      version: 1,
    });
    tx.set(path('tasks', 'pending'), {
      id: 'pending',
      leadId: 'live',
      state: 'Pending',
      recipientUid: 'rep',
      version: 1,
    });
  });
  return { store, call };
}
test('archives paginate only accessible archived leads and bind cursors to current access', async () => {
  const { store, call } = await setup();
  const first = (
    await call('rep', 'get', '/archived-leads?limit=30').expect(200)
  ).body;
  assert.equal(first.items.length, 30);
  assert.ok(first.nextCursor);
  assert.ok(first.items.every((l) => l.archived && l.assignedToUid === 'rep'));
  const next = (
    await call(
      'rep',
      'get',
      '/archived-leads?limit=30&cursor=' + encodeURIComponent(first.nextCursor),
    ).expect(200)
  ).body;
  assert.equal(next.items.length, 3);
  assert.equal(next.nextCursor, null);
  assert.equal(
    new Set([...first.items, ...next.items].map((l) => l.id)).size,
    33,
  );
  await call(
    'other',
    'get',
    '/archived-leads?cursor=' + encodeURIComponent(first.nextCursor),
  ).expect(400);
  await call('rep', 'get', '/archived-leads?limit=101').expect(400);
  await call('rep', 'get', '/archived-leads?archived=false').expect(400);
  await call('unknown', 'get', '/archived-leads').expect(403);
  assert.equal(
    (await call('rep', 'get', '/leads').expect(200)).body.items.length,
    1,
  );
  await store.run(async (tx) => {
    const m = await tx.get(path('members', 'rep'));
    tx.set(path('members', 'rep'), { ...m, version: 2 });
  });
  await call(
    'rep',
    'get',
    '/archived-leads?cursor=' + encodeURIComponent(first.nextCursor),
  ).expect(400);
});
test('archive retains the record and date, cancels pending reminders and rejects stale versions', async () => {
  const { store, call } = await setup();
  await call('other', 'post', '/leads/live/archive', {
    expectedVersion: 1,
  }).expect(404);
  await call('rep', 'post', '/leads/live/archive', {
    expectedVersion: 2,
  }).expect(409);
  await call('rep', 'post', '/leads/live/archive', {
    expectedVersion: 1,
  }).expect(200);
  const lead = await store.get(path('leads', 'live'));
  assert.equal(lead.archivedAt, '2026-10-29T10:00:00.000Z');
  assert.equal(lead.archived, true);
  assert.equal((await store.get(path('tasks', 'pending'))).state, 'Cancelled');
  const page = (
    await call('rep', 'get', '/archived-leads?limit=100').expect(200)
  ).body;
  assert.ok(page.items.some((l) => l.id === 'live'));
  assert.equal(
    (await call('rep', 'get', '/leads').expect(200)).body.items.length,
    0,
  );
});
