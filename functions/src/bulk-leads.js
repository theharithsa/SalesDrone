import { z } from 'zod';
import { AppError, LeadInput } from './contracts.js';
import { leadAccess, assertVersion, path } from './policy.js';
import {
  readFieldOptions,
  assertFieldOption,
  validateCustomValues,
} from './field-options.js';
import { normalizeLead } from './leads.js';
import { recordStage } from './journey.js';
import { queueLeadNotification } from './notifications.js';
const fields = [
  'company',
  'jobTitle',
  'source',
  'location',
  'zone',
  'legacyStatus',
  'stage',
  'tags',
  'customFields',
];
export const BulkLeadInput = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9_.:-]{1,150}$/),
            expectedVersion: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(25)
      .refine(
        (items) => new Set(items.map((x) => x.id)).size === items.length,
        'Select unique leads',
      ),
    changes: z
      .object(
        Object.fromEntries(
          fields.map((key) => [
            key,
            LeadInput.shape[key].removeDefault().optional(),
          ]),
        ),
      )
      .strict(),
    assignedToUid: z.union([z.string().min(1).max(100), z.null()]).optional(),
  })
  .strict()
  .refine(
    (v) => Object.keys(v.changes).length || v.assignedToUid !== undefined,
    'Choose at least one change',
  );
export async function planBulkLeads(tx, member, input, now, apply = false) {
  const options = await readFieldOptions(tx);
  const assigning = input.assignedToUid !== undefined;
  if (assigning && !member.capabilities.includes('assignments:write'))
    throw new AppError(403, 'CAPABILITY', 'Assignment permission is required');
  if (assigning && input.assignedToUid) {
    const target = await tx.get(path('members', input.assignedToUid));
    if (!target?.active || !target.capabilities.includes('leads:read'))
      throw new AppError(
        400,
        'ASSIGNEE',
        'Choose an active member with lead access',
      );
  }
  const plans = [];
  for (const item of input.items) {
    const old = await leadAccess(tx, member, item.id);
    assertVersion(old, item.expectedVersion);
    if (old.archived)
      throw new AppError(
        409,
        'ARCHIVED',
        'Archived leads cannot be batch edited',
      );
    const base = Object.fromEntries(
      Object.keys(LeadInput.shape)
        .filter((k) => k in old)
        .map((k) => [k, old[k]]),
    );
    const changes = { ...input.changes };
    assertFieldOption(options, 'stage', changes.stage, old.stage);
    if (changes.customFields) {
      changes.customFields = { ...old.customFields, ...changes.customFields };
      validateCustomValues(
        options,
        changes.customFields,
        old.customFields || {},
      );
    }
    const { allowDuplicate, ...normalized } = normalizeLead({
      ...base,
      ...changes,
    });
    const reassigned = assigning && old.assignedToUid !== input.assignedToUid;
    const tasks = reassigned
      ? await tx.query(path('tasks'), {
          filters: [
            ['leadId', '==', old.id],
            ['state', '==', 'Pending'],
          ],
          limit: 101,
        })
      : [];
    if (tasks.length > 100)
      throw new AppError(
        409,
        'TASK_LIMIT',
        'A selected lead has too many pending tasks',
      );
    const keys = [
      ...Object.keys(input.changes),
      ...(reassigned ? ['assignedToUid'] : []),
    ];
    const updated = {
      ...old,
      ...normalized,
      ...(reassigned
        ? {
            assignedToUid: input.assignedToUid,
            assignmentRevision: (old.assignmentRevision || 1) + 1,
          }
        : {}),
      version: old.version + 1,
      updatedAt: now,
    };
    const changed = keys.some(
      (key) =>
        JSON.stringify(old[key] ?? null) !==
        JSON.stringify(updated[key] ?? null),
    );
    plans.push({ old, updated, tasks, reassigned, changed, keys });
  }
  if (plans.reduce((n, p) => n + p.tasks.length, 0) > 200)
    throw new AppError(
      409,
      'TASK_LIMIT',
      'This batch would cancel more than 200 pending tasks; select fewer leads',
    );
  if (
    Buffer.byteLength(
      JSON.stringify(plans.map((p) => [p.old, p.updated, p.tasks])),
    ) >
    2 * 1024 * 1024
  )
    throw new AppError(
      413,
      'BATCH_SIZE',
      'This batch contains too much stored data; select fewer leads',
    );
  if (apply)
    for (const p of plans) {
      if (!p.changed) continue;
      tx.set(path('leads', p.old.id), p.updated);
      recordStage(tx, p.updated, p.old.stage, member.uid, now, 'edited');
      if (p.reassigned) {
        queueLeadNotification(tx, p.updated, member.uid, 'lead_assigned', now);
        for (const t of p.tasks)
          tx.set(path('tasks', t.id), {
            ...t,
            state: 'Cancelled',
            version: t.version + 1,
          });
      }
      const id = 'bulk_' + p.updated.id + '_' + p.updated.version;
      tx.set(path('activities', id), {
        id,
        leadId: p.old.id,
        type: 'change',
        notes: 'Lead updated in a batch edit',
        actorUid: member.uid,
        createdAt: now,
      });
    }
  return {
    count: plans.length,
    changedCount: plans.filter((p) => p.changed).length,
    items: plans.map((p) => ({
      id: p.old.id,
      name: p.old.name,
      version: apply && p.changed ? p.updated.version : p.old.version,
      changed: p.changed,
      before: Object.fromEntries(p.keys.map((k) => [k, p.old[k] ?? null])),
      after: Object.fromEntries(p.keys.map((k) => [k, p.updated[k] ?? null])),
    })),
  };
}
