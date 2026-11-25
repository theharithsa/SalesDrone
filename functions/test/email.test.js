import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { observableStore } from '../src/observable-store.js';
import { path, hash } from '../src/policy.js';
import { PRESETS } from '../src/contracts.js';
import { dispatchEmails, verifyEmailReceipt } from '../src/email-delivery.js';
import { emailSettings, emailPreferences, nextDigestSlot } from '../src/email-policy.js';
import { digestFacts } from '../src/email-digests.js';
import { renderEmail, sampleDigest, templateInfo, templatePreview } from '../src/email-templates.js';

const initial = '2026-11-23T03:29:00.000Z';
const signingKey = Buffer.alloc(32, 125);
const signatureSecret = 'whsec_' + signingKey.toString('base64');
const rep = { id: 'rep', uid: 'rep', email: 'rep@example.test', name: 'Synthetic rep',
  active: true, scope: 'assigned', role: 'SDR', capabilities: PRESETS.SDR, version: 1 };
const lead = { id: 'synthetic-lead', name: 'Synthetic Customer Unsent', phone: '5550100',
  enquiryDate: '2026-11-20', stage: 'New', assignedToUid: 'rep', assignmentRevision: 1, version: 1, archived: false, doNotContact: false, suppressionReason: '' };
const basicTask = { id: 'shared', title: 'Internal task title', leadId: lead.id, kind: 'administrative',
  dueAt: '2026-11-23T07:00:00.000Z', timezone: 'Asia/Kolkata', creatorUid: 'admin', recipientUid: rep.uid,
  state: 'Pending', createdAt: '2026-11-21T00:00:00.000Z', version: 1, completedAt: null };

async function fixture({ send, chooseInsight } = {}) {
  let tick = initial, ready = true;
  const transport = [];
  const base = memoryStore({
    [path('members', rep.uid)]: rep,
    [path('leads', lead.id)]: lead,
    [path('tasks', basicTask.id)]: basicTask,
  });
  const store = observableStore(base);
  const config = {
    environment: 'pre-production', origin: 'https://example-preprod.test',
    webhookSecret: () => signatureSecret, ready: () => ready, verifiedEmail: async member => member.email,
    chooseInsight,
    send: async (payload, key) => {
      transport.push({ payload, key });
      return send ? send(payload, key, transport.length) : { state: 'Accepted', providerId: randomUUID() };
    },
  };
  const app = createApp({ store, emailRuntime: config, now: () => tick,
    bootstrapAdminEmails: ['admin@example.test'],
    verifyToken: async uid => ({ uid, email: uid + '@example.test', email_verified: true,
      firebase: { sign_in_provider: 'google.com' } }),
    verifyAppCheck: token => assert.equal(token, 'attested'),
  });
  const call = (uid, method, url, body, key = randomUUID()) => {
    const req = request(app)[method]('/api/v1' + url).set('Authorization', 'Bearer ' + uid)
      .set('X-Firebase-AppCheck', 'attested').set('Idempotency-Key', key);
    return body === undefined ? req : req.send(body);
  };
  await call('admin', 'get', '/me').expect(200);
  const write = (collection, id, value) => base.run(tx => tx.set(path(collection, id), value));
  const policy = async values => {
    const { version, ...settings } = (await call('admin', 'get', '/email/settings').expect(200)).body;
    delete settings.deliveryReady;
    return call('admin', 'patch', '/email/settings', { ...settings, enabled: true, ...values, expectedVersion: version }).expect(200);
  };
  const preferences = async (uid, values) => {
    const { version, ...defaults } = (await call(uid, 'get', '/email/preferences').expect(200)).body;
    return call(uid, 'patch', '/email/preferences', { ...defaults, ...values, expectedVersion: version }).expect(200);
  };
  const jobs = () => base.query(path('emailJobs'));
  const drain = () => dispatchEmails({ store, config, at: tick });
  const rawReceipt = (event, timestamp = Math.floor(Date.parse(tick) / 1000), withSecret = true) => {
    const raw = JSON.stringify(event, null, 2), id = 'msg_' + randomUUID();
    const signed = createHmac('sha256', signingKey).update(id + '.' + timestamp + '.' + raw).digest('base64');
    return request(app).post('/api/v1/email/receipts/resend').type('application/json')
      .set('svix-id', id).set('svix-timestamp', String(timestamp))
      .set('svix-signature', withSecret ? 'v1,' + signed : 'v1,' + 'X'.repeat(43) + '=').send(raw);
  };
  return { call, policy, preferences, write, jobs, drain, transport, rawReceipt, store,
    at: value => { tick = value; }, ready: value => { ready = value; } };
}

