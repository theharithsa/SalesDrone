import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTerminalDeliveries } from '../src/delivery-retention.js';
import { path } from '../src/policy.js';
import { memoryStore } from '../src/store.js';

test('retention drains old terminal receipts in bounded batches and preserves pending work', async () => {
  const at = '2026-11-12T00:00:00.000Z';
  const oldAt = '2026-08-01T00:00:00.000Z';
  const recentAt = '2026-11-11T00:00:00.000Z';
  const job = (id, status, nextAttemptAt, finishedAt = nextAttemptAt) =>
    [path('reminderDeliveries', id), { id, status, nextAttemptAt, finishedAt }];
  const receipt = (id) => [path('deviceDeliveries', id), { id, status: 'Accepted' }];
  const store = memoryStore(Object.fromEntries([
    job('dispatched', 'Dispatched', oldAt),
    job('failed', 'Failed', oldAt),
    job('cancelled', 'Cancelled', oldAt),
    job('leased', 'Pending', oldAt),
    job('recent', 'Dispatched', recentAt),
    job('recently-cancelled', 'Cancelled', oldAt, recentAt),
    ...Array.from({ length: 21 }, (_, index) => receipt('dispatched_' + index)),
    receipt('failed_a'),
    receipt('cancelled_a'),
    receipt('leased_a'),
    receipt('recent_a'),
    receipt('recently-cancelled_a'),
    receipt('dispatched-different-job_a'),
    [path('tasks', 'task-1'), { id: 'task-1' }],
    ['users/member/notifications/dispatched', { id: 'dispatched' }],
  ]));
  assert.deepEqual(await cleanTerminalDeliveries(store, at), { removed: 24 });
  assert.ok(await store.get(path('reminderDeliveries', 'dispatched')));
  assert.deepEqual(await cleanTerminalDeliveries(store, at), { removed: 2 });
  assert.deepEqual(await cleanTerminalDeliveries(store, at), { removed: 0 });
  for (const id of ['dispatched', 'failed', 'cancelled'])
    assert.equal(await store.get(path('reminderDeliveries', id)), null);
  for (const id of ['leased', 'recent', 'recently-cancelled']) {
    assert.ok(await store.get(path('reminderDeliveries', id)));
    assert.ok(await store.get(path('deviceDeliveries', id + '_a')));
  }
  assert.ok(await store.get(path('deviceDeliveries', 'dispatched-different-job_a')));
  assert.ok(await store.get(path('tasks', 'task-1')));
  assert.ok(await store.get('users/member/notifications/dispatched'));
});
