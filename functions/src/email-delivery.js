import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AppError } from './contracts.js';
import { digestFacts } from './email-digests.js';
import {
  deliveryKey, emailOn, emailPreferencePath, emailPreferences, EMAIL_MILLIS,
  readEmailSettings, readEmailPreferences, scheduleKey, weekStart, writeDigestSchedule, writeEmailJob,
} from './email-policy.js';
import { EMAIL_FROM, digestCopy, sampleDigest, renderEmail, LEGACY_TEMPLATE_VERSION, TEMPLATE_VERSION } from './email-templates.js';
import { betaPolicyPath } from './email-beta.js';
import { stageReleaseAnnouncements } from './email-release-announcement.js';
import { readResearchSettings } from './lead-research-settings.js';
import { resetActive, RESET_STATE } from './lead-data-reset.js';
import { canReadLead, effectiveMember, hash, path } from './policy.js';

const { minute, day } = EMAIL_MILLIS;
const batchLimit = 6;
const counters = { sends: 30, betaSends: 10, betaInbound: 60, digestScans: 12, modelCalls: 8 };
const maxAge = 20 * 60 * minute;
const maxAttempts = 4;
const expiry = 30 * day;
const addressPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const opaque = /^[a-f0-9]{64}$/;
const providerId = /^[a-f0-9-]{36}$/i;
const nowISO = value => new Date(value).toISOString();
const readDue = (store, collection, at) => store.query(path(collection), {
  filters: [['id', '<=', at + '~']], limit: batchLimit,
});

export async function reserveEmailBudget(tx, kind, at) {
  const id = at.slice(0, 10);
  const location = path('emailBudgets', id);
  const prior = await tx.get(location);
  const count = prior?.[kind] || 0;
  const beta = kind === 'betaSends';
  const totalSends = prior?.sends || 0;
  if (count >= counters[kind] || beta && totalSends >= counters.sends) return false;
  tx.set(location, { ...prior, id, [kind]: count + 1, ...(beta ? { sends: totalSends + 1 } : {}) });
  return true;
}

export async function stageScheduledDigests({ store, at, telemetry, settings: policy }) {
  const settings = policy || await readEmailSettings(store);
  if (!emailOn(settings, 'daily') && !emailOn(settings, 'weekly')) return;
  for (const { id } of await readDue(store, 'emailSchedules', at)) {
    await store.run(async tx => {
      const item = await tx.get(path('emailSchedules', id));
      if (!item) return;
      const location = emailPreferencePath(item.uid);
      const value = await tx.get(location);
      tx.delete(path('emailSchedules', id));
      if (!value?.[item.type + 'Enabled'] || value.scheduled?.[item.type] !== id) return;
      const current = await readEmailSettings(tx);
      const next = writeDigestSchedule(tx, item.uid, item.type, emailPreferences(value), at);
      tx.set(location, { ...value, scheduled: { ...value.scheduled, [item.type]: next } });
      // Missed runs do not backfill notifications or switch the reporting window.
      if (!emailOn(current, item.type) || Date.parse(at) - Date.parse(item.at) >= 30 * minute) return;
      const identity = item.uid + ':' + (item.type === 'weekly' ? weekStart(item.date) : item.date);
      const existing = await tx.get(path('emailJobs', deliveryKey(item.type, identity)));
      if (!existing) writeEmailJob(tx, {
        event: item.type, identity, at, settings: current, uid: item.uid,
        slot: { at: item.at, date: item.date }, preferenceVersion: value.version,
        trace: telemetry?.capture?.()?.traceparent,
      });
    });
  }
}

