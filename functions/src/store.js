import {
  indexedLeadWrite,
  publicLeadValue,
  reindexLeadPage,
  LEAD_INDEX_FIELD,
} from './lead-filter-index.js';
import { ROOT } from './policy.js';
import { FieldPath } from 'firebase-admin/firestore';
// Both adapters expose the same transaction boundary. Buffered writes ensure all
// Firestore reads precede writes, including policy checks and idempotency reads.
function firestoreReader(db, transaction, raw = false) {
  const output = (path, value) => (raw ? value : publicLeadValue(path, value));
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
    scan: async (path, { after, limit = 50 } = {}) => {
      let q = db.collection(path).orderBy(FieldPath.documentId()).limit(limit);
      if (after) q = q.startAfter(after);
      const result = transaction ? await transaction.get(q) : await q.get();
      return result.docs.map((doc) => ({
        id: doc.id,
        data: output(path + '/' + doc.id, doc.data()),
      }));
    },
    get: async (path) => {
      const ref = db.doc(path);
      const s = transaction ? await transaction.get(ref) : await ref.get();
      return s.exists ? output(path, s.data()) : null;
    },
    getAll: async (paths) => {
      if (!paths.length) return [];
      const refs = paths.map((p) => db.doc(p));
      const snapshots = transaction
        ? await transaction.getAll(...refs)
        : await db.getAll(...refs);
      return snapshots.map((s, i) =>
        s.exists ? output(paths[i], s.data()) : null,
      );
    },
    query: async (path, opts) => {
      const q = queryRef(path, opts);
      const s = transaction ? await transaction.get(q) : await q.get();
      return s.docs.map((d) => output(path + '/' + d.id, d.data()));
    },
    count: async (path, filters = []) => {
      let q = db.collection(path);
      for (const [f, op, v] of filters) q = q.where(f, op, v);
      return (await q.count().get()).data().count;
    },
    set: (path, data) =>
      writes.push([
        'set',
        path,
        structuredClone(raw ? data : indexedLeadWrite(path, data)),
      ]),
    ...(raw
      ? {
          writeLeadIndex: (id, tokens) =>
            writes.push([
              'update',
              `${ROOT}/leads/${id}`,
              { [LEAD_INDEX_FIELD]: tokens },
            ]),
        }
      : {}),
    delete: (path) => writes.push(['delete', path]),
    flush: () => {
      for (const [op, path, data] of writes) {
        if (op === 'set') transaction.set(db.doc(path), data);
        else if (op === 'update') transaction.update(db.doc(path), data);
        else transaction.delete(db.doc(path));
      }
    },
  };
}
export function firestoreStore(db) {
  const reader = firestoreReader(db);
  return {
    ...reader,
    reindexLeads: (options) =>
      db.runTransaction(async (tx) => {
        const raw = firestoreReader(db, tx, true);
        const result = await reindexLeadPage(raw, options);
        raw.flush();
        return result;
      }),
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
  const reader = (map, raw = false) => {
    const output = (p, v) => (raw ? v : publicLeadValue(p, v));
    return {
      scan: async (p, { after, limit = 50 } = {}) =>
        [...map.entries()]
          .filter(
            ([k]) =>
              k.startsWith(p + '/') &&
              k.split('/').length === p.split('/').length + 1,
          )
          .map(([k, v]) => ({
            id: k.slice(p.length + 1),
            data: output(k, structuredClone(v)),
          }))
          .filter((row) => !after || row.id > after)
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .slice(0, limit),
      get: async (p) => output(p, structuredClone(map.get(p) || null)),
      getAll: async (paths) =>
        paths.map((p) => output(p, structuredClone(map.get(p) || null))),
      query: async (
        p,
        {
          filters = [],
          order = 'id',
          direction = 'asc',
          after,
          limit = 50,
        } = {},
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
              op === 'array-contains'
                ? Array.isArray(v[f]) && v[f].includes(x)
                : op === '=='
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
          .slice(0, limit)
          .map((v) => output(p + '/' + v.id, v)),
      set: (p, v) =>
        map.set(p, structuredClone(raw ? v : indexedLeadWrite(p, v))),
      ...(raw
        ? {
            writeLeadIndex: (id, tokens) => {
              const p = `${ROOT}/leads/${id}`;
              if (!map.has(p)) throw Error('Lead disappeared during indexing');
              map.set(p, { ...map.get(p), [LEAD_INDEX_FIELD]: tokens });
            },
          }
        : {}),
      delete: (p) => map.delete(p),
      count: async (p, f) =>
        (
          await reader(map).query(p, {
            filters: f,
            limit: Number.MAX_SAFE_INTEGER,
          })
        ).length,
    };
  };
  const run = (fn, raw = false) => {
    const result = tail.then(async () => {
      const next = new Map(data);
      const r = await fn(reader(next, raw));
      data.clear();
      for (const [k, v] of next) data.set(k, v);
      return r;
    });
    tail = result.catch(() => {});
    return result;
  };
  return {
    ...reader(data),
    run: (fn) => run(fn),
    reindexLeads: (options) => run((tx) => reindexLeadPage(tx, options), true),
    dump: () =>
      Object.fromEntries([...data].map(([p, v]) => [p, publicLeadValue(p, v)])),
  };
}
