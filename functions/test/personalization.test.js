import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import {
  readAISettings,
  AI_SETTINGS_PATH,
  DEFAULT_AI_INSTRUCTIONS,
} from '../src/ai-settings.js';
import { DEFAULT_FIELD_LABELS } from '../src/field-options.js';
import { dashboardSnapshot, dashboardBrief } from '../src/dashboard.js';
const output = (c) => ({
  headline: 'Prioritize the next step',
  summary: 'Review the available reminders.',
  insights: [
    {
      title: 'Review reminders',
      detail: 'Start with the outstanding work.',
      type: 'priority',
      taskIds: [],
      leadIds: [],
      facts: [{ key: 'pendingTasks', value: c.facts.pendingTasks }],
    },
  ],
});
async function setup() {
  const store = memoryStore(),
    inputs = [];
  let clock = Date.parse('2026-10-25T06:00:00Z');
  const app = createApp({
    store,
    now: () => new Date(clock).toISOString(),
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
    summarizeDashboard: async (c) => {
      inputs.push(c);
      return output(c);
    },
  });
  const call = (method, url, body, uid = 'admin') => {
    const q = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + uid);
    if (url !== '/personal-access-tokens')
      q.set('Idempotency-Key', randomUUID());
    return body ? q.send(body) : q;
  };
  await call('get', '/me').expect(200);
  await store.run(async (tx) => {
    tx.set(path('members', 'rep'), {
      id: 'rep',
      uid: 'rep',
      role: 'SDR',
      scope: 'all',
      version: 1,
      active: true,
      capabilities: ['leads:read', 'members:write'],
    });
  });
  return {
    store,
    call,
    inputs,
    tick: () => {
      clock += 60000;
    },
  };
}
test('AI preferences enforce Admin access, optimistic versions, bounded input and default reset without prompt audit data', async () => {
  const s = await setup();
  const defaults = (await s.call('get', '/ai-settings').expect(200)).body;
  assert.equal(defaults.usingDefault, true);
  assert.equal(defaults.defaultInstructions, DEFAULT_AI_INSTRUCTIONS);
  await s.call('get', '/ai-settings', null, 'rep').expect(403);
  await s
    .call(
      'patch',
      '/ai-settings',
      { expectedVersion: 1, instructions: 'Focus on callbacks' },
      'rep',
    )
    .expect(403);
  await s
    .call('patch', '/ai-settings', {
      expectedVersion: 1,
      instructions: 'x'.repeat(4001),
    })
    .expect(400);
  await s
    .call('patch', '/ai-settings', {
      expectedVersion: 1,
      instructions: 'Short bullets',
      extra: true,
    })
    .expect(400);
  const updated = (
    await s
      .call('patch', '/ai-settings', {
        expectedVersion: 1,
        instructions: '  Focus on callbacks in Tamil.  ',
      })
      .expect(200)
  ).body;
  assert.equal(updated.version, 2);
  assert.equal(updated.instructions, 'Focus on callbacks in Tamil.');
  assert.equal(updated.usingDefault, false);
  assert.equal(
    (
      await s
        .call('patch', '/ai-settings', {
          expectedVersion: 2,
          instructions: updated.instructions,
        })
        .expect(200)
    ).body.version,
    2,
  );
  await s
    .call('patch', '/ai-settings', {
      expectedVersion: 1,
      instructions: 'Old edit',
    })
    .expect(409);
  const reset = (
    await s
      .call('patch', '/ai-settings', { expectedVersion: 2, instructions: '  ' })
      .expect(200)
  ).body;
  assert.equal(reset.usingDefault, true);
  assert.equal(reset.instructions, '');
  assert.ok(
    !JSON.stringify(await s.store.query(path('auditEvents'))).includes('Tamil'),
  );
  const token = (
    await s
      .call('post', '/personal-access-tokens', {
        name: 'Read configuration',
        scopes: ['configuration:read'],
        expiresInDays: 7,
      })
      .expect(200)
  ).body;
  const credential = token.token;
  assert.ok(credential);
  await request(
    createApp({
      store: s.store,
      verifyToken: async () => {
        throw Error('not Google');
      },
    }),
  )
    .get('/api/v1/ai-settings')
    .set('Authorization', 'Bearer ' + credential)
    .expect(403);
});
test('summary generation is explicit, uses current guidance, reuses matching cache and invalidates it after a preference change', async () => {
  const s = await setup();
  await s.call('get', '/dashboard').expect(200);
  assert.equal(s.inputs.length, 0);
  await s.call('post', '/dashboard/insights', {}).expect(200);
  assert.equal(s.inputs[0].workspaceGuidance, DEFAULT_AI_INSTRUCTIONS);
  await s.call('post', '/dashboard/insights', {}).expect(200);
  assert.equal(s.inputs.length, 1);
  await s
    .call('patch', '/ai-settings', {
      expectedVersion: 1,
      instructions: 'Focus on pipeline gaps. Use short bullets.',
    })
    .expect(200);
  await s.call('post', '/dashboard/insights', {}).expect(200);
  assert.equal(s.inputs.length, 2);
  assert.equal(
    s.inputs[1].workspaceGuidance,
    'Focus on pipeline gaps. Use short bullets.',
  );
  s.tick();
  await s
    .call('patch', '/ai-settings', { expectedVersion: 2, instructions: '' })
    .expect(200);
  await s.call('post', '/dashboard/insights', {}).expect(200);
  assert.equal(s.inputs[2].workspaceGuidance, DEFAULT_AI_INSTRUCTIONS);
});
test('a changed preference version prevents an in-flight summary from publishing', async () => {
  const s = await setup(),
    member = await s.store.get(path('members', 'admin')),
    snapshot = await dashboardSnapshot(s.store, member);
  await assert.rejects(
    () =>
      dashboardBrief({
        store: s.store,
        member,
        snapshot,
        summarize: async (c) => {
          await s.store.run(async (tx) =>
            tx.set(AI_SETTINGS_PATH, {
              version: 2,
              instructions: 'New guidance',
            }),
          );
          return output(c);
        },
      }),
    (e) => e.code === 'AI_SETTINGS_CHANGED',
  );
  assert.equal(
    (await s.store.get('users/admin/insights/dashboard')).status,
    'Failed',
  );
  assert.equal((await readAISettings(s.store)).version, 2);
});
test('built-in labels rename safely, preserve stable lead keys and reject unknown, blank and duplicate names', async () => {
  const s = await setup();
  const config = (await s.call('get', '/field-options').expect(200)).body;
  assert.deepEqual(config.labels, DEFAULT_FIELD_LABELS);
  const created = (
    await s
      .call('post', '/leads', {
        name: 'Synthetic customer',
        phone: '+12025550199',
        enquiryDate: '2026-10-25',
      })
      .expect(200)
  ).body;
  await s
    .call('patch', '/field-options', {
      expectedVersion: 1,
      values: config.values,
      labels: { name: 'Project contact', zone: 'Industry' },
    })
    .expect(200);
  const lead = (await s.call('get', '/leads/' + created.id).expect(200)).body;
  assert.equal(lead.name, 'Synthetic customer');
  assert.equal(lead['Project contact'], undefined);
  await s
    .call('patch', '/field-options', {
      expectedVersion: 1,
      values: config.values,
      labels: { name: 'Stale' },
    })
    .expect(409);
  for (const labels of [
    { unknown: 'Anything' },
    { name: '' },
    { name: 'a'.repeat(81) },
    { name: 'Industry' },
    { name: 'bad\nlabel' },
  ])
    await s
      .call('patch', '/field-options', {
        expectedVersion: 2,
        values: config.values,
        labels,
      })
      .expect(400);
  await s
    .call('patch', '/field-options', {
      expectedVersion: 2,
      values: config.values,
      customFields: [
        { id: 'cf_contact', label: 'Project contact', type: 'text' },
      ],
    })
    .expect(400);
  // Older choice editors omit labels: retain renamed fields rather than resetting them.
  const next = (
    await s
      .call('patch', '/field-options', {
        expectedVersion: 2,
        values: config.values,
      })
      .expect(200)
  ).body;
  assert.equal(next.labels.name, 'Project contact');
  assert.equal(next.labels.zone, 'Industry');
  await s
    .call(
      'patch',
      '/field-options',
      {
        expectedVersion: 3,
        values: config.values,
        labels: { name: 'No access' },
      },
      'rep',
    )
    .expect(403);
});

