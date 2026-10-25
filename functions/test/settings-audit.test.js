import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path, hash } from '../src/policy.js';
import { deliverTelemetry } from '../src/telemetry-outbox.js';
import {
  settingsAuditTransaction,
  queueSettingsAudits,
} from '../src/settings-audit.js';
const type = 'com.avinyatech.salesdrone.settings.audit.committed';
async function setup() {
  const store = memoryStore(),
    app = createApp({
      store,
      verifyToken: async (uid) => ({
        uid,
        email:
          uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.invalid',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      }),
    });
  const call = (method, url, body, who = 'admin', key) => {
    let r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + who);
    if (key) r = r.set('Idempotency-Key', key);
    return body === undefined ? r : r.send(body);
  };
  await call('get', '/me').expect(200);
  await store.run(async (tx) =>
    tx.set(path('members', 'viewer'), {
      id: 'viewer',
      uid: 'viewer',
      active: true,
      role: 'Viewer',
      scope: 'assigned',
      capabilities: ['leads:read'],
      version: 1,
    }),
  );
  const events = async () =>
    (await store.query(path('telemetryOutbox'), { limit: 100 })).filter(
      (x) => x.event.type === type,
    );
  return { store, call, events };
}
test('personal settings create durable key-level audits with OTel unavailable; unchanged and denied saves do not emit changes', async () => {
  const { store, call, events } = await setup();
  const prefs = {
    timezone: 'Asia/Kolkata',
    appearance: 'system',
    bookMode: false,
  };
  await call('patch', '/me', prefs, 'viewer').expect(200);
  assert.equal((await events()).length, 0);
  await call(
    'patch',
    '/me',
    {
      ...prefs,
      appearance: 'dark',
      bookMode: true,
      automaticReminders: false,
      reminderTime: '14:00',
    },
    'viewer',
  ).expect(200);
  const rows = await events();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((x) => x.event.data['settings.section']).sort(), [
    'appearance',
    'reminders',
  ]);
  assert.deepEqual(
    rows.find((x) => x.event.data['settings.section'] === 'appearance').event
      .data['settings.changed_keys'],
    ['appearance', 'bookMode'],
  );
  const audits = (
    await store.query(path('auditEvents'), { limit: 100 })
  ).filter((x) => x.settingsChanges);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actorUid, 'viewer');
  assert.ok(rows.every((x) => x.event.data['audit.id'] === audits[0].id));
  assert.ok(
    rows.every((x) => /^user:[a-f0-9]{32}$/.test(x.event.data['actor.id'])),
  );
  assert.ok(rows.every((x) => !JSON.stringify(x.event).includes('14:00')));
  await call(
    'patch',
    '/me',
    {
      ...prefs,
      appearance: 'dark',
      bookMode: true,
      automaticReminders: false,
      reminderTime: '14:00',
    },
    'viewer',
  ).expect(200);
  assert.equal((await events()).length, 2);
  await call(
    'patch',
    '/me',
    { ...prefs, bookMode: 'invalid' },
    'viewer',
  ).expect(400);
  await call('patch', '/me', prefs, 'outsider').expect(403);
  assert.equal((await events()).length, 2);
});
test('all editable Settings families are audited without exporting dynamic values, token secrets or target identities', async () => {
  const { store, call, events } = await setup();
  let current = (await call('get', '/workspace-settings').expect(200)).body;
  await call('patch', '/workspace-settings', {
    expectedVersion: current.version,
    exportsEnabled: false,
    assignedOnly: true,
  }).expect(200);
  current = (await call('get', '/ai-settings').expect(200)).body;
  await call('patch', '/ai-settings', {
    expectedVersion: current.version,
    instructions: 'PRIVATE PROMPT VALUE',
    insightMode: 'automatic',
  }).expect(200);
  current = (await call('get', '/field-options').expect(200)).body;
  await call('patch', '/field-options', {
    expectedVersion: current.version,
    labels: { company: 'PRIVATE LABEL VALUE' },
    values: { ...current.values, location: ['PRIVATE CITY VALUE'] },
  }).expect(200);
  current = (await call('get', '/scoring-settings').expect(200)).body;
  await call('patch', '/scoring-settings', {
    expectedVersion: current.version,
    enabled: false,
    factors: current.factors,
  }).expect(200);
  await call('patch', '/members/viewer', {
    expectedVersion: 1,
    role: 'Viewer',
    scope: 'all',
    active: true,
  }).expect(200);
  const invitationKey = randomUUID(),
    inv = {
      email: 'PRIVATE_INVITE@example.invalid',
      role: 'Viewer',
      scope: 'assigned',
    };
  await call('post', '/invitations', inv, 'admin', invitationKey).expect(200);
  let count = (await events()).length;
  await call('post', '/invitations', inv, 'admin', invitationKey).expect(200);
  assert.equal((await events()).length, count);
  await call(
    'post',
    '/invitations/' + hash(inv.email.toLowerCase()) + '/accept',
    {},
    'PRIVATE_INVITE',
  ).expect(200);
  const token = (
    await call('post', '/personal-access-tokens', {
      name: 'PRIVATE TOKEN NAME',
      scopes: ['leads:read'],
      expiresInDays: 7,
    }).expect(200)
  ).body;
  await call(
    'delete',
    '/personal-access-tokens/' + token.personalAccessToken.id,
    {},
  ).expect(200);
  const device = {
    id: randomUUID(),
    token: 'PRIVATE_FCM_TOKEN_VALUE_123456789012345678901234567890',
    label: 'PRIVATE DEVICE LABEL',
  };
  await call('post', '/devices', device).expect(200);
  await call('delete', '/devices/' + device.id).expect(200);
  const rows = await events(),
    sections = new Set(rows.map((x) => x.event.data['settings.section']));
  for (const section of [
    'reports-access',
    'ai.insights',
    'manage-fields',
    'ai.scoring',
    'people.members',
    'people.invitations',
    'developer.tokens',
    'notifications.devices',
  ])
    assert.ok(sections.has(section), section);
  const fields = rows.find(
    (x) => x.event.data['settings.section'] === 'manage-fields',
  ).event.data['settings.changed_keys'];
  assert.ok(fields.includes('labels.company'));
  assert.ok(fields.includes('values.location'));
  const payload = JSON.stringify(rows.map((x) => x.event));
  assert.ok(!payload.includes('PRIVATE'));
  assert.ok(!payload.includes(token.token));
  assert.ok(!payload.includes('viewer'));
  const logs = [],
    sent = [];
  const result = await deliverTelemetry({
    store,
    tenant: 'https://fixture.live.dynatrace.com',
    key: 'synthetic',
    telemetry: {
      span: async (_n, fn) => fn(),
      capture: () => ({}),
      log: (name, attrs) => logs.push({ name, attrs }),
    },
    fetchImpl: async (_u, options) => {
      assert.equal(
        options.headers['Content-Type'],
        'application/cloudevent+json',
      );
      sent.push(JSON.parse(options.body));
      return { status: 202, headers: new Headers() };
    },
  });
  assert.equal(result.rejected, 0);
  assert.equal(result.delivered, rows.length);
  assert.ok(
    logs.some(
      (l) =>
        l.name === 'settings.audit.delivered' &&
        l.attrs['settings.section'] === 'ai.insights',
    ),
  );
  assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
  assert.ok(sent.every((e) => e.data['audit.id'] && e.data['transaction.id']));
});
test('settings audits/outbox roll back with failed domain writes and record final net changes only', async () => {
  const store = memoryStore();
  await store.run(async (tx) =>
    tx.set('users/fixture', {
      timezone: 'Asia/Kolkata',
      appearance: 'light',
      bookMode: false,
    }),
  );
  const run = async (fail) =>
    store.run(async (tx) => {
      const tracking = settingsAuditTransaction(tx);
      tracking.tx.set('users/fixture', {
        timezone: 'Asia/Kolkata',
        appearance: 'dark',
        bookMode: false,
      });
      tracking.tx.set('users/fixture', {
        timezone: 'Asia/Kolkata',
        appearance: 'light',
        bookMode: true,
      });
      const changes = await tracking.changes();
      assert.deepEqual(changes[0].keys, ['bookMode']);
      const audit = {
        id: randomUUID(),
        actorUid: 'fixture',
        action: 'PATCH /me',
        requestId: randomUUID(),
        createdAt: new Date().toISOString(),
        settingsChanges: changes,
      };
      tx.set(path('auditEvents', audit.id), audit);
      queueSettingsAudits(tx, audit, changes);
      if (fail) throw Error('rollback fixture');
    });
  await assert.rejects(run(true));
  assert.equal((await store.get('users/fixture')).bookMode, false);
  assert.equal(
    (await store.query(path('auditEvents'), { limit: 20 })).length,
    0,
  );
  assert.equal(
    (await store.query(path('telemetryOutbox'), { limit: 20 })).length,
    0,
  );
  await run(false);
  assert.equal(
    (await store.query(path('telemetryOutbox'), { limit: 20 })).length,
    1,
  );
});

