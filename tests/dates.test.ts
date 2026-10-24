import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localInstant } from '../apps/web/src/lib/dates.ts';
test('reminder input preserves the chosen instant and rejects daylight-saving gaps and ambiguity', () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.equal(localInstant('2026-10-24T10:00'), '2026-10-24T14:00:00.000Z');
    assert.throws(() => localInstant('2026-03-08T02:30'), /does not exist/);
    assert.throws(() => localInstant('2026-11-01T01:30'), /occurs twice/);
    process.env.TZ = 'Asia/Kolkata';
    assert.equal(localInstant('2026-10-24T10:00'), '2026-10-24T04:30:00.000Z');
  } finally {
    if (original) process.env.TZ = original;
    else delete process.env.TZ;
  }
});
