import { MAX_EMAIL_HTML, prepareEmailHtml, renderRichCorrespondenceV2 } from './email-html.js';
import { renderCorrespondenceV1 } from './email-message-format.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './contracts.js';
import { RESET_STATE, resetActive } from './lead-data-reset.js';
import { assertVersion, canReadLead, effectiveMember, hash, leadAccess, path } from './policy.js';
import { documentKey } from './store.js';

export const betaPolicyPath = path('settings', 'emailBeta');
const threads = path('emailBetaThreads');
const messages = path('emailBetaMessages');
const jobs = path('emailBetaDue');
const erasures = path('emailBetaErase');
const ref = (collection, id) => collection + '/' + id;
const keys = (type, value) => path('emailBetaKeys', hash(type + ':' + value));
const due = (at, id) => at + '_' + id;
const inMinutes = (at, minutes) => new Date(Date.parse(at) + 60_000 * minutes).toISOString();
const uuid = z.uuid();
const objectId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/);
const version = z.number().int().positive();
const body = z.string().trim().min(1).max(16_000);
const subject = z.string().trim().min(1).max(180).regex(/^[^\r\n]+$/);
export const BetaSettings = z.object({ enabled: z.boolean(), memberIds: z.array(objectId).max(50), expectedVersion: version }).strict();
const html = z.string().min(1).max(MAX_EMAIL_HTML).optional();
export const BetaCompose = z.object({ leadId: objectId, subject, body, html }).strict();
export const BetaReply = z.object({ body, html, expectedVersion: version }).strict();
export const BetaLink = z.object({ leadId: objectId.nullable(), expectedVersion: version }).strict();
export const BetaRead = z.object({ latestMessageId: uuid }).strict();
export const BetaDelete = z.object({ confirmation: z.literal('DELETE'), expectedVersion: version }).strict();

const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const addressPattern = /^[^\s<>,@]+@[^\s<>,@]+\.[^\s<>,@]+$/;
const emailAddress = value => {
  const address = normalize(value?.match?.(/<([^<>]+)>\s*$/)?.[1] || value);
  return address.length <= 254 && addressPattern.test(address) ? address : null;
};
const providerId = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const messageId = value => typeof value === 'string' && /^<[^\s<>]{1,248}>$/.test(value) ? value : null;
const unavailable = () => new AppError(503, 'EMAIL_BETA_SETUP', 'Email Beta is unavailable');
const notFound = () => new AppError(404, 'NOT_FOUND', 'Email conversation not found');
const isAdmin = member => member.role === 'Admin';
const mayUse = (member, policy) => !!member?.active && policy.enabled &&
  (isAdmin(member) || policy.memberIds.includes(member.uid));
const betaPolicy = row => ({
  enabled: row?.enabled === true, memberIds: row?.memberIds || [], version: row?.version || 1,
});
export async function betaAccess(store, config, member) {
  return !!config?.ready() && !!member && mayUse(member, betaPolicy(await store.get(betaPolicyPath)));
}
async function authorize(store, config, member) {
  if (!await betaAccess(store, config, member)) throw new AppError(403, 'EMAIL_BETA_ACCESS', 'Email Beta is unavailable for your account');
  if (resetActive(await store.get(RESET_STATE))) throw unavailable();
}
export async function readBetaSettings(store, config) {
  return { ...betaPolicy(await store.get(betaPolicyPath)), deliveryReady: !!config?.ready() };
}
export async function saveBetaSettings(tx, config, input) {
  const prior = betaPolicy(await tx.get(betaPolicyPath));
  assertVersion(prior, input.expectedVersion);
  if (input.enabled && !config?.ready()) throw unavailable();
  const memberIds = [...new Set(input.memberIds)].sort();
  const members = await tx.getAll(memberIds.map(id => path('members', id)));
  if (members.some(member => !member?.active)) throw new AppError(400, 'EMAIL_BETA_MEMBER', 'Select active workspace members');
  if (prior.enabled === input.enabled && JSON.stringify(prior.memberIds) === JSON.stringify(memberIds))
    return { ...prior, deliveryReady: !!config?.ready() };
  const next = { enabled: input.enabled, memberIds, version: prior.version + 1 };
  tx.set(betaPolicyPath, next);
  return { ...next, deliveryReady: !!config?.ready() };
}
async function getThread(store, member, id) {
  const thread = await store.get(ref(threads, id));
  if (!thread || thread.deleted) throw notFound();
  if (thread.leadId) {
    const lead = await store.get(path('leads', thread.leadId));
    if (!canReadLead(member, lead)) throw notFound();
    return { thread, lead };
  }
  if (!isAdmin(member)) throw notFound();
  return { thread, lead: null };
}
const leadLabel = lead => lead ? { id: lead.id, name: lead.name || lead.company || 'Unnamed lead' } : null;
const maySend = (member, lead) => lead ? member.capabilities.includes('leads:edit') &&
  !lead.archived && !lead.doNotContact && !lead.needsReview : isAdmin(member);
