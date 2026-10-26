import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
async function setup() {
  const store = memoryStore();
  const app = createApp({
    store,
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.invalid',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
    verifyAppCheck: async (value) => {
      if (value !== 'fixture-appcheck')
        throw Object.assign(Error('App verification required'), {
          status: 403,
          code: 'APP_CHECK',
        });
    },
  });
  const call = (uid, method, url, body) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + uid)
      .set('X-Firebase-AppCheck', 'fixture-appcheck');
    return body === undefined ? r : r.send(body);
  };
  await call('admin', 'get', '/me').expect(200);
  await store.run(async (tx) =>
    tx.set(path('members', 'viewer'), {
      id: 'viewer',
      uid: 'viewer',
      role: 'Viewer',
      scope: 'assigned',
      active: true,
      version: 1,
      capabilities: ['leads:read'],
    }),
  );
  return { store, app, call };
}
test('font choices persist per member, preserve older PATCH clients and produce key-only audits', async () => {
  const { store, call } = await setup();
  assert.equal(
    (await call('viewer', 'get', '/me').expect(200)).body.preferences.fontStyle,
    'standard',
  );
  const input = { timezone: 'Asia/Kolkata', appearance: 'system' };
  for (const fontStyle of ['inter', 'source-sans', 'lora']) {
    await call('viewer', 'patch', '/me', { ...input, fontStyle }).expect(200);
    assert.equal(
      (await call('viewer', 'get', '/me').expect(200)).body.preferences
        .fontStyle,
      fontStyle,
    );
  }
  const events = async () =>
    (await store.query(path('telemetryOutbox'), { limit: 100 })).filter(
      (r) =>
        r.event.type === 'com.avinyatech.salesdrone.settings.audit.committed',
    );
  const first = await events();
  assert.equal(first.length, 3);
  assert.ok(
    first.every(
      (row) =>
        JSON.stringify(row.event.data['settings.changed_keys']) ===
        JSON.stringify(['fontStyle']),
    ),
  );
  assert.ok(!JSON.stringify(first).includes('"lora"'));
  await call('viewer', 'patch', '/me', { ...input, fontStyle: 'lora' }).expect(
    200,
  );
  assert.equal((await events()).length, 3);
  await call('viewer', 'patch', '/me', {
    ...input,
    appearance: 'dark',
    bookMode: true,
  }).expect(200);
  assert.equal((await store.get('users/viewer')).fontStyle, 'lora');
  assert.equal(
    (await call('admin', 'get', '/me').expect(200)).body.preferences.fontStyle,
    'standard',
  );
  await call('viewer', 'patch', '/me', {
    ...input,
    fontStyle: 'standard',
  }).expect(200);
  assert.equal((await store.get('users/viewer')).fontStyle, 'standard');
});
test('invalid font values and cross-account, unapproved, App Check and PAT writes are denied', async () => {
  const { app, call, store } = await setup();
  const input = {
    timezone: 'Asia/Kolkata',
    appearance: 'system',
    fontStyle: 'inter',
  };
  for (const fontStyle of [
    null,
    12,
    'https://example.invalid/font.css',
    'unknown',
  ])
    await call('viewer', 'patch', '/me', { ...input, fontStyle }).expect(400);
  await call('viewer', 'patch', '/me', { ...input, uid: 'admin' }).expect(400);
  await request(app).patch('/api/v1/me').send(input).expect(401);
  await request(app)
    .patch('/api/v1/me')
    .set('Authorization', 'Bearer viewer')
    .send(input)
    .expect(403);
  await call('outsider', 'patch', '/me', input).expect(403);
  const token = (
    await call('admin', 'post', '/personal-access-tokens', {
      name: 'Synthetic font test',
      scopes: ['leads:read'],
      expiresInDays: 7,
    }).expect(200)
  ).body.token;
  await call(token, 'patch', '/me', input).expect(403);
  assert.equal(await store.get('users/viewer'), null);
});
