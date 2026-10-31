// Firestore serializes Date as Timestamp; structuredClone preserves Date in both stores.
export const rateLimitExpiry = (at) => new Date(Date.parse(at) + 86400000);

// One bounded, resumable migration of internal counters; customer collections are untouched.
export async function backfillRateLimitExpiry(store, root) {
  const statePath = `${root}/maintenance/rateLimitExpiry`;
  return store.run(async (tx) => {
    const state = await tx.get(statePath);
    if (state?.complete) return { scanned: 0, converted: 0, complete: true };
    const rows = await tx.scan(`${root}/rateLimits`, {
      after: state?.after,
      limit: 100,
    });
    let converted = 0;
    for (const { id, data } of rows) {
      if (
        typeof data.expiresAt !== "string" ||
        !Number.isFinite(Date.parse(data.expiresAt))
      )
        continue;
      tx.set(`${root}/rateLimits/${id}`, {
        ...data,
        expiresAt: new Date(data.expiresAt),
      });
      converted++;
    }
    const complete = rows.length < 100;
    tx.set(statePath, {
      after: rows.at(-1)?.id || state?.after || null,
      complete,
    });
    return { scanned: rows.length, converted, complete };
  });
}
