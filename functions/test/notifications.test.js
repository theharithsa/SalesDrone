import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { dispatchReminders } from '../src/reminders.js';

async function setup() {
  const store = memoryStore();
  let clock = '2026-10-24T12:00:00.000Z';
  const app = createApp({
    store,
    now: () => clock,
    verifyToken: async (uid) => ({
      uid,
      email:
        uid === 'admin'
          ? 'spraghav@gmail.com'
          : uid === 'other'
            ? 'theharithsa@gmail.com'
            : uid + '@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  const call = (who, method, url, body, key = randomUUID()) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + who)
      .set('Idempotency-Key', key);
    return body === undefined ? r : r.send(body);
  };
  await call('admin', 'get', '/me').expect(200);
  await call('other', 'get', '/me').expect(200);
  await store.run(async (tx) =>
    tx.set(path('members', 'rep'), {
      id: 'rep',
      uid: 'rep',
      email: 'rep@example.com',
      name: 'Demo rep',
      active: true,
      scope: 'assigned',
      role: 'SDR',
      capabilities: ['leads:read', 'leads:edit', 'tasks:write'],
      version: 1,
    }),
  );
  const create = async (key = randomUUID()) =>
    (
      await call(
        'admin',
        'post',
        '/leads',
        {
          name: 'Private Synthetic Customer',
          phone: '+12025550188',
          enquiryDate: '2026-10-24',
        },
        key,
      ).expect(200)
    ).body;
  const assign = async (lead, target) =>
    (
      await call('admin', 'patch', '/leads/' + lead.id + '/assignment', {
        expectedVersion: lead.version,
        assignedToUid: target,
      }).expect(200)
    ).body;
  const device = async (who, id, token) =>
    store.run(async (tx) =>
      tx.set(`users/${who}/devices/${id}`, { id, enabled: true, token }),
    );
  return {
    store,
    call,
    create,
    assign,
    device,
    now: () => clock,
    time: (t) => {
      clock = t;
    },
  };
}
test('lead capture atomically creates one owner-only inbox alert and push job, including on request replay', async () => {
  const s = await setup();
  const key = randomUUID();
  const lead = await s.create(key);
  await s.create(key);
  const inbox = (await s.call('admin', 'get', '/notifications').expect(200))
    .body.items;
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].kind, 'lead_created');
  assert.equal(inbox[0].leadId, lead.id);
  assert.equal(inbox[0].readAt, null);
  assert.equal((await s.store.query(path('reminderDeliveries'))).length, 1);
  assert.equal(
    (await s.call('other', 'get', '/notifications').expect(200)).body.items
      .length,
    0,
  );
  assert.equal(
    (await s.call('rep', 'get', '/notifications').expect(200)).body.items
      .length,
    0,
  );
  await s.call('outsider', 'get', '/notifications').expect(403);
});
test('assignment alerts target the new owner, ignore unchanged assignment, and cannot revive after transfer away and back', async () => {
  const s = await setup();
  let l = await s.create();
  l = await s.assign(l, 'rep');
  const first = (await s.call('rep', 'get', '/notifications').expect(200)).body
    .items[0];
  assert.equal(first.kind, 'lead_assigned');
  assert.equal(
    (await s.call('admin', 'get', '/notifications').expect(200)).body.items
      .length,
    0,
  );
  const noChange = await s.assign(l, 'rep');
  assert.equal(noChange.version, l.version);
  assert.equal((await s.store.query('users/rep/notifications')).length, 1);
  l = await s.assign(l, 'other');
  l = await s.assign(l, 'rep');
  const current = (await s.call('rep', 'get', '/notifications').expect(200))
    .body.items;
  assert.equal(current.length, 1);
  assert.notEqual(current[0].id, first.id);
  await s
    .call('rep', 'patch', '/notifications/' + first.id, { read: true })
    .expect(404);
  await s.device('rep', 'browser', 'rep-device');
  await s.device('other', 'browser', 'other-device');
  const sent = [];
  await dispatchReminders({
    store: s.store,
    now: s.now,
    send: async (m) => sent.push(m),
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].token, 'rep-device');
  l = await s.assign(l, null);
  assert.equal(
    (await s.call('rep', 'get', '/notifications').expect(200)).body.items
      .length,
    0,
  );
  assert.equal(l.assignedToUid, null);
});
test('lead push retries only failed devices, retains a read state and uses private generic lock-screen text and a lead deep link', async () => {
  const s = await setup();
  const l = await s.create();
  await s.device('admin', 'good', 'good');
  await s.device('admin', 'bad', 'bad');
  let fail = true;
  const sent = [];
  const send = async (m) => {
    sent.push(m);
    if (m.token === 'bad' && fail) throw Error('temporary');
  };
  await dispatchReminders({ store: s.store, now: s.now, send });
  const n = (await s.call('admin', 'get', '/notifications').expect(200)).body
    .items[0];
  await s
    .call('admin', 'patch', '/notifications/' + n.id, { read: true })
    .expect(200);
  fail = false;
  s.time('2026-10-24T12:05:00.000Z');
  await dispatchReminders({ store: s.store, now: s.now, send });
  await dispatchReminders({ store: s.store, now: s.now, send });
  assert.equal(sent.filter((m) => m.token === 'good').length, 1);
  assert.equal(sent.filter((m) => m.token === 'bad').length, 2);
  assert.ok(
    sent.every(
      (m) =>
        m.data.url === '/leads?lead=' + l.id &&
        !m.data.body.includes(l.name) &&
        !m.data.body.includes(l.phone),
    ),
  );
  assert.equal((await s.store.query('users/admin/notifications')).length, 1);
  assert.ok(
    (await s.call('admin', 'get', '/notifications').expect(200)).body.items[0]
      .readAt,
  );
});
test('membership and assignment are rechecked immediately before each push; stale jobs cancel', async () => {
  const s = await setup();
  let l = await s.assign(await s.create(), 'rep');
  await s.device('rep', 'one', 'one');
  await s.device('rep', 'two', 'two');
  const sent = [];
  await dispatchReminders({
    store: s.store,
    now: s.now,
    send: async (m) => {
      sent.push(m);
      l = await s.assign(l, 'other');
    },
  });
  assert.equal(sent.length, 1);
  assert.equal(
    (await s.store.query(path('reminderDeliveries'))).filter(
      (j) => j.kind === 'lead_assigned' && j.recipientUid === 'rep',
    )[0].status,
    'Cancelled',
  );
  await s.device('other', 'one', 'other');
  await s.store.run(async (tx) =>
    tx.set(path('members', 'other'), {
      ...(await tx.get(path('members', 'other'))),
      active: false,
    }),
  );
  await dispatchReminders({
    store: s.store,
    now: s.now,
    send: async () => assert.fail('revoked member must not receive a push'),
  });
});
test('read and unread are explicit, private, validated states; legacy reminder notifications remain supported', async () => {
  const s = await setup();
  await s.create();
  const n = (await s.call('admin', 'get', '/notifications').expect(200)).body
    .items[0];
  await s.call('admin', 'patch', '/notifications/' + n.id, {}).expect(200);
  assert.ok(
    (await s.call('admin', 'get', '/notifications').expect(200)).body.items[0]
      .readAt,
  );
  await s
    .call('admin', 'patch', '/notifications/' + n.id, { read: false })
    .expect(200);
  assert.equal(
    (await s.call('admin', 'get', '/notifications').expect(200)).body.items[0]
      .readAt,
    null,
  );
  await s
    .call('other', 'patch', '/notifications/' + n.id, { read: false })
    .expect(404);
  await s
    .call('admin', 'patch', '/notifications/' + n.id, { read: 'false' })
    .expect(400);
  await s
    .call('admin', 'patch', '/notifications/' + n.id, {
      read: true,
      readAt: 'anything',
    })
    .expect(400);
  const task = (
    await s
      .call('admin', 'post', '/tasks', {
        title: 'Personal task',
        dueAt: '2026-10-24T11:00:00Z',
      })
      .expect(200)
  ).body;
  await s.store.run(async (tx) =>
    tx.set('users/admin/notifications/legacy', {
      id: 'legacy',
      taskId: task.id,
      leadId: null,
      title: 'Legacy reminder',
      createdAt: s.now(),
      readAt: null,
    }),
  );
  await s
    .call('admin', 'patch', '/notifications/legacy', { read: true })
    .expect(200);
  await s
    .call('admin', 'patch', '/notifications/legacy', { read: false })
    .expect(200);
  assert.equal(
    (await s.store.get('users/admin/notifications/legacy')).readAt,
    null,
  );
});
