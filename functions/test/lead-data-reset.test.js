import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { memoryStore } from '../src/store.js';
import { observableStore } from '../src/observable-store.js';
import { createApp } from '../src/app.js';
import { path } from '../src/policy.js';
import { PRESETS } from '../src/contracts.js';
import { generateToken } from '../src/personal-access-tokens.js';
import {
  advanceLeadReset,
  guardLeadData,
  RESET_STATE,
} from '../src/lead-data-reset.js';

async function setup() {
  const raw = memoryStore();
  const store = observableStore(raw, () => ({
    enabled: true,
    span: (_n, fn) => fn(),
    capture: () => ({
      actorId: 'system',
      operation: 'test',
      traceparent: null,
    }),
  }));
  let time = '2026-10-29T10:00:00.000Z';
  const objects = new Set([
    'workspaces/avinyatech/lead-files/lead/file',
    'workspaces/avinyatech/lead-files/orphan/file',
  ]);
  let failStorage = false;
  const files = {
    list: async (prefix, limit) => {
      if (failStorage) throw Error('secret provider error');
      return [...objects].filter((p) => p.startsWith(prefix)).slice(0, limit);
    },
    delete: async (p) => {
      if (failStorage) throw Error('secret provider error');
      objects.delete(p);
    },
  };
  const app = createApp({
    store,
    files,
    now: () => time,
    verifyToken: async (uid) => ({
      uid,
      email: uid + '@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  const call = (uid, method, url, body, key) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + uid);
    if (key) r.set('Idempotency-Key', key);
    return body ? r.send(body) : r;
  };
  await raw.run(async (tx) => {
    for (const uid of ['admin', 'rep', 'inactive'])
      tx.set(path('members', uid), {
        id: uid,
        uid,
        role: uid === 'rep' ? 'SDR' : 'Admin',
        active: uid !== 'inactive',
        capabilities: PRESETS.Admin,
        scope: 'all',
        version: 1,
      });
    tx.set(path('settings', 'fields'), { version: 7, retained: true });
    tx.set(path('adminBindings', 'protected'), { uid: 'admin' });
    tx.set('users/admin', { appearance: 'dark' });
    for (let i = 0; i < 75; i++)
      tx.set(path('leads', 'lead' + i.toString().padStart(3, '0')), {
        id: 'lead' + i.toString().padStart(3, '0'),
        name: 'Sensitive fixture',
        archived: !!(i % 2),
        version: 1,
      });
    for (const collection of [
      'activities',
      'activityRevisions',
      'leadTransitions',
      'noteAnalyses',
      'leadScores',
      'imports',
      'importChunks',
      'dedupeKeys',
    ])
      tx.set(path(collection, 'fixture'), {
        id: 'fixture',
        leadId: 'lead',
        notes: 'Sensitive fixture',
      });
    tx.set(path('tasks', 'linked'), {
      id: 'linked',
      leadId: 'lead',
      title: 'Sensitive fixture',
    });
    tx.set(path('tasks', 'personal'), {
      id: 'personal',
      leadId: null,
      title: 'Keep my personal reminder',
    });
    tx.set(path('reminderDeliveries', 'linked_1'), {
      id: 'linked_1',
      taskId: 'linked',
    });
    tx.set(path('reminderDeliveries', 'personal_1'), {
      id: 'personal_1',
      taskId: 'personal',
      status: 'Pending',
    });
    tx.set(path('deviceDeliveries', 'linked_1_device'), {
      id: 'linked_1_device',
    });
    tx.set(path('deviceDeliveries', 'personal_1_device'), {
      id: 'personal_1_device',
    });
    tx.set(path('leadAttachments', 'file'), {
      id: 'file',
      leadId: 'lead',
      objectPath: 'workspaces/avinyatech/lead-files/lead/file',
    });
    for (const uid of ['admin', 'inactive']) {
      tx.set(`users/${uid}/notifications/linked`, {
        id: 'linked',
        leadId: 'lead',
      });
      tx.set(`users/${uid}/notifications/personal`, {
        id: 'personal',
        leadId: null,
        taskId: 'personal',
      });
      tx.set(`users/${uid}/insights/dashboard`, {
        summary: 'Sensitive fixture',
      });
    }
    tx.set(path('requests', 'old-key'), {
      fingerprint: 'prior-fingerprint',
      result: { name: 'Sensitive fixture' },
      createdAt: time,
    });
  });
  return {
    raw,
    store,
    app,
    files,
    objects,
    call,
    now: () => time,
    setTime: (t) => {
      time = t;
    },
    storageFailure: (v) => {
      failStorage = v;
    },
  };
}
const preview = async (s) =>
  (await s.call('admin', 'post', '/lead-data-reset/preview', {}).expect(200))
    .body;
async function begin(s) {
  const p = await preview(s);
  const key = randomUUID();
  const input = { previewId: p.previewId, confirmation: 'DELETE ALL LEADS' };
  return {
    job: (
      await s.call('admin', 'post', '/lead-data-reset', input, key).expect(200)
    ).body,
    key,
    input,
  };
}
async function drain(s) {
  for (let i = 0; i < 100; i++) {
    const result = await advanceLeadReset({
      store: s.store,
      files: s.files,
      now: s.now,
      batches: 4,
    });
    if (!result.active) return;
    if (result.blocked) return;
  }
  throw Error('Reset did not terminate');
}

test('reset requires current Google Admin, fresh owner-bound preview, strict confirmation and idempotency', async () => {
  const s = await setup();
  await s.call('rep', 'post', '/lead-data-reset/preview', {}).expect(403);
  await s.call('inactive', 'get', '/lead-data-reset').expect(403);
  const personal = generateToken(
    'admin',
    { name: 'Synthetic integration', scopes: ['leads:read'], expiresInDays: 7 },
    s.now(),
  );
  await s.raw.run(async (tx) =>
    tx.set(path('personalAccessTokens', personal.record.id), personal.record),
  );
  await request(s.app)
    .post('/api/v1/lead-data-reset/preview')
    .set('Authorization', 'Bearer ' + personal.token)
    .send({})
    .expect(403);
  const p = await preview(s);
  assert.equal(p.counts.leads, 75);
  assert.equal(p.counts.archived, 37);
  await s
    .call(
      'admin',
      'post',
      '/lead-data-reset',
      { previewId: p.previewId, confirmation: 'delete' },
      randomUUID(),
    )
    .expect(400);
  await s
    .call('admin', 'post', '/lead-data-reset', {
      previewId: p.previewId,
      confirmation: 'DELETE ALL LEADS',
    })
    .expect(400);
  s.setTime('2026-10-29T10:11:00.000Z');
  await s
    .call(
      'admin',
      'post',
      '/lead-data-reset',
      { previewId: p.previewId, confirmation: 'DELETE ALL LEADS' },
      randomUUID(),
    )
    .expect(409);
  const started = await begin(s);
  await s
    .call('admin', 'post', '/lead-data-reset', started.input, started.key)
    .expect(200);
  await s
    .call(
      'admin',
      'post',
      '/lead-data-reset',
      { ...started.input, previewId: randomUUID() },
      started.key,
    )
    .expect(409);
  await s.call('admin', 'post', '/lead-data-reset/preview', {}).expect(409);
  await s.raw.run(async (tx) => {
    const m = await tx.get(path('members', 'admin'));
    tx.set(path('members', 'admin'), { ...m, active: false });
  });
  await s
    .call('admin', 'post', '/lead-data-reset', started.input, started.key)
    .expect(403);
});
test('resumable cleanup removes all lead data/files/caches, preserves configuration/personal reminders/audit and prevents resurrection', async () => {
  const s = await setup();
  const createKey = randomUUID();
  const createInput = {
    name: 'Synthetic old request',
    phone: '5551234567',
    enquiryDate: '2026-10-29',
  };
  await s.call('admin', 'post', '/leads', createInput, createKey).expect(200);
  const started = await begin(s);
  assert.equal(
    (await advanceLeadReset({ store: s.store, files: s.files, now: s.now }))
      .processed,
    0,
  );
  const guarded = guardLeadData(s.store);
  await assert.rejects(
    guarded.run(async (tx) => {
      tx.set(path('leads', 'late'), { id: 'late' });
    }),
    { code: 'LEAD_DATA_RESET' },
  );
  await s
    .call(
      'admin',
      'post',
      '/leads',
      { name: 'Late', phone: '1234567890' },
      randomUUID(),
    )
    .expect(503);
  s.setTime('2026-10-29T10:06:00.000Z');
  // Simultaneous workers must not delete/progress a batch twice.
  await Promise.all([
    advanceLeadReset({ store: s.store, files: s.files, now: s.now }),
    advanceLeadReset({ store: s.store, files: s.files, now: s.now }),
  ]);
  await drain(s);
  const status = (await s.call('admin', 'get', '/lead-data-reset').expect(200))
    .body;
  assert.equal(status.active, false);
  assert.equal(status.job.status, 'Completed');
  assert.ok(status.job.deletedRecords >= 80);
  assert.equal(s.objects.size, 0);
  assert.equal(await s.raw.count(path('leads')), 0);
  assert.equal(await s.raw.count(path('importChunks')), 0);
  assert.equal(await s.raw.get(path('tasks', 'linked')), null);
  assert.ok(await s.raw.get(path('tasks', 'personal')));
  assert.ok(await s.raw.get(path('reminderDeliveries', 'personal_1')));
  assert.ok(await s.raw.get(path('deviceDeliveries', 'personal_1_device')));
  assert.equal(
    await s.raw.get(path('deviceDeliveries', 'linked_1_device')),
    null,
  );
  assert.equal(await s.raw.get('users/inactive/notifications/linked'), null);
  assert.ok(await s.raw.get('users/inactive/notifications/personal'));
  assert.equal(await s.raw.get('users/admin/insights/dashboard'), null);
  assert.equal((await s.raw.get(path('settings', 'fields'))).version, 7);
  assert.equal((await s.raw.get('users/admin')).appearance, 'dark');
  assert.ok(await s.raw.get(path('adminBindings', 'protected')));
  assert.ok(await s.raw.get(path('members', 'admin')));
  const old = await s.raw.get(path('requests', 'old-key'));
  assert.equal(old.expiredByReset, true);
  assert.equal(old.result, undefined);
  assert.ok(
    await s.raw.get(
      path('auditEvents', 'lead_reset_complete_' + started.job.id),
    ),
  );
  const events = await s.raw.query(path('telemetryOutbox'), { limit: 1000 });
  assert.ok(events.some((r) => r.event.data['records.reset_completed'] === 1));
  assert.ok(!JSON.stringify(events).includes('Sensitive fixture'));
  await s.call('admin', 'post', '/leads', createInput, createKey).expect(409);
  await guarded.run(async (tx) =>
    tx.set(path('leads', 'fresh'), { id: 'fresh' }),
  );
  await s
    .call('admin', 'post', '/lead-data-reset', started.input, started.key)
    .expect(200);
  assert.ok(await s.raw.get(path('leads', 'fresh')));
});
test('storage failure keeps writes paused and safe error, resume reauthorizes and retry completes', async () => {
  const s = await setup();
  await begin(s);
  s.setTime('2026-10-29T10:06:00.000Z');
  s.storageFailure(true);
  await drain(s);
  const state = (await s.call('admin', 'get', '/lead-data-reset').expect(200))
    .body;
  assert.equal(state.active, true);
  assert.equal(state.job.status, 'Blocked');
  assert.ok(!state.job.lastError.includes('secret'));
  await s
    .call('rep', 'post', `/lead-data-reset/${state.job.id}/resume`, {
      expectedVersion: state.job.version,
    })
    .expect(403);
  await s
    .call('admin', 'post', `/lead-data-reset/${state.job.id}/resume`, {
      expectedVersion: state.job.version - 1,
    })
    .expect(409);
  s.storageFailure(false);
  await s
    .call('admin', 'post', `/lead-data-reset/${state.job.id}/resume`, {
      expectedVersion: state.job.version,
    })
    .expect(200);
  await drain(s);
  assert.equal((await s.raw.get(RESET_STATE)).active, false);
});