function retire(tx, job, state, at, reason = null) {
  if (job.nextId) tx.delete(path('emailDue', job.nextId));
  const id = job.retireId || scheduleKey(nowISO(Date.parse(at) + expiry), job.id);
  tx.set(path('emailRetire', id), { id, jobId: job.id });
  const { lease: _lease, nextId: _next, facts: _facts, releaseFacts: _release, ...result } = job;
  tx.set(path('emailJobs', job.id), { ...result, state, reason, finishedAt: at, retireId: id });
}
async function claimEmail(store, entry, at) {
  return store.run(async tx => {
    const job = await tx.get(path('emailJobs', entry.jobId));
    if (!job || job.nextId !== entry.id) {
      if (await tx.get(path('emailDue', entry.id))) tx.delete(path('emailDue', entry.id));
      return null;
    }
    const retryStart = job.event === 'release' ? job.firstSendingAt : job.createdAt;
    if ((job.claims || 0) >= maxAttempts || retryStart && Date.parse(at) - Date.parse(retryStart) >= maxAge) {
      retire(tx, job, 'Failed', at, 'retry_window_ended');
      return null;
    }
    const lease = randomUUID();
    const nextId = scheduleKey(nowISO(Date.parse(at) + 3 * minute), job.id);
    const claimed = { ...job, lease, nextId, claims: (job.claims || 0) + 1 };
    tx.delete(path('emailDue', job.nextId));
    tx.set(path('emailDue', nextId), { id: nextId, jobId: job.id });
    tx.set(path('emailJobs', job.id), claimed);
    return claimed;
  });
}

async function sendContext(store, config, job, at) {
  if (job.event !== 'test') {
    const settings = await readEmailSettings(store);
    if (settings.version !== job.policyVersion || !emailOn(settings, job.event)) return null;
  }
  if (job.event === 'invitation') {
    const invite = await store.get(path('invitations', job.invitationId));
    if (!invite?.active || invite.expiresAt <= at || invite.version !== job.sourceVersion) return null;
    return { email: invite.email };
  }
  const member = await effectiveMember(store, await store.get(path('members', job.uid)));
  if (!member?.active || (job.event === 'test' && member.role !== 'Admin')) return null;
  if (job.event === 'access_ready' && member.version !== job.sourceVersion) return null;
  if (job.event === 'release' && config.environment !== 'production') return null;
  if (job.event === 'test' || job.event === 'access_ready' || job.event === 'release')
    return { email: await config.verifiedEmail(member), member };

  if (!member.capabilities.includes('leads:read') || resetActive(await store.get(RESET_STATE))) return null;
  const prefs = await readEmailPreferences(store, member.uid);
  if ((job.event.startsWith('lead_') && !prefs.leadUpdates) ||
      (job.event.startsWith('task_') && !prefs.taskUpdates)) return null;
  if (job.slot && (job.preferenceVersion !== prefs.version || !prefs[job.event + 'Enabled'])) return null;
  if (job.leadId) {
    const lead = await store.get(path('leads', job.leadId));
    if (!lead || lead.archived || !canReadLead(member, lead)) return null;
    if (job.event === 'lead_assigned' && (lead.assignedToUid !== job.uid ||
        (lead.assignmentRevision || 1) !== job.sourceVersion)) return null;
    if (job.outcomeStage) {
      const stageSettings = await readResearchSettings(store);
      if (lead.version !== job.sourceVersion || lead.stage !== job.outcomeStage ||
          (lead.assignedToUid || null) !== job.outcomeAssignee ||
          !stageSettings[job.event === 'lead_converted' ? 'convertedStages' : 'failedStages'].includes(lead.stage))
        return null;
    }
    if (job.taskId) {
      const task = await store.get(path('tasks', job.taskId));
      if (!task || task.deleted || task.deletedAt || task.leadId !== lead.id ||
          task.recipientUid !== member.uid || task.version !== job.sourceVersion ||
          (task.kind === 'outreach' && (lead.doNotContact || lead.needsReview))) return null;
    }
  }
  return { email: await config.verifiedEmail(member), member, prefs };
}

function routeRecipient(config, address, { scenario, event }) {
  if (!address || !addressPattern.test(address)) return null;
  if (config.environment === 'pre-production') {
    if (scenario === 'bounce') return 'bounced@resend.dev';
    return config.testInbox || 'delivered@resend.dev';
  }
  return event === 'release' || config.allowlist?.includes(address) ? address : null;
}

