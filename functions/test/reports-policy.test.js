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
