import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leadPathId,
  reviewActivities,
  filterLeadActivities,
  leadWorkspaceTabs,
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

test('lead views separate notes and calls while All retains every activity and review state in source order', () => {
  const items = [
    { id: 'n', type: 'note', autoReminder: { status: 'NeedsReview' } },
    { id: 'c', type: 'call', autoReminder: { status: 'Failed' } },
    { id: 's', type: 'stage_change' },
    { id: 'i', type: 'note', imported: true, sourceColumn: 'First discussion' },
  ];
  const ids = (tab: (typeof leadWorkspaceTabs)[number]) =>
    filterLeadActivities(items, tab).map((a) => a.id);
  assert.deepEqual(ids('all'), ['n', 'c', 's', 'i']);
  assert.deepEqual(ids('comments'), ['n', 'i']);
  assert.deepEqual(ids('calls'), ['c']);
  assert.deepEqual(ids('review'), ['n', 'c']);
  assert.deepEqual(ids('tasks'), []);
  assert.deepEqual(ids('files'), []);
  assert.deepEqual(filterLeadActivities([], 'calls'), []);
  assert.deepEqual(
    items.map((a) => a.id),
    ['n', 'c', 's', 'i'],
  );
});
