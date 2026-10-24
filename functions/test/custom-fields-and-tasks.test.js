import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path, googleIdentity } from '../src/policy.js';
import { DEFAULT_FIELD_OPTIONS } from '../src/field-options.js';
import { dispatchReminders } from '../src/reminders.js';
const now = '2026-10-24T12:00:00.000Z';
async function setup() {
  const store = memoryStore(),
    app = createApp({
      store,
      now: () => now,
      verifyToken: async (uid) => ({
        uid,
        email:
          uid === 'admin'
            ? 'spraghav@gmail.com'
            : uid === 'other'
              ? 'theharithsa@gmail.com'
              : 'viewer@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      }),
    });
  const call = (method, url, body, uid = 'admin') => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + uid)
      .set('Idempotency-Key', randomUUID());
    return body ? r.send(body) : r;
  };
  await call('get', '/me').expect(200);
  await call('get', '/me', null, 'other').expect(200);
  await store.run(async (tx) =>
    tx.set(path('members', 'viewer'), {
      id: 'viewer',
      uid: 'viewer',
      role: 'Viewer',
      scope: 'all',
      active: true,
      version: 1,
      capabilities: ['leads:read'],
    }),
  );
  return { store, call };
}
const lead = {
  name: 'Synthetic customer',
  phone: '+12025550188',
  enquiryDate: '2026-10-24',
};
const task = {
  title: 'Original reminder',
  dueAt: '2026-10-25T10:00:00Z',
  timezone: 'Asia/Kolkata',
  kind: 'administrative',
};
test('only admins can save workspace choices; protected values, uniqueness and versions are enforced', async () => {
  const s = await setup();
  const c = (await s.call('get', '/field-options', null, 'viewer').expect(200))
    .body;
  assert.equal(c.version, 1);
  const values = structuredClone(DEFAULT_FIELD_OPTIONS);
  values.stage.push('Negotiating');
  values.outcome.push('Assistant answered');
  values.source.push('Partner programme');
  values.zone.push('Healthcare');
  values.countryCode.push('+49');
  await s
    .call('patch', '/field-options', { expectedVersion: 1, values }, 'viewer')
    .expect(403);
  const updated = (
    await s
      .call('patch', '/field-options', { expectedVersion: 1, values })
      .expect(200)
  ).body;
  assert.equal(updated.version, 2);
  assert.ok(updated.values.stage.includes('Negotiating'));
  await s
    .call('patch', '/field-options', { expectedVersion: 1, values })
    .expect(409);
  const bad = structuredClone(values);
  bad.disposition = bad.disposition.filter((v) => v !== 'Do not contact');
  await s
    .call('patch', '/field-options', { expectedVersion: 2, values: bad })
    .expect(400);
  const duplicate = structuredClone(values);
  duplicate.source.push('PARTNER PROGRAMME');
  await s
    .call('patch', '/field-options', { expectedVersion: 2, values: duplicate })
    .expect(400);
});
test('custom stages and outcomes work in lead capture, calls and imports; unconfigured workflow values fail', async () => {
  const s = await setup(),
    values = structuredClone(DEFAULT_FIELD_OPTIONS);
  values.stage.push('Negotiating');
  values.outcome.push('Assistant answered');
  values.disposition.push('Awaiting documents');
  await s
    .call('patch', '/field-options', { expectedVersion: 1, values })
    .expect(200);
  const l = (
    await s
      .call('post', '/leads', { ...lead, stage: 'Negotiating' })
      .expect(200)
  ).body;
  await s
    .call('post', '/leads', {
      ...lead,
      phone: '+12025550189',
      stage: 'Made up',
    })
    .expect(400);
  await s
    .call('post', '/leads/' + l.id + '/activities', {
      type: 'call',
      outcome: 'Made up',
      expectedVersion: 1,
    })
    .expect(400);
  await s
    .call('post', '/leads/' + l.id + '/activities', {
      type: 'call',
      outcome: 'Assistant answered',
      disposition: 'Awaiting documents',
      expectedVersion: 1,
    })
    .expect(200);
  const i = (
    await s
      .call('post', '/imports/preview', {
        filename: 'synthetic.csv',
        sheet: 'Sheet1',
        rows: [
          { ...lead, phone: '+12025550190', legacyStatus: 'Legacy sales step' },
        ],
        statusMap: { 'Legacy sales step': 'Negotiating' },
      })
      .expect(200)
  ).body;
  assert.equal(i.valid, 1);
  await s.call('post', '/imports/' + i.id + '/commit', {}).expect(200);
  assert.ok(
    (await s.store.query(path('leads'))).some(
      (l) => l.stage === 'Negotiating' && l.importId,
    ),
  );
});
test('retiring a choice preserves existing records and unchanged edits while preventing new use', async () => {
  const s = await setup(),
    values = structuredClone(DEFAULT_FIELD_OPTIONS);
  values.stage.push('Retired stage');
  await s
    .call('patch', '/field-options', { expectedVersion: 1, values })
    .expect(200);
  const l = (
    await s
      .call('post', '/leads', { ...lead, stage: 'Retired stage' })
      .expect(200)
  ).body;
  await s
    .call('patch', '/field-options', {
      expectedVersion: 2,
      values: DEFAULT_FIELD_OPTIONS,
    })
    .expect(200);
  await s
    .call('patch', '/leads/' + l.id, {
      expectedVersion: 1,
      name: 'Corrected synthetic name',
      stage: 'Retired stage',
    })
    .expect(200);
  await s
    .call('post', '/leads', {
      ...lead,
      phone: '+12025550191',
      stage: 'Retired stage',
    })
    .expect(400);
  const filtered = (
    await s
      .call(
        'get',
        '/leads?filters=[]&stage=' + encodeURIComponent('Retired stage'),
      )
      .expect(200)
  ).body;
  assert.equal(filtered.items.length, 1);
});
test('task editing changes title, type and timing with validation, owner checks and stale-write protection', async () => {
  const s = await setup(),
    l = (await s.call('post', '/leads', lead).expect(200)).body,
    t = (await s.call('post', '/tasks', { ...task, leadId: l.id }).expect(200))
      .body;
  await s
    .call(
      'patch',
      '/tasks/' + t.id,
      { expectedVersion: 1, title: 'Other user edit' },
      'other',
    )
    .expect(403);
  const edited = (
    await s
      .call('patch', '/tasks/' + t.id, {
        expectedVersion: 1,
        title: 'Prepare proposal',
        kind: 'outreach',
        dueAt: '2026-10-26T05:00:00Z',
      })
      .expect(200)
  ).body;
  assert.equal(edited.version, 2);
  assert.equal(edited.title, 'Prepare proposal');
  assert.equal(edited.kind, 'outreach');
  await s
    .call('patch', '/tasks/' + t.id, { expectedVersion: 1, title: 'Stale' })
    .expect(409);
  await s
    .call('patch', '/tasks/' + t.id, { expectedVersion: 2, title: '' })
    .expect(400);
  await s
    .call('patch', '/tasks/' + t.id, {
      expectedVersion: 2,
      recipientUid: 'other',
    })
    .expect(400);
});
test('deleting a task removes it from all UI queries and prevents pending delivery without erasing its audit', async () => {
  const s = await setup(),
    t = (await s.call('post', '/tasks', task).expect(200)).body;
  await s.call('delete', '/tasks/' + t.id, { expectedVersion: 2 }).expect(409);
  await s
    .call('delete', '/tasks/' + t.id, { expectedVersion: 1 }, 'viewer')
    .expect(403);
  await s.call('delete', '/tasks/' + t.id, { expectedVersion: 1 }).expect(200);
  await s.call('get', '/tasks/' + t.id).expect(404);
  for (const state of ['Pending', 'Cancelled'])
    assert.equal(
      (await s.call('get', '/tasks?state=' + state).expect(200)).body.items
        .length,
      0,
    );
  const stored = await s.store.get(path('tasks', t.id));
  assert.equal(stored.deleted, true);
  assert.equal(stored.state, 'Cancelled');
  assert.ok(stored.deletedAt);
  assert.equal(
    (await s.store.get(path('reminderDeliveries', t.id + '_1'))).status,
    'Cancelled',
  );
  let sent = 0;
  await dispatchReminders({
    store: s.store,
    now: () => '2026-10-26T12:00:00Z',
    send: async () => sent++,
  });
  assert.equal(sent, 0);
  assert.ok(
    (await s.store.query(path('auditEvents'))).some(
      (e) =>
        e.action === 'DELETE /api/v1/tasks/:id' ||
        e.action === 'DELETE /tasks/:id',
    ),
  );
});
test('another admin cannot delete a lead-linked task owned by someone else', async () => {
  const s = await setup(),
    l = (await s.call('post', '/leads', lead).expect(200)).body,
    t = (await s.call('post', '/tasks', { ...task, leadId: l.id }).expect(200))
      .body;
  await s
    .call('delete', '/tasks/' + t.id, { expectedVersion: 1 }, 'other')
    .expect(403);
  assert.equal(
    (await s.call('get', '/tasks/' + t.id).expect(200)).body.title,
    task.title,
  );
});