const summary = (thread, lead, member) => ({
  id: thread.id, subject: thread.subject, correspondent: thread.correspondent, updatedAt: thread.updatedAt,
  latestMessageId: thread.latestMessageId, lastDirection: thread.lastDirection,
  ...(thread.preview ? { preview: thread.preview } : {}),
  version: thread.version, lead: leadLabel(lead),
  unread: !!thread.lastInboundMessageId && thread.reads?.[hash(member.uid)] !== thread.lastInboundMessageId,
  canSend: maySend(member, lead),
});

export async function betaList({ store, config, member, leadId, filter, cursor, seal, open }) {
  await authorize(store, config, member);
  if (leadId) await leadAccess(store, member, leadId);
  if (filter === 'unlinked' && !isAdmin(member)) throw notFound();
  const binding = JSON.stringify(['email-beta', member.uid, member.version, member.accessPolicyVersion, filter, leadId || null]);
  const after = cursor ? open(cursor, binding) : undefined;
  const rows = await store.query(threads, {
    filters: leadId ? [['leadId', '==', leadId]] : filter === 'unlinked' ? [['leadId', '==', null]] : [],
    order: 'updatedAt', direction: 'desc', after, limit: 25,
  });
  const leadIds = [...new Set(rows.filter(row => row.leadId && !row.deleted).map(row => row.leadId))];
  const leadRows = await store.getAll(leadIds.map(id => path('leads', id)), ['id','name','company','assignedToUid','archived','needsReview','doNotContact']);
  const leadMap = new Map(leadIds.map((id, index) => [id, leadRows[index]]));
  const items = rows.flatMap(thread => {
    const lead = leadMap.get(thread.leadId);
    if (thread.deleted || (thread.leadId ? !canReadLead(member, lead) : !isAdmin(member))) return [];
    const result = summary(thread, lead, member);
    if (filter === 'unread' && !result.unread || filter === 'sent' && !thread.hasSent) return [];
    return [result];
  });
  const last = rows.at(-1);
  return { items, nextCursor: rows.length === 25 ? seal([last.updatedAt, last.id], binding) : null };
}
export async function betaDetail({ store, config, member, id, cursor, seal, open }) {
  await authorize(store, config, member);
  const { thread } = await getThread(store, member, id);
  const binding = JSON.stringify(['email-beta-thread', member.uid, member.version, member.accessPolicyVersion, thread.id, thread.leadId]);
  const rows = await store.query(messages, { filters: [['threadId','==',id]], order: 'orderKey', direction: 'desc',
    after: cursor ? open(cursor, binding) : undefined, limit: 25 });
  const { thread: current, lead } = await getThread(store, member, id);
  if (current.leadId !== thread.leadId) throw new AppError(409, 'STALE_VERSION', 'Conversation moved. Refresh to continue.');
  const last = rows.at(-1);
  return {
    ...summary(current, lead, member),
    messages: rows.map(({ id, direction, body: text, createdAt, state, attachments, truncated, formatVersion, html }) =>
      ({ id, direction, body: text, createdAt, state, attachments: !!attachments, truncated: !!truncated, ...([1, 2].includes(formatVersion) ? { formatVersion } : {}), ...(html ? { html } : {}) })),
    nextCursor: rows.length === 25 ? seal([last.orderKey, last.id], binding) : null,
  };
}
const audit = (tx, member, action, at) => {
  const id = randomUUID();
  tx.set(path('auditEvents', id), { id, type: 'email.beta.' + action, actorUid: member.uid, createdAt: at });
};
function writeMessage(tx, thread, message, at) {
  tx.set(ref(messages, message.id), message);
  tx.set(ref(threads, thread.id), {
    ...thread, updatedAt: at, latestMessageId: message.id, lastDirection: message.direction,
    preview: message.body.replace(/\s+/g, ' ').trim().slice(0, 160),
    ...(message.direction === 'inbound' ? { lastInboundMessageId: message.id } : {}),
    hasSent: message.direction === 'outbound' || thread.hasSent === true, version: thread.version + 1,
  });
}
function queue(tx, kind, id, data, at) {
  const job = { id: due(at, id), workId: id, kind, claims: 0, createdAt: at, ...data };
  tx.set(ref(kind === 'erase' ? erasures : jobs, job.id), job);
  return job.id;
}
export async function betaSend(tx, config, member, threadId, input, requestKey, at, traceparent) {
  await authorize(tx, config, member);
  if (!uuid.safeParse(requestKey).success) throw new AppError(400, 'IDEMPOTENCY', 'Supply a UUID Idempotency-Key');
  const priorKey = keys('send', member.uid + ':' + requestKey);
  const fingerprint = hash(JSON.stringify([threadId, input]));
  const prior = await tx.get(priorKey);
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new AppError(409, 'IDEMPOTENCY', 'This send key was already used');
    if (Date.parse(at) - Date.parse(prior.createdAt) >= 7 * 86_400_000)
      throw new AppError(409, 'IDEMPOTENCY_EXPIRED', 'The saved send response expired');
    await getThread(tx, member, prior.threadId);
    return { threadId: prior.threadId, messageId: prior.messageId };
  }
  let thread, lead;
  if (threadId) {
    ({ thread, lead } = await getThread(tx, member, threadId));
    assertVersion(thread, input.expectedVersion);
  } else {
    lead = await leadAccess(tx, member, input.leadId);
    const correspondent = emailAddress(lead.email);
    if (!correspondent) throw new AppError(400, 'EMAIL_ADDRESS', 'Add a valid email address to this lead first');
    thread = { id: randomUUID(), leadId: lead.id, subject: input.subject, correspondent, version: 0, reads: {} };
  }
  if (!maySend(member, lead)) throw new AppError(403, 'EMAIL_BETA_SEND', 'You cannot send email for this lead');
  if (lead && emailAddress(lead.email) !== thread.correspondent)
    throw new AppError(409, 'EMAIL_ADDRESS_CHANGED', 'The lead email changed. Start a new conversation with the current address.');
  if (!config.permits(thread.correspondent)) throw new AppError(403, 'EMAIL_BETA_DESTINATION', 'This environment uses an approved test inbox');
  if (await tx.get(path('emailSuppressions', hash(thread.correspondent))))
    throw new AppError(409, 'EMAIL_SUPPRESSED', 'This address cannot receive email');
  const rich = input.html ? prepareEmailHtml(input.html) : null;
  if (rich && (!rich.html || !rich.text || rich.clipped))
    throw new AppError(400, 'EMAIL_BETA_HTML', 'Use a shorter message with supported formatting');
  const id = randomUUID();
  const message = { id, threadId: thread.id, direction: 'outbound', state: 'Queued',
    body: rich?.text || input.body, ...(rich ? { html: rich.html, formatVersion: 2 } : { formatVersion: 1 }),
    createdAt: at, orderKey: due(at, id), actorUid: member.uid, target: thread.correspondent,
    subject: thread.version && !/^re:/i.test(thread.subject) ? 'Re: ' + thread.subject : thread.subject,
    replyToId: thread.internetId || null, initialLeadId: thread.leadId,
    policyVersion: betaPolicy(await tx.get(betaPolicyPath)).version };
  queue(tx, 'send', id, { threadId: thread.id, ...(traceparent ? { traceparent } : {}) }, at);
  writeMessage(tx, thread, message, at);
  tx.set(priorKey, { fingerprint, threadId: thread.id, messageId: id, createdAt: at });
  audit(tx, member, 'queued', at);
  return { threadId: thread.id, messageId: id };
}
export async function betaChange(tx, config, member, id, action, input, at) {
  await authorize(tx, config, member);
  const { thread } = await getThread(tx, member, id);
  if (action === 'read') {
    if (thread.latestMessageId === input.latestMessageId && thread.lastInboundMessageId &&
        thread.reads?.[hash(member.uid)] !== thread.lastInboundMessageId) {
      const reads = Object.fromEntries(Object.entries(thread.reads || {}).slice(-79));
      reads[hash(member.uid)] = thread.lastInboundMessageId;
      tx.set(ref(threads, id), { ...thread, reads });
    }
    return { ok: true };
  }
  if (!isAdmin(member)) throw new AppError(403, 'FORBIDDEN', 'Admin access is required');
  assertVersion(thread, input.expectedVersion);
  if (action === 'link') {
    if (input.leadId) await leadAccess(tx, member, input.leadId);
    if (thread.leadId !== input.leadId) {
      tx.set(ref(threads, id), { ...thread, leadId: input.leadId, version: thread.version + 1 });
      audit(tx, member, input.leadId ? 'linked' : 'unlinked', at);
    }
  } else {
    tx.set(ref(threads, id), { id, deleted: true, version: thread.version + 1, updatedAt: at });
    queue(tx, 'erase', id, { threadId: id }, at);
    audit(tx, member, 'deleted', at);
  }
  return { ok: true };
}
export async function betaMatch(store, config, member, id) {
  await authorize(store, config, member);
  if (!isAdmin(member)) throw new AppError(403, 'FORBIDDEN', 'Admin access is required');
  const { thread } = await getThread(store, member, id);
  if (thread.leadId) return { lead: null };
  const matches = await store.query(path('leads'), {
    filters: [['email','==',thread.correspondent]], fields: ['id','name','company','archived'], order: '__name__', limit: 2,
  });
  return { lead: matches.length === 1 && !matches[0].archived ? leadLabel(matches[0]) : null };
}

