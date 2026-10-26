import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUniqueRows,
  retainLeadSelection,
} from '../apps/web/src/lib/lead-pagination.ts';
test('overlapping/replayed pages do not duplicate leads and retain updated data in stable order', () => {
  const first = [
    { id: 'a', version: 1 },
    { id: 'b', version: 1 },
  ];
  const next = [
    { id: 'b', version: 2 },
    { id: 'c', version: 1 },
  ];
  const merged = appendUniqueRows(first, next);
  assert.deepEqual(merged, [first[0], next[0], next[1]]);
  assert.deepEqual(appendUniqueRows(merged, next), merged);
  assert.deepEqual(first, [
    { id: 'a', version: 1 },
    { id: 'b', version: 1 },
  ]);
});
test('sparse empty pages preserve loaded rows, allowing the caller to follow the next cursor', () => {
  const rows = [{ id: 'a', version: 1 }];
  assert.deepEqual(appendUniqueRows(rows, []), rows);
  assert.deepEqual(appendUniqueRows([], []), []);
});
test('pagination preserves selection, without selecting new rows or retaining changed/missing records', () => {
  const before = new Map([
    ['a', 1],
    ['b', 2],
    ['removed', 1],
  ]);
  const selection = new Set(['a', 'b', 'removed']);
  const rows = [
    { id: 'a', version: 1 },
    { id: 'b', version: 3 },
    { id: 'new', version: 1 },
  ];
  assert.deepEqual([...retainLeadSelection(selection, before, rows)], ['a']);
  assert.deepEqual([...selection], ['a', 'b', 'removed']);
});
