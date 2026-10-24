import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { createApp } from '../src/app.js';
import {
  DEFAULT_FACTORS,
  ScoringPatch,
  readScoring,
  verifySignals,
  calculateScore,
  scoreView,
  scoreSources,
  processLeadScore,
  scoreLeads,
} from '../src/scoring.js';
import {
  dashboardSnapshot,
  dashboardBrief,
  verifyBrief,
} from '../src/dashboard.js';
import { intelligenceGemini } from '../src/intelligence-gemini.js';
const at = '2026-10-24T12:00:00.000Z';
const config = { version: 1, enabled: true, factors: DEFAULT_FACTORS };
const set = (s, p, v) => s.run(async (tx) => tx.set(p, v));
const signal = (factorId, quote = 'Commercial GC', state = 'present') => ({
  factorId,
  state,
  evidence: [{ sourceId: 'note:n1', quote }],
});
const brief = (context) => ({
  headline: 'Close the loop',
  summary: 'Review your outstanding reminders before the next conversation.',
  insights: [
    {
      title: 'Make the next step clear',
      detail: 'Review the open reminders.',
      type: 'priority',
      taskIds: [],
      leadIds: [],
      facts: [{ key: 'pendingTasks', value: context.facts.pendingTasks }],
    },
  ],
});
async function setup() {
  const store = memoryStore();
  let calls = 0;
  const app = createApp({
    store,
    now: () => at,
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : uid + '@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
    extractScore: async () => {
      calls++;
      return { signals: [signal('account_type')] };
    },
    summarizeDashboard: async (c) => {
      calls++;
      return brief(c);
    },
  });
  const call = (uid, m, u, b) => {
    const r = request(app)
      [m]('/api/v1' + u)
      .set('Authorization', 'Bearer ' + uid)
      .set('Idempotency-Key', randomUUID());
    return b === undefined ? r : r.send(b);
  };
  await call('admin', 'get', '/me').expect(200);
  await set(store, path('members', 'rep'), {
    id: 'rep',
    uid: 'rep',
    active: true,
    scope: 'assigned',
    role: 'SDR',
    version: 1,
    capabilities: [
      'leads:read',
      'leads:edit',
      'activities:write',
      'tasks:write',
    ],
  });
  await set(store, path('members', 'viewer'), {
    id: 'viewer',
    uid: 'viewer',
    active: true,
    scope: 'all',
    role: 'Viewer',
    version: 1,
    capabilities: ['leads:read'],
  });
  const lead = {
    id: 'lead1',
    name: 'Synthetic lead',
    phone: '+12025550123',
    email: 'private@example.com',
    archived: false,
    version: 1,
    assignedToUid: 'rep',
    stage: 'New',
    zone: 'Commercial',
    location: 'Example City',
    createdAt: at,
  };
  await set(store, path('leads', lead.id), lead);
  await set(store, path('activities', 'n1'), {
    id: 'n1',
    leadId: lead.id,
    type: 'note',
    notes: 'Commercial GC',
    actorUid: 'rep',
    createdAt: at,
    revision: 1,
  });
  return { store, call, lead, calls: () => calls };
}
test('model validation, unknowns, deterministic normalization and red flags', () => {
  assert.equal(calculateScore(config, []).score, null);
  let s = calculateScore(config, [signal('account_type'), signal('rfq')]);
  assert.equal(s.score, 27);
  s = calculateScore(config, [signal('account_type'), signal('poor_credit')]);
  assert.equal(s.score, 0);
  assert.equal(s.hasRisk, true);
  assert.equal(
    calculateScore(config, [signal('account_type', 'x', 'conflict')]).score,
    0,
  );
  assert.throws(() =>
    ScoringPatch.parse({
      expectedVersion: 1,
      enabled: true,
      factors: [DEFAULT_FACTORS[0], DEFAULT_FACTORS[0]],
    }),
  );
  assert.throws(() =>
    ScoringPatch.parse({
      expectedVersion: 1,
      enabled: true,
      factors: DEFAULT_FACTORS.filter((f) => f.group === 'risk'),
    }),
  );
});
test('only exact source quotes qualify, fabricated references and factors cannot award points', () => {
  const sources = [{ id: 'note:n1', text: 'Commercial GC' }];
  assert.equal(
    verifySignals(config, { signals: [signal('account_type')] }, sources)[0]
      .state,
    'present',
  );
  assert.equal(
    verifySignals(
      config,
      { signals: [signal('account_type', 'invented')] },
      sources,
    )[0].state,
    'unknown',
  );
  assert.equal(
    verifySignals(
      config,
      { signals: [{ ...signal('account_type'), evidence: [] }] },
      sources,
    )[0].state,
    'unknown',
  );
  assert.throws(() =>
    verifySignals(config, { signals: [signal('nonexistent')] }, sources),
  );
  assert.throws(() =>
    verifySignals(
      config,
      { signals: [signal('account_type'), signal('account_type')] },
      sources,
    ),
  );
});
test('sources omit structured identity and bound free-text history', async () => {
  const { store, lead } = await setup();
  for (let i = 2; i < 23; i++)
    await set(store, path('activities', 'n' + i), {
      id: 'n' + i,
      leadId: lead.id,
      notes: 'x'.repeat(2500),
    });
  const r = await scoreSources(store, lead),
    text = JSON.stringify(r.sources);
  assert.ok(
    !text.includes(lead.phone) &&
      !text.includes(lead.email) &&
      !text.includes(lead.name),
  );
  assert.ok(r.sourcesTruncated);
  assert.ok(r.notesIncluded <= 16);
  assert.ok(
    r.sources
      .filter((s) => s.id.startsWith('note:'))
      .reduce((n, s) => n + s.text.length, 0) <= 8000,
  );
});
test('score cache is idempotent, weights recalculate but changed rules and notes invalidate', async () => {
  const { store, lead } = await setup();
  let n = 0;
  const extract = async () => {
    n++;
    return { signals: [signal('account_type')] };
  };
  let s = await processLeadScore({
    store,
    leadId: lead.id,
    extract,
    now: () => at,
  });
  assert.equal(s.score, 15);
  await processLeadScore({ store, leadId: lead.id, extract, now: () => at });
  assert.equal(n, 1);
  const cache = await store.get(path('leadScores', lead.id));
  const changed = {
    ...config,
    version: 2,
    factors: DEFAULT_FACTORS.map((f) =>
      f.id === 'account_type' ? { ...f, weight: 30 } : f,
    ),
  };
  assert.equal(scoreView(changed, lead, cache).score, 26);
  changed.factors = changed.factors.map((f) => ({
    ...f,
    description: f.description + ' Changed.',
  }));
  assert.equal(scoreView(changed, lead, cache).status, 'Stale');
  assert.equal(
    scoreView(config, { ...lead, version: 2 }, cache).status,
    'Stale',
  );
});
test('AI result is discarded when a note changes during extraction; failure backoff is bounded', async () => {
  const { store, lead } = await setup();
  const r = await processLeadScore({
    store,
    leadId: lead.id,
    extract: async () => {
      await set(store, path('leads', lead.id), { ...lead, version: 2 });
      return { signals: [signal('account_type')] };
    },
    now: () => at,
  });
  assert.equal(r.status, 'Stale');
  let n = 0;
  const extract = async () => {
    n++;
    throw Error('provider failure');
  };
  await processLeadScore({ store, leadId: lead.id, extract, now: () => at });
  await processLeadScore({ store, leadId: lead.id, extract, now: () => at });
  assert.equal(n, 1);
  assert.equal((await store.get(path('leadScores', lead.id))).status, 'Failed');
});
test('scheduled scoring visits active leads once and respects its lease', async () => {
  const { store } = await setup();
  let n = 0;
  const extract = async () => {
    n++;
    return { signals: [signal('account_type')] };
  };
  assert.equal((await scoreLeads({ store, extract, now: () => at })).ready, 1);
  await scoreLeads({ store, extract, now: () => at });
  assert.equal(n, 1);
  await set(store, path('settings', 'score-worker'), {
    leaseUntil: '2026-10-25T00:00:00.000Z',
  });
  assert.equal(
    (await scoreLeads({ store, extract, now: () => at })).busy,
    true,
  );
});
test('scoring APIs enforce admin config, lead scope, read/edit capabilities and optimistic versions', async () => {
  const { store, call } = await setup();
  const body = { expectedVersion: 1, enabled: true, factors: DEFAULT_FACTORS };
  await call('rep', 'patch', '/scoring-settings', body).expect(403);
  await call('admin', 'patch', '/scoring-settings', body).expect(200);
  await call('admin', 'patch', '/scoring-settings', body).expect(409);
  await call('viewer', 'post', '/leads/lead1/score/refresh', {}).expect(403);
  let res = await call('rep', 'post', '/leads/lead1/score/refresh', {}).expect(
    200,
  );
  assert.equal(res.body.score, 15);
  res = await call('rep', 'get', '/lead-scores?ids=lead1').expect(200);
  assert.equal(res.body.items[0].score, 15);
  assert.ok(!res.body.items[0].factors);
  await set(store, path('leads', 'secret'), {
    id: 'secret',
    version: 1,
    archived: false,
    assignedToUid: 'admin',
  });
  await call('rep', 'get', '/lead-scores?ids=lead1,secret').expect(404);
  await call('rep', 'get', '/leads/secret/score').expect(404);
  await call('rep', 'get', '/lead-scores?ids=lead1&extra=x').expect(400);
});
test('correcting an old note invalidates evidence even when it is not a call', async () => {
  const { call } = await setup();
  await call('rep', 'post', '/leads/lead1/score/refresh', {}).expect(200);
  await call('rep', 'post', '/activities/n1/corrections', {
    type: 'note',
    expectedRevision: 1,
    notes: 'No longer a commercial contractor',
  }).expect(200);
  const r = await call('rep', 'get', '/leads/lead1/score').expect(200);
  assert.equal(r.body.status, 'Stale');
});
test('dashboard counts only permitted leads, personal reminders and personal outreach', async () => {
  const { store, call } = await setup();
  await set(store, path('leads', 'hidden'), {
    id: 'hidden',
    name: 'Secret',
    version: 1,
    archived: false,
    assignedToUid: 'admin',
    createdAt: at,
  });
  for (const [id, uid, leadId] of [
    ['mine', 'rep', 'lead1'],
    ['others', 'admin', 'lead1'],
    ['hidden', 'rep', 'hidden'],
  ])
    await set(store, path('tasks', id), {
      id,
      title: id,
      recipientUid: uid,
      leadId,
      state: 'Pending',
      version: 1,
      dueAt: '2026-10-24T11:00:00.000Z',
    });
  for (const [id, uid, leadId] of [
    ['mycall', 'rep', 'lead1'],
    ['othercall', 'admin', 'lead1'],
    ['hiddencall', 'rep', 'hidden'],
  ])
    await set(store, path('activities', id), {
      id,
      leadId,
      actorUid: uid,
      type: 'call',
      outcome: 'Connected',
      createdAt: at,
    });
  const r = await call('rep', 'get', '/dashboard').expect(200);
  assert.equal(r.body.coverage.totalLeads, 1);
  assert.equal(r.body.facts.pendingTasks, 1);
  assert.equal(r.body.facts.calls14, 1);
  assert.equal(r.body.facts.overdueTasks, 1);
  assert.ok(!r.body.aiContext);
  assert.ok(!JSON.stringify(r.body).includes('Secret'));
});
test('brief grounding rejects fabricated IDs and numbers; cached briefs stay isolated and invalidate on access changes', async () => {
  const { store } = await setup();
  const member = await store.get(path('members', 'rep'));
  const snapshot = await dashboardSnapshot(store, member, at);
  assert.throws(() =>
    verifyBrief(
      {
        ...brief(snapshot.aiContext),
        insights: [
          { ...brief(snapshot.aiContext).insights[0], taskIds: ['unknown'] },
        ],
      },
      snapshot.aiContext,
    ),
  );
  assert.throws(() =>
    verifyBrief(
      {
        ...brief(snapshot.aiContext),
        insights: [
          {
            ...brief(snapshot.aiContext).insights[0],
            facts: [{ key: 'pendingTasks', value: 999 }],
          },
        ],
      },
      snapshot.aiContext,
    ),
  );
  let n = 0;
  const summarize = async (c) => {
    n++;
    return brief(c);
  };
  const a = await dashboardBrief({
    store,
    member,
    snapshot,
    summarize,
    now: () => at,
  });
  const b = await dashboardBrief({
    store,
    member,
    snapshot,
    summarize,
    now: () => at,
  });
  assert.equal(a.status, 'Ready');
  assert.equal(b.generatedAt, a.generatedAt);
  assert.equal(n, 1);
  await set(store, path('members', 'rep'), { ...member, version: 2 });
  await assert.rejects(
    dashboardBrief({ store, member, snapshot, summarize, now: () => at }),
    (e) => e.code === 'SCOPE_CHANGED',
  );
});
test('revocation during model execution prevents publishing a brief', async () => {
  const { store } = await setup();
  const member = await store.get(path('members', 'rep')),
    snapshot = await dashboardSnapshot(store, member, at);
  await assert.rejects(
    dashboardBrief({
      store,
      member,
      snapshot,
      now: () => at,
      summarize: async (c) => {
        await set(store, path('members', 'rep'), {
          ...member,
          active: false,
          version: 2,
        });
        return brief(c);
      },
    }),
    (e) => e.code === 'DEMO_ONLY',
  );
  assert.notEqual(
    (await store.get('users/rep/insights/dashboard')).status,
    'Ready',
  );
});
test('Gemini adapter uses structured JSON and server credential header, with safe provider errors', async () => {
  let options;
  const adapter = intelligenceGemini({
    key: 'synthetic-key',
    fetchImpl: async (_, o) => {
      options = o;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ signals: [] }) }] } },
          ],
        }),
      };
    },
  });
  await adapter.extract({ sources: [], factors: [] });
  assert.equal(options.headers['x-goog-api-key'], 'synthetic-key');
  assert.ok(!options.body.includes('synthetic-key'));
  assert.equal(
    JSON.parse(options.body).generationConfig.responseMimeType,
    'application/json',
  );
  const failed = intelligenceGemini({
    key: 'synthetic-key',
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(
    failed.extract({}),
    (e) => e.code === 'AI_RATE_LIMIT' && e.status === 429,
  );
});