async function prepareEmail({ store, config, job, context, at, telemetry }) {
  const to = routeRecipient(config, context?.email, job);
  if (!to) return null;
  const recipientHash = hash(to);
  if (job.recipientHash && job.recipientHash !== recipientHash) return null;
  if (await store.get(path('emailSuppressions', recipientHash))) return null;
  let facts = job.event === 'test' ? sampleDigest[job.template] : job.releaseFacts || null;
  let insight = job.insight || null;
  let scope = new Map();
  if (job.slot) {
    const reserved = await store.run(tx => reserveEmailBudget(tx, 'digestScans', at));
    if (!reserved) return null;
    const digest = await digestFacts(store, context.member, job.event, job.slot, context.prefs);
    if (!digest || (job.facts && !isDeepStrictEqual(job.facts, digest.facts))) return null;
    ({ facts, scope } = digest);
    // Persist the reservation before calling Gemini. A worker that dies here falls back
    // to facts on retry rather than invoking the model a second time.
    if (config.chooseInsight && !job.insightStarted && context.prefs.digestInsights &&
        context.member.leadFeatureAccess.intelligence) {
      const started = await store.run(async tx => {
        const latest = await tx.get(path('emailJobs', job.id));
        if (latest?.lease !== job.lease ||
            !(await reserveEmailBudget(tx, 'modelCalls', at))) return false;
        tx.set(path('emailJobs', job.id), { ...latest, insightStarted: true });
        return true;
      });
      if (started) {
        const choices = Object.keys(digestCopy(job.event, facts).insights);
        try {
          const result = await config.chooseInsight({ type: job.event, facts, choices });
          if (choices.includes(result)) insight = result;
        } catch {
          telemetry?.log?.('worker.stage', { worker: 'email', 'operation.stage': 'fallback' });
        }
      }
    }
  }
  return { to, recipientHash, facts: facts || null, insight, scope };
}

async function armEmail(store, job, prepared, at, betaEmail) {
  return store.run(async tx => {
    const location = path('emailJobs', job.id);
    const latest = await tx.get(location);
    if (latest?.lease !== job.lease) return null;
    if (await tx.get(path('emailSuppressions', prepared.recipientHash))) {
      retire(tx, latest, 'Suppressed', at, 'suppressed_recipient');
      return null;
    }
    if (!(await reserveEmailBudget(tx, 'sends', at))) {
      if (latest.event === 'release' && latest.attempts === 0) {
        const nextDay = nowISO(Date.parse(at.slice(0, 10)) + day);
        const nextId = scheduleKey(nextDay, latest.id);
        tx.delete(path('emailDue', latest.nextId));
        tx.set(path('emailDue', nextId), { id: nextId, jobId: latest.id });
        tx.set(location, { ...latest, state: 'Delayed', nextId, lease: null, claims: 0, reason: 'daily_limit' });
        return { deferred: true };
      }
      retire(tx, latest, 'Suppressed', at, 'daily_limit');
      return null;
    }
    const releaseReplyTo = latest.event === 'release' && latest.attempts === 0 && betaEmail?.ready() &&
      (await tx.get(betaPolicyPath))?.enabled ? betaEmail.releaseAddress : latest.releaseReplyTo || null;
    const work = {
      ...latest, ...(releaseReplyTo ? { releaseReplyTo } : {}), recipientHash: prepared.recipientHash,
      facts: prepared.facts, insight: prepared.insight,
      ...(job.event === 'release' ? { firstSendingAt: latest.firstSendingAt || at } : {}),
      // Keep the same body and tags if a retry crosses a deployment.
      templateVersion: latest.templateVersion ?? (latest.attempts ? LEGACY_TEMPLATE_VERSION : TEMPLATE_VERSION),
      attempts: latest.attempts + 1, sendingAt: at,
    };
    tx.set(location, work);
    return work;
  });
}
async function settleEmail(store, job, at, result) {
  return store.run(async tx => {
    const location = path('emailJobs', job.id);
    const latest = await tx.get(location);
    if (latest?.lease !== job.lease) return latest?.state || 'Suppressed';
    if (result.retry && latest.claims < maxAttempts &&
        Date.parse(at) - Date.parse(latest.event === 'release' ? latest.firstSendingAt || at : latest.createdAt) < maxAge) {
      const nextId = scheduleKey(nowISO(Date.parse(at) + 2 ** latest.claims * minute), latest.id);
      tx.delete(path('emailDue', latest.nextId));
      tx.set(path('emailDue', nextId), { id: nextId, jobId: latest.id });
      tx.set(location, { ...latest, state: 'Delayed', lease: null, nextId, reason: result.reason });
      return 'Delayed';
    }
    retire(tx, result.providerId ? { ...latest, providerId: result.providerId } : latest,
      result.state, at, result.reason);
    return result.state;
  });
}