const receiptState = {
  'email.sent': 'Accepted', 'email.delivery_delayed': 'Delayed', 'email.delivered': 'Delivered',
  'email.failed': 'Failed', 'email.bounced': 'Failed', 'email.complained': 'Suppressed', 'email.suppressed': 'Suppressed',
};
const stateRank = { Queued: 0, Accepted: 1, Delayed: 2, Failed: 3, Delivered: 4, Suppressed: 5 };
export async function betaReceipt(store, config, event, at, reserve) {
  const data = event?.data;
  if (!providerId(data?.email_id)) return;
  if (event.type === 'email.received') {
    const aliases = (Array.isArray(data.to) ? data.to : []).slice(0, 10).map(emailAddress);
    if (!aliases.some(address => config.accepts(address))) return;
    return store.run(async tx => {
      if (!(await tx.get(betaPolicyPath))?.enabled) throw unavailable();
      const marker = keys('incoming', data.email_id);
      if (await tx.get(marker)) return;
      if (!await reserve(tx, 'betaInbound', at))
        throw new AppError(429, 'EMAIL_BETA_QUOTA', 'Daily inbound pilot budget reached');
      const id = randomUUID();
      const workId = queue(tx, 'receive', id, { providerId: data.email_id }, at);
      tx.set(marker, { jobId: workId });
    });
  }
  const tag = data.tags?.salesdrone_beta;
  if (!receiptState[event.type] || !uuid.safeParse(tag).success || data.tags?.salesdrone_env !== config.environment) return;
  return store.run(async tx => {
    const messagePath = ref(messages, tag);
    const message = await tx.get(messagePath);
    if (!message || message.direction !== 'outbound' || message.providerId && message.providerId !== data.email_id) return;
    const thread = await tx.get(ref(threads, message.threadId));
    if (!thread || thread.deleted) return;
    const internetId = messageId(data.message_id);
    if (internetId) tx.set(keys('internet', internetId), { threadId: thread.id });
    if (internetId && thread.latestMessageId === message.id)
      tx.set(ref(threads, thread.id), { ...thread, internetId });
    const state = receiptState[event.type];
    const next = stateRank[state] > stateRank[message.state] ? state : message.state;
    tx.set(messagePath, { ...message, providerId: data.email_id, state: next });
    if (event.type === 'email.complained' || event.type === 'email.suppressed' ||
        event.type === 'email.bounced' && /permanent/i.test(data.bounce?.type || '')) {
      tx.set(path('emailSuppressions', hash(message.target)), {
        id: hash(message.target), reason: event.type === 'email.bounced' ? 'hard_bounce' : 'provider_suppressed', at,
      });
    }
  });
}

