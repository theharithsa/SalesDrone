import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { readFieldOptions, FIELD_SETTINGS_PATH } from '../src/field-options.js';
import { PRESETS } from '../src/contracts.js';
import { matchesLead } from '../src/lead-filters.js';
import {
  equalityToken,
  LEAD_INDEX_FIELD,
  LEAD_INDEX_STATE,
  advanceLeadFilterIndex,
} from '../src/lead-filter-index.js';
const commit = 'a'.repeat(40),
  t0 = '2026-10-30T00:00:00.000Z',
  t1 = '2026-10-30T00:03:00.000Z';
const row = (id, source = 'Other') => ({
  id,
  name: 'Synthetic contact',
  source,
  stage: 'New',
  customFields: { cf_product: 'Ｒｅｔａｉｌ' },
  archived: false,
  assignedToUid: 'sdr',
  version: 7,
  updatedAt: t0,
  createdAt: t0,
});
async function finish(store) {
  await store.reindexLeads({ commit, now: t0 });
  let r;
  do {
    r = await store.reindexLeads({ commit, now: t1 });
  } while (!r.ready);
}
async function fixture(seed = {}) {
  const store = memoryStore(seed),
    queries = [];
  const baseQuery = store.query;
  store.query = async (p, o) => {
    const result = await baseQuery(p, o);
    if (p === path('leads'))
      queries.push({ filters: o.filters, count: result.length });
    return result;
  };
  await store.set(path('members', 'sdr'), {
    uid: 'sdr',
    id: 'sdr',
    email: 'sdr@example.test',
    role: 'SDR',
    scope: 'assigned',
    active: true,
    version: 1,
    capabilities: PRESETS.SDR,
  });
  const config = await readFieldOptions(store);
  await store.set(FIELD_SETTINGS_PATH, {
    ...config,
    customFields: [
      {
        id: 'cf_product',
        label: 'Product',
        type: 'select',
        options: ['Retail'],
        required: false,
        deleted: false,
      },
    ],
  });
  const app = createApp({
    store,
    cursorSecret: 'synthetic-stable-key',
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : 'sdr@example.test',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  await request(app)
    .get('/api/v1/me')
    .set('Authorization', 'Bearer admin')
    .expect(200);
  const call = (filters, extra = {}, who = 'admin') =>
    request(app)
      .get('/api/v1/leads')
      .set('Authorization', 'Bearer ' + who)
      .query({ filters: JSON.stringify(filters), ...extra });
  return { store, queries, call, app };
}
test('normalized indexed equality finds sparse Unicode/case matches beyond the scan budget without changing scope or business data', async () => {
  const seed = {};
  for (let i = 0; i < 1105; i++) {
    const id = String(i).padStart(4, '0');
    seed[path('leads', id)] = row(id);
  }
  seed[path('leads', '0001')] = row('0001', '  WeBSite  ');
  seed[path('leads', '9999')] = {
    ...row('9999', 'Website'),
    assignedToUid: 'other',
  };
  const f = await fixture(seed),
    filter = [{ field: 'source', op: 'equals', value: 'ＷＥＢＳＩＴＥ' }];
  const before = await f.store.get(path('leads', '0001'));
  const scan = (await f.call(filter, {}, 'sdr').expect(200)).body;
  assert.equal(scan.items.length, 0);
  assert.equal(scan.scanLimited, true);
  await finish(f.store);
  f.queries.length = 0;
  const indexed = (await f.call(filter, {}, 'sdr').expect(200)).body;
  assert.deepEqual(
    indexed.items.map((x) => x.id),
    ['0001'],
  );
  assert.ok(
    f.queries.some((q) =>
      q.filters.some(
        ([key, op]) => key === LEAD_INDEX_FIELD && op === 'array-contains',
      ),
    ),
  );
  assert.ok(f.queries.reduce((n, q) => n + q.count, 0) < 10);
  assert.equal(indexed.scanLimited, false);
  assert.deepEqual(await f.store.get(path('leads', '0001')), before);
  assert.ok(!JSON.stringify(indexed).includes(LEAD_INDEX_FIELD));
  assert.equal(await f.store.count(path('activities')), 0);
  assert.equal(await f.store.count(path('telemetryOutbox')), 0);
  assert.ok(
    f.queries.every((q) =>
      q.filters.some(
        ([key, op, value]) =>
          key === 'assignedToUid' && op === '==' && value === 'sdr',
      ),
    ),
  );
});
test('custom select equality and multiple residual conditions preserve every existing matching rule', async () => {
  const f = await fixture({
    [path('leads', 'one')]: row('one', ' Website '),
    [path('leads', 'two')]: {
      ...row('two', 'Website'),
      company: 'Different',
      customFields: { cf_product: 'Trade' },
    },
  });
  await finish(f.store);
  const filters = [
    { field: 'cf_product', op: 'equals', value: 'retail' },
    { field: 'source', op: 'equals', value: 'WEBSITE' },
    { field: 'stage', op: 'equals', value: 'ＮＥＷ' },
    { field: 'company', op: 'empty', value: '' },
  ];
  const result = (await f.call(filters).expect(200)).body;
  assert.deepEqual(
    result.items.map((x) => x.id),
    ['one'],
  );
  assert.ok(result.items.every((l) => matchesLead(l, filters)));
  await f.store.run(async (tx) => {
    const lead = await tx.get(path('leads', 'one'));
    tx.set(path('leads', 'one'), {
      ...lead,
      source: 'Referral',
      customFields: { cf_product: 'Trade' },
    });
  });
  assert.equal((await f.call(filters).expect(200)).body.items.length, 0);
  assert.equal(
    (
      await f
        .call([{ field: 'source', op: 'equals', value: 'referral' }])
        .expect(200)
    ).body.items[0].id,
    'one',
  );
  for (const value of [
    await f.store.get(path('leads', 'one')),
    ...(await f.store.getAll([path('leads', 'one')])),
    ...(await f.store.scan(path('leads'))).map((x) => x.data),
  ])
    assert.ok(!(LEAD_INDEX_FIELD in value));
});
test('signed scan cursors survive readiness and indexed cursors remain bound to query and identity', async () => {
  const f = await fixture({
    [path('leads', 'a')]: row('a', 'Website'),
    [path('leads', 'b')]: row('b', 'Website'),
    [path('leads', 'c')]: row('c', 'Website'),
  });
  const filters = [{ field: 'source', op: 'equals', value: 'website' }];
  const first = (await f.call(filters, { limit: 1 }).expect(200)).body;
  assert.equal(first.items[0].id, 'c');
  await finish(f.store);
  f.queries.length = 0;
  const next = (
    await f.call(filters, { limit: 1, cursor: first.nextCursor }).expect(200)
  ).body;
  assert.equal(next.items[0].id, 'b');
  assert.ok(
    f.queries.every(
      (q) => !q.filters.some(([field]) => field === LEAD_INDEX_FIELD),
    ),
  );
  const start = (await f.call(filters, { limit: 1 }).expect(200)).body;
  const end = (
    await f.call(filters, { limit: 2, cursor: start.nextCursor }).expect(200)
  ).body;
  assert.deepEqual(
    end.items.map((x) => x.id),
    ['b', 'a'],
  );
  await f
    .call([{ field: 'source', op: 'equals', value: 'Referral' }], {
      cursor: start.nextCursor,
    })
    .expect(400);
  await f.call(filters, { cursor: start.nextCursor }, 'sdr').expect(400);
});
test('publication barrier, drain interval, reset pause, bounded pages and concurrent resumes control the backfill', async () => {
  const seed = {};
  for (let i = 0; i < 205; i++)
    seed[path('leads', String(i).padStart(3, '0'))] = row(String(i));
  const store = memoryStore(seed),
    before = store.dump();
  const unpublished = await advanceLeadFilterIndex({
    store,
    commit,
    now: t0,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ commit: 'b'.repeat(40) }),
    }),
  });
  assert.equal(unpublished.waiting, true);
  assert.equal(await store.get(LEAD_INDEX_STATE), null);
  const response = () => ({ ok: true, json: async () => ({ commit }) });
  await advanceLeadFilterIndex({ store, commit, now: t0, fetchImpl: response });
  assert.equal(
    (await store.reindexLeads({ commit, now: '2026-10-30T00:02:00Z' })).waiting,
    true,
  );
  await store.set(path('maintenance', 'lead-data-reset'), { active: true });
  assert.equal((await store.reindexLeads({ commit, now: t1 })).paused, true);
  await store.delete(path('maintenance', 'lead-data-reset'));
  const results = await Promise.all([
    store.reindexLeads({ commit, now: t1 }),
    store.reindexLeads({ commit, now: t1 }),
    store.reindexLeads({ commit, now: t1 }),
  ]);
  assert.deepEqual(
    results.map((r) => r.scanned),
    [100, 100, 5],
  );
  assert.equal((await store.get(LEAD_INDEX_STATE)).ready, true);
  for (const [p, v] of Object.entries(before))
    assert.deepEqual(await store.get(p), v);
  assert.equal((await store.reindexLeads({ commit, now: t1 })).updated, 0);
  // Writes use the same index function; no raw normalized source values are stored in tokens.
  const token = equalityToken('source', 'Website');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(
    (
      await store.query(path('leads'), {
        filters: [
          [
            LEAD_INDEX_FIELD,
            'array-contains',
            equalityToken('source', 'other'),
          ],
        ],
        limit: 1000,
      })
    ).length,
    205,
  );
});

test('a failing legacy index page rolls back earlier patches and leaves its checkpoint retryable', async () => {
  const malformed = Object.fromEntries(
    Array.from({ length: 1001 }, (_, i) => ['cf_f' + i, 'value']),
  );
  const store = memoryStore({
    [path('leads', 'a')]: row('a', 'Website'),
    [path('leads', 'z')]: { ...row('z'), customFields: malformed },
  });
  await store.reindexLeads({ commit, now: t0 });
  const state = await store.get(LEAD_INDEX_STATE);
  await assert.rejects(store.reindexLeads({ commit, now: t1 }), /safe size/);
  assert.deepEqual(await store.get(LEAD_INDEX_STATE), state);
  assert.equal(
    (
      await store.query(path('leads'), {
        filters: [
          [
            LEAD_INDEX_FIELD,
            'array-contains',
            equalityToken('source', 'website'),
          ],
        ],
      })
    ).length,
    0,
  );
});