test('large custom-field changes are hashed and chunked without losing control keys', async () => {
  const store = memoryStore();
  await store.run(async (tx) => {
    const tracking = settingsAuditTransaction(tx);
    tracking.tx.set(path('settings', 'fields'), {
      version: 2,
      customFields: Array.from({ length: 20 }, (_, i) => ({
        id: 'cf_private_' + i,
        label: 'PRIVATE CUSTOMER LABEL',
        type: 'text',
        options: [],
        required: false,
        deleted: false,
      })),
    });
    const changes = await tracking.changes();
    const fieldChange = changes.find((c) => c.section === 'manage-fields');
    assert.equal(fieldChange.keys.length, 100);
    assert.ok(
      fieldChange.keys.every((k) =>
        /^customFields\.[a-f0-9]{16}\.(label|type|options|required|deleted)$/.test(
          k,
        ),
      ),
    );
    queueSettingsAudits(
      tx,
      {
        id: randomUUID(),
        actorUid: 'fixture',
        action: 'PATCH /field-options',
        requestId: randomUUID(),
        createdAt: new Date().toISOString(),
      },
      changes,
    );
  });
  const rows = await store.query(path('telemetryOutbox'), { limit: 20 });
  assert.equal(rows.length, 3);
  assert.equal(
    rows.reduce((n, r) => n + r.event.data['settings.changed_count'], 0),
    100,
  );
  assert.equal(new Set(rows.map((r) => r.id)).size, 3);
  assert.ok(
    rows.every((r) => r.event.data['settings.changed_keys'].length <= 40),
  );
  assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
  assert.ok(!JSON.stringify(rows).includes('cf_private'));
});
