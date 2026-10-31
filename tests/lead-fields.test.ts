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

test('renamed header labels are detected without changing legacy workbook aliases', () => {
  assert.equal(
    detectHeaderRow(
      [
        [],
        [],
        ['Project contact', 'Industry'],
        ['Synthetic contact', 'Building'],
      ],
      ['Project contact', 'Industry'],
    ),
    2,
  );
  assert.equal(detectHeaderRow([[], ['Ｃｏｎｔａｃｔ']], ['Contact']), 1);
});


import { defaultFieldOptions, fieldRemovalReason } from '../apps/web/src/lib/field-options.ts';
test('field removal guards preserve required identity and one contact while permitting restoration', () => {
  assert.ok(fieldRemovalReason(defaultFieldOptions, 'name'));
  assert.ok(fieldRemovalReason(defaultFieldOptions, 'enquiryDate'));
  assert.equal(fieldRemovalReason(defaultFieldOptions, 'phone'), '');
  const phoneHidden = {...defaultFieldOptions, hiddenFields: ['phone']};
  assert.ok(fieldRemovalReason(phoneHidden, 'email'));
  assert.equal(fieldRemovalReason(phoneHidden, 'phone'), '');
  assert.ok(fieldRemovalReason({...defaultFieldOptions, hiddenFields: ['email']}, 'phone'));
  assert.equal(fieldRemovalReason(phoneHidden, 'stage'), '');
});

test('demo Exact match preserves literal text while Equals keeps its existing flexible matching',()=>{
 const lead={source:' Website ',stage:'New',customFields:{cf_product:'Ｒｅｔａｉｌ'}};
 assert.equal(matchesColumnFilters(lead,[{field:'source',op:'equals',value:'website'}]),true);
 assert.equal(matchesColumnFilters(lead,[{field:'source',op:'exact',value:'Website'}]),false);
 assert.equal(matchesColumnFilters(lead,[{field:'source',op:'exact',value:' Website '}]),true);
 assert.equal(matchesColumnFilters(lead,[{field:'cf_product',op:'exact',value:'Retail'}]),false);
 assert.equal(matchesColumnFilters(lead,[{field:'cf_product',op:'exact',value:'Ｒｅｔａｉｌ'}]),true);
});
