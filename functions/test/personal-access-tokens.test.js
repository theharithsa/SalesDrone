import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { PAT_ROUTES, TOKEN_SCOPES } from '../src/personal-access-tokens.js';
async function setup(verifyPersonalTokenOwner = null) {
  let time = '2026-10-25T03:00:00.000Z';
  const store = memoryStore();
  let checks = 0;
  const app = createApp({
    store,
    now: () => time,
    verifyPersonalTokenOwner,
    verifyToken: async (uid) => ({
      uid,
      email:
        uid === 'admin'
          ? 'spraghav@gmail.com'
          : uid === 'other'
            ? 'theharithsa@gmail.com'
            : uid + '@example.invalid',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
    verifyAppCheck: async (token) => {
      checks++;
      if (token !== 'appcheck')
        throw Object.assign(new Error('App Check required'), {
          status: 403,
          code: 'APP_CHECK',
        });
    },
  });
  const call = (credential, method, url, body, key) => {
    let r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + credential);
    if (!credential.startsWith('sd_pat_'))
      r = r.set('X-Firebase-AppCheck', 'appcheck');
    if (key) r = r.set('Idempotency-Key', key);
    return body === undefined ? r : r.send(body);
  };
  await call('admin', 'get', '/me').expect(200);
  await call('other', 'get', '/me').expect(200);
  const issue = async (
    scopes = ['leads:read'],
    name = 'Synthetic integration',
    expiresInDays = 30,
  ) =>
    (
      await call('admin', 'post', '/personal-access-tokens', {
        name,
        scopes,
        expiresInDays,
      }).expect(200)
    ).body;
  return {
    store,
    app,
    call,
    issue,
    setTime: (v) => (time = v),
    checks: () => checks,
  };
}
test('one-time issuance stores a hash only and metadata never reveals credentials', async () => {
  const { store, issue, call, checks } = await setup();
  const result = await issue();
  assert.match(result.token, /^sd_pat_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/);
  assert.equal(result.personalAccessToken.scopes[0], 'leads:read');
  assert.ok(!JSON.stringify(store.dump()).includes(result.token));
  const saved = await store.get(
    path('personalAccessTokens', result.personalAccessToken.id),
  );
  assert.match(saved.tokenHash, /^[a-f0-9]{64}$/);
  const before = checks();
  await call(result.token, 'get', '/leads').expect(200);
  assert.equal(checks(), before);
  const list = (
    await call('admin', 'get', '/personal-access-tokens').expect(200)
  ).body;
  assert.equal(list.items.length, 1);
  assert.ok(list.items[0].lastUsedAt);
  assert.equal(list.availableScopes.length, TOKEN_SCOPES.length);
  assert.ok(!JSON.stringify(list).includes(result.token));
  assert.ok(!JSON.stringify(list).includes(saved.tokenHash));
  await call(result.token, 'get', '/personal-access-tokens').expect(403);
  await call(result.token, 'post', '/personal-access-tokens', {
    name: 'Escalation',
    scopes: ['leads:read'],
  }).expect(403);
  await call(result.token, 'get', '/me').expect(403);
  await request((await setup()).app)
    .get('/api/v1/leads')
    .set('Authorization', 'Bearer admin')
    .expect(403);
});
test('read-only token cannot write, manage admin/device settings or invoke AI generation', async () => {
  const { issue, call } = await setup();
  const { token } = await issue();
  for (const [method, url, body] of [
    ['post', '/leads', { name: 'Denied' }],
    ['get', '/tasks'],
    ['patch', '/field-options', {}],
    ['get', '/members'],
    ['get', '/devices'],
    ['post', '/dashboard/insights', {}],
    ['post', '/leads/anything/score/refresh', {}],
    ['post', '/invitations/anything/accept', {}],
  ]) {
    const r = await call(token, method, url, body);
    assert.equal(r.status, 403, url);
  }
  await call(token, 'get', '/leads').expect(200);
});
test('scoped CRUD shares validation, optimistic versions, replay protection and soft deletion', async () => {
  const { issue, call } = await setup();
  const { token } = await issue([
    'leads:read',
    'leads:create',
    'leads:edit',
    'leads:archive',
    'activities:read',
    'activities:write',
    'tasks:read',
    'tasks:write',
  ]);
  const body = {
      name: 'Synthetic token enquiry',
      phone: '+12025550160',
      enquiryDate: '2026-10-25',
    },
    key = randomUUID();
  let lead = (await call(token, 'post', '/leads', body, key).expect(200)).body;
  assert.equal(
    (await call(token, 'post', '/leads', body, key).expect(200)).body.id,
    lead.id,
  );
  await call(token, 'post', '/leads', { name: 'Different' }, key).expect(409);
  lead = (
    await call(token, 'patch', '/leads/' + lead.id, {
      expectedVersion: lead.version,
      company: 'Synthetic company',
    }).expect(200)
  ).body;
  await call(token, 'patch', '/leads/' + lead.id, {
    expectedVersion: 1,
    company: 'Stale',
  }).expect(409);
  const activity = (
    await call(
      token,
      'post',
      '/leads/' + lead.id + '/activities',
      {
        type: 'note',
        notes: 'Synthetic API note',
        expectedVersion: lead.version,
      },
      randomUUID(),
    ).expect(200)
  ).body;
  assert.ok(activity.activity.id);
  await call(token, 'get', '/leads/' + lead.id + '/activities').expect(200);
  const task = (
    await call(
      token,
      'post',
      '/tasks',
      {
        title: 'Synthetic task',
        dueAt: '2026-10-26T10:00:00.000Z',
        timezone: 'Etc/UTC',
        kind: 'administrative',
      },
      randomUUID(),
    ).expect(200)
  ).body;
  const edited = (
    await call(token, 'patch', '/tasks/' + task.id, {
      expectedVersion: task.version,
      title: 'Edited task',
    }).expect(200)
  ).body;
  await call(token, 'delete', '/tasks/' + task.id, {
    expectedVersion: edited.version,
  }).expect(200);
  await call(token, 'get', '/tasks/' + task.id).expect(404);
  lead = (await call(token, 'get', '/leads/' + lead.id).expect(200)).body;
  await call(token, 'post', '/leads/' + lead.id + '/archive', {
    expectedVersion: lead.version,
  }).expect(200);
  assert.equal(
    (await call(token, 'get', '/leads/' + lead.id)).body.archived,
    true,
  );
});
test('compound call changes require explicit stage and follow-up scopes', async () => {
  const { issue, call } = await setup();
  const lead = (
    await call(
      'admin',
      'post',
      '/leads',
      {
        name: 'Synthetic scope lead',
        phone: '+12025550161',
        enquiryDate: '2026-10-25',
      },
      randomUUID(),
    ).expect(200)
  ).body;
  const { token } = await issue([
    'leads:read',
    'activities:write',
    'leads:archive',
  ]);
  const input = {
    type: 'call',
    outcome: 'Connected',
    notes: 'No scheduling instruction',
    expectedVersion: lead.version,
  };
  await call(
    token,
    'post',
    '/leads/' + lead.id + '/activities',
    { ...input, stage: 'Working' },
    randomUUID(),
  ).expect(403);
  await call(
    token,
    'post',
    '/leads/' + lead.id + '/activities',
    {
      ...input,
      followUp: {
        title: 'Test',
        dueAt: '2026-10-26T10:00:00.000Z',
        timezone: 'Etc/UTC',
        kind: 'outreach',
      },
    },
    randomUUID(),
  ).expect(403);
  await call(
    token,
    'post',
    '/leads/' + lead.id + '/activities',
    input,
    randomUUID(),
  ).expect(200);
});
test('revocation, expiry, tampering and owner suspension or role downgrade invalidate tokens', async () => {
  const { store, issue, call, setTime } = await setup();
  let r = await issue();
  await call(r.token + 'x', 'get', '/leads').expect(401);
  await call(r.token.slice(0, -3) + 'abc', 'get', '/leads').expect(401);
  await call(
    'other',
    'delete',
    '/personal-access-tokens/' + r.personalAccessToken.id,
    {},
  ).expect(404);
  await call('other', 'get', '/personal-access-tokens')
    .expect(200)
    .then((v) => assert.equal(v.body.items.length, 0));
  await call(
    'admin',
    'delete',
    '/personal-access-tokens/' + r.personalAccessToken.id,
    {},
  ).expect(200);
  await call(
    'admin',
    'delete',
    '/personal-access-tokens/' + r.personalAccessToken.id,
    {},
  ).expect(200);
  await call(r.token, 'get', '/leads').expect(401);
  r = await issue();
  setTime('2026-11-25T03:00:00.000Z');
  await call(r.token, 'get', '/leads').expect(401);
  setTime('2026-10-25T03:00:00.000Z');
  const admin = await store.get(path('members', 'admin'));
  await store.run((tx) =>
    tx.set(path('members', 'admin'), { ...admin, active: false }),
  );
  await call(r.token, 'get', '/leads').expect(401);
  await store.run((tx) =>
    tx.set(path('members', 'admin'), { ...admin, role: 'SDR' }),
  );
  await call(r.token, 'get', '/leads').expect(401);
});
test('current owner capabilities and assigned scope constrain access and replay', async () => {
  const { store, issue, call } = await setup();
  const r = await issue(['leads:read', 'leads:create']);
  const key = randomUUID(),
    input = {
      name: 'Synthetic assigned lead',
      phone: '+12025550162',
      enquiryDate: '2026-10-25',
    };
  const lead = (await call(r.token, 'post', '/leads', input, key).expect(200))
    .body;
  let m = await store.get(path('members', 'admin'));
  await store.run((tx) =>
    tx.set(path('members', 'admin'), {
      ...m,
      capabilities: ['leads:read'],
      version: m.version + 1,
    }),
  );
  await call(
    r.token,
    'post',
    '/leads',
    { name: 'Denied' },
    randomUUID(),
  ).expect(403);
  await store.run((tx) => {
    tx.set(path('members', 'admin'), {
      ...m,
      scope: 'assigned',
      version: m.version + 2,
    });
    tx.set(path('leads', lead.id), { ...lead, assignedToUid: 'other' });
  });
  await call(r.token, 'get', '/leads/' + lead.id).expect(404);
  await call(r.token, 'post', '/leads', input, key).expect(404);
  assert.equal(
    (await call(r.token, 'get', '/leads').expect(200)).body.items.length,
    0,
  );
});
test('limits, validation and Google-only admin management cannot be bypassed', async () => {
  const { store, issue, call, setTime } = await setup();
  for (const body of [
    { name: '', scopes: ['leads:read'] },
    { name: 'Test', scopes: ['members:write'] },
    { name: 'Test', scopes: [] },
    { name: 'Test', scopes: ['leads:read', 'leads:read'] },
    { name: 'Test', scopes: ['leads:read'], expiresInDays: 365 },
  ])
    await call('admin', 'post', '/personal-access-tokens', body).expect(400);
  await call(
    'admin',
    'post',
    '/personal-access-tokens',
    { name: 'Replay', scopes: ['leads:read'] },
    randomUUID(),
  ).expect(400);
  for (let i = 0; i < 20; i++) await issue(['leads:read'], 'Synthetic ' + i, 7);
  await call('admin', 'post', '/personal-access-tokens', {
    name: 'Too many',
    scopes: ['leads:read'],
  }).expect(409);
  setTime('2026-11-02T03:00:00.000Z');
  await issue();
  const m = await store.get(path('members', 'admin'));
  await store.run((tx) =>
    tx.set(path('members', 'admin'), { ...m, role: 'SDR' }),
  );
  await call('admin', 'get', '/personal-access-tokens').expect(403);
});
test('per-token authenticated request limit is enforced without App Check bypass for Google', async () => {
  const { issue, call } = await setup();
  const { token } = await issue();
  for (let i = 0; i < 120; i++) await call(token, 'get', '/leads').expect(200);
  const response = await call(token, 'get', '/leads').expect(429);
  assert.equal(response.headers['retry-after'], '60');
  await call('admin', 'get', '/leads').expect(200);
});
test('scope map is explicit, bounded and all defined scopes are used', () => {
  assert.equal(new Set(Object.values(PAT_ROUTES)).size, TOKEN_SCOPES.length);
  assert.ok(
    Object.keys(PAT_ROUTES).every((k) => /^(get|post|put|patch|delete) \//.test(k)),
  );
  assert.ok(
    !Object.keys(PAT_ROUTES).some(
      (k) => k.includes('personal-access-tokens') || k.includes('/members'),
    ),
  );
});
test('revocation between admission and the domain transaction prevents a write', async () => {
  const { store, issue, call } = await setup();
  const result = await issue(['leads:read', 'leads:create']);
  const original = store.run;
  let runs = 0;
  store.run = async (fn) => {
    runs++;
    if (runs === 2)
      await original(async (tx) => {
        const p = path('personalAccessTokens', result.personalAccessToken.id),
          t = await tx.get(p);
        tx.set(p, {
          ...t,
          active: false,
          revokedAt: '2026-10-25T03:00:00.000Z',
        });
      });
    return original(fn);
  };
  await call(
    result.token,
    'post',
    '/leads',
    { name: 'Must not commit', enquiryDate: '2026-10-25' },
    randomUUID(),
  ).expect(401);
  assert.equal(await store.count(path('leads')), 0);
});
test('owner aggregate limit and token-list cursor isolation apply across credentials', async () => {
  const { issue, call } = await setup();
  const tokens = await Promise.all([
    issue(['leads:read'], 'One'),
    issue(['leads:read'], 'Two'),
    issue(['leads:read'], 'Three'),
  ]);
  const page = (
    await call('admin', 'get', '/personal-access-tokens?limit=2').expect(200)
  ).body;
  assert.equal(page.items.length, 2);
  assert.ok(page.nextCursor);
  await call(
    'other',
    'get',
    '/personal-access-tokens?cursor=' + encodeURIComponent(page.nextCursor),
  ).expect(400);
  assert.equal(
    (
      await call(
        'admin',
        'get',
        '/personal-access-tokens?limit=2&cursor=' +
          encodeURIComponent(page.nextCursor),
      ).expect(200)
    ).body.items.length,
    1,
  );
  for (const { token } of tokens)
    for (let i = 0; i < 100; i++)
      await call(token, 'get', '/leads').expect(200);
  await call(tokens[0].token, 'get', '/leads').expect(429);
});
test('a tasks-only credential can read tasks without access to lead records or other data', async () => {
  const { issue, call } = await setup();
  const { token } = await issue(['tasks:read']);
  await call(token, 'get', '/tasks').expect(200);
  await call(token, 'get', '/leads').expect(403);
  await call(token, 'get', '/dashboard').expect(403);
  await call(token, 'get', '/field-options').expect(403);
  await call(
    token,
    'post',
    '/tasks',
    { title: 'No write access' },
    randomUUID(),
  ).expect(403);
});
test('disabled or deleted credential owners are rejected before accessing data', async () => {
  let enabled = true;
  const { issue, call } = await setup(async () => enabled);
  const { token } = await issue();
  await call(token, 'get', '/leads').expect(200);
  enabled = false;
  await call(token, 'get', '/leads').expect(401);
  await call('admin', 'get', '/leads').expect(200);
});
