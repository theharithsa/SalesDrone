import { emailOn, readEmailSettings, writeEmailJob } from './email-policy.js';
import { documentKey } from './store.js';
import { path } from './policy.js';

import { RELEASE_NOTES_ORIGIN } from './email-release-links.js';

export const releaseQueueDailyLimit = 12;
const batch = 6;
const versionPattern = /^\d{1,8}\.\d{1,8}\.\d{1,8}$/;
const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;

export function releaseAnnouncement(value, current) {
  if (!value || typeof value.version !== 'string' || !versionPattern.test(value.version) ||
      value.version !== current.version || value.commit !== current.commit ||
      !/^[a-f0-9]{40}$/.test(value.commit) || !Number.isFinite(Date.parse(value.publishedAt)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || !text(value.summary, 250) ||
      !Array.isArray(value.highlights) || !value.highlights.length ||
      value.highlights.length > 5 || value.highlights.some(line => !text(line, 240))) return null;
  const { version, publishedAt, date, summary, highlights } = value;
  return { version, publishedAt, date, summary, highlights };
}

export async function fetchReleaseAnnouncement(current, fetchImpl = fetch) {
  const response = await fetchImpl(new URL('release-announcement.json', RELEASE_NOTES_ORIGIN), {
    redirect: 'error', signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const output = await response.text();
  if (output.length > 4096) return null;
  return releaseAnnouncement(JSON.parse(output), current);
}

/** Stage a bounded slice of the verified release's eligible member list. */
export async function stageReleaseAnnouncements({ store, config, settings, at, telemetry }) {
  if (config.environment !== 'production' || !config.release || !emailOn(settings, 'release') ||
      Number(at.slice(14, 16)) % 15 >= 5) return 0;
  const { current, read } = config.release;
  const statePath = path('settings', 'emailReleaseProgress');
  const prior = await store.get(statePath);
  const day = at.slice(0, 10);
  if (prior?.day === day && prior.queuedToday >= releaseQueueDailyLimit) return 0;
  if (prior?.done && prior.id === current.version) return 0;
  const facts = prior && !prior.done ? prior.facts : await read(current);
  const published = Date.parse(facts?.publishedAt);
  if (!Number.isFinite(published) || published > Date.parse(at)) return 0;
  return store.run(async tx => {
    const state = await tx.get(statePath);
    const policy = await readEmailSettings(tx);
    if (!emailOn(policy, 'release') || (state?.done && state.id === facts.version) ||
        (state && !state.done && state.id !== facts.version)) return 0;
    if (state && Date.parse(state.facts.publishedAt) > published) return 0;
    const progress = state?.id === facts.version ? state : null;
    const queuedToday = state?.day === day ? state.queuedToday : 0;
    const limit = Math.min(batch, releaseQueueDailyLimit - queuedToday);
    if (limit <= 0) return 0;
    const rows = await tx.query(path('members'), {
      order: '__name__', ...(progress?.cursor ? { after: [progress.cursor] } : {}), limit, fields: ['active'],
    });
    let queued = 0;
    for (const row of rows) {
      if (row.active !== true) continue;
      const uid = documentKey(row);
      writeEmailJob(tx, {
        event: 'release', identity: facts.version + ':' + uid, uid,
        at, settings: policy, releaseFacts: facts, trace: telemetry?.capture?.()?.traceparent,
      });
      queued++;
    }
    tx.set(statePath, {
      id: facts.version, facts, cursor: rows.length ? documentKey(rows.at(-1)) : progress?.cursor || null,
      day, queuedToday: queuedToday + queued, done: rows.length < limit,
    });
    return queued;
  });
}