test('email controls are scoped, versioned and paused by default', async () => {
  const f = await fixture();
  assert.deepEqual((await f.call('admin', 'get', '/email/settings')).body, { ...emailSettings(), deliveryReady: true });
  assert.deepEqual((await f.call('rep', 'get', '/email/preferences')).body, emailPreferences());
  await f.call('rep', 'get', '/email/settings').expect(403);
  await f.call('rep', 'get', '/email/deliveries').expect(403);
  await f.call('rep', 'post', '/email/preview', { template: 'daily' }).expect(403);
  await f.call('rep', 'post', '/email/test', { template: 'daily' }).expect(403);
  await f.call('rep', 'patch', '/email/preferences', { ...emailPreferences(), expectedVersion: 1, uid: 'admin' }).expect(400);
  const { version, ...fields } = emailPreferences();
  await f.call('rep', 'patch', '/email/preferences', { ...fields, expectedVersion: version, timezone: 'Wrong/Timezone' }).expect(400);
  await f.policy();
  await f.call('admin', 'patch', '/email/settings', {
    expectedVersion: 1, enabled: false, events: emailSettings().events, outcomeRecipientUid: null,
  }).expect(409);
  const preview = await f.call('admin', 'post', '/email/preview', { template: 'weekly' }).expect(200);
  assert.match(preview.body.html, /Weekly insight/);
  assert.match(preview.body.text, /Leads covered: 5/);
  assert.match(preview.body.text, /previous|prior week/);
});

test('every email uses first-party SalesDrone branding in delivery and the sandboxed preview', () => {
  const origin = 'https://example-preprod.test';
  for (const template of Object.keys(templateInfo)) {
    const preview = templatePreview(template, origin);
    const delivery = renderEmail({ template, origin, preprod: true, facts: sampleDigest[template] });
    assert.match(preview.html, /src="\/brand\/salesdrone-mark\.png"/);
    assert.match(preview.html, /url\("\/fonts\/open-sans\/open-sans-latin\.woff2"\)/);
    assert.doesNotMatch(preview.html, /<a\s/);
    assert.match(delivery.html, /src="https:\/\/example-preprod\.test\/brand\/salesdrone-mark\.png"/);
    assert.match(delivery.html, /url\("https:\/\/example-preprod\.test\/fonts\/open-sans\/open-sans-latin\.woff2"\)/);
    assert.match(delivery.html, /<!--\[if mso\]><style>/);
    assert.match(delivery.html, />SalesDrone<\/td>/);
    assert.match(delivery.subject, /^\[Pre-prod\]/);
    assert.match(delivery.text, /^SalesDrone\n/);
  }
});

test('invitation is atomic, only a genuine reissue sends, and acceptance emits no second access job', async () => {
  const f = await fixture();
  await f.policy();
  const body = { email: 'new@example.test', role: 'SDR', scope: 'assigned' };
  const key = randomUUID();
  const invite = (await f.call('admin', 'post', '/invitations', body, key).expect(200)).body;
  await f.call('admin', 'post', '/invitations', body, key).expect(200);
  await f.call('admin', 'post', '/invitations', body).expect(200);
  assert.deepEqual((await f.jobs()).map(job => job.event), ['invitation']);
  await f.drain();
  assert.deepEqual(f.transport[0].payload.to, ['delivered@resend.dev']);
  assert.match(f.transport[0].payload.text, /https:\/\/example-preprod\.test/);
  assert.doesNotMatch(f.transport[0].payload.html + f.transport[0].payload.text, /new@example/);
  await f.call('admin', 'post', '/email/invitations/' + invite.id + '/resend', { expectedVersion: invite.version }).expect(200);
  await f.call('new', 'post', '/invitations/' + invite.id + '/accept', {}).expect(200);
  const run = await f.drain();
  assert.equal(run.suppressed, 1);
  assert.deepEqual((await f.jobs()).map(job => job.event), ['invitation', 'invitation']);
});

