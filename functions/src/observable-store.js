import { randomUUID } from 'node:crypto';
import { hash, path, ROOT } from './policy.js';
import { APP_VERSION, BUILD_COMMIT } from './version.js';
const domains = new Set([
  'leads',
  'leadAttachments',
  'activities',
  'activityRevisions',
  'leadTransitions',
  'tasks',
  'members',
  'personalAccessTokens',
  'invitations',
  'imports',
  'leadScores',
]);
function domain(p, data) {
  const parts = p.split('/');
  if (p.startsWith(ROOT + '/')) {
    const d = parts[2];
    if (d === 'settings')
      return ['fields', 'scoring', 'ai', 'workspace'].includes(parts[3])
        ? 'settings'
        : null;
    if (d === 'leadScores' && !['Ready', 'Failed'].includes(data?.status))
      return null;
    return domains.has(d) ? d : null;
  }
  if (parts[0] === 'users' && parts[2] === 'notifications')
    return 'notifications';
  if (parts[0] === 'users' && parts[2] === 'devices') return 'devices';
  return null;
}
/** Count only transitions observed from a read-before-write snapshot. No field values leave the store. */
export function lifecycleCounts(domain, before, after) {
  if (!before || !after) return {};
  const result = {};
  if (domain === 'tasks') {
    for (const state of ['Completed', 'Cancelled', 'Pending'])
      if (after.state === state && before.state !== state)
        result[state === 'Pending' ? 'reopened' : state.toLowerCase()] = 1;
    if (!before.deletedAt && after.deletedAt) result.soft_deleted = 1;
  }
  if (domain === 'leads') {
    if (!before.archived && after.archived) result.archived = 1;
    if (!before.doNotContact && after.doNotContact) result.suppressed = 1;
    if (before.doNotContact && after.doNotContact === false)
      result.unsuppressed = 1;
    if (before.stage !== after.stage) result.stage_changed = 1;
    if (before.assignedToUid !== after.assignedToUid)
      result.assignment_changed = 1;
  }
  return result;
}
// Instrument the SDK boundary; never serialize document values into telemetry.
export function observableStore(base, getTelemetry = () => null) {
  const wrap = (name, fn) => {
    const t = getTelemetry();
    return t
      ? t.span(name, fn, {
          'db.system.name': 'gcp.firestore',
          'db.operation.name': name.split('.')[1],
        })
      : fn();
  };
  return {
    ...base,
    get: (p) => wrap('firestore.get', () => base.get(p)),
    query: (p, o) => wrap('firestore.query', () => base.query(p, o)),
    count: (p, f) => wrap('firestore.count', () => base.count(p, f)),
    run: (fn) => {
      const t = getTelemetry();
      if (!t?.enabled) return base.run(fn);
      const transactionId = randomUUID();
      return t.span(
        'firestore.transaction',
        () =>
          base.run(async (tx) => {
            const written = new Map(),
              known = new Map();
            const reader = {
              ...tx,
              get: async (p) => {
                const value = await tx.get(p);
                known.set(p, value);
                return value;
              },
              query: async (p, o) => {
                const values = await tx.query(p, o);
                for (const value of values)
                  known.set(p + '/' + value.id, value);
                return values;
              },
              set: (p, v) => {
                tx.set(p, v);
                written.set(p, structuredClone(v));
              },
              delete: (p) => {
                tx.delete(p);
                written.set(p, null);
              },
            };
            const result = await fn(reader),
              summaries = new Map();
            for (const [p, v] of written) {
              const d = domain(p, v);
              if (!d) continue;
              const s = summaries.get(d) || {
                written: 0,
                created: 0,
                changed: 0,
                deleted: 0,
              };
              s.written++;
              if (v === null) s.deleted++;
              else if (known.has(p)) {
                if (known.get(p) === null) s.created++;
                else s.changed++;
              }
              for (const [kind, count] of Object.entries(
                lifecycleCounts(d, known.get(p), v),
              ))
                s[kind] = (s[kind] || 0) + count;
              summaries.set(d, s);
            }
            const capture = t.capture(),
              time = new Date().toISOString();
            for (const [d, s] of summaries) {
              const id = hash(transactionId + ':' + d);
              const data = {
                'event.id': id,
                'event.provider': 'com.avinyatech.salesdrone.backend',
                'event.authority': 'server-confirmed',
                'schema.version': 1,
                'transaction.id': transactionId,
                'operation.id': capture.operationId,
                'request.id': capture.requestId,
                operation: capture.operation,
                'actor.id': capture.actorId,
                'app.version': APP_VERSION,
                'build.commit': BUILD_COMMIT,
                'record.domain': d,
                'records.written': s.written,
                'records.known_created': s.created,
                'records.known_changed': s.changed,
                'records.deleted': s.deleted,
                ...Object.fromEntries(
                  Object.entries(s)
                    .filter(
                      ([k]) =>
                        !['written', 'created', 'changed', 'deleted'].includes(
                          k,
                        ),
                    )
                    .map(([k, v]) => ['records.' + k, v]),
                ),
                'correlation.origin': capture.traceparent
                  ? 'backend-transaction'
                  : 'outbox-consumer',
              };
              const event = {
                specversion: '1.0',
                id,
                source: 'com.avinyatech.salesdrone.backend',
                type: `com.avinyatech.salesdrone.${d}.committed`,
                time,
                data,
                ...(capture.traceparent
                  ? { traceparent: capture.traceparent }
                  : {}),
              };
              tx.set(path('telemetryOutbox', id), {
                id,
                status: 'Pending',
                nextAttemptAt: time,
                attemptCount: 0,
                createdAt: time,
                event,
              });
            }
            return result;
          }),
        { 'transaction.id': transactionId },
      );
    },
  };
}
