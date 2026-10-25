import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leadPathId,
  reviewActivities,
} from '../apps/web/src/lib/lead-workspace.ts';
test('lead route accepts a single encoded identifier and rejects invalid paths', () => {
  assert.equal(leadPathId('/leads/demo-0'), 'demo-0');
  assert.equal(leadPathId('/leads/a%20b/'), 'a b');
  for (const path of [
    '/leads',
    '/leads/',
    '/tasks/a',
    '/leads/a/b',
    '/leads/a%2Fb',
    '/leads/%E0%A4%A',
  ])
    assert.equal(leadPathId(path), null);
});
test('review surfaces actionable analysis states without counting scheduled or dismissed reminders', () => {
  const items = [
    'Pending',
    'Failed',
    'NeedsReview',
    'Scheduled',
    'Dismissed',
    'NoAction',
    'Disabled',
  ].map((status, i) => ({ id: String(i), autoReminder: { status } }));
  assert.deepEqual(
    reviewActivities([...items, { id: 'plain' }]).map((a) => a.id),
    ['0', '1', '2'],
  );
});
