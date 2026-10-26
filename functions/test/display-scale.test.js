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
test('display scale defaults, persists independently and emits safe appearance audit keys', async () => {
  const { call, store } = await setup();
  const input = { timezone: 'Asia/Kolkata', appearance: 'system' };
  assert.equal(
    (await call('viewer', 'get', '/me').expect(200)).body.preferences
      .displayScale,
    100,
  );
  for (const displayScale of [85, 90, 110, 125])
    await call('viewer', 'patch', '/me', { ...input, displayScale }).expect(
      200,
    );
  await call('viewer', 'patch', '/me', {
    ...input,
    fontStyle: 'lora',
    bookMode: true,
  }).expect(200);
  assert.equal((await store.get('users/viewer')).displayScale, 125);
  assert.equal(
    (await call('admin', 'get', '/me').expect(200)).body.preferences
      .displayScale,
    100,
  );
  const events = async () =>
    (await store.query(path('telemetryOutbox'), { limit: 100 })).filter(
      (r) =>
        r.event.type === 'com.avinyatech.salesdrone.settings.audit.committed',
    );
  const before = await events();
  assert.ok(
    before.some((r) =>
      r.event.data['settings.changed_keys'].includes('displayScale'),
    ),
  );
  await call('viewer', 'patch', '/me', {
    ...input,
    fontStyle: 'lora',
    bookMode: true,
    displayScale: 125,
  }).expect(200);
  assert.equal((await events()).length, before.length);
  for (const displayScale of [null, 95, '85', 50, 200])
    await call('viewer', 'patch', '/me', { ...input, displayScale }).expect(
      400,
    );
  await call('outsider', 'patch', '/me', { ...input, displayScale: 90 }).expect(
    403,
  );
  await request(createApp({ store }))
    .patch('/api/v1/me')
    .send({ ...input, displayScale: 85 })
    .expect(401);
});
