import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { PRESETS } from '../src/contracts.js';
import { dispatchBetaEmail } from '../src/email-beta.js';
import { reserveEmailBudget } from '../src/email-delivery.js';

const at = '2026-11-27T00:00:00.000Z';
const key = Buffer.alloc(32, 3);
const customer = 'customer@example.test';
const address = 'leads@mail-preprod.example.test';
const domain = address.split('@')[1];
const alias = id => 'reply+' + id + '@' + domain;
const lead = { id: 'lead1', name: 'Synthetic lead', assignedToUid: 'rep', version: 1, email: customer };
const member = id => ({ id, uid: id, active: true, role: 'SDR', scope: 'assigned', capabilities: PRESETS.SDR, version: 1 });

function fixture({ sharedWebhook = false } = {}) {
  const store = memoryStore({
    [path('members', 'rep')]: member('rep'),
    [path('members', 'other')]: member('other'),
    [path('leads', lead.id)]: lead,
  });
  const sends = [];
  const incoming = new Map();
  const config = {
    sharedWebhook, ready: () => true, environment: 'pre-production', address, releaseAddress: 'release@' + domain,
    permits: value => value === customer, replyAddress: alias,
    threadFromAddress: value => value?.startsWith('reply+') ? value.split('@')[0].slice(6) : null,
    accepts: value => value === address || value === 'release@' + domain || value?.startsWith('reply+'),
    webhookSecret: async () => 'whsec_' + key.toString('base64'),
    receive: async id => incoming.get(id),
    send: async (payload, id) => {
      const providerId = randomUUID();
      sends.push({ payload, id, providerId });
      return { state: 'Accepted', providerId };
    },
  };
  const api = request(createApp({
    store, betaEmail: config, ...(sharedWebhook ? { emailRuntime: config } : {}), cursorSecret: 'synthetic-cursor-secret-1234567890123456',
    now: () => at, bootstrapAdminEmails: ['admin@example.test'],
    verifyToken: async uid => ({ uid, email: uid + '@example.test', email_verified: true, firebase: { sign_in_provider: 'google.com' } }),
    verifyAppCheck: async value => assert.equal(value, 'verified'),
  }));
  const call = (method, endpoint, user = 'admin') =>
    api[method]('/api/v1' + endpoint).set('Authorization', 'Bearer ' + user).set('X-Firebase-AppCheck', 'verified');
  const receipt = (event, signed = true) => {
    const body = JSON.stringify(event);
    const stamp = String(Date.parse(at) / 1000);
    const id = 'msg_' + randomUUID();
    const signature = createHmac('sha256', key).update(id + '.' + stamp + '.' + body).digest('base64');
    return api.post(sharedWebhook ? '/api/v1/email/receipts/resend' : '/api/v1/email/beta/receipts/resend').set('Content-Type', 'application/json')
      .set('svix-id', id).set('svix-timestamp', stamp)
      .set('svix-signature', 'v1,' + (signed ? signature : 'bad')).send(body);
  };
  const enable = async () => {
    await call('get', '/me').expect(200);
    await call('patch', '/email/beta/settings').send({ enabled: true, memberIds: ['rep', 'other'], expectedVersion: 1 }).expect(200);
  };
  const dispatch = () => dispatchBetaEmail({ store, config, at, reserve: reserveEmailBudget });
  return { store, call, receipt, enable, dispatch, incoming, sends };
}

test('Email Beta defaults off and queued mail rechecks assignment and idempotency', async () => {
  const { store, call, enable, dispatch, sends } = fixture();
  await call('get', '/email/threads', 'rep').expect(403);
  await call('get', '/me').expect(200);
  const settings = await call('get', '/email/beta/settings').expect(200);
  assert.equal(settings.body.enabled, false);
  await call('get', '/email/beta/settings', 'rep').expect(403);
  await enable();
  const idempotencyKey = randomUUID();
  const input = { leadId: lead.id, subject: 'Test conversation', body: 'Synthetic message' };
  const send = (body = input) => call('post', '/email/threads', 'rep').set('Idempotency-Key', idempotencyKey).send(body);
  const result = await send().expect(200);
  assert.deepEqual((await send().expect(200)).body, result.body);
  assert.equal((await send({ ...input, body: 'Different' }).expect(409)).body.error.code, 'IDEMPOTENCY');
  const { threadId } = result.body;
  await call('get', '/email/threads/' + threadId, 'other').expect(404);
  const empty = await call('get', '/email/threads', 'other').expect(200);
  assert.equal(empty.body.items.length, 0);
  await store.run(async tx => tx.set(path('leads', lead.id), { ...lead, assignedToUid: 'other' }));
  await call('get', '/email/threads/' + threadId, 'rep').expect(404);
  await send().expect(404);
  await dispatch();
  assert.equal(sends.length, 0);
  const visible = await call('get', '/email/threads/' + threadId, 'other').expect(200);
  assert.equal(visible.body.messages[0].state, 'Suppressed');
});

