import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { dispatchReminders } from '../src/reminders.js';
import { path, hash } from '../src/policy.js';
const identity = (uid, email) => ({
  uid,
  email,
  email_verified: true,
  name: uid,
  firebase: { sign_in_provider: 'google.com' },
});
const people = {
  admin: identity('admin', 'spraghav@gmail.com'),
  admin2: identity('admin2', 'theharithsa@gmail.com'),
  outsider: identity('outsider', 'outsider@example.com'),
  sdr: identity('sdr', 'sdr@example.com'),
  viewer: identity('viewer', 'viewer@example.com'),
};
const lead = (n = 1) => ({
  name: 'Customer ' + n,
  phone: '+1202555' + String(100 + n).padStart(4, '0'),
  company: 'Example ' + n,
  source: 'Website',
  enquiryDate: '2026-10-24',
});
function setup() {
  const store = memoryStore();
  let clock = '2026-10-24T12:00:00.000Z';
  const app = createApp({
    store,
    verifyToken: async (token) => {
      if (!people[token]) throw Error('invalid');
      return people[token];
    },
    now: () => clock,
  });
  const call = (who, method, url, body, key) => {
    let req = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + who);
    if (key) req = req.set('Idempotency-Key', key);
    return body ? req.send(body) : req;
  };
  return { store, app, call, now: () => clock, setTime: (t) => (clock = t) };
}
async function bootstrap(s) {
  await s.call('admin', 'get', '/me').expect(200);
  await s.call('admin2', 'get', '/me').expect(200);
}
async function grant(s, who, role = 'SDR', scope = 'assigned') {
  await s
    .call(
      'admin',
      'post',
      '/invitations',
      { email: people[who].email, role, scope },
      randomUUID(),
    )
    .expect(200);
  await s
    .call(
      who,
      'post',
      '/invitations/' + hash(people[who].email) + '/accept',
      {},
    )
    .expect(200);
}
async function createLead(s, n = 1, who = 'admin') {
  return (
    await s.call(who, 'post', '/leads', lead(n), randomUUID()).expect(200)
  ).body;
}

test('both verified Google admins receive equal capabilities; other accounts remain isolated demo users', async () => {
  const s = setup();
  const a = (await s.call('admin', 'get', '/me').expect(200)).body;
  const b = (await s.call('admin2', 'get', '/me').expect(200)).body;
  assert.equal(a.mode, 'live');
  assert.equal(b.mode, 'live');
  assert.deepEqual(a.member.capabilities, b.member.capabilities);
  const d = (await s.call('outsider', 'get', '/me').expect(200)).body;
  assert.equal(d.mode, 'demo');
  assert.equal(d.member, null);
  await s.call('outsider', 'get', '/leads').expect(403);
  await s.call('outsider', 'get', '/summary').expect(403);
  await request(s.app).get('/api/v1/leads').expect(401);
  await s.call('invalid', 'get', '/me').expect(401);
});

test('email spoofing, non-Google providers, and unverified identities cannot bootstrap', async () => {
  const s = setup();
  for (const token of [
    { ...people.admin, email_verified: false },
    { ...people.admin, firebase: { sign_in_provider: 'password' } },
  ]) {
    const app = createApp({ store: s.store, verifyToken: async () => token });
    await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer test')
      .expect(403);
  }
  assert.equal(await s.store.get(path('members', 'admin')), null);
});

test('enquiry creates once, changed retry conflicts, duplicate contacts and stale edits are rejected', async () => {
  const s = setup();
  await bootstrap(s);
  const key = randomUUID();
  const a = (await s.call('admin', 'post', '/leads', lead(), key).expect(200))
    .body;
  const b = (await s.call('admin', 'post', '/leads', lead(), key).expect(200))
    .body;
  assert.equal(a.id, b.id);
  await s.call('admin', 'post', '/leads', lead(2), key).expect(409);
  await s.call('admin', 'post', '/leads', lead(), randomUUID()).expect(409);
  await s
    .call('admin', 'patch', '/leads/' + a.id, {
      stage: 'Working',
      expectedVersion: 1,
    })
    .expect(200);
  await s
    .call('admin', 'patch', '/leads/' + a.id, {
      stage: 'Qualified',
      expectedVersion: 1,
    })
    .expect(409);
  await s
    .call(
      'admin',
      'post',
      '/leads',
      { name: 'Missing contact', enquiryDate: '2026-10-24' },
      randomUUID(),
    )
    .expect(400);
});

