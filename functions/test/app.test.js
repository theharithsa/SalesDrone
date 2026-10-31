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

test('archive validates empty, unknown and invalid versions without changing lead state', async () => {
  const s = setup();
  await bootstrap(s);
  const l = await createLead(s);
  for (const body of [
    undefined,
    {},
    { expectedVersion: '1' },
    { expectedVersion: 0 },
    { expectedVersion: -1 },
    { expectedVersion: 1, extra: true },
  ]) {
    const r = await s
      .call('admin', 'post', '/leads/' + l.id + '/archive', body)
      .expect(400);
    assert.equal(r.body.error.code, 'VALIDATION');
  }
  const unchanged = await s.store.get(path('leads', l.id));
  assert.equal(unchanged.version, l.version);
  assert.equal(unchanged.archived, false);
  await s
    .call('admin', 'post', '/leads/' + l.id + '/archive', {
      expectedVersion: l.version + 1,
    })
    .expect(409);
  await s
    .call('admin', 'post', '/leads/' + l.id + '/archive', {
      expectedVersion: l.version,
    })
    .expect(200);
  assert.equal((await s.store.get(path('leads', l.id))).archived, true);
});

test('duplicate creation never discloses another SDR lead ID or contact values', async () => {
  const s = setup();
  await bootstrap(s);
  await grant(s, 'sdr');
  await grant(s, 'viewer', 'SDR');
  const l = await createLead(s, 88, 'sdr');
  const denied = await s.call('viewer', 'get', '/leads/' + l.id);
  assert.ok([403, 404].includes(denied.status));
  for (const who of ['viewer', 'admin']) {
    const r = await s
      .call(who, 'post', '/leads', lead(88), randomUUID())
      .expect(409);
    assert.equal(r.body.error.code, 'DUPLICATE');
    assert.equal(r.body.error.details, undefined);
    const json = JSON.stringify(r.body);
    assert.ok(!json.includes(l.id));
    assert.ok(!json.includes(l.phone));
  }
  assert.equal(await s.store.count(path('leads')), 1);
});

test('malformed and oversized JSON have stable private errors with request/version metadata', async () => {
  const s = setup();
  const malformed = await request(s.app)
    .post('/api/v1/leads')
    .set('Content-Type', 'application/json')
    .send('{"private":"SYNTHETIC-PRIVATE-CELL", broken}')
    .expect(400);
  assert.equal(malformed.body.error.code, 'BAD_JSON');
  assert.equal(
    malformed.body.error.message,
    'Request body must contain valid JSON.',
  );
  assert.ok(!JSON.stringify(malformed.body).includes('SYNTHETIC-PRIVATE-CELL'));
  const oversized = await request(s.app)
    .post('/api/v1/leads')
    .send({ value: 'x'.repeat(12 * 1024 * 1024) })
    .expect(413);
  assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(
    oversized.body.error.message,
    'Request body exceeds the allowed size.',
  );
  for (const r of [malformed, oversized]) {
    assert.equal(r.body.error.requestId, r.headers['x-request-id']);
    assert.ok(r.headers['x-app-version']);
    assert.equal(r.body.error.details, undefined);
  }
});

test('archive records one actor-attributed timeline transition atomically', async () => {
  const s=setup(); await bootstrap(s); const l=await createLead(s,81);
  await s.call('admin','post',`/leads/${l.id}/archive`,{expectedVersion:l.version}).expect(200);
  const saved=await s.store.get(path('leads',l.id));
  const events=await s.store.query(path('activities'),{filters:[['leadId','==',l.id]],limit:100});
  const archived=events.filter(e=>e.notes==='Lead archived');
  assert.equal(archived.length,1); assert.equal(archived[0].actorUid,'admin');assert.equal(archived[0].createdAt,s.now());
  await s.call('admin','post',`/leads/${l.id}/archive`,{expectedVersion:l.version}).expect(409);
  await s.call('admin','post',`/leads/${l.id}/archive`,{expectedVersion:saved.version}).expect(200);
  assert.equal((await s.store.query(path('activities'),{filters:[['leadId','==',l.id]],limit:100})).filter(e=>e.notes==='Lead archived').length,1);
});

test('mutation rate-limit expiry is a Date rather than an ISO string', async()=>{
  const s=setup();await bootstrap(s);await createLead(s,82);
  const counters=Object.entries(s.store.dump()).filter(([p])=>p.includes('/rateLimits/')).map(([,v])=>v);
  assert.ok(counters.length);for(const c of counters){assert.ok(c.expiresAt instanceof Date);assert.equal(c.expiresAt.toISOString(),'2026-10-25T12:00:00.000Z');}
});

