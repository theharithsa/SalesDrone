import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentAttempt } from '../apps/web/src/lib/comment-attempt.ts';
test('uncertain comment retry preserves payload version and key even after a lead refresh', () => {
  const first = commentAttempt(
    null,
    ' Follow up next week ',
    4,
    () => 'key-one',
  );
  assert.deepEqual(first, {
    notes: 'Follow up next week',
    expectedVersion: 4,
    key: 'key-one',
  });
  assert.equal(
    commentAttempt(first, 'Follow up next week', 5, () => 'key-two'),
    first,
  );
  const edited = commentAttempt(first, 'New discussion', 5, () => 'key-two');
  assert.equal(edited.key, 'key-two');
  assert.equal(edited.expectedVersion, 5);
});
test('empty or oversized comments never create a write attempt', () => {
  assert.throws(() => commentAttempt(null, '   ', 1));
  assert.throws(() => commentAttempt(null, 'a'.repeat(4001), 1));
});