test('verified replies thread once, release replies stay Admin-only, deletion erases message bodies', async () => {
  const { store, call, receipt, enable, dispatch, incoming, sends } = fixture();
  await enable();
  const sent = await call('post', '/email/threads', 'rep').set('Idempotency-Key', randomUUID())
    .send({ leadId: lead.id, subject: 'Quote', body: '**Sample price**\n\n- *Oak*\n- <script>example</script>' }).expect(200);
  const { threadId, messageId } = sent.body;
  await dispatch();
  assert.equal(sends[0].payload.reply_to, alias(threadId));
  assert.match(sends[0].payload.html, /<strong>Sample price<\/strong>/);
  assert.match(sends[0].payload.html, /<li><em>Oak<\/em><\/li>/);
  assert.equal(sends[0].payload.html.includes('<script>'), false);
  assert.match(sends[0].payload.html, /&lt;script&gt;/);
  assert.equal(sends[0].payload.text, 'Sample price\n\n• Oak\n• <script>example</script>');
  const originalId = '<original@example.test>';
  await receipt({ type: 'email.delivered', data: { email_id: sends[0].providerId, message_id: originalId,
    tags: { salesdrone_beta: messageId, salesdrone_env: 'pre-production' } } }).expect(200);
  const receive = async (to, internetId) => {
    const id = randomUUID();
    incoming.set(id, { from: customer, to: [to], subject: 'Re: Quote', text: '<img src="https://untrusted.test">',
      message_id: internetId, headers: { 'In-Reply-To': originalId }, authentication: { dmarc: 'pass' },
      attachments: [{ filename: 'private.txt' }] });
    const event = { type: 'email.received', data: { email_id: id, to: [to] } };
    await receipt(event, false).expect(401);
    await receipt(event).expect(200);
    await receipt(event).expect(200);
    await dispatch();
  };
  const replyId = '<reply@example.test>';
  await receive(alias(threadId), replyId);
  const detail = await call('get', '/email/threads/' + threadId, 'rep').expect(200);
  assert.equal(detail.body.messages.length, 2);
  const reply = detail.body.messages.find(item => item.direction === 'inbound');
  assert.equal(reply.attachments, true);
  assert.equal(reply.body, '<img src="https://untrusted.test">');
  assert.ok(!JSON.stringify(detail.body).includes('private.txt'));
  assert.equal(detail.body.unread, true);
  await call('patch', '/email/threads/' + threadId + '/read', 'rep')
    .send({ latestMessageId: detail.body.latestMessageId }).expect(200);
  assert.equal((await call('get', '/email/threads/' + threadId, 'rep').expect(200)).body.unread, false);
  await call('post', '/email/threads/' + threadId + '/replies', 'rep').set('Idempotency-Key', randomUUID())
    .send({ body: 'Thanks', expectedVersion: detail.body.version }).expect(200);
  await dispatch();
  assert.equal(sends[1].payload.headers['In-Reply-To'], replyId);
  await receive('release@' + domain, '<release-reply@example.test>');
  await call('get', '/email/threads?filter=unlinked', 'rep').expect(404);
  const unlinked = await call('get', '/email/threads?filter=unlinked').expect(200);
  assert.equal(unlinked.body.items.length, 1);
  const current = await call('get', '/email/threads/' + threadId).expect(200);
  await call('delete', '/email/threads/' + threadId).send({ confirmation: 'DELETE', expectedVersion: current.body.version }).expect(200);
  await call('get', '/email/threads/' + threadId).expect(404);
  await dispatch();
  const bodyRows = await store.query(path('emailBetaMessages'), { filters: [['threadId', '==', threadId]] });
  assert.deepEqual(bodyRows, []);
  await receive(alias(threadId), '<late@example.test>');
  assert.equal((await call('get', '/email/threads?filter=unlinked').expect(200)).body.items.length, 1);
});

test('a shared pre-prod webhook verifies signatures and dispatches only Pilot inbox mail', async () => {
  const { call, receipt, enable, dispatch, incoming } = fixture({ sharedWebhook: true });
  await enable();
  for (const to of ['unrelated@example.test', address]) {
    const id = randomUUID();
    incoming.set(id, { from: customer, to: [to], subject: 'Shared callback', text: 'Synthetic reply' });
    const event = { type: 'email.received', data: { email_id: id, to: [to] } };
    await receipt(event, false).expect(401);
    await receipt(event).expect(200);
  }
  await dispatch();
  const { body } = await call('get', '/email/threads?filter=unlinked').expect(200);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].subject, 'Shared callback');
});