test('task listing batch-reads each distinct lead without task re-reads and preserves visibility', async()=>{
  const s=setup();await bootstrap(s);
  const originalGet=s.store.get,originalGetAll=s.store.getAll;const reads=[],batches=[];
  s.store.get=async p=>{reads.push(p);return originalGet(p)};
  s.store.getAll=async paths=>{batches.push(paths);return originalGetAll(paths)};
  const l=await createLead(s,83);
  const dueAt='2026-10-25T12:00:00.000Z';
  for(const id of ['a','b']) await s.store.set(path('tasks',id),{id,leadId:l.id,recipientUid:'admin',creatorUid:'admin',title:'Synthetic',dueAt,state:'Pending'});
  await s.store.set(path('tasks','missing'),{id:'missing',leadId:'absent',recipientUid:'admin',creatorUid:'admin',dueAt,state:'Pending'});
  await s.store.set(path('tasks','personal'),{id:'personal',leadId:null,recipientUid:'admin',creatorUid:'admin',dueAt,state:'Pending'});
  await s.store.set(path('tasks','other'),{id:'other',leadId:null,recipientUid:'admin',creatorUid:'admin2',dueAt,state:'Pending'});
  reads.length=0;batches.length=0;
  const instrumented=createApp({store:s.store,verifyToken:async()=>people.admin,now:s.now});
  const result=(await request(instrumented).get('/api/v1/tasks').set('Authorization','Bearer admin').expect(200)).body;
  assert.deepEqual(result.items.map(t=>t.id).sort(),['a','b','personal']);
  assert.equal(batches.length,1);assert.equal(new Set(batches[0]).size,2);
  assert.equal(reads.filter(p=>p.includes('/tasks/')||p.includes('/leads/')).length,0);
});

test('task batch lookup still excludes leads outside current assigned scope', async()=>{
 const s=setup();await bootstrap(s);await grant(s,'sdr');const mine=await createLead(s,84),other=await createLead(s,85);
 await s.store.run(async tx=>tx.set(path('leads',mine.id),{...mine,assignedToUid:'sdr'}));
 for(const [id,leadId] of [['mine',mine.id],['other',other.id]])await s.store.set(path('tasks',id),{id,leadId,recipientUid:'sdr',creatorUid:'sdr',dueAt:'2026-10-25T12:00:00Z',state:'Pending'});
 const result=(await s.call('sdr','get','/tasks').expect(200)).body;assert.deepEqual(result.items.map(t=>t.id),['mine']);
});

test('archive timeline failure rolls back the lead and every linked write',async()=>{
 const s=setup();await bootstrap(s);const lead=await createLead(s,86);const before=s.store.dump();
 const failing={...s.store,run:fn=>s.store.run(tx=>fn({...tx,set:(p,value)=>{
  if(value.notes==='Lead archived')throw Error('synthetic storage failure');tx.set(p,value);
 }}))};
 const app=createApp({store:failing,verifyToken:async()=>people.admin,now:s.now});
 await request(app).post(`/api/v1/leads/${lead.id}/archive`).set('Authorization','Bearer admin').send({expectedVersion:lead.version}).expect(500);
 assert.deepEqual(s.store.dump(),before);
});

test('stage and detail edits retain shared imported contacts; newly acquired duplicate contacts stay blocked', async () => {
  const s = setup();
  await bootstrap(s);
  await s.store.set(path('settings','fields'),{version:1,values:{stage:['New','Intro','Samples Given']}});
  const first = (await s.call('admin', 'post', '/leads', lead(80), randomUUID()).expect(200)).body;
  const second = (await s.call('admin', 'post', '/leads', {...lead(80), name:'Separate synthetic enquiry', allowDuplicate:true}, randomUUID()).expect(200)).body;
  const third = (await s.call('admin', 'post', '/leads', lead(81), randomUUID()).expect(200)).body;
  const edited = (await s.call('admin', 'patch', '/leads/'+second.id, {expectedVersion:second.version,stage:'Samples Given',company:'Changed company'}).expect(200)).body;
  assert.equal(edited.stage,'Samples Given');
  assert.equal(edited.phone,second.phone);
  await s.call('admin', 'patch', '/leads/'+second.id, {expectedVersion:edited.version,phone:third.phone}).expect(409);
  assert.equal((await s.store.get(path('leads',second.id))).version,edited.version);
  await s.call('admin', 'patch', '/leads/'+second.id, {expectedVersion:second.version,stage:'Intro'}).expect(409);
  const {contactKeys} = await import('../src/leads.js');
  const sharedKey=contactKeys(edited)[0];
  assert.deepEqual(new Set((await s.store.get(path('dedupeKeys',sharedKey))).leadIds),new Set([first.id,second.id]));
  const moved=(await s.call('admin', 'patch', '/leads/'+second.id, {expectedVersion:edited.version,phone:lead(82).phone}).expect(200)).body;
  assert.deepEqual((await s.store.get(path('dedupeKeys',sharedKey))).leadIds,[first.id]);
  assert.deepEqual((await s.store.get(path('dedupeKeys',contactKeys(moved)[0]))).leadIds,[second.id]);
  assert.equal((await s.store.get(path('leads',first.id))).stage,'New');
});

