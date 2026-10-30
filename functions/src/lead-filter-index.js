import { createHash } from 'node:crypto';
import { ROOT } from './policy.js';
import { normalizeFilterValue } from './lead-filters.js';
export const LEAD_INDEX_FIELD = '_filterEqualsV1';
export const LEAD_INDEX_STATE = `${ROOT}/maintenance/lead-filter-index-v1`;
const collection = `${ROOT}/leads`;
export const isLeadPath = (path) =>
  path.startsWith(collection + '/') && path.split('/').length === 4;
export const equalityToken = (field, value) =>
  createHash('sha256')
    .update(JSON.stringify([field, normalizeFilterValue(value)]))
    .digest('hex');
export function leadIndexTokens(lead) {
  const entries = [
    ['stage', lead.stage],
    ['source', lead.source],
    ...Object.entries(lead.customFields || {}).filter(([key]) =>
      /^cf_[a-z0-9_]{1,60}$/.test(key),
    ),
  ];
  if (entries.length > 1002)
    throw Error('Lead filter index exceeds its safe size');
  return [
    ...new Set(entries.map(([key, value]) => equalityToken(key, value))),
  ].sort();
}
export const indexedLeadWrite = (path, value) =>
  isLeadPath(path)
    ? { ...value, [LEAD_INDEX_FIELD]: leadIndexTokens(value) }
    : value;
export function publicLeadValue(path, value) {
  if (!value || !isLeadPath(path)) return value;
  const { [LEAD_INDEX_FIELD]: _index, ...lead } = value;
  return lead;
}
export function indexedEquality(filters, config) {
  return filters.find(
    (f) =>
      f.op === 'equals' &&
      normalizeFilterValue(f.value) &&
      (['stage', 'source'].includes(f.field) ||
        config?.customFields.some(
          (d) => d.id === f.field && !d.deleted && d.type === 'select',
        )),
  );
}
// Called only by adapter-owned maintenance transactions. This capability can update
// the derived field alone; it cannot rewrite business fields, timestamps or versions.
export async function reindexLeadPage(
  tx,
  { commit, now = new Date().toISOString() },
) {
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw Error('A published build commit is required');
  const reset = await tx.get(`${ROOT}/maintenance/lead-data-reset`);
  const state = await tx.get(LEAD_INDEX_STATE);
  if (reset?.active)
    return { paused: true, scanned: 0, updated: 0, ready: !!state?.ready };
  if (state?.ready) return { scanned: 0, updated: 0, ready: true };
  // Hosting publication follows all Functions deployments. Leave 150 seconds for
  // older invocations (120-second timeout) to drain before scanning legacy records.
  if (state?.writerCommit !== commit) {
    tx.set(LEAD_INDEX_STATE, {
      generation: 1,
      writerCommit: commit,
      notBefore: new Date(Date.parse(now) + 150000).toISOString(),
      ready: false,
      scanned: 0,
      updated: 0,
    });
    return { waiting: true, scanned: 0, updated: 0, ready: false };
  }
  if (Date.parse(now) < Date.parse(state.notBefore))
    return { waiting: true, scanned: 0, updated: 0, ready: false };
  const rows = await tx.scan(collection, { after: state.after, limit: 100 });
  let updated = 0;
  for (const { id, data } of rows) {
    const tokens = leadIndexTokens(data);
    if (JSON.stringify(data[LEAD_INDEX_FIELD]) === JSON.stringify(tokens))
      continue;
    tx.writeLeadIndex(id, tokens);
    updated++;
  }
  const ready = rows.length < 100;
  tx.set(LEAD_INDEX_STATE, {
    ...state,
    after: rows.at(-1)?.id || state.after || null,
    ready,
    scanned: state.scanned + rows.length,
    updated: state.updated + updated,
    ...(ready ? { completedAt: now } : {}),
  });
  return { scanned: rows.length, updated, ready, completed: ready };
}
export async function advanceLeadFilterIndex({
  store,
  commit,
  now,
  fetchImpl = fetch,
}) {
  if ((await store.get(LEAD_INDEX_STATE))?.ready)
    return { scanned: 0, updated: 0, ready: true };
  const response = await fetchImpl(
    'https://sales-drone-avinya.firebaseapp.com/version.json',
    { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok || (await response.json()).commit !== commit)
    return { waiting: true, scanned: 0, updated: 0, ready: false };
  return store.reindexLeads({ commit, now });
}