const header = (headers, name) => Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1];
function referenceIds(value) {
  return typeof value === 'string' ? (value.match(/<[^\s<>]{1,248}>/g) || []).slice(-12) : [];
}
async function receiveBeta(tx, config, job, input, rich, at) {
  if (!(await tx.get(betaPolicyPath))?.enabled) throw unavailable();
  const correspondent = emailAddress(input.from);
  const destinations = (Array.isArray(input.to) ? input.to : []).slice(0, 10).map(emailAddress);
  const destination = destinations.find(address => config.accepts(address));
  if (!correspondent || !destination || !config.permits(correspondent)) return;
  const ownId = messageId(input.message_id);
  if (ownId && await tx.get(keys('internet', ownId))) return;
  const aliasId = config.threadFromAddress(destination);
  const references = [...new Set([...referenceIds(header(input.headers, 'in-reply-to')), ...referenceIds(header(input.headers, 'references'))])];
  const mappings = await tx.getAll(references.map(value => keys('internet', value)));
  const candidates = [...new Set([aliasId, ...mappings.map(row => row?.threadId)].filter(Boolean))];
  const matched = await tx.getAll(candidates.map(id => ref(threads, id)));
  if (matched.some(thread => thread?.deleted)) return;
  const verifiedSender = input.authentication?.dmarc === 'pass';
  const known = verifiedSender && destination !== config.releaseAddress && candidates.length === 1 && matched[0]?.correspondent === correspondent ? matched[0] : null;
  if (known?.leadId && !await tx.get(path('leads', known.leadId))) return;
  const thread = known || { id: randomUUID(), leadId: null, correspondent, version: 0, reads: {},
    subject: typeof input.subject === 'string' ? input.subject.replace(/[\r\n]/g, ' ').trim().slice(0, 180) || '(No subject)' : '(No subject)' };
  const text = (typeof input.text === 'string' ? input.text.trim() : '') || rich.text;
  const id = job.workId;
  writeMessage(tx, { ...thread, internetId: ownId || thread.internetId || null }, {
    id, threadId: thread.id, orderKey: due(at, id), direction: 'inbound', createdAt: at, state: 'Received',
    body: text.slice(0, 16_000) || 'This message has no plain-text body.',
    ...(rich.html ? { html: rich.html } : {}),
    truncated: text.length > 16_000 || rich.clipped, attachments: Array.isArray(input.attachments) && input.attachments.length > 0,
  }, at);
  if (ownId) tx.set(keys('internet', ownId), { threadId: thread.id });
}

