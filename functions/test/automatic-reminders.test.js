import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import {
  analyzeNotes,
  resolveExtraction,
  zonedInstant,
} from '../src/automatic-reminders.js';
import { dispatchReminders } from '../src/reminders.js';
import { geminiExtractor } from '../src/gemini.js';
const clock = '2026-10-24T12:00:00.000Z';
const extraction = (overrides = {}) => ({
  intent: 'schedule',
  action: 'call',
  evidence: 'Call them next week.',
  conditional: false,
  multiple: false,
  timing: 'next_week',
  days: null,
  minutes: null,
  date: null,
  weekday: null,
  time: null,
  ...overrides,
});
const context = {
  notes: 'Call them next week.',
  referenceAt: clock,
  now: clock,
  timezone: 'Asia/Kolkata',
};
async function setup() {
  const store = memoryStore(),
    app = createApp({
      store,
      now: () => clock,
      verifyToken: async (t) => ({
        uid: t,
        email: t === 'admin' ? 'spraghav@gmail.com' : 'theharithsa@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      }),
    });
  const call = (method, url, body, who = 'admin', key = randomUUID()) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + who)
      .set('Idempotency-Key', key);
    return body ? r.send(body) : r;
  };
  await call('get', '/me').expect(200);
  await call('get', '/me', null, 'other').expect(200);
  const lead = (
    await call('post', '/leads', {
      name: 'Synthetic auto-reminder test',
      phone: '+12025550199',
      enquiryDate: '2026-10-24',
    }).expect(200)
  ).body;
  const add = async (body = {}, key) =>
    (
      await call(
        'post',
        '/leads/' + lead.id + '/activities',
        {
          type: 'note',
          notes: context.notes,
          expectedVersion: (await store.get(path('leads', lead.id))).version,
          ...body,
        },
        'admin',
        key,
      ).expect(200)
    ).body.activity;
  return { store, call, lead, add };
}
test('dates resolve in account timezone with explicit next-week defaults, weekdays and DST validation', () => {
  assert.equal(
    resolveExtraction(extraction(), context).dueAt,
    '2026-10-31T04:30:00.000Z',
  );
  assert.equal(
    resolveExtraction(extraction(), {
      ...context,
      settings: { nextWeekRule: 'next_monday' },
    }).dueAt,
    '2026-10-26T04:30:00.000Z',
  );
  assert.equal(
    resolveExtraction(extraction(), {
      ...context,
      settings: { moveWeekends: true },
    }).dueAt,
    '2026-11-02T04:30:00.000Z',
  );
  assert.equal(
    resolveExtraction(
      extraction({ timing: 'days', days: 1, minutes: null, time: '11:00' }),
      context,
    ).dueAt,
    '2026-10-25T05:30:00.000Z',
  );
  assert.equal(
    resolveExtraction(extraction({ timing: 'weekday', weekday: 2 }), context)
      .dueAt,
    '2026-10-27T04:30:00.000Z',
  );
  assert.throws(
    () => zonedInstant('2026-03-08', '02:30', 'America/New_York'),
    /missing or ambiguous/,
  );
  assert.throws(
    () => zonedInstant('2026-11-01', '01:30', 'America/New_York'),
    /missing or ambiguous/,
  );
  assert.equal(
    zonedInstant('2026-11-01', '03:30', 'America/New_York'),
    '2026-11-01T08:30:00.000Z',
  );
});
test('unclear, conditional, fabricated, past, contradictory and invalid dates cannot silently schedule', () => {
  for (const x of [
    extraction({ intent: 'review' }),
    extraction({ conditional: true }),
    extraction({ multiple: true }),
    extraction({ evidence: 'invented quote' }),
    extraction({ timing: 'none' }),
    extraction({ timing: 'days', days: 0 }),
    extraction({ timing: 'date', date: '2026-02-30' }),
    extraction({ time: '99:99' }),
  ])
    assert.equal(resolveExtraction(x, context).status, 'NeedsReview');
  assert.equal(
    resolveExtraction(extraction(), {
      ...context,
      notes: 'Do not call again. Call them next week.',
    }).status,
    'NeedsReview',
  );
  assert.equal(
    resolveExtraction(extraction({ intent: 'none' }), context).status,
    'NoAction',
  );
});
test('saved notes enqueue atomically; replay and concurrent workers create one task and one delivered inbox item', async () => {
  const s = await setup(),
    key = randomUUID();
  const a = await s.add({}, key);
  const replay = await s
    .call(
      'post',
      '/leads/' + s.lead.id + '/activities',
      { type: 'note', notes: context.notes, expectedVersion: 1 },
      'admin',
      key,
    )
    .expect(200);
  assert.equal(replay.body.activity.id, a.id);
  assert.equal((await s.store.query(path('noteAnalyses'))).length, 1);
  let calls = 0;
  const worker = () =>
    analyzeNotes({
      store: s.store,
      now: () => clock,
      extract: async () => {
        calls++;
        return extraction();
      },
    });
  await Promise.all([worker(), worker()]);
  assert.equal(calls, 1);
  const tasks = await s.store.query(path('tasks'));
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].automatic, true);
  await worker();
  assert.equal(calls, 1);
  await s.store.run(async (tx) =>
    tx.set('users/admin/devices/test', {
      id: 'test',
      enabled: true,
      token: 'synthetic',
    }),
  );
  const sent = [];
  await dispatchReminders({
    store: s.store,
    now: () => tasks[0].dueAt,
    send: async (msg) => sent.push(msg),
  });
  assert.equal(sent.filter((m) => m.data.url.startsWith('/tasks?')).length, 1);
  assert.equal(sent.filter((m) => m.data.url.startsWith('/leads?')).length, 1);
  const inbox = await s.store.query('users/admin/notifications');
  assert.equal(inbox.filter((n) => n.kind === 'task_reminder').length, 1);
  assert.equal(inbox.filter((n) => n.kind === 'lead_created').length, 1);
});
test('manual reminders, disabled preferences, suppressed leads and users without task permission never produce AI tasks', async () => {
  const s = await setup();
  await s.add({
    type: 'call',
    outcome: 'Connected',
    followUp: {
      title: 'Manual',
      dueAt: '2026-11-01T10:00:00Z',
      timezone: 'Asia/Kolkata',
      kind: 'outreach',
    },
  });
  assert.equal((await s.store.query(path('noteAnalyses'))).length, 0);
  await s
    .call('patch', '/me', {
      timezone: 'Asia/Kolkata',
      appearance: 'system',
      automaticReminders: false,
    })
    .expect(200);
  const disabled = await s.add();
  assert.equal(disabled.autoReminder.status, 'Disabled');
  await s
    .call('patch', '/me', {
      timezone: 'Asia/Kolkata',
      appearance: 'system',
      automaticReminders: true,
    })
    .expect(200);
  await s.add();
  await s.store.run(async (tx) => {
    const l = await tx.get(path('leads', s.lead.id));
    tx.set(path('leads', s.lead.id), { ...l, doNotContact: true });
  });
  let calls = 0;
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => {
      calls++;
      return extraction();
    },
  });
  assert.equal(calls, 0);
  await s.store.run(async (tx) => {
    const l = await tx.get(path('leads', s.lead.id));
    const m = await tx.get(path('members', 'admin'));
    tx.set(path('leads', l.id), { ...l, doNotContact: false });
    tx.set(path('members', 'admin'), {
      ...m,
      capabilities: m.capabilities.filter((c) => c !== 'tasks:write'),
    });
  });
  assert.equal((await s.add()).autoReminder.status, 'Disabled');
});
test('correction during Gemini request discards stale analysis; next revision is processed once', async () => {
  const s = await setup();
  const a = await s.add();
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => {
      await s
        .call('post', '/activities/' + a.id + '/corrections', {
          type: 'note',
          notes: 'Call them tomorrow.',
          expectedRevision: 1,
        })
        .expect(200);
      return extraction();
    },
  });
  assert.equal((await s.store.query(path('tasks'))).length, 0);
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () =>
      extraction({ evidence: 'Call them tomorrow.', timing: 'days', days: 1 }),
  });
  assert.equal((await s.store.query(path('tasks'))).length, 1);
  const updated = await s.store.get(path('activities', a.id));
  assert.equal(updated.revision, 2);
  assert.equal(updated.autoReminder.status, 'Scheduled');
});
test('correction cancels an untouched generated reminder; manual edits are preserved', async () => {
  const s = await setup(),
    a = await s.add();
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => extraction(),
  });
  let act = await s.store.get(path('activities', a.id));
  const first = act.autoReminder.taskId;
  await s
    .call('post', '/activities/' + a.id + '/corrections', {
      type: 'note',
      notes: context.notes,
      expectedRevision: 1,
    })
    .expect(200);
  assert.equal((await s.store.get(path('tasks', first))).state, 'Cancelled');
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => extraction(),
  });
  act = await s.store.get(path('activities', a.id));
  await s
    .call('patch', '/tasks/' + act.autoReminder.taskId, {
      expectedVersion: 1,
      dueAt: '2026-11-04T05:30:00Z',
    })
    .expect(200);
  await s
    .call('post', '/activities/' + a.id + '/corrections', {
      type: 'note',
      notes: context.notes,
      expectedRevision: 2,
    })
    .expect(200);
  assert.equal(
    (await s.store.get(path('tasks', act.autoReminder.taskId))).state,
    'Pending',
  );
  assert.equal(
    (await s.store.get(path('activities', a.id))).autoReminder.status,
    'NeedsReview',
  );
});
test('permission or assignment changes during inference prevent automatic creation', async () => {
  for (const change of ['revoked', 'reassigned', 'disabled']) {
    const s = await setup();
    await s.add();
    await analyzeNotes({
      store: s.store,
      now: () => clock,
      extract: async () => {
        await s.store.run(async (tx) => {
          if (change === 'revoked') {
            const m = await tx.get(path('members', 'admin'));
            tx.set(path('members', 'admin'), { ...m, active: false });
          } else if (change === 'reassigned') {
            const l = await tx.get(path('leads', s.lead.id));
            tx.set(path('leads', l.id), { ...l, assignedToUid: 'other' });
          } else tx.set('users/admin', { automaticReminders: false });
        });
        return extraction();
      },
    });
    assert.equal((await s.store.query(path('tasks'))).length, 0, change);
  }
});
test('failed analysis is visible, retry is owner-only, and manual resolution invalidates pending work', async () => {
  const s = await setup(),
    a = await s.add();
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => {
      const e = Error();
      e.code = 'GEMINI_CONFIG';
      throw e;
    },
  });
  assert.equal(
    (await s.store.get(path('activities', a.id))).autoReminder.status,
    'Failed',
  );
  const url = '/activities/' + a.id + '/automatic-reminder';
  await s
    .call('patch', url, { action: 'retry', expectedRevision: 1 }, 'other')
    .expect(403);
  await s
    .call('patch', url, { action: 'retry', expectedRevision: 1 })
    .expect(200);
  await s
    .call('patch', url, {
      action: 'schedule',
      expectedRevision: 1,
      task: {
        title: 'Explicit follow-up',
        dueAt: '2026-11-02T04:30:00Z',
        timezone: 'Asia/Kolkata',
        kind: 'outreach',
      },
    })
    .expect(200);
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => {
      throw Error('must not run');
    },
  });
  assert.equal((await s.store.query(path('tasks'))).length, 1);
  assert.equal(
    (await s.store.get(path('activities', a.id))).autoReminder.status,
    'Manual',
  );
});
test('Undo cancels the generated task and cannot resurrect it on replay', async () => {
  const s = await setup(),
    a = await s.add();
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => extraction(),
  });
  await s
    .call('patch', '/activities/' + a.id + '/automatic-reminder', {
      action: 'dismiss',
      expectedRevision: 1,
    })
    .expect(200);
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => extraction(),
  });
  assert.equal((await s.store.query(path('tasks')))[0].state, 'Cancelled');
  await s
    .call('patch', '/activities/' + a.id + '/automatic-reminder', {
      action: 'retry',
      expectedRevision: 1,
    })
    .expect(409);
});
test('transient failures retry with backoff and stop after three attempts', async () => {
  const s = await setup(),
    a = await s.add();
  let time = clock;
  for (let n = 0; n < 3; n++) {
    await analyzeNotes({
      store: s.store,
      now: () => time,
      extract: async () => {
        throw Error('network');
      },
    });
    const j = await s.store.get(path('noteAnalyses', a.autoReminder.id));
    time = j.nextAttemptAt;
  }
  assert.equal(
    (await s.store.get(path('activities', a.id))).autoReminder.status,
    'Failed',
  );
});
test('Gemini adapter uses a structured server-only request and redacts provider failures', async () => {
  const extract = geminiExtractor({
    key: 'private-test-key',
    fetchImpl: async (url, opts) => {
      assert.match(url, /gemini-3.5-flash-lite/);
      const b = JSON.parse(opts.body);
      assert.equal(opts.headers['x-goog-api-key'], 'private-test-key');
      assert.ok(b.generationConfig.responseJsonSchema);
      assert.match(b.contents[0].parts[0].text, /Call them/);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(extraction()) }] } },
          ],
        }),
      };
    },
  });
  assert.equal((await extract(context)).timing, 'next_week');
  const broken = geminiExtractor({
    key: 'private-test-key',
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });
  await assert.rejects(
    broken(context),
    (e) =>
      e.code === 'GEMINI_CONFIG' && !e.message.includes('private-test-key'),
  );
});

test('explicit timezone wording and a corrected Do not contact disposition cannot schedule automatically', async () => {
  const x = extraction({
    evidence: 'Call tomorrow at 11 AM PST.',
    timing: 'days',
    days: 1,
    time: '11:00',
  });
  assert.equal(
    resolveExtraction(x, { ...context, notes: x.evidence }).status,
    'NeedsReview',
  );
  const s = await setup(),
    a = await s.add({ type: 'call', outcome: 'Connected' });
  await s
    .call('post', '/activities/' + a.id + '/corrections', {
      type: 'call',
      outcome: 'Connected',
      disposition: 'Do not contact',
      notes: context.notes,
      expectedRevision: 1,
    })
    .expect(200);
  let count = 0;
  await analyzeNotes({
    store: s.store,
    now: () => clock,
    extract: async () => {
      count++;
      return extraction();
    },
  });
  assert.equal(count, 0);
  assert.equal((await s.store.query(path('tasks'))).length, 0);
});
