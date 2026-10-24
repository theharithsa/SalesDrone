import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  worksheetColumns,
  legacyImportColumns,
  detectHeaderRow,
  matchesColumnFilters,
} from '../apps/web/src/lib/lead-fields.ts';
test('PAC mapping has the exact fourteen first-sheet labels in source order', () => {
  assert.deepEqual(
    legacyImportColumns.map((x) => x[1]),
    [
      'Sl No',
      'Enq Source',
      'Name',
      'Contact No.',
      'Company Name',
      'Location, City',
      'Sector',
      'Enq Date',
      'Status',
      'Initial discussion',
      '1st follow up',
      '2nd follow up',
      '3rd follow up',
      '4th follow up',
    ],
  );
});
test('header detection skips the two blank opening rows and trims date header whitespace', () => {
  assert.equal(
    detectHeaderRow([
      [],
      [],
      worksheetColumns.map((x) => x[1] + ' '),
      ['1', 'PAC', 'Example'],
    ]),
    2,
  );
});
test('demo column filtering uses the same case and empty/date semantics as the server', () => {
  const l = {
    name: 'Synthetic Name',
    zone: 'Education',
    location: 'Bengaluru',
    enquiryDate: '2026-04-18',
    followUp1: '',
  };
  assert.equal(
    matchesColumnFilters(l, [
      { field: 'zone', op: 'equals', value: 'education' },
      { field: 'location', op: 'contains', value: 'BENG' },
      { field: 'followUp1', op: 'empty', value: '' },
      { field: 'enquiryDate', op: 'after', value: '2026-04-01' },
    ]),
    true,
  );
  assert.equal(
    matchesColumnFilters(l, [
      { field: 'name', op: 'contains', value: 'missing' },
    ]),
    false,
  );
});

test('visible fields use full names and omit the legacy serial number', () => {
  assert.ok(!worksheetColumns.some(([key]) => String(key) === 'serial'));
  assert.equal(
    worksheetColumns.find(([key]) => key === 'source')?.[1],
    'Enquiry source',
  );
  assert.equal(
    worksheetColumns.find(([key]) => key === 'enquiryDate')?.[1],
    'Enquiry date',
  );
});
