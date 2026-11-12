import { path } from './policy.js';
import { rateLimitExpiry } from './rate-limit.js';

const progressPath = path('maintenance', 'operationalCounterExpiry');
const batchSize = 50;

function aiBudgetTime(id) {
  const bucket = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})$/.exec(id);
  if (!bucket) return null;
  const iso = `${bucket[1]}:${bucket[2]}:00.000Z`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === iso ? iso : null;
}

export async function backfillOperationalCounterExpiry(store) {
  return store.run(async (tx) => {
    const state = (await tx.get(progressPath)) ?? { phase: 'budgets' };
    if (state.phase === 'complete') return { scanned: 0, converted: 0, completed: false };

    const [member] = state.phase === 'budgets'
      ? await tx.scan(path('members'), { after: state.ownerAfter, limit: 1 })
      : [];
    const collection = member ? `users/${member.id}/aiBudgets` : path('pushTests');
    const after = member || state.phase === 'pushTests' ? state.after : undefined;
    const rows = await tx.scan(collection, { after, limit: batchSize });
    let converted = 0;
    for (const row of rows) {
      const at = member ? aiBudgetTime(row.id) : row.data.at;
      if (row.data.expiresAt != null || typeof at !== 'string' || !Number.isFinite(Date.parse(at)))
        continue;
      tx.set(collection + '/' + row.id, { ...row.data, expiresAt: rateLimitExpiry(at) });
      converted++;
    }

    const batchFinished = rows.length < batchSize;
    const last = rows.at(-1)?.id ?? null;
    const next = member
      ? {
          phase: 'budgets',
          ownerAfter: batchFinished ? member.id : state.ownerAfter ?? null,
          after: batchFinished ? null : last,
        }
      : batchFinished ? { phase: 'complete' } : { phase: 'pushTests', after: last };
    tx.set(progressPath, next);
    return { scanned: rows.length, converted, completed: next.phase === 'complete' };
  });
}