test('custom lead fields enforce types, required values, dropdown choices, permissions and retirement without losing history', async () => {
  const s = await setup();
  const config = (await s.call('get', '/field-options').expect(200)).body;
  const fields = [
    {
      id: 'cf_product',
      label: 'Product interest',
      type: 'select',
      options: ['Drone', 'Camera'],
      required: true,
      deleted: false,
    },
    {
      id: 'cf_budget',
      label: 'Budget',
      type: 'number',
      options: [],
      required: false,
      deleted: false,
    },
    {
      id: 'cf_date',
      label: 'Meeting date',
      type: 'date',
      options: [],
      required: false,
      deleted: false,
    },
    {
      id: 'cf_approved',
      label: 'Approved',
      type: 'checkbox',
      options: [],
      required: false,
      deleted: false,
    },
  ];
  await s
    .call(
      'patch',
      '/field-options',
      {
        expectedVersion: config.version,
        values: config.values,
        customFields: fields,
        hiddenFields: ['company'],
      },
      'viewer',
    )
    .expect(403);
  const saved = (
    await s
      .call('patch', '/field-options', {
        expectedVersion: config.version,
        values: config.values,
        customFields: fields,
        hiddenFields: ['company'],
      })
      .expect(200)
  ).body;
  assert.deepEqual(saved.hiddenFields, ['company']);
  await s.call('post', '/leads', lead).expect(400);
  for (const invalid of [
    { cf_product: 'Other' },
    { cf_product: 'Drone', cf_budget: '100' },
    { cf_product: 'Drone', cf_date: '2026-02-30' },
    { cf_product: 'Drone', cf_approved: 'yes' },
    { cf_product: 'Drone', cf_unknown: 'x' },
  ])
    await s
      .call('post', '/leads', { ...lead, customFields: invalid })
      .expect(400);
  const l = (
    await s
      .call('post', '/leads', {
        ...lead,
        customFields: {
          cf_product: 'Drone',
          cf_budget: 0,
          cf_approved: false,
          cf_date: '2026-11-02',
        },
      })
      .expect(200)
  ).body;
  assert.equal(l.customFields.cf_budget, 0);
  await s
    .call('patch', '/field-options', {
      expectedVersion: saved.version,
      values: saved.values,
      customFields: fields.map((f) =>
        f.id === 'cf_budget' ? { ...f, type: 'text' } : f,
      ),
    })
    .expect(400);
  const retired = (
    await s
      .call('patch', '/field-options', {
        expectedVersion: saved.version,
        values: saved.values,
        customFields: fields.map((f) =>
          f.id === 'cf_product' ? { ...f, deleted: true } : f,
        ),
      })
      .expect(200)
  ).body;
  await s
    .call('patch', '/field-options', {
      expectedVersion: retired.version,
      values: retired.values,
      customFields: fields,
    })
    .expect(400);
  await s
    .call('patch', '/leads/' + l.id, {
      expectedVersion: l.version,
      customFields: { cf_product: 'Camera' },
    })
    .expect(400);
  const updated = (
    await s
      .call('patch', '/leads/' + l.id, {
        expectedVersion: l.version,
        customFields: { cf_budget: 250 },
      })
      .expect(200)
  ).body;
  assert.equal(updated.customFields.cf_product, 'Drone');
  assert.equal(updated.customFields.cf_approved, false);
  assert.equal(updated.customFields.cf_budget, 250);
  // Saving shared dropdowns with the original request shape must preserve custom definitions.
  const after = (
    await s
      .call('patch', '/field-options', {
        expectedVersion: retired.version,
        values: retired.values,
      })
      .expect(200)
  ).body;
  assert.equal(after.customFields.length, 4);
  assert.deepEqual(after.hiddenFields, ['company']);
});
test('invalid custom definitions and hiding essential fields are rejected', async () => {
  const s = await setup();
  const c = (await s.call('get', '/field-options').expect(200)).body;
  const f = {
    id: 'cf_one',
    label: 'One',
    type: 'select',
    options: [],
    required: false,
    deleted: false,
  };
  for (const change of [
    { customFields: [f] },
    {
      customFields: [
        { ...f, type: 'text' },
        { ...f, type: 'text' },
      ],
    },
    { hiddenFields: ['name'] },
    { customFields: [{ ...f, id: '__proto__', type: 'text' }] },
  ])
    await s
      .call('patch', '/field-options', {
        expectedVersion: 1,
        values: c.values,
        ...change,
      })
      .expect(400);
});

