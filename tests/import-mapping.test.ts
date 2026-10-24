import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCommentHeader,
  mapImportRows,
} from '../apps/web/src/lib/import-mapping.ts';
import { worksheetColumns } from '../apps/web/src/lib/lead-fields.ts';
test('multiple comment columns keep column identity, sheet order and repeated text while blank cells are skipped', () => {
  const headers = [
    'Name',
    'Phone',
    'Initial discussion',
    '1st follow up',
    'Customer reply',
  ];
  const [row] = mapImportRows(
    [['Alex Morgan', '+12025550169', 'Same note', '', 'Same note']],
    headers,
    { name: '0', phone: '1' },
    [4, 2, 3, 4],
  );
  assert.equal(row.name, 'Alex Morgan');
  assert.deepEqual(row.importComments, [
    { sourceColumn: 'Initial discussion', sourceIndex: 2, notes: 'Same note' },
    { sourceColumn: 'Customer reply', sourceIndex: 4, notes: 'Same note' },
  ]);
  assert.ok(isCommentHeader('1st follow up'));
  assert.ok(isCommentHeader('Initial discussion'));
  assert.ok(!isCommentHeader('Customer name'));
  assert.ok(
    worksheetColumns.every(
      ([key]) =>
        ![
          'initialDiscussion',
          'followUp1',
          'followUp2',
          'followUp3',
          'followUp4',
        ].includes(key),
    ),
  );
});