export async function dispatchEmails({ store, config, betaEmail, at, telemetry }) {
  const stats = { accepted: 0, failed: 0, delayed: 0, suppressed: 0 };
  if (!config.ready()) return stats;
  const settings = await readEmailSettings(store);
  await stageScheduledDigests({ store, at, telemetry, settings });
  try {
    const staged = await stageReleaseAnnouncements({ store, config, settings, at, telemetry });
    if (staged) telemetry?.emailOperation?.('release_queue', 'queued', 0);
  } catch {
    telemetry?.log?.('worker.stage', { worker: 'email', 'operation.stage': 'release_queue_failed' }, 'WARN');
  }
  for (const row of await readDue(store, 'emailDue', at)) {
    const job = await claimEmail(store, row, at);
    if (!job) continue;
    const started = performance.now();
    const dispatch = async () => {
      const context = await sendContext(store, config, job, at);
      const prepared = await prepareEmail({ store, config, job, context, at, telemetry });
      if (!prepared) return settleEmail(store, job, at, { state: 'Suppressed', reason: 'no_longer_eligible' });
      // Recheck source and verified recipient immediately before the outbound request.
      const fresh = await sendContext(store, config, job, at);
      if (!fresh || fresh.email !== context.email || fresh.member?.version !== context.member?.version ||
          fresh.member?.accessPolicyVersion !== context.member?.accessPolicyVersion ||
          fresh.prefs?.version !== context.prefs?.version)
        return settleEmail(store, job, at, { state: 'Suppressed', reason: 'no_longer_eligible' });
      const currentScope = await store.getAll([...prepared.scope.keys()].map(id => path('leads', id)),
        ['assignedToUid', 'archived', 'doNotContact', 'needsReview']);
      if (!isDeepStrictEqual(currentScope, [...prepared.scope.values()]))
        return settleEmail(store, job, at, { state: 'Suppressed', reason: 'no_longer_eligible' });
      const armed = await armEmail(store, job, prepared, at, betaEmail);
      if (!armed) return 'Suppressed';
      if (armed.deferred) return 'Delayed';
      const preprod = config.environment === 'pre-production';
      const template = job.template || job.event;
      const message = renderEmail({
        template, origin: config.origin, preprod, facts: prepared.facts,
        insight: prepared.insight, leadId: job.leadId, taskId: job.taskId, templateVersion: armed.templateVersion,
      });
      const send = () => config.send({
        ...message, from: EMAIL_FROM, to: [prepared.to],
        ...(armed.releaseReplyTo ? { reply_to: armed.releaseReplyTo } : {}),
        tags: [
          { name: 'salesdrone_job', value: job.id },
          { name: 'salesdrone_env', value: config.environment },
          { name: 'template_version', value: String(armed.templateVersion) },
        ],
      }, config.environment + '/' + job.id);
      const result = telemetry?.span ? await telemetry.span('resend.send', send) : await send();
      return settleEmail(store, armed, at, result);
    };
    let result;
    try {
      result = telemetry?.span
        ? await telemetry.span('email.deliver', dispatch, {}, job.observabilityTraceparent)
        : await dispatch();
    } catch {
      result = await settleEmail(store, job, at, { state: 'Failed', retry: true, reason: 'verification_unavailable' });
    }
    const count = result === 'Delivered' ? 'accepted' : result.toLowerCase();
    if (Object.hasOwn(stats, count)) stats[count]++;
    telemetry?.emailOperation?.('dispatch', result.toLowerCase(), (performance.now() - started) / 1000);
  }
  return stats;
}

export function resendClient(key, fetchImpl = fetch) {
  return async (body, idempotencyKey) => {
    try {
      const credential = await key();
      if (!credential) return { state: 'Failed', reason: 'sender_configuration' };
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
        headers: {
          Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const receipt = await response.json();
        if (typeof receipt.id === 'string' && providerId.test(receipt.id))
          return { state: 'Accepted', providerId: receipt.id, reason: null };
        return { state: 'Failed', retry: true, reason: 'invalid_receipt' };
      }
      await response.body?.cancel();
      if (response.status === 429 || response.status >= 500)
        return { state: 'Failed', retry: true, reason: response.status === 429 ? 'provider_rate_limit' : 'provider_unavailable' };
      return { state: 'Failed', reason: response.status === 401 || response.status === 403
        ? 'sender_configuration' : 'provider_rejected' };
    } catch {
      return { state: 'Failed', retry: true, reason: 'provider_unavailable' };
    }
  };
}