test('lead assignment, configured outcomes and shared task changes respect permission, current versions and self-actions', async () => {
  const f = await fixture();
  await f.policy();
  await f.preferences('rep', { leadUpdates: true, taskUpdates: true });
  await f.write('settings', 'leadResearch', { convertedStages: ['Won'], failedStages: ['Lost'] });
  await f.write('settings', 'fields', { values: { stage: ['New', 'Won', 'Lost'] } });
  await f.call('admin', 'patch', '/leads/' + lead.id + '/assignment', { assignedToUid: null, expectedVersion: 1 }).expect(200);
  await f.call('admin', 'patch', '/leads/' + lead.id + '/assignment', { assignedToUid: 'rep', expectedVersion: 2 }).expect(200);
  assert.equal((await f.drain()).accepted, 1);
  await f.call('admin', 'patch', '/leads/' + lead.id, { stage: 'Won', expectedVersion: 3 }).expect(200);
  assert.equal((await f.drain()).accepted, 1);
  await f.call('admin', 'patch', '/leads/' + lead.id, { stage: 'Won', expectedVersion: 4 }).expect(200);
  assert.equal((await f.jobs()).filter(job => job.event === 'lead_converted').length, 1);
  const endpoint = '/leads/' + lead.id + '/tasks/' + basicTask.id;
  await f.call('admin', 'patch', endpoint, {
    expectedVersion: 1, state: 'Completed', comment: 'Private context stays in app',
  }).expect(200);
  assert.equal((await f.drain()).accepted, 1);
  await f.call('admin', 'patch', endpoint, {
    expectedVersion: 2, state: 'Pending', dueAt: '2026-11-24T04:00:00.000Z', comment: 'A new action',
  }).expect(200);
  assert.equal((await f.drain()).accepted, 1);
  await f.call('rep', 'patch', endpoint, {
    expectedVersion: 3, dueAt: '2026-11-24T05:00:00.000Z', comment: 'I moved it',
  }).expect(200);
  await f.call('admin', 'patch', '/leads/' + lead.id, { stage: 'Lost', expectedVersion: 5 }).expect(200);
  await f.write('members', 'rep', { ...rep, active: false, version: 2 });
  assert.equal((await f.drain()).suppressed, 1);
  const events = (await f.jobs()).map(job => job.event);
  assert.ok(events.includes('task_completed') && events.includes('task_reopened') && events.includes('lead_failed'));
  assert.ok(!events.includes('task_rescheduled'));
  for (const { payload } of f.transport) {
    assert.doesNotMatch(payload.html + payload.text, /Private context|Synthetic Customer|5550100|Internal task title/);
    assert.match(payload.text, /example-preprod\.test/);
  }
});