test('workspace insight mode defaults to manual, validates changes and exposes only the safe mode to dashboard readers', async () => {
  const s = await setup();
  assert.equal((await readAISettings(s.store)).insightMode, 'manual');
  for (const insightMode of ['sometimes', true])
    await s
      .call('patch', '/ai-settings', {
        expectedVersion: 1,
        instructions: '',
        insightMode,
      })
      .expect(400);
  await s
    .call(
      'patch',
      '/ai-settings',
      { expectedVersion: 1, instructions: '', insightMode: 'automatic' },
      'rep',
    )
    .expect(403);
  const saved = (
    await s
      .call('patch', '/ai-settings', {
        expectedVersion: 1,
        instructions: '',
        insightMode: 'automatic',
      })
      .expect(200)
  ).body;
  assert.equal(saved.version, 2);
  assert.equal(saved.insightMode, 'automatic');
  const unchanged = (
    await s
      .call('patch', '/ai-settings', {
        expectedVersion: 2,
        instructions: '',
        insightMode: 'automatic',
      })
      .expect(200)
  ).body;
  assert.equal(unchanged.version, 2);
  const legacy = (
    await s
      .call('patch', '/ai-settings', {
        expectedVersion: 2,
        instructions: 'Private workspace guidance',
      })
      .expect(200)
  ).body;
  assert.equal(legacy.insightMode, 'automatic');
  await s
    .call('patch', '/ai-settings', {
      expectedVersion: 2,
      instructions: '',
      insightMode: 'manual',
    })
    .expect(409);
  const dashboard = (await s.call('get', '/dashboard', null, 'rep').expect(200))
    .body;
  assert.equal(dashboard.insightMode, 'automatic');
  assert.equal(dashboard.instructions, undefined);
  assert.ok(!JSON.stringify(dashboard).includes('Private workspace guidance'));
  assert.equal(s.inputs.length, 0);
  const manual = (
    await s
      .call('patch', '/ai-settings', {
        expectedVersion: 3,
        instructions: legacy.instructions,
        insightMode: 'manual',
      })
      .expect(200)
  ).body;
  assert.equal(manual.insightMode, 'manual');
  assert.equal(manual.version, 4);
});