export function verifyEmailReceipt(body, headers, secret, at) {
  const id = headers['svix-id'];
  const ts = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!Buffer.isBuffer(body) || typeof id !== 'string' || typeof ts !== 'string' || typeof signatures !== 'string')
    throw new AppError(401, 'EMAIL_SIGNATURE', 'Invalid email receipt signature');
  const epoch = Number(ts);
  const valid = Buffer.byteLength(body) <= 32_768 &&
    /^[A-Za-z0-9_-]{1,100}$/.test(id) && /^\d{10}$/.test(ts) &&
    Math.abs(Date.parse(at) / 1000 - epoch) <= 300 &&
    signatures.length <= 1024 && /^whsec_[A-Za-z0-9+/=]+$/.test(secret || '');
  if (!valid) throw new AppError(401, 'EMAIL_SIGNATURE', 'Invalid email receipt signature');
  const key = Buffer.from(secret.slice(6), 'base64');
  const expected = createHmac('sha256', key).update(id + '.' + ts + '.').update(body).digest();
  const matched = signatures.split(' ').some(signature => {
    if (!/^v1,[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    const supplied = Buffer.from(signature.slice(3), 'base64');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
  if (!matched) throw new AppError(401, 'EMAIL_SIGNATURE', 'Invalid email receipt signature');
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new AppError(400, 'BAD_JSON', 'Invalid email receipt');
  }
}

const receiptStates = {
  'email.sent': 'Accepted', 'email.delivery_delayed': 'Delayed', 'email.delivered': 'Delivered',
  'email.failed': 'Failed', 'email.bounced': 'Failed', 'email.complained': 'Suppressed',
  'email.suppressed': 'Suppressed',
};
const ranks = { Accepted: 1, Delayed: 2, Failed: 3, Delivered: 4, Suppressed: 5 };
export async function applyEmailReceipt(store, event, environment, at) {
  const data = event?.data;
  if (!Object.hasOwn(receiptStates, event?.type) || data?.tags?.salesdrone_env !== environment ||
      !opaque.test(data?.tags?.salesdrone_job || '') || typeof data?.email_id !== 'string' ||
      !providerId.test(data.email_id) || !Number.isFinite(Date.parse(event.created_at)) ||
      !Array.isArray(data.to) || data.to.length !== 1 || typeof data.to[0] !== 'string') return null;
  const recipientHash = hash(data.to[0].toLowerCase());
  const location = path('emailJobs', data.tags.salesdrone_job);
  const punitive = event.type === 'email.complained' ||
    (event.type === 'email.bounced' && data.bounce?.type === 'Permanent');
  const nextState = punitive ? 'Suppressed' : receiptStates[event.type];
  return store.run(async tx => {
    const job = await tx.get(location);
    if (!job?.sendingAt || job.recipientHash !== recipientHash ||
        (job.providerId && data.email_id !== job.providerId)) return null;
    if (punitive) {
      const address = path('emailSuppressions', recipientHash);
      if (!await tx.get(address)) tx.set(address, {
        id: recipientHash, reason: event.type === 'email.complained' ? 'complaint' : 'hard_bounce', createdAt: at,
      });
    }
    if (ranks[nextState] <= (ranks[job.providerState] || 0)) return null;
    retire(tx, {
      ...job, providerState: nextState, providerId: data.email_id,
    }, nextState, at, punitive ? 'provider_suppression' : null);
    return nextState;
  });
}
export async function cleanEmailRetention(store, at) {
  await store.run(async tx => {
    for (const row of await readDue(tx, 'emailRetire', at)) {
      tx.delete(path('emailJobs', row.jobId));
      tx.delete(path('emailRetire', row.id));
    }
    const threshold = nowISO(Date.parse(at) - 2 * day).slice(0, 10);
    const staleCounters = await tx.query(path('emailBudgets'), {
      filters: [['id', '<', threshold]], limit: batchLimit,
    });
    for (const row of staleCounters) tx.delete(path('emailBudgets', row.id));
  });
}
