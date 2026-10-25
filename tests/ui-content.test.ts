import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials } from '../apps/web/src/lib/types.ts';
test('avatar initials handle whitespace, compound names, missing names and grapheme clusters', () => {
  assert.equal(initials('  Sam   Lee '), 'SL');
  assert.equal(initials('Christopher Alexander Montgomery III'), 'CI');
  assert.equal(initials('👩🏽‍💻 Priya'), '👩🏽‍💻P');
  assert.equal(initials('🦊 Fox'), '🦊F');
  assert.equal(initials('Jo'), 'J');
  assert.equal(initials('王秀英'), '王');
  assert.equal(initials('   '), '?');
});
