import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backfillOperationalCounterExpiry } from '../src/operational-counter-backfill.js';
import { path } from '../src/policy.js';
import { memoryStore } from '../src/store.js';

test('backfill is resumable, bounded and preserves existing operational counter values', async () => {
  const prefix = 'users/legacy/aiBudgets/';
  const at = '2026-10-30T02:00:00.000Z';
  const future = new Date('2026-12-01T02:00:00.000Z');
  const seed = {
    [path('members', 'legacy')]: { active: false },
    [path('members', 'new')]: { active: true },
    [path('pushTests', 'legacy')]: { at },
    [path('pushTests', 'new')]: { at, expiresAt: future },
    [path('pushTests', 'malformed')]: { at: 'unknown' },
    [path('importChunks', 'legacy')]: { at },
    ['users/new/aiBudgets/2026-10-30T01-00']: { count: 1, expiresAt: future },
    [prefix + '2026-02-30T00-00']: { count: 2 },
  };
  for (let minute = 0; minute < 55; minute++)
    seed[prefix + '2026-10-30T01-' + String(minute).padStart(2, '0')] = { count: 2 };
  const store = memoryStore(seed);

  assert.deepEqual(await backfillOperationalCounterExpiry(store), { scanned: 50, converted: 49, completed: false });
  assert.deepEqual(await backfillOperationalCounterExpiry(store), { scanned: 6, converted: 6, completed: false });
  assert.deepEqual(await backfillOperationalCounterExpiry(store), { scanned: 1, converted: 0, completed: false });
  assert.deepEqual(await backfillOperationalCounterExpiry(store), { scanned: 3, converted: 1, completed: true });
  assert.deepEqual(await backfillOperationalCounterExpiry(store), { scanned: 0, converted: 0, completed: false });
  assert.deepEqual(await store.get(prefix + '2026-10-30T01-54'), {
    count: 2,
    expiresAt: new Date('2026-10-31T01:54:00.000Z'),
  });
  assert.deepEqual(await store.get(path('pushTests', 'legacy')), {
    at,
    expiresAt: new Date('2026-10-31T02:00:00.000Z'),
  });
  for (const record of [path('pushTests', 'malformed'), path('pushTests', 'new'), path('importChunks', 'legacy'), prefix + '2026-02-30T00-00'])
    assert.deepEqual(await store.get(record), seed[record]);
});
