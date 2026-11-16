import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leadPathId,
  buildLeadTimeline,
  reviewActivities,
  filterLeadActivities,
  leadWorkspaceTabs,
  tabAfterLeadLoad,
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

test('same-lead route loading preserves the requested Files tab and another lead starts at All', () => {
  assert.equal(tabAfterLeadLoad('files', 'lead-a', 'lead-a'), 'files');
  assert.equal(tabAfterLeadLoad('comments', 'lead-a', 'lead-a'), 'comments');
  assert.equal(tabAfterLeadLoad('files', 'lead-a', 'lead-b'), 'all');
  assert.equal(tabAfterLeadLoad('files', undefined, 'lead-a'), 'all');
});


test('All merges recorded work by creation time, not due or import time', () => {
  const task = { id: 'shared', leadId: 'lead', title: 'Send quote', timezone: 'UTC', state: 'Pending', version: 1 };
  const rows = buildLeadTimeline([
    { id: 'import', type: 'note', imported: true, createdAt: '2026-11-20T10:00:00Z' },
    { id: 'shared', type: 'call', createdAt: '2026-11-16T10:00:00Z' },
    { id: 'note', type: 'note', createdAt: '2026-11-16T11:00:00Z' },
  ], [
    { ...task, createdAt: '2026-11-16T09:00:00Z', dueAt: '2026-12-01T10:00:00Z', kind: 'outreach' },
    { ...task, id: 'admin', createdAt: '2026-11-16T12:00:00Z', dueAt: '2026-11-16T08:00:00Z', kind: 'administrative' },
  ]);
  assert.deepEqual(rows.map(({ kind, id }) => [kind, id]), [
    ['task', 'task:admin'], ['activity', 'activity:note'], ['activity', 'activity:shared'],
    ['reminder', 'task:shared'], ['activity', 'activity:import'],
  ]);
  assert.equal(rows.at(-1)?.date, null);
});