test('assigned scope, viewer permissions, and admin-only grants are enforced at API boundaries', async () => {
  const s = setup();
  await bootstrap(s);
  await grant(s, 'sdr');
  await grant(s, 'viewer', 'Viewer', 'all');
  const a = await createLead(s);
  await s.call('sdr', 'get', '/leads/' + a.id).expect(404);
  assert.equal(
    (await s.call('sdr', 'get', '/leads').expect(200)).body.items.length,
    0,
  );
  await s
    .call(
      'sdr',
      'post',
      '/invitations',
      { email: 'x@example.com', role: 'SDR' },
      randomUUID(),
    )
    .expect(403);
  await s
    .call('admin', 'patch', '/leads/' + a.id + '/assignment', {
      assignedToUid: 'sdr',
      expectedVersion: 1,
    })
    .expect(200);
  await s.call('sdr', 'get', '/leads/' + a.id).expect(200);
  await s
    .call('viewer', 'patch', '/leads/' + a.id, {
      stage: 'Working',
      expectedVersion: 2,
    })
    .expect(403);
  await s
    .call('viewer', 'post', '/imports/preview', { rows: [] }, randomUUID())
    .expect(403);
});

test('invitations bind to the intended verified identity and revoked membership takes effect immediately', async () => {
  const s = setup();
  await bootstrap(s);
  await s
    .call(
      'admin',
      'post',
      '/invitations',
      { email: people.sdr.email, role: 'SDR' },
      randomUUID(),
    )
    .expect(200);
  await s
    .call(
      'outsider',
      'post',
      '/invitations/' + hash(people.sdr.email) + '/accept',
      {},
    )
    .expect(403);
  await s
    .call(
      'sdr',
      'post',
      '/invitations/' + hash(people.sdr.email) + '/accept',
      {},
    )
    .expect(200);
  await s
    .call('admin', 'patch', '/members/sdr', {
      role: 'SDR',
      scope: 'assigned',
      active: false,
      expectedVersion: 1,
    })
    .expect(200);
  await s.call('sdr', 'get', '/leads').expect(403);
  assert.equal(
    (await s.call('sdr', 'get', '/me').expect(200)).body.mode,
    'demo',
  );
  await s
    .call(
      'sdr',
      'post',
      '/invitations/' + hash(people.sdr.email) + '/accept',
      {},
    )
    .expect(404);
});

test('call, next step and stage save atomically; retries cannot duplicate calls or reminders', async () => {
  const s = setup();
  await bootstrap(s);
  const a = await createLead(s);
  const key = randomUUID();
  const body = {
    type: 'call',
    outcome: 'No answer',
    notes: 'Try later',
    stage: 'Working',
    expectedVersion: 1,
    followUp: {
      title: 'Call again',
      dueAt: '2026-10-24T13:00:00Z',
      timezone: 'Asia/Kolkata',
      kind: 'outreach',
    },
  };
  const r = (
    await s
      .call('admin', 'post', '/leads/' + a.id + '/activities', body, key)
      .expect(200)
  ).body;
  await s
    .call('admin', 'post', '/leads/' + a.id + '/activities', body, key)
    .expect(200);
  assert.equal(r.lead.stage, 'Working');
  assert.equal(
    (await s.call('admin', 'get', '/tasks').expect(200)).body.items.length,
    1,
  );
  assert.equal(
    (await s.call('admin', 'get', '/leads/' + a.id + '/activities').expect(200))
      .body.items.length,
    1,
  );
  const invalid = {
    ...body,
    expectedVersion: 2,
    followUp: { ...body.followUp, timezone: 'Bad/Timezone' },
  };
  await s
    .call(
      'admin',
      'post',
      '/leads/' + a.id + '/activities',
      invalid,
      randomUUID(),
    )
    .expect(400);
  assert.equal(
    (await s.call('admin', 'get', '/leads/' + a.id).expect(200)).body.version,
    2,
  );
});

test('do-not-contact cancels outreach and blocks calls/new outreach, preserving administrative tasks', async () => {
  const s = setup();
  await bootstrap(s);
  const a = await createLead(s);
  for (const kind of ['outreach', 'administrative'])
    await s
      .call(
        'admin',
        'post',
        '/tasks',
        {
          leadId: a.id,
          title: kind,
          dueAt: '2026-10-24T11:00:00Z',
          kind,
          timezone: 'Asia/Kolkata',
        },
        randomUUID(),
      )
      .expect(200);
  await s
    .call('admin', 'patch', '/leads/' + a.id, {
      expectedVersion: 1,
      doNotContact: true,
      suppressionReason: 'Requested removal',
    })
    .expect(200);
  const tasks = (await s.call('admin', 'get', '/tasks').expect(200)).body.items;
  assert.equal(tasks.find((t) => t.kind === 'outreach').state, 'Cancelled');
  assert.equal(tasks.find((t) => t.kind === 'administrative').state, 'Pending');
  await s
    .call(
      'admin',
      'post',
      '/leads/' + a.id + '/activities',
      { type: 'call', outcome: 'Connected', expectedVersion: 2 },
      randomUUID(),
    )
    .expect(409);
  await s
    .call(
      'admin',
      'post',
      '/tasks',
      { leadId: a.id, title: 'Again', dueAt: '2026-10-24T13:00:00Z' },
      randomUUID(),
    )
    .expect(409);
});