test('concurrent drains, bounded retries, raw signed receipts and suppression are distinct', async () => {
  const id = randomUUID();
  const f = await fixture({ send: (_payload, _key, calls) => calls === 1
    ? { state: 'Failed', reason: 'provider_unavailable', retry: true }
    : { providerId: id, state: 'Accepted' } });
  const key = randomUUID();
  const queued = await f.call('admin', 'post', '/email/test', { template: 'daily', scenario: 'bounce' }, key).expect(200);
  await f.call('admin', 'post', '/email/test', { template: 'daily', scenario: 'bounce' }, key).expect(200);
  await f.call('admin', 'post', '/email/test', { template: 'daily' }).expect(429);
  await Promise.all([f.drain(), f.drain()]);
  assert.equal(f.transport.length, 1);
  assert.equal((await f.jobs())[0].state, 'Delayed');
  f.at('2026-11-23T03:32:00.000Z');
  await f.drain();
  assert.equal((await f.jobs())[0].state, 'Accepted');
  assert.deepEqual(f.transport[0], f.transport[1]);
  const event = {
    type: 'email.delivered', created_at: '2026-11-23T03:32:00.000Z',
    data: { email_id: id, to: ['bounced@resend.dev'],
      tags: { salesdrone_job: queued.body.id, salesdrone_env: 'pre-production' } },
  };
  await f.rawReceipt(event, undefined, false).expect(401);
  await f.rawReceipt(event, 1_700_000_000).expect(401);
  await f.rawReceipt({ ...event, data: { ...event.data, tags: { ...event.data.tags, salesdrone_env: 'production' } } }).expect(200);
  assert.equal((await f.jobs())[0].state, 'Accepted');
  await f.rawReceipt(event).expect(200);
  await f.rawReceipt({ ...event, type: 'email.delivery_delayed' }).expect(200);
  assert.equal((await f.jobs())[0].state, 'Delivered');
  const bounce = { ...event, type: 'email.bounced', data: { ...event.data, bounce: { type: 'Permanent' } } };
  await f.rawReceipt(bounce).expect(200);
  await f.rawReceipt(bounce).expect(200);
  assert.equal((await f.jobs())[0].state, 'Suppressed');
  assert.equal((await f.store.get(path('emailSuppressions', hash('bounced@resend.dev')))).reason, 'hard_bounce');
  f.at('2026-11-23T03:37:00.000Z');
  await f.call('admin', 'post', '/email/test', { template: 'daily', scenario: 'bounce' }).expect(200);
  assert.equal((await f.drain()).suppressed, 1);
  assert.equal(f.transport.length, 2);
  const history = (await f.call('admin', 'get', '/email/deliveries?limit=1').expect(200)).body;
  assert.ok(history.nextCursor);
  assert.doesNotMatch(JSON.stringify(history), /bounced@|providerId|recipientHash/);
  const events = await f.store.query(path('telemetryOutbox'), { limit: 100 });
  const types = events.map(row => row.event.type);
  assert.ok(types.includes('com.avinyatech.salesdrone.email.delivery.delivered'));
  assert.ok(types.includes('com.avinyatech.salesdrone.email.delivery.suppressed'));
  assert.doesNotMatch(JSON.stringify(events), /bounced@|Weekly Completion|Internal task title/);
});

test('digests respect the local calendar, factual fallback and one AI selection per job', async () => {
  let calls = 0;
  const f = await fixture({ chooseInsight: input => {
    calls++;
    assert.ok(input.choices.includes('priority'));
    assert.doesNotMatch(JSON.stringify(input), /synthetic-lead|Internal task title|@example/);
    return 'unsupported_model_claim';
  } });
  await f.policy({ events: { ...emailSettings().events, weekly: false } });
  await f.preferences('rep', { dailyEnabled: true, dailyTime: '09:00', digestInsights: true });
  await f.write('tasks', 'personal', { ...basicTask, id: 'personal', leadId: null });
  f.at('2026-11-23T03:30:00.000Z');
  assert.equal((await f.drain()).accepted, 1);
  assert.equal(calls, 1);
  assert.match(f.transport[0].payload.text, /Due today: 1/);
  assert.match(f.transport[0].payload.text, /Today’s priority/);
  assert.doesNotMatch(f.transport[0].payload.text, /unsupported_model_claim/);
  await f.drain();
  assert.equal(f.transport.length, 1);
  assert.equal(nextDigestSlot('daily', { dailyTime: '02:30', timezone: 'America/New_York' }, '2026-03-07T08:00:00.000Z').date, '2026-03-09');
  assert.equal(nextDigestSlot('daily', { dailyTime: '01:30', timezone: 'America/New_York' }, '2026-10-31T07:00:00.000Z').date, '2026-11-02');
});

test('receipt abuse limit applies before parsing and header types must be strings', async () => {
  const f = await fixture();
  assert.throws(() => verifyEmailReceipt(Buffer.from('{}'), {
    'svix-id': 'msg_fixture', 'svix-timestamp': ['1', '2'], 'svix-signature': 'fixture',
  }, signatureSecret, initial), { status: 401, code: 'EMAIL_SIGNATURE' });
  for (let count = 0; count < 120; count++)
    await f.rawReceipt({}, undefined, false).expect(401);
  const limited = await f.rawReceipt({}, undefined, false).expect(429);
  assert.ok(Number(limited.headers['retry-after']) > 0);
  assert.deepEqual(await f.jobs(), []);
});

