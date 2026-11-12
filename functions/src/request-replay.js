import { path } from './policy.js';

export const replayDays = 7;
const replayWindowMs = replayDays * 24 * 60 * 60 * 1000;
const collection = path('requests');
const progressPath = path('maintenance', 'requestReplayExpiry');
const batchSize = 50;

export function replayExpiry(createdAt) {
  const time = Date.parse(createdAt);
  return Number.isFinite(time)
    ? new Date(time + replayWindowMs).toISOString()
    : null;
}

export function replayExpired(receipt, at) {
  const expiresAt = replayExpiry(receipt.createdAt);
  return receipt.replayExpired || !expiresAt || expiresAt <= at;
}

function expiredMarker(receipt) {
  return {
    fingerprint: receipt.fingerprint ?? null,
    createdAt: receipt.createdAt ?? null,
    replayExpired: true,
  };
}

// Keep the member/key hash reserved. Removing the entire document could turn a
// delayed retry into a new mutation.
export async function expireRequestReplays(store, at) {
  return store.run(async (tx) => {
    const due = await tx.query(collection, {
      filters: [['replayExpiresAt', '<=', at]],
      order: 'replayExpiresAt',
      fields: ['id', 'fingerprint', 'createdAt'],
      limit: batchSize,
    });
    const progress = await tx.get(progressPath);
    const legacy = progress?.complete
      ? []
      : await tx.scan(collection, { after: progress?.after, limit: batchSize });
    let redacted = 0;
    for (const receipt of due) {
      tx.set(path('requests', receipt.id), expiredMarker(receipt));
      redacted++;
    }
    for (const { id, data } of legacy) {
      if (data.replayExpiresAt || data.replayExpired || data.expiredByReset) continue;
      if (replayExpired(data, at)) {
        tx.set(path('requests', id), expiredMarker(data));
        redacted++;
      } else {
        tx.set(path('requests', id), {
          ...data,
          id,
          replayExpiresAt: replayExpiry(data.createdAt),
        });
      }
    }
    if (!progress?.complete)
      tx.set(progressPath, {
        after: legacy.at(-1)?.id ?? null,
        complete: legacy.length < batchSize,
      });
    return { scanned: due.length + legacy.length, redacted };
  });
}