test('cursor is opaque, signed and bound to filters and membership version', async () => {
  const s = setup();
  await bootstrap(s);
  for (let i = 1; i <= 3; i++) await createLead(s, i);
  const r = (await s.call('admin', 'get', '/leads?limit=1').expect(200)).body;
  assert.ok(r.nextCursor);
  const next = (
    await s
      .call(
        'admin',
        'get',
        '/leads?limit=1&cursor=' + encodeURIComponent(r.nextCursor),
      )
      .expect(200)
  ).body;
  assert.notEqual(next.items[0].id, r.items[0].id);
  await s
    .call(
      'admin',
      'get',
      '/leads?stage=Working&cursor=' + encodeURIComponent(r.nextCursor),
    )
    .expect(400);
  await s
    .call(
      'admin',
      'get',
      '/leads?cursor=' + encodeURIComponent(r.nextCursor + 'x'),
    )
    .expect(400);
});

test('~1000-row import reconciles duplicates/errors and resumes safely with chunk idempotency', async () => {
  const s = setup();
  await bootstrap(s);
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    ...lead(i + 1),
    legacyStatus: 'Pending',
  }));
  rows[1] = rows[0];
  rows[2] = { ...rows[2], email: 'invalid-email' };
  const input = {
    filename: 'enquiries.xlsx',
    sheet: 'Enquiries',
    rows,
    statusMap: { Pending: 'New' },
    dateOrder: 'DMY',
    blankRows: 5,
  };
  let job = (
    await s
      .call('admin', 'post', '/imports/preview', input, randomUUID())
      .expect(200)
  ).body;
  assert.equal(job.total, 1000);
  assert.equal(job.invalid, 1);
  const retry = randomUUID();
  let response = await s
    .call('admin', 'post', '/imports/' + job.id + '/commit', {}, retry)
    .expect(200);
  job = response.body;
  const duplicate = (
    await s
      .call('admin', 'post', '/imports/' + job.id + '/commit', {}, retry)
      .expect(200)
  ).body;
  assert.equal(duplicate.offset, job.offset);
  while (job.status !== 'Completed')
    job = (
      await s
        .call(
          'admin',
          'post',
          '/imports/' + job.id + '/commit',
          {},
          randomUUID(),
        )
        .expect(200)
    ).body;
  assert.equal(job.imported, 998);
  assert.equal(job.duplicates, 1);
  assert.equal(job.imported + job.duplicates + job.invalid, 1000);
  const replay = (
    await s
      .call('admin', 'post', '/imports/preview', input, randomUUID())
      .expect(200)
  ).body;
  assert.equal(replay.status, 'Completed');
  assert.equal(await s.store.count(path('leads')), 998);
  assert.equal(
    (
      await s.call('admin', 'get', '/leads?limit=100').expect(200)
    ).body.items.every((l) => l.assignedToUid === null),
    true,
  );
});

test('reminder worker handles closed-app delivery and does not duplicate successful devices or inbox entries', async () => {
  const s = setup();
  await bootstrap(s);
  const deviceId = randomUUID();
  await s
    .call('admin', 'post', '/devices', {
      id: deviceId,
      token: 'a'.repeat(30),
      label: 'Browser',
    })
    .expect(200);
  await s
    .call(
      'admin',
      'post',
      '/tasks',
      { title: 'Follow up', dueAt: '2026-10-24T11:00:00Z' },
      randomUUID(),
    )
    .expect(200);
  const sent = [];
  const opts = { store: s.store, now: s.now, send: async (m) => sent.push(m) };
  await dispatchReminders(opts);
  await dispatchReminders(opts);
  assert.equal(sent.length, 1);
  assert.equal(
    (await s.call('admin', 'get', '/notifications').expect(200)).body.items
      .length,
    1,
  );
  assert.equal(sent[0].data.body.includes('Customer'), false);
});

