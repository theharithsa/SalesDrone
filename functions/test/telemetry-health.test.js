import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitorExporter, boundedFlush } from '../src/telemetry-health.js';
import { lifecycleCounts } from '../src/observable-store.js';
test('export callbacks are once-only and errors never escape or expose exporter content', async () => {
  const health = { traces: { success: 0, failure: 0 } };
  let calls = 0,
    warnings = 0;
  const exporter = monitorExporter(
    {
      export(_batch, done) {
        done({ code: 1, error: Error('PRIVATE TOKEN') });
        done({ code: 0 });
      },
    },
    'traces',
    health,
    () => warnings++,
  );
  exporter.export([], () => calls++);
  assert.equal(calls, 1);
  assert.equal(warnings, 1);
  assert.equal(health.traces.failure, 1);
  const throwing = monitorExporter(
    {
      export() {
        throw Error('PRIVATE TOKEN');
      },
    },
    'traces',
    health,
  );
  throwing.export([], () => calls++);
  assert.equal(calls, 2);
  assert.ok(!JSON.stringify(health).includes('PRIVATE'));
});
test('bounded flush distinguishes rejection and timeout without throwing or waiting indefinitely', async () => {
  assert.deepEqual(
    await boundedFlush([
      {
        forceFlush: async () => {
          throw Error('PRIVATE');
        },
      },
    ]),
    { outcome: 'failure' },
  );
  assert.deepEqual(
    await boundedFlush([{ forceFlush: () => new Promise(() => {}) }], 10),
    { outcome: 'timeout' },
  );
  assert.deepEqual(await boundedFlush([{ forceFlush: async () => {} }]), {
    outcome: 'success',
  });
});
test('lifecycle counters use known transitions and omit customer field values', () => {
  assert.deepEqual(
    lifecycleCounts('tasks', { state: 'Pending' }, { state: 'Completed' }),
    { completed: 1 },
  );
  assert.deepEqual(lifecycleCounts('tasks', null, { state: 'Completed' }), {});
  assert.deepEqual(
    lifecycleCounts('tasks', { state: 'Completed' }, { state: 'Completed' }),
    {},
  );
  assert.deepEqual(
    lifecycleCounts('tasks', { state: 'Completed' }, { state: 'Pending' }),
    { reopened: 1 },
  );
  const value = lifecycleCounts(
    'leads',
    { stage: 'PRIVATE', assignedToUid: 'PRIVATE', doNotContact: false },
    {
      stage: 'OTHER',
      assignedToUid: 'OTHER',
      doNotContact: true,
      archived: true,
    },
  );
  assert.deepEqual(value, {
    archived: 1,
    suppressed: 1,
    stage_changed: 1,
    assignment_changed: 1,
  });
  assert.ok(!JSON.stringify(value).includes('PRIVATE'));
});