test('weekly recap counts distinct accessible leads and prior week, and its link filters completion dates', async () => {
  const f = await fixture();
  const done = { ...basicTask, state: 'Completed', completedAt: '2026-11-22T18:29:00.000Z',
    completedDueAt: '2026-11-22T18:30:00.000Z' };
  await f.write('tasks', 'done', { ...done, id: 'done' });
  await f.write('tasks', 'prior', { ...done, id: 'prior', completedAt: '2026-11-15T18:29:00.000Z' });
  await f.write('tasks', 'next', { ...done, id: 'next', completedAt: '2026-11-22T18:30:00.000Z' });
  const slot = { date: '2026-11-23', at: '2026-11-23T03:30:00.000Z' };
  const { facts } = await digestFacts(f.store, rep, 'weekly', slot, emailPreferences());
  assert.equal(facts.completed, 1);
  assert.equal(facts.leads, 1);
  assert.equal(facts.onTime, 1);
  assert.equal(facts.priorWeek, 1);
  await f.policy();
  await f.preferences('rep', { weeklyEnabled: true });
  f.at(slot.at);
  assert.equal((await f.drain()).accepted, 1);
  assert.match(f.transport[0].payload.text, /status=Completed&from=2026-11-16&until=2026-11-23/);
  const result = await f.call('rep', 'get', '/tasks?state=Completed&view=accessible&from=2026-11-16&until=2026-11-23&tz=Asia%2FKolkata').expect(200);
  assert.deepEqual(result.body.items.map(task => task.id), ['done']);
  await f.call('rep', 'get', '/tasks?state=Completed&view=accessible&from=2026-11-16&until=2026-11-29&tz=Asia%2FKolkata').expect(400);
  for (const template of ['invitation','access_ready','lead_assigned','lead_converted','lead_failed','task_assigned',
    'task_completed','task_rescheduled','task_reopened','daily','weekly','test']) {
    const preview = templatePreview(template, 'https://example-preprod.test');
    assert.match(preview.html, /SalesDrone/);
    assert.ok(preview.text.includes(preview.subject));
  }
});

test('shared task assignment, direct approval, workspace pause and the daily rate cap', async () => {
  const f = await fixture();
  await f.policy();
  await f.preferences('rep', { taskUpdates: true });
  const input = { title: 'Assigned action', leadId: lead.id, dueAt: '2026-11-23T07:00:00.000Z',
    kind: 'administrative', recipientUid: 'rep' };
  await f.call('rep', 'post', '/tasks', input).expect(403);
  const task = (await f.call('admin', 'post', '/tasks', input).expect(200)).body;
  assert.equal(task.recipientUid, 'rep');
  await f.write('members', 'approved', { ...rep, id: 'approved', uid: 'approved', email: 'approved@example.test', active: false });
  await f.call('admin', 'patch', '/members/approved', {
    active: true, expectedVersion: 1, role: 'SDR', scope: 'assigned',
  }).expect(200);
  await f.write('emailBudgets', '2026-11-23', { id: '2026-11-23', sends: 29 });
  const result = await f.drain();
  assert.deepEqual({ accepted: result.accepted, suppressed: result.suppressed }, { accepted: 1, suppressed: 1 });
  assert.deepEqual((await f.jobs()).map(job => job.event).sort(), ['access_ready', 'task_assigned']);
  await f.call('admin', 'patch', '/leads/' + lead.id + '/tasks/' + task.id + '/assignment',
    { expectedVersion: task.version, recipientUid: 'admin' }).expect(200);
  assert.equal((await f.jobs()).length, 2);
  await f.call('admin', 'patch', '/leads/' + lead.id + '/tasks/' + task.id + '/assignment',
    { expectedVersion: task.version + 1, recipientUid: 'rep' }).expect(200);
  await f.policy({ enabled: false });
  await f.policy();
  assert.equal((await f.drain()).suppressed, 1);
  assert.equal(f.transport.length, 1);
});