test('custom filters use validated definitions and remain scoped to permitted leads', async () => {
  const s = await setup();
  const c = (await s.call('get', '/field-options').expect(200)).body;
  const fields = [
    {
      id: 'cf_product',
      label: 'Product',
      type: 'text',
      options: [],
      required: false,
      deleted: false,
    },
    {
      id: 'cf_date',
      label: 'Visit',
      type: 'date',
      options: [],
      required: false,
      deleted: false,
    },
  ];
  await s
    .call('patch', '/field-options', {
      expectedVersion: 1,
      values: c.values,
      customFields: fields,
    })
    .expect(200);
  await s
    .call('post', '/leads', {
      ...lead,
      customFields: { cf_product: 'Drone', cf_date: '2026-11-02' },
    })
    .expect(200);
  const query = (filters) =>
    '/leads?filters=' + encodeURIComponent(JSON.stringify(filters));
  const result = (
    await s
      .call(
        'get',
        query([
          { field: 'cf_product', op: 'equals', value: 'drone' },
          { field: 'cf_date', op: 'after', value: '2026-11-01' },
        ]),
      )
      .expect(200)
  ).body;
  assert.equal(result.items.length, 1);
  await s
    .call('get', query([{ field: 'cf_missing', op: 'equals', value: 'x' }]))
    .expect(400);
  await s
    .call(
      'get',
      query([{ field: 'cf_product', op: 'before', value: '2026-11-01' }]),
    )
    .expect(400);
  await s.store.run(async (tx) =>
    tx.set(path('members', 'viewer'), {
      ...(await tx.get(path('members', 'viewer'))),
      scope: 'assigned',
    }),
  );
  const scoped = (
    await s
      .call(
        'get',
        query([{ field: 'cf_product', op: 'equals', value: 'drone' }]),
        null,
        'viewer',
      )
      .expect(200)
  ).body;
  assert.equal(scoped.items.length, 0);
});

test('Google profile photos come only from verified identity claims and fall back safely', () => {
  const token = {
    uid: 'photo-user',
    email: 'photo@example.com',
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
    picture: 'https://lh3.googleusercontent.com/a/example',
  };
  assert.equal(googleIdentity(token).photoURL, token.picture);
  assert.equal(
    googleIdentity({ ...token, picture: 'javascript:alert(1)' }).photoURL,
    undefined,
  );
  assert.equal(
    googleIdentity({ ...token, picture: 'https://example.com/photo.png' })
      .photoURL,
    undefined,
  );
  assert.throws(() => googleIdentity({ ...token, email_verified: false }));
});