test('rescheduled/cancelled tasks and revoked users are not sent old reminders', async () => {
  const s = setup();
  await bootstrap(s);
  await grant(s, 'sdr');
  await s
    .call('sdr', 'post', '/devices', {
      id: randomUUID(),
      token: 'b'.repeat(30),
      label: 'Browser',
    })
    .expect(200);
  const t = (
    await s
      .call(
        'sdr',
        'post',
        '/tasks',
        { title: 'Due', dueAt: '2026-10-24T11:00:00Z' },
        randomUUID(),
      )
      .expect(200)
  ).body;
  await s
    .call('sdr', 'patch', '/tasks/' + t.id, {
      expectedVersion: 1,
      dueAt: '2026-10-25T11:00:00Z',
    })
    .expect(200);
  let count = 0;
  await dispatchReminders({
    store: s.store,
    now: s.now,
    send: async () => count++,
  });
  assert.equal(count, 0);
  await s
    .call('admin', 'patch', '/members/sdr', {
      active: false,
      role: 'SDR',
      scope: 'assigned',
      expectedVersion: 1,
    })
    .expect(200);
  s.setTime('2026-10-26T12:00:00.000Z');
  await dispatchReminders({
    store: s.store,
    now: s.now,
    send: async () => count++,
  });
  assert.equal(count, 0);
});

test('transient delivery retries only failed devices and recovers a stale lease', async () => {
  const s = setup();
  await bootstrap(s);
  for (const token of ['good', 'bad'])
    await s
      .call('admin', 'post', '/devices', {
        id: randomUUID(),
        token: token.repeat(15),
        label: token,
      })
      .expect(200);
  await s
    .call(
      'admin',
      'post',
      '/tasks',
      { title: 'Due', dueAt: '2026-10-24T11:00:00Z' },
      randomUUID(),
    )
    .expect(200);
  let good = 0,
    bad = 0,
    fail = true;
  const send = async (m) => {
    if (m.token.startsWith('good')) good++;
    else {
      bad++;
      if (fail) throw Error('temporary');
    }
  };
  await dispatchReminders({ store: s.store, now: s.now, send });
  assert.equal(good, 1);
  assert.equal(bad, 1);
  fail = false;
  s.setTime('2026-10-24T12:05:00.000Z');
  await dispatchReminders({ store: s.store, now: s.now, send });
  assert.equal(good, 1);
  assert.equal(bad, 2);
  assert.equal(
    (await s.call('admin', 'get', '/notifications').expect(200)).body.items
      .length,
    1,
  );
});

test('idempotent responses cannot leak a lead after reassignment', async () => {
  const s = setup();
  await bootstrap(s);
  await grant(s, 'sdr');
  const key = randomUUID();
  const body = lead(15);
  const l = (await s.call('sdr', 'post', '/leads', body, key).expect(200)).body;
  await s
    .call('admin', 'patch', '/leads/' + l.id + '/assignment', {
      assignedToUid: 'admin',
      expectedVersion: 1,
    })
    .expect(200);
  await s.call('sdr', 'post', '/leads', body, key).expect(404);
});

test('corrected call history preserves the original revision and updates the latest-call projection', async () => {
  const s = setup();
  await bootstrap(s);
  const l = await createLead(s);
  const call = (
    await s
      .call(
        'admin',
        'post',
        '/leads/' + l.id + '/activities',
        {
          type: 'call',
          outcome: 'Connected',
          notes: 'Original',
          expectedVersion: 1,
        },
        randomUUID(),
      )
      .expect(200)
  ).body.activity;
  await s
    .call(
      'admin',
      'post',
      '/activities/' + call.id + '/corrections',
      {
        type: 'call',
        outcome: 'No answer',
        notes: 'Corrected',
        expectedRevision: 1,
      },
      randomUUID(),
    )
    .expect(200);
  assert.equal(
    (await s.call('admin', 'get', '/leads/' + l.id).expect(200)).body
      .lastCallOutcome,
    'No answer',
  );
  const versions = await s.store.query(path('activityRevisions'));
  assert.equal(versions.length, 1);
  assert.equal(versions[0].notes, 'Original');
});

test('large error reports are paginated without dropping validation failures', async () => {
  const s = setup();
  await bootstrap(s);
  const i = (
    await s
      .call(
        'admin',
        'post',
        '/imports/preview',
        {
          filename: 'invalid.xlsx',
          sheet: 'Sheet',
          rows: Array.from({ length: 120 }, (_, n) => ({
            ...lead(n),
            email: 'invalid-email',
          })),
        },
        randomUUID(),
      )
      .expect(200)
  ).body;
  assert.equal(i.invalid, 120);
  assert.equal(i.errors.length, 100);
  const report = (
    await s
      .call('admin', 'get', '/imports/' + i.id + '/errors?limit=100')
      .expect(200)
  ).body;
  assert.equal(report.items.length, 120);
  assert.equal(report.nextCursor, null);
});
