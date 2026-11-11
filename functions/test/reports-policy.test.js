import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path, requireMember } from '../src/policy.js';
import { WORKSPACE_SETTINGS_PATH } from '../src/workspace-settings.js';
import { deliveryContext } from '../src/notifications.js';
import { PRESETS } from '../src/contracts.js';
import { dashboardSnapshot, dashboardBrief } from '../src/dashboard.js';
import { analyzeNotes, enqueueAnalysis } from '../src/automatic-reminders.js';
async function setup() {
  const store = memoryStore();
  const app = createApp({
    store,
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  const call = (uid, m, p, b) => {
    const q = request(app)
      [m]('/api/v1' + p)
      .set('Authorization', 'Bearer ' + uid)
      .set('Idempotency-Key', randomUUID());
    return b ? q.send(b) : q;
  };
  await call('admin', 'get', '/me').expect(200);
  await store.run(async (tx) => {
    for (const uid of ['rep', 'other'])
      tx.set(path('members', uid), {
        uid,
        id: uid,
        role: 'SDR',
        scope: 'all',
        capabilities: PRESETS.SDR,
        active: true,
        version: 1,
      });
    for (let i = 0; i < 125; i++)
      tx.set(path('leads', 'lead' + String(i).padStart(3, '0')), {
        id: 'lead' + String(i).padStart(3, '0'),
        name: i === 0 ? '=HYPERLINK("x")' : 'Lead ' + i,
        phone: '+001234',
        zone: i % 2 ? 'MEP' : 'Concrete',
        stage: 'New',
        source: 'Website',
        assignedToUid: i < 120 ? 'rep' : 'other',
        archived: false,
        version: 1,
      });
  });
  return { store, app, call };
}
test('filtered reports traverse every matching page, honor selected fields, scope and signed column/filter bindings', async () => {
  const s = await setup();
  const input = {
    columns: ['name', 'phone', 'zone'],
    filters: [{ field: 'zone', op: 'equals', value: 'Concrete' }],
    limit: 20,
  };
  let cursor,
    rows = [];
  do {
    const p = (
      await s
        .call('rep', 'post', '/leads/export', {
          ...input,
          ...(cursor ? { cursor } : {}),
        })
        .expect(200)
    ).body;
    rows.push(...p.rows);
    cursor = p.nextCursor;
    if (cursor) {
      await s
        .call('rep', 'post', '/leads/export', {
          ...input,
          columns: ['phone'],
          cursor,
        })
        .expect(400);
      await s
        .call('other', 'post', '/leads/export', { ...input, cursor })
        .expect(400);
    }
  } while (cursor);
  assert.equal(rows.length, 60);
  assert.ok(
    rows.every((r) => Number(r.id.slice(4)) < 120 && r.values.length === 3),
  );
  assert.ok(rows.some((r) => r.values[0].startsWith('=')));
  assert.equal(rows[0].values[1], '+001234');
  assert.ok(!JSON.stringify(rows).includes('assignedToUid'));
  await s
    .call('admin', 'post', '/leads/export', {
      ...input,
      columns: ['not-a-field'],
    })
    .expect(400);
  await s
    .call('admin', 'post', '/leads/export', {
      ...input,
      columns: ['name', 'name'],
    })
    .expect(400);
  const audit = await s.store.query(path('auditEvents'));
  assert.ok(
    audit.some((a) => a.action === 'POST /leads/export' && a.columnCount === 3),
  );
  assert.ok(!JSON.stringify(audit).includes('HYPERLINK'));
});
test('workspace controls default to assigned-only, preserve configured scope when disabled, protect edits and invalidate report cursors', async () => {
  const s = await setup();
  const me = (await s.call('rep', 'get', '/me').expect(200)).body;
  assert.equal(me.member.scope, 'assigned');
  assert.equal(me.workspaceSettings.assignedOnly, true);
  await s.call('rep', 'get', '/leads/lead124').expect(404);
  assert.equal(
    (await s.call('admin', 'get', '/leads?limit=100').expect(200)).body.items
      .length,
    100,
  );
  const first = (
    await s
      .call('admin', 'post', '/leads/export', { columns: ['name'], limit: 1 })
      .expect(200)
  ).body;
  await s
    .call('rep', 'patch', '/workspace-settings', {
      expectedVersion: 1,
      exportsEnabled: false,
      assignedOnly: false,
    })
    .expect(403);
  await s
    .call('admin', 'patch', '/workspace-settings', {
      expectedVersion: 1,
      exportsEnabled: false,
      assignedOnly: true,
    })
    .expect(200);
  await s
    .call('admin', 'post', '/leads/export', { columns: ['name'] })
    .expect(403);
  await s
    .call('admin', 'patch', '/workspace-settings', {
      expectedVersion: 1,
      exportsEnabled: true,
      assignedOnly: false,
    })
    .expect(409);
  await s
    .call('admin', 'patch', '/workspace-settings', {
      expectedVersion: 2,
      exportsEnabled: true,
      assignedOnly: false,
    })
    .expect(200);
  await s
    .call('admin', 'post', '/leads/export', {
      columns: ['name'],
      limit: 1,
      cursor: first.nextCursor,
    })
    .expect(400);
  await s.call('rep', 'get', '/leads/lead124').expect(200);
  assert.equal(
    (await s.call('rep', 'get', '/me').expect(200)).body.member.scope,
    'all',
  );
  await s.store.run(async (tx) => {
    const m = await tx.get(path('members', 'rep'));
    tx.set(path('members', 'rep'), { ...m, scope: 'assigned' });
  });
  await s.call('rep', 'get', '/leads/lead124').expect(404);
  await s
    .call('admin', 'patch', '/workspace-settings', {
      expectedVersion: 3,
      exportsEnabled: 'true',
      assignedOnly: true,
    })
    .expect(400);
});
test('current assigned-only policy suppresses old cross-owner reminder deliveries and in-flight AI publication', async () => {
  const s = await setup();
  await s.store.run(async (tx) => {
    tx.set(WORKSPACE_SETTINGS_PATH, {
      version: 2,
      exportsEnabled: true,
      assignedOnly: false,
    });
    tx.set(path('tasks', 'task'), {
      id: 'task',
      recipientUid: 'rep',
      leadId: 'lead124',
      state: 'Pending',
      version: 1,
      kind: 'administrative',
      dueAt: '2026-10-26T06:00:00Z',
      timezone: 'Asia/Kolkata',
    });
  });
  const job = { taskId: 'task', taskVersion: 1 };
  assert.ok(await deliveryContext(s.store, job));
  const member = await requireMember(s.store, { uid: 'rep' }, 'leads:read');
  const snapshot = await dashboardSnapshot(s.store, member);
  await assert.rejects(
    () =>
      dashboardBrief({
        store: s.store,
        member,
        snapshot,
        summarize: async () => {
          await s.store.run(async (tx) =>
            tx.set(WORKSPACE_SETTINGS_PATH, {
              version: 3,
              exportsEnabled: true,
              assignedOnly: true,
            }),
          );
          return {
            headline: 'Synthetic',
            summary: 'Synthetic',
            insights: [
              {
                title: 'Review work',
                detail: 'Review pending tasks',
                type: 'priority',
                taskIds: [],
                leadIds: [],
                facts: [
                  { key: 'pendingTasks', value: snapshot.facts.pendingTasks },
                ],
              },
            ],
          };
        },
      }),
    (e) => e.code === 'SCOPE_CHANGED',
  );
  assert.equal(await deliveryContext(s.store, job), null);
});
test('personal tokens require the separate export scope and cannot edit workspace controls', async () => {
  const s = await setup();
  const issue = async (scopes) => {
    const r = await request(s.app)
      .post('/api/v1/personal-access-tokens')
      .set('Authorization', 'Bearer admin')
      .send({ name: 'Synthetic report', scopes, expiresInDays: 7 })
      .expect(200);
    return r.body.token;
  };
  const read = await issue(['leads:read']);
  await request(s.app)
    .post('/api/v1/leads/export')
    .set('Authorization', 'Bearer ' + read)
    .send({ columns: ['name'] })
    .expect(403);
  const exportKey = await issue(['leads:export']);
  await request(s.app)
    .post('/api/v1/leads/export')
    .set('Authorization', 'Bearer ' + exportKey)
    .send({ columns: ['name'] })
    .expect(200);
  await request(s.app)
    .patch('/api/v1/workspace-settings')
    .set('Authorization', 'Bearer ' + exportKey)
    .send({ expectedVersion: 1, exportsEnabled: false, assignedOnly: false })
    .expect(403);
});

test('global search finds earlier comments and formatted phones, and exports only scoped notes', async () => {
  const s = await setup();
  await s.store.run(async (tx) => {
    for (const [id, leadId, type, notes] of [
      ['earlier', 'lead000', 'note', '=Historic fictional sample'],
      ['recent', 'lead000', 'note', 'Recent update'],
      ['private', 'lead124', 'note', 'Historic fictional sample'],
      ['call', 'lead000', 'call', 'Excluded call outcome'],
    ]) {
      tx.set(path('activities', id), { id, leadId, type, notes, createdAt: '2026-11-01T10:00:00.000Z' });
    }
  });
  const query = '/leads?field=all&search=historic+fictional';
  const first = (await s.call('rep', 'get', query).expect(200)).body;
  assert.equal(first.items.length, 0);
  assert.ok(first.nextCursor);
  const second = (await s.call('rep', 'get', query + '&cursor=' + encodeURIComponent(first.nextCursor)).expect(200)).body;
  assert.deepEqual(second.items.map((lead) => lead.id), ['lead000']);
  assert.equal((await s.call('rep', 'get', '/leads?field=all&search=001-234').expect(200)).body.items.length, 30);
  await s.call('rep', 'get', '/leads?field=all&search=other&cursor=' + encodeURIComponent(first.nextCursor)).expect(400);
  const input = { columns: ['phone', 'name'], search: 'historic fictional', field: 'all', includeComments: true };
  const page = (await s.call('rep', 'post', '/leads/export', input).expect(200)).body;
  const exported = (await s.call('rep', 'post', '/leads/export', { ...input, cursor: page.nextCursor }).expect(200)).body;
  assert.deepEqual(exported.columns.map((c) => c.key), ['phone', 'name']);
  assert.deepEqual(exported.comments.map((row) => [row.leadId, row.text]), [
    ['lead000', '=Historic fictional sample'],
    ['lead000', 'Recent update'],
  ]);
});


test('member feature controls apply to current sessions and preserve Admin and manual workflows', async () => {
  const { store, call } = await setup();
  const initial = (await call('rep', 'get', '/workspace-settings').expect(200)).body;
  assert.equal(initial.memberExportsEnabled, true);
  assert.equal(initial.memberIntelligenceEnabled, true);
  const leadId = 'lead001';
  await store.run(async (tx) => {
    const rep = await tx.get(path('members', 'rep'));
    tx.set(path('members', 'rep'), {
      ...rep,
      capabilities: [...rep.capabilities, 'assistant:query', 'hygiene:read', 'hygiene:run', 'hygiene:ai'],
    });
    const member = await requireMember(tx, { uid: 'rep' }, 'leads:read');
    const lead = await tx.get(path('leads', leadId));
    await enqueueAnalysis(tx, {
      id: 'synthetic-note', leadId, revision: 1, type: 'note',
      notes: 'Call next Monday at 10:00',
    }, member, lead, '2026-11-10T08:00:00.000Z');
  });
  const scan = (await call('rep', 'post', '/lead-hygiene/scans', {}).expect(200)).body;
  await store.run(async (tx) => {
    const record = await tx.get(path('hygieneScans', scan.id));
    tx.set(path('hygieneScans', scan.id), {
      ...record, status: 'Completed', summaryStatus: 'Completed',
      summary: { themes: [{ label: 'Synthetic theme' }] },
    });
  });
  const blocked = {
    ...initial,
    expectedVersion: initial.version,
    memberExportsEnabled: false,
    memberIntelligenceEnabled: false,
  };
  delete blocked.version;
  await call('rep', 'patch', '/workspace-settings', blocked).expect(403);
  const disabled = (await call('admin', 'patch', '/workspace-settings', blocked).expect(200)).body;
  const me = (await call('rep', 'get', '/me').expect(200)).body;
  assert.deepEqual(me.member.leadFeatureAccess, { export: false, intelligence: false });
  assert.ok(me.member.capabilities.includes('hygiene:read'));
  assert.ok(!me.member.capabilities.includes('hygiene:ai'));
  assert.ok(!me.member.capabilities.includes('assistant:query'));
  for (const [method, url, payload, code] of [
    ['post', '/leads/export', { columns: ['name'] }, 'EXPORT_DISABLED'],
    ['post', '/dashboard/insights', {}, 'INTELLIGENCE_DISABLED'],
    ['get', '/lead-scores?ids=lead001', undefined, 'INTELLIGENCE_DISABLED'],
    ['get', '/leads/lead001/score', undefined, 'INTELLIGENCE_DISABLED'],
    ['post', '/leads/lead001/score/refresh', {}, 'INTELLIGENCE_DISABLED'],
    ['get', '/lead-assistant/conversations', undefined, 'FORBIDDEN'],
    ['post', '/lead-hygiene/scans/scan/summary', {}, 'FORBIDDEN'],
  ]) {
    const denied = await call('rep', method, url, payload).expect(403);
    assert.equal(denied.body.error.code, code);
  }
  const hygiene = (await call('rep', 'get', '/lead-hygiene/scans/' + scan.id).expect(200)).body;
  assert.equal(hygiene.status, 'Completed');
  assert.equal(hygiene.summary, null);
  await call('rep', 'post', '/lead-hygiene/scans', {}).expect(200);
  await call('rep', 'get', '/leads/lead001').expect(200);
  const dashboard = (await call('rep', 'get', '/dashboard').expect(200)).body;
  assert.equal(dashboard.intelligenceEnabled, false);
  assert.deepEqual(dashboard.priority, []);
  assert.deepEqual(dashboard.scoreDistribution, []);
  await call('admin', 'post', '/leads/export', { columns: ['name'], limit: 1 }).expect(200);
  await call('admin', 'get', '/leads/lead001/score').expect(200);
  await call('admin', 'get', '/lead-assistant/conversations').expect(200);

  let extractions = 0;
  await analyzeNotes({
    store,
    now: () => '2026-11-11T08:00:00.000Z',
    extract: async () => { extractions++; },
  });
  assert.equal(extractions, 0);
  assert.equal((await store.get(path('noteAnalyses', 'synthetic-note_r1'))).status, 'Cancelled');

  const legacySave = (await call('admin', 'patch', '/workspace-settings', {
    expectedVersion: disabled.version, exportsEnabled: true, assignedOnly: false,
  }).expect(200)).body;
  assert.equal(legacySave.memberExportsEnabled, false);
  assert.equal(legacySave.memberIntelligenceEnabled, false);
  await call('admin', 'patch', '/workspace-settings', {
    expectedVersion: legacySave.version, exportsEnabled: true, assignedOnly: true,
    memberExportsEnabled: true, memberIntelligenceEnabled: true,
  }).expect(200);
  await call('rep', 'post', '/leads/export', { columns: ['name'], limit: 1 }).expect(200);
  await call('rep', 'get', '/leads/lead001/score').expect(200);
});