const jobCollection = job => job.kind === 'erase' ? erasures : jobs;
async function claim(store, row, at) {
  return store.run(async tx => {
    const current = await tx.get(ref(jobCollection(row), row.id));
    if (!current) return null;
    const job = { ...current, id: due(inMinutes(at, 3), current.workId), claims: current.claims + 1 };
    tx.delete(ref(jobCollection(row), row.id));
    tx.set(ref(jobCollection(job), job.id), job);
    return job;
  });
}
async function complete(store, job, fn) {
  return store.run(async tx => {
    if (!await tx.get(ref(jobCollection(job), job.id))) return;
    await fn(tx);
    tx.delete(ref(jobCollection(job), job.id));
  });
}
const retry = (tx, job, at, extra = {}) => {
  const next = { ...job, ...extra, id: due(at, job.workId) };
  tx.set(ref(jobCollection(job), next.id), next);
};
async function armSend(tx, config, job, at, reserve) {
  const mPath = ref(messages, job.workId);
  const message = await tx.get(mPath);
  if (!message) return null;
  const thread = await tx.get(ref(threads, message.threadId));
  if (!thread || thread.deleted || thread.leadId !== message.initialLeadId) return { state: 'Suppressed' };
  if (message.state === 'Delivered' || message.state === 'Accepted') return null;
  if (job.claims > 4 || Date.parse(at) - Date.parse(job.createdAt) >= 20 * 3_600_000)
    return { state: 'Failed' };
  const member = await effectiveMember(tx, await tx.get(path('members', message.actorUid)));
  const policy = betaPolicy(await tx.get(betaPolicyPath));
  const lead = thread.leadId ? await tx.get(path('leads', thread.leadId)) : null;
  if (policy.version !== message.policyVersion || !mayUse(member, policy) || thread.leadId && (!canReadLead(member, lead) || emailAddress(lead.email) !== message.target) ||
      !maySend(member, lead) || !config.permits(message.target) ||
      await tx.get(path('emailSuppressions', hash(message.target)))) return { state: 'Suppressed' };
  if (!await reserve(tx, 'betaSends', at)) return { state: 'Failed' };
  return { message, thread };
}
async function processSend(store, config, job, at, reserve, telemetry) {
  const armed = await store.run(async tx => await tx.get(ref(jobCollection(job), job.id)) ? armSend(tx, config, job, at, reserve) : null);
  const message = armed?.message;
  let result = armed?.state ? armed : null;
  if (message) {
    const payload = {
      from: message.formatVersion ? 'SalesDrone <' + config.address + '>' : config.address,
      to: [message.target], subject: message.subject,
      ...(message.formatVersion === 2 ? renderRichCorrespondenceV2(message.body, message.html) :
        message.formatVersion === 1 ? renderCorrespondenceV1(message.body) : { text: message.body }),
      reply_to: config.replyAddress(armed.thread.id),
      tags: [{ name: 'salesdrone_beta', value: message.id }, { name: 'salesdrone_env', value: config.environment }],
      ...(message.replyToId ? { headers: { 'In-Reply-To': message.replyToId, References: message.replyToId } } : {}),
    };
    const send = () => config.send(payload, 'salesdrone-beta/' + config.environment + '/' + message.id);
    result = telemetry?.span ? await telemetry.span('email.beta.send', send, {}, job.traceparent) : await send();
  }
  await complete(store, job, async tx => {
    if (!result) return;
    const mPath = ref(messages, job.workId);
    const current = await tx.get(mPath);
    const thread = await tx.get(ref(threads, job.threadId));
    if (!current || !thread || thread.deleted) return;
    if (result.retry && job.claims < 4 && ['Queued','Delayed'].includes(current.state)) {
      retry(tx, job, inMinutes(at, 2 ** job.claims));
      tx.set(mPath, { ...current, state: 'Delayed' });
    } else if (stateRank[result.state] > stateRank[current.state]) {
      tx.set(mPath, { ...current, state: result.state, ...(result.providerId ? { providerId: result.providerId } : {}) });
    }
  });
  if (result) telemetry?.emailOperation?.('dispatch', result.state.toLowerCase(), 0);
}
export async function dispatchBetaEmail({ store, config, at, reserve, telemetry }) {
  if (!config?.ready() || resetActive(await store.get(RESET_STATE))) return;
  const enabled = !!(await store.get(betaPolicyPath))?.enabled;
  const queryDue = (collection, limit) => store.query(collection, { filters: [['id','<=',at + '~']], limit });
  const rows = await queryDue(erasures, 2);
  if (enabled) rows.push(...await queryDue(jobs, 6));
  for (const row of rows) {
    const job = await claim(store, row, at);
    if (!job) continue;
    if (job.kind === 'erase') {
      await complete(store, job, async tx => {
        const batch = await tx.query(messages, { filters: [['threadId','==',job.threadId]], order: '__name__', limit: 40 });
        for (const item of batch) tx.delete(ref(messages, documentKey(item)));
        if (batch.length === 40) retry(tx, job, inMinutes(at, 1));
      });
    } else if (job.kind === 'receive') {
      try {
        const received = await config.receive(job.providerId);
        const rich = prepareEmailHtml(received?.html);
        await complete(store, job, tx => receiveBeta(tx, config, job, received, rich, at));
        telemetry?.log?.('worker.stage', { worker: 'email', 'operation.stage': 'beta_inbound_processed' });
      } catch {
        telemetry?.log?.('worker.stage', { worker: 'email', 'operation.stage': 'beta_inbound_retry' }, 'WARN');
        // Keep unprocessed webhook jobs recoverable without blocking the rest of the queue.
        if (job.claims < 8) await complete(store, job, tx => retry(tx, job, inMinutes(at, job.claims < 4 ? 5 : 60)));
        else await complete(store, job, async () => {});
      }
    } else {
      await processSend(store, config, job, at, reserve, telemetry);
    }
  }
}
