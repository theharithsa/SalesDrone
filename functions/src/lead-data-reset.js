import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './contracts.js';
import { path, ROOT, hash, requireMember } from './policy.js';

export const RESET_STATE = path('maintenance', 'lead-data-reset');
export const ResetConfirmation = z
  .object({ previewId: z.uuid(), confirmation: z.literal('DELETE ALL LEADS') })
  .strict();
export const ResetResume = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
const phases = [
  'reminderDeliveries',
  'tasks',
  'leadAttachments',
  'storage',
  'activities',
  'activityRevisions',
  'leadTransitions',
  'noteAnalyses',
  'leadScores',
  'hygieneScans',
  'hygieneFindings',
  'hygieneEvidence',
  'assistantConversations',
  'assistantRequests',
  'assistantMessages',
  'assistantContributions',
  'researchIndexJobs',
  'researchChunks',
  'imports',
  'importChunks',
  'importBaselines',
  'dedupeKeys',
  'leads',
  'requests',
  'members',
];
const affected = new Set(
  phases.filter((p) => !['storage', 'members'].includes(p)),
);
export const resetActive = (state) => !!state?.active;
const unavailable = () =>
  new AppError(
    503,
    'LEAD_DATA_RESET',
    'Lead data is being cleared. Try again after cleanup finishes.',
  );

