import { FieldPath, FieldValue } from 'firebase-admin/firestore';
const DOCUMENT_KEY = Symbol('document-key');
export const documentKey = value => value[DOCUMENT_KEY] ?? value.id;
const withDocumentKey = (value, key) => Object.defineProperty(value, DOCUMENT_KEY, {value:key});
const fieldValue = (value, field) => field === '__name__' ? documentKey(value) : field.split('.').reduce((v,key)=>v?.[key], value);
// Both adapters expose the same transaction boundary. Buffered writes ensure all
// Firestore reads precede writes, including policy checks and idempotency reads.
function firestoreReader(db, transaction) {
  const writes = [];
  const queryRef = (
    path,
    { filters = [], order = 'id', direction = 'asc', after, limit = 50, fields } = {},
  ) => {
    let q = db.collection(path);
    for (const [f, op, v] of filters) q = q.where(f, op, v);
    q = q.orderBy(order === '__name__' ? FieldPath.documentId() : order, direction);
    if (order !== 'id' && order !== '__name__') q = q.orderBy('id', direction);
    if (after !== undefined) q = q.startAfter(...after);
    if(fields)q=q.select(...fields);
    return q.limit(limit);
  };
  return {
    scan: async (path, { after, limit = 50 } = {}) => {
      let q = db.collection(path).orderBy(FieldPath.documentId()).limit(limit);
      if (after) q = q.startAfter(after);
      const result = transaction ? await transaction.get(q) : await q.get();
      return result.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    },
    get: async (path) => {
      const ref = db.doc(path);
      const s = transaction ? await transaction.get(ref) : await ref.get();
      return s.exists ? s.data() : null;
    },
    getAll: async (paths, fields) => {
      if (!paths.length) return [];
      const refs = paths.map(p => db.doc(p));
      const args=fields?[...refs,{fieldMask:fields}]:refs;
      const snapshots = transaction ? await transaction.getAll(...args) : await db.getAll(...args);
      return snapshots.map(s => s.exists ? s.data() : null);
    },
    query: async (path, opts) => {
      const q = queryRef(path, opts);
      const s = transaction ? await transaction.get(q) : await q.get();
      return s.docs.map((d) => opts?.order === '__name__' ? withDocumentKey(d.data(),d.id) : d.data());
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
        if (op === 'set') {
          if (path.split('/')[2] === 'researchChunks' && Array.isArray(data.embedding)) data.embedding = FieldValue.vector(data.embedding);
          transaction.set(db.doc(path), data);
        }
        else transaction.delete(db.doc(path));
      }
    },
  };
}
export function firestoreStore(db) {
  const reader = firestoreReader(db);
  return {
    ...reader,
    nearest: async (path, {filters = [], vector, limit = 12}) => {
      let q = db.collection(path);
      for (const [f, op, v] of filters) q = q.where(f, op, v);
      const result = await q.findNearest({vectorField:'embedding',queryVector:vector,limit,distanceMeasure:'COSINE'}).get();
      return result.docs.map(d => { const value=d.data(); delete value.embedding; return value; });
    },
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
    scan: async (p, { after, limit = 50 } = {}) =>
      [...map.entries()]
        .filter(
          ([k]) =>
            k.startsWith(p + '/') &&
            k.split('/').length === p.split('/').length + 1,
        )
        .map(([k, v]) => ({
          id: k.slice(p.length + 1),
          data: structuredClone(v),
        }))
        .filter((row) => !after || row.id > after)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, limit),
    get: async (p) => structuredClone(map.get(p) || null),
    getAll: async (paths,fields) => paths.map(p => {const value=structuredClone(map.get(p)||null);return value&&fields?Object.fromEntries(fields.filter(f=>f in value).map(f=>[f,value[f]])):value;}),
    query: async (
      p,
      { filters = [], order = 'id', direction = 'asc', after, limit = 50, fields } = {},
    ) =>
      [...map.entries()]
        .filter(
          ([k]) =>
            k.startsWith(p + '/') &&
            k.split('/').length === p.split('/').length + 1,
        )
        .map(([key, v]) => withDocumentKey(structuredClone(v),key.split('/').at(-1)))
        .filter((v) =>
          filters.every(([f, op, x]) =>
            op === 'in'
              ? Array.isArray(x) && x.includes(fieldValue(v,f))
              : op === '=='
              ? fieldValue(v,f) === x
              : op === '>='
                ? fieldValue(v,f) >= x
                : op === '<='
                  ? fieldValue(v,f) <= x
                  : op === '<'
                    ? fieldValue(v,f) < x
                    : op === '>'
                      ? fieldValue(v,f) > x
                      : false,
          ),
        )
        .sort(
          (a, b) =>
            (fieldValue(a,order) < fieldValue(b,order)
              ? -1
              : fieldValue(a,order) > fieldValue(b,order)
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
              ? fieldValue(v,order) > after[0] ||
                (fieldValue(v,order) === after[0] && v.id > after[1])
              : fieldValue(v,order) < after[0] ||
                (fieldValue(v,order) === after[0] && v.id < after[1])),
        )
        .slice(0, limit)
        .map(value=>fields?withDocumentKey(Object.fromEntries(fields.filter(f=>f in value).map(f=>[f,value[f]])),documentKey(value)):value),
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
    nearest: async (p, {filters = [], vector, limit = 12}) => {
      const rows = await reader(data).query(p,{filters,limit:Number.MAX_SAFE_INTEGER});
      const norm = v => Math.sqrt(v.reduce((n,x)=>n+x*x,0));
      return rows.filter(r=>Array.isArray(r.embedding)&&r.embedding.length===vector.length)
        .map(r=>({r,score:r.embedding.reduce((n,x,i)=>n+x*vector[i],0)/(norm(r.embedding)*norm(vector)||1)}))
        .sort((a,b)=>b.score-a.score).slice(0,limit).map(({r})=>{delete r.embedding;return r;});
    },
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
