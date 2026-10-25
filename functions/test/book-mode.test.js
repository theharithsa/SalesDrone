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
test('book mode defaults off, is self-owned, persists, and survives older theme/reminder PATCH clients', async () => {
  const { store, call } = await setup();
  assert.equal(
    (await call('viewer', 'get', '/me').expect(200)).body.preferences.bookMode,
    false,
  );
  await call('viewer', 'patch', '/me', {
    timezone: 'Asia/Kolkata',
    appearance: 'light',
    bookMode: true,
  }).expect(200);
  assert.equal((await store.get('users/viewer')).bookMode, true);
  await call('viewer', 'patch', '/me', {
    timezone: 'Asia/Kolkata',
    appearance: 'dark',
  }).expect(200);
  const profile = (await call('viewer', 'get', '/me').expect(200)).body;
  assert.equal(profile.preferences.bookMode, true);
  assert.equal(profile.preferences.appearance, 'dark');
  assert.equal(
    (await call('admin', 'get', '/me').expect(200)).body.preferences.bookMode,
    false,
  );
  await call('viewer', 'patch', '/me', {
    timezone: 'Asia/Kolkata',
    appearance: 'system',
    bookMode: false,
  }).expect(200);
  assert.equal(
    (await call('viewer', 'get', '/me').expect(200)).body.preferences.bookMode,
    false,
  );
});
test('book preferences reject invalid payloads, identity spoofing, unauthenticated, unapproved and PAT writes', async () => {
  const { app, call, store } = await setup();
  const input = {
    timezone: 'Asia/Kolkata',
    appearance: 'light',
    bookMode: true,
  };
  for (const body of [
    { ...input, bookMode: 'true' },
    { ...input, uid: 'admin' },
    { ...input, bookMode: null },
  ])
    await call('viewer', 'patch', '/me', body).expect(400);
  await request(app).patch('/api/v1/me').send(input).expect(401);
  await request(app)
    .patch('/api/v1/me')
    .set('Authorization', 'Bearer viewer')
    .send(input)
    .expect(403);
  await call('outsider', 'patch', '/me', input).expect(403);
  const token = (
    await call('admin', 'post', '/personal-access-tokens', {
      name: 'Synthetic integration',
      scopes: ['leads:read'],
      expiresInDays: 7,
    }).expect(200)
  ).body.token;
  await call(token, 'patch', '/me', input).expect(403);
  assert.equal(await store.get('users/viewer'), null);
  assert.equal(await store.get('users/outsider'), null);
});