// All application/worker transactions read the same lock. Firestore retries a
// transaction racing the start/completion commit; late writes cannot resurrect data.
export function guardLeadData(base) {
  if (base.maintenanceStore) return base;
  return {
    ...base,
    maintenanceStore: base,
    run: (fn) =>
      base.run(async (tx) => {
        const state = await tx.get(RESET_STATE);
        const check = (p) => {
          if (
            resetActive(state) &&
            ((affected.has(p.split('/')[2]) && p.startsWith(ROOT + '/')) ||
              (p.startsWith('users/') &&
                /\/(notifications|insights)\//.test(p)))
          )
            throw unavailable();
        };
        return fn({
          ...tx,
          set: (p, v) => {
            check(p);
            tx.set(p, v);
          },
          delete: (p) => {
            check(p);
            tx.delete(p);
          },
        });
      }),
  };
}
export async function resetAdmin(tx, identity) {
  const member = await requireMember(tx, identity, 'members:write');
  if (identity.personalAccess || member.role !== 'Admin')
    throw new AppError(
      403,
      'ADMIN_REQUIRED',
      'Only an active administrator signed in with Google can clear lead data',
    );
  return member;
}
const publicJob = (j) =>
  j
    ? Object.fromEntries(
        [
          'id',
          'status',
          'phase',
          'version',
          'createdAt',
          'readyAt',
          'updatedAt',
          'completedAt',
          'deletedRecords',
          'deletedFiles',
          'redactedRequests',
          'lastError',
        ].map((k) => [k, j[k] ?? null]),
      )
    : null;
export async function resetStatus(store) {
  const state = await store.get(RESET_STATE);
  return {
    active: resetActive(state),
    job: state?.jobId
      ? publicJob(await store.get(path('leadDataResets', state.jobId)))
      : null,
  };
}
export async function previewReset({ store, identity, now }) {
  await resetAdmin(store, identity);
  const counts = {
    leads: await store.count(path('leads')),
    archived: await store.count(path('leads'), [['archived', '==', true]]),
  };
  return store.run(async (tx) => {
    const member = await resetAdmin(tx, identity),
      state = await tx.get(RESET_STATE);
    if (resetActive(state))
      throw new AppError(409, 'RESET_ACTIVE', 'Lead cleanup is already active');
    const id = randomUUID(),
      expiresAt = new Date(Date.parse(now()) + 600000).toISOString();
    tx.set(path('leadResetPreviews', id), {
      id,
      uid: member.uid,
      stateVersion: state?.version || 0,
      expiresAt,
    });
    return { previewId: id, expiresAt, counts };
  });
}
export async function startReset({ store, identity, input, key, now }) {
  if (!z.uuid().safeParse(key).success)
    throw new AppError(400, 'IDEMPOTENCY', 'Supply a UUID Idempotency-Key');
  return store.run(async (tx) => {
    const member = await resetAdmin(tx, identity),
      id = hash(member.uid + ':' + key),
      prior = await tx.get(path('leadDataResets', id));
    if (prior) {
      if (prior.previewId !== input.previewId)
        throw new AppError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'This key was used for another cleanup',
        );
      return publicJob(prior);
    }
    const state = await tx.get(RESET_STATE),
      preview = await tx.get(path('leadResetPreviews', input.previewId));
    if (resetActive(state))
      throw new AppError(409, 'RESET_ACTIVE', 'Lead cleanup is already active');
    if (
      !preview ||
      preview.uid !== member.uid ||
      preview.expiresAt <= now() ||
      preview.stateVersion !== (state?.version || 0)
    )
      throw new AppError(
        409,
        'RESET_PREVIEW_EXPIRED',
        'Review a new cleanup preview before confirming',
      );
    const job = {
      id,
      previewId: input.previewId,
      status: 'Waiting',
      phase: phases[0],
      phaseIndex: 0,
      cursor: null,
      memberId: null,
      memberCursor: null,
      memberPart: 0,
      version: 1,
      createdAt: now(),
      updatedAt: now(),
      readyAt: new Date(Date.parse(now()) + 300000).toISOString(),
      deletedRecords: 0,
      deletedFiles: 0,
      redactedRequests: 0,
      lease: null,
      leaseUntil: null,
      lastError: null,
    };
    tx.delete(path('maintenance','leadResearchIndex'));
    tx.set(RESET_STATE, {
      id: 'lead-data-reset',
      active: true,
      jobId: id,
      version: (state?.version || 0) + 1,
    });
    tx.set(path('leadDataResets', id), job);
    tx.delete(path('leadResetPreviews', input.previewId));
    const auditId = 'lead_reset_' + id;
    tx.set(path('auditEvents', auditId), {
      id: auditId,
      actorUid: member.uid,
      action: 'lead-data-reset.started',
      createdAt: now(),
    });
    return publicJob(job);
  });
}
export async function resumeReset({
  store,
  identity,
  id,
  expectedVersion,
  now,
}) {
  return store.run(async (tx) => {
    await resetAdmin(tx, identity);
    const state = await tx.get(RESET_STATE),
      job = await tx.get(path('leadDataResets', id));
    if (!state?.active || state.jobId !== id || !job)
      throw new AppError(404, 'NOT_FOUND', 'Cleanup not found');
    if (job.version !== expectedVersion)
      throw new AppError(
        409,
        'STALE_VERSION',
        'Refresh cleanup status before retrying',
      );
    if (job.status !== 'Blocked')
      throw new AppError(
        409,
        'RESET_STATE',
        'Only blocked cleanup needs a retry',
      );
    const updated = {
      ...job,
      status: 'Running',
      lastError: null,
      lease: null,
      leaseUntil: null,
      version: job.version + 1,
      updatedAt: now(),
    };
    tx.set(path('leadDataResets', id), updated);
    return publicJob(updated);
  });
}
// At most 30 documents and 100 per-device receipts in a transaction; every
// external file operation occurs outside transactions. Deletion is retry-safe.
export async function advanceLeadReset({
  store,
  files,
  now = () => new Date().toISOString(),
  batches = 4,
}) {
  store = store.maintenanceStore || store;
  const stats = {
    active: false,
    processed: 0,
    removed: 0,
    files: 0,
    blocked: 0,
  };
  for (let b = 0; b < batches; b++) {
    const lease = randomUUID();
    const job = await store.run(async (tx) => {
      const state = await tx.get(RESET_STATE);
      if (!resetActive(state)) return null;
      stats.active = true;
      const old = await tx.get(path('leadDataResets', state.jobId));
      if (
        !old ||
        old.status === 'Blocked' ||
        old.readyAt > now() ||
        old.leaseUntil > now()
      )
        return null;
      const next = {
        ...old,
        status: 'Running',
        lease,
        leaseUntil: new Date(Date.parse(now()) + 150000).toISOString(),
        version: old.version + 1,
        updatedAt: now(),
      };
      tx.set(path('leadDataResets', next.id), next);
      return next;
    });
    if (!job) break;
    try {
      let rows = [],
        collection = path(job.phase),
        next = { ...job },
        removedFiles = 0,
        deletions = [],
        rewrites = [];
      if (job.phase === 'storage') {
        if (!files?.list)
          throw new AppError(
            503,
            'STORAGE_UNAVAILABLE',
            'File listing unavailable',
          );
        // The fixed private prefix is never accepted from a caller/document.
        const list = await files.list(ROOT + '/lead-files/', 30);
        for (const name of list) {
          if (!name.startsWith(ROOT + '/lead-files/'))
            throw Error('Unsafe file path');
          await files.delete(name);
          removedFiles++;
        }
        if (!list.length) next.phaseIndex++;
      } else if (job.phase === 'members') {
        if (!job.memberId) {
          const member = (
            await store.scan(path('members'), { after: job.cursor, limit: 1 })
          )[0];
          if (!member) next.phaseIndex++;
          else {
            next.memberId = member.id;
            next.memberCursor = null;
            next.memberPart = 0;
          }
        } else {
          const part = job.memberPart === 0 ? 'notifications' : 'insights';
          collection = `users/${job.memberId}/${part}`;
          rows = await store.scan(collection, {
            after: job.memberCursor,
            limit: 30,
          });
          for (const row of rows)
            if (part === 'insights' || row.data.leadId)
              deletions.push(collection + '/' + row.id);
          if (rows.length) next.memberCursor = rows.at(-1).id;
          else if (job.memberPart === 0) {
            next.memberPart = 1;
            next.memberCursor = null;
          } else {
            next.cursor = job.memberId;
            next.memberId = null;
            next.memberCursor = null;
            next.memberPart = 0;
          }
        }
      } else {
        rows = await store.scan(collection, { after: job.cursor, limit: 30 });
        for (const row of rows) {
          const p = collection + '/' + row.id;
          if (job.phase === 'tasks' && !row.data.leadId) {
            next.cursor = row.id;
            continue;
          }
          if (job.phase === 'reminderDeliveries') {
            const task = row.data.taskId
              ? await store.get(path('tasks', row.data.taskId))
              : null;
            if (!row.data.leadId && task && !task.leadId) {
              next.cursor = row.id;
              continue;
            }
            // Drop receipts before the delivery record, leaving standalone task
            // retry receipts intact. A corrupt oversized set drains next time.
            const receipts = await store.query(path('deviceDeliveries'), {
              filters: [
                ['id', '>=', row.id + '_'],
                ['id', '<=', row.id + '_\uf8ff'],
              ],
              order: 'id',
              direction: 'asc',
              limit: 101,
            });
            deletions.push(
              ...receipts
                .slice(0, 100)
                .map((r) => path('deviceDeliveries', r.id)),
            );
            if (receipts.length > 100) break;
          }
          if (job.phase === 'leadAttachments') {
            if (!files?.delete) throw Error('Storage unavailable');
            const objectPath = `${ROOT}/lead-files/${row.data.leadId}/${row.id}`;
            if (row.data.objectPath !== objectPath)
              throw Error('Unsafe file path');
            await files.delete(objectPath);
            removedFiles++;
          }
          if (job.phase === 'requests')
            rewrites.push([
              p,
              {
                fingerprint: row.data.fingerprint,
                createdAt: row.data.createdAt,
                expiredByReset: true,
              },
            ]);
          else deletions.push(p);
          next.cursor = row.id;
          // Keep the write count well below Firestore's transaction limit.
          if (deletions.length >= 100) break;
        }
        if (!rows.length) {
          next.phaseIndex++;
          next.cursor = null;
        }
      }
      await store.run(async (tx) => {
        const current = await tx.get(path('leadDataResets', job.id)),
          state = await tx.get(RESET_STATE);
        if (
          current?.lease !== lease ||
          state?.jobId !== job.id ||
          !state.active
        )
          return;
        for (const p of deletions) tx.delete(p);
        for (const [p, v] of rewrites) tx.set(p, v);
        const completed = next.phaseIndex >= phases.length;
        const updated = {
          ...next,
          phase: phases[next.phaseIndex] || 'complete',
          status: completed ? 'Completed' : 'Running',
          lease: null,
          leaseUntil: null,
          updatedAt: now(),
          version: current.version + 1,
          deletedRecords: current.deletedRecords + deletions.length,
          deletedFiles: current.deletedFiles + removedFiles,
          redactedRequests: current.redactedRequests + rewrites.length,
          ...(completed ? { completedAt: now() } : {}),
        };
        tx.set(path('leadDataResets', job.id), updated);
        if (completed) {
          tx.set(RESET_STATE, {
            ...state,
            active: false,
            version: state.version + 1,
          });
          const id = 'lead_reset_complete_' + job.id;
          tx.set(path('auditEvents', id), {
            id,
            action: 'lead-data-reset.completed',
            createdAt: now(),
            deletedRecords: updated.deletedRecords,
            deletedFiles: updated.deletedFiles,
          });
        }
      });
      stats.processed++;
      stats.removed += deletions.length;
      stats.files += removedFiles;
    } catch {
      await store.run(async (tx) => {
        const current = await tx.get(path('leadDataResets', job.id));
        if (current?.lease === lease)
          tx.set(path('leadDataResets', job.id), {
            ...current,
            status: 'Blocked',
            lastError:
              'Cleanup paused. Check storage/service access, then retry. Lead writes remain paused.',
            lease: null,
            leaseUntil: null,
            updatedAt: now(),
            version: current.version + 1,
          });
      });
      stats.blocked++;
      break;
    }
  }
  return stats;
}
