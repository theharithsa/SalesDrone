// Both adapters expose the same transaction boundary. Buffered writes ensure all
// Firestore reads precede writes, including policy checks and idempotency reads.
function firestoreReader(db, transaction) {
  const writes = [];
  const queryRef = (
    path,
    { filters = [], order = 'id', direction = 'asc', after, limit = 50 } = {},
  ) => {
    let q = db.collection(path);
    for (const [f, op, v] of filters) q = q.where(f, op, v);
    q = q.orderBy(order, direction);
    if (order !== 'id') q = q.orderBy('id', direction);
    if (after !== undefined) q = q.startAfter(...after);
    return q.limit(limit);
  };
  return {
    get: async (path) => {
      const ref = db.doc(path);
      const s = transaction ? await transaction.get(ref) : await ref.get();
      return s.exists ? s.data() : null;
    },
    query: async (path, opts) => {
      const q = queryRef(path, opts);
      const s = transaction ? await transaction.get(q) : await q.get();
      return s.docs.map((d) => d.data());
    },
    count: async (path, filters = []) => {
      let q = db.collection(path);
      for (const [f, op, v] of filters) q = q.where(f, op, v);
      return (await q.count().get()).data().count;
    },
    set: (path, data) => writes.push(['set', path, structuredClone(data)]),
    delete: (path) => writes.push(['delete', path]),
    flush: () => {
      for (const [op, path, data] of writes) {
        if (op === 'set') transaction.set(db.doc(path), data);
        else transaction.delete(db.doc(path));
      }
    },
  };
}
export function firestoreStore(db) {
  const reader = firestoreReader(db);
  return {
    ...reader,
    run: (fn) =>
      db.runTransaction(async (tx) => {
        const r = firestoreReader(db, tx);
        const value = await fn(r);
        r.flush();
        return value;
      }),
  };
}
export function memoryStore(seed = {}) {
  let data = new Map(Object.entries(seed));
  let tail = Promise.resolve();
  const reader = (map) => ({
    get: async (p) => structuredClone(map.get(p) || null),
    query: async (
      p,
      { filters = [], order = 'id', direction = 'asc', after, limit = 50 } = {},
    ) =>
      [...map.entries()]
        .filter(
          ([k]) =>
            k.startsWith(p + '/') &&
            k.split('/').length === p.split('/').length + 1,
        )
        .map(([, v]) => structuredClone(v))
        .filter((v) =>
          filters.every(([f, op, x]) =>
            op === '=='
              ? v[f] === x
              : op === '>='
                ? v[f] >= x
                : op === '<='
                  ? v[f] <= x
                  : op === '<'
                    ? v[f] < x
                    : op === '>'
                      ? v[f] > x
                      : false,
          ),
        )
        .sort(
          (a, b) =>
            (a[order] < b[order]
              ? -1
              : a[order] > b[order]
                ? 1
                : a.id < b.id
                  ? -1
                  : a.id > b.id
                    ? 1
                    : 0) * (direction === 'asc' ? 1 : -1),
        )
        .filter(
          (v) =>
            !after ||
            (direction === 'asc'
              ? v[order] > after[0] ||
                (v[order] === after[0] && v.id > after[1])
              : v[order] < after[0] ||
                (v[order] === after[0] && v.id < after[1])),
        )
        .slice(0, limit),
    set: (p, v) => map.set(p, structuredClone(v)),
    delete: (p) => map.delete(p),
    count: async (p, f) =>
      (
        await reader(map).query(p, {
          filters: f,
          limit: Number.MAX_SAFE_INTEGER,
        })
      ).length,
  });
  return {
    ...reader(data),
    run: (fn) => {
      const result = tail.then(async () => {
        const next = new Map(data);
        const r = await fn(reader(next));
        data.clear();
        for (const [k, v] of next) data.set(k, v);
        return r;
      });
      tail = result.catch(() => {});
      return result;
    },
    dump: () => Object.fromEntries(data),
  };
}