test('corrections require original author or Admin in addition to current lead access', async () => {
 const s=setup();await bootstrap(s);await grant(s,'sdr');await grant(s,'viewer','SDR');
 const l=await createLead(s);
 const settings=(await s.call('admin','get','/workspace-settings').expect(200)).body;
 await s.call('admin','patch','/workspace-settings',{expectedVersion:settings.version,exportsEnabled:settings.exportsEnabled,assignedOnly:false}).expect(200);
 await s.store.run(async tx=>{const m=await tx.get(path('members','sdr'));tx.set(path('members','sdr'),{...m,scope:'all'});const v=await tx.get(path('members','viewer'));tx.set(path('members','viewer'),{...v,scope:'all'});});
 const a=(await s.call('sdr','post',`/leads/${l.id}/activities`,{type:'note',notes:'Synthetic original',expectedVersion:l.version},randomUUID()).expect(200)).body.activity;
 const correction={type:'note',notes:'Synthetic corrected',expectedRevision:1};
 const denied=await s.call('viewer','post',`/activities/${a.id}/corrections`,correction,randomUUID()).expect(403);assert.equal(denied.body.error.code,'ACTIVITY_AUTHOR');
 await s.call('sdr','post',`/activities/${a.id}/corrections`,correction,randomUUID()).expect(200);
 await s.call('admin2','post',`/activities/${a.id}/corrections`,{...correction,expectedRevision:2},randomUUID()).expect(200);
 await s.store.run(async tx=>{const activity=await tx.get(path('activities',a.id));delete activity.actorUid;tx.set(path('activities',a.id),activity);});
 await s.call('sdr','post',`/activities/${a.id}/corrections`,{...correction,expectedRevision:3},randomUUID()).expect(403);
 await s.call('admin','post',`/activities/${a.id}/corrections`,{...correction,expectedRevision:3},randomUUID()).expect(200);
});

test('archived duplicate disclosure requires current access and restore preserves contact owners', async()=>{
 const s=setup();await bootstrap(s);await grant(s,'sdr');
 const first=await createLead(s,91);
 await s.call('admin','post',`/leads/${first.id}/archive`,{expectedVersion:first.version}).expect(200);
 const visible=await s.call('admin','post','/leads',lead(91),randomUUID()).expect(409);assert.equal(visible.body.error.code,'DUPLICATE_ARCHIVED');
 const hidden=await s.call('sdr','post','/leads',lead(91),randomUUID()).expect(409);assert.equal(hidden.body.error.code,'DUPLICATE');assert.ok(!JSON.stringify(hidden.body).includes(first.id));
 const {contactKeys}=await import('../src/leads.js');const key=contactKeys(first)[0];
 await s.store.run(async tx=>{tx.set(path('dedupeKeys',key),{id:key,leadIds:[first.id,'other-synthetic']});});
 const restored=(await s.call('admin','post',`/leads/${first.id}/restore`,{expectedVersion:2}).expect(200)).body;
 assert.deepEqual(new Set((await s.store.get(path('dedupeKeys',key))).leadIds),new Set([first.id,'other-synthetic']));
 await s.call('admin','post',`/leads/${first.id}/archive`,{expectedVersion:restored.version}).expect(200);
 await s.store.run(async tx=>tx.set(path('dedupeKeys',key),{id:key,leadIds:['other-synthetic']}));
 await s.call('admin','post',`/leads/${first.id}/restore`,{expectedVersion:4}).expect(409);
 assert.equal((await s.store.get(path('leads',first.id))).archived,true);
});

test('single and batch reassignment preserve private administrative tasks', async()=>{
 const s=setup();await bootstrap(s);await grant(s,'sdr');
 for(const batch of [false,true]){
 const l=await createLead(s,batch?94:93);
 await s.store.run(async tx=>{for(const kind of ['outreach','administrative'])tx.set(path('tasks',l.id+kind),{id:l.id+kind,leadId:l.id,kind,state:'Pending',version:1,recipientUid:'admin'});});
 if(batch)await s.call('admin','post','/leads/batch',{items:[{id:l.id,expectedVersion:l.version}],changes:{},assignedToUid:'sdr'},randomUUID()).expect(200);
 else await s.call('admin','patch',`/leads/${l.id}/assignment`,{expectedVersion:l.version,assignedToUid:'sdr'}).expect(200);
 assert.equal((await s.store.get(path('tasks',l.id+'outreach'))).state,'Cancelled');
 const task=await s.store.get(path('tasks',l.id+'administrative'));assert.equal(task.state,'Pending');assert.equal(task.version,1);assert.equal(task.recipientUid,'admin');
 }
});
