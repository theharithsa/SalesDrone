import { z } from 'zod';
import { createHash } from 'node:crypto';
import { AppError } from './contracts.js';
import { path, leadAccess, requireMember } from './policy.js';
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
import FILE_TYPES from './attachment-types.json' with { type: 'json' };
export { FILE_TYPES };
export const AttachmentInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine(
        (v) => !/[\x00-\x1f\x7f/\\]/.test(v),
        'Use a filename without paths or control characters',
      ),
    size: z.number().int().min(1).max(MAX_FILE_BYTES),
    contentType: z.enum(Object.values(FILE_TYPES)),
  })
  .strict()
  .refine(
    (v) => FILE_TYPES[v.name.split('.').pop().toLowerCase()] === v.contentType,
    'Unsupported file extension or type',
  );
export const AttachmentDelete = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const attachmentView = ({
  id,
  leadId,
  name,
  size,
  contentType,
  state,
  version,
  createdAt,
  createdByUid,
}) => ({
  id,
  leadId,
  name,
  size,
  contentType,
  state,
  version,
  createdAt,
  createdByUid,
});
export function validateBytes(bytes, record) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length !== record.size ||
    bytes.length > MAX_FILE_BYTES
  )
    throw new AppError(
      400,
      'FILE_SIZE',
      'The file size does not match the upload',
    );
  const type = record.contentType,
    prefix = bytes.subarray(0, 16),
    text = prefix.toString('latin1');
  let valid =
    type === 'image/jpeg'
      ? prefix.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : type === 'image/png'
        ? prefix
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === 'image/gif'
          ? /^GIF8[79]a/.test(text)
          : type === 'image/webp'
            ? text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP'
            : type === 'application/pdf'
              ? text.startsWith('%PDF-')
              : type.includes('openxmlformats')
                ? prefix.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
                : [
                      'application/msword',
                      'application/vnd.ms-excel',
                      'application/vnd.ms-powerpoint',
                    ].includes(type)
                  ? prefix
                      .subarray(0, 8)
                      .equals(
                        Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]),
                      )
                  : !bytes.includes(0);
  if (valid && type.startsWith('text/'))
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      valid = false;
    }
  if (!valid)
    throw new AppError(
      400,
      'FILE_TYPE',
      'The file contents do not match its type',
    );
  return createHash('sha256').update(bytes).digest('hex');
}
export async function attachmentAccess(tx, member, leadId, id) {
  const lead = await leadAccess(tx, member, leadId),
    record = await tx.get(path('leadAttachments', id));
  if (
    !record ||
    record.leadId !== leadId ||
    ['Deleting', 'Deleted'].includes(record.state)
  )
    throw new AppError(404, 'NOT_FOUND', 'Attachment is unavailable');
  return { lead, record };
}
export async function reserveAttachment(tx, m, leadId, input, id, now) {
  const lead = await leadAccess(tx, m, leadId);
  if (lead.archived)
    throw new AppError(409, 'ARCHIVED', 'Archived leads cannot receive files');
  if ((lead.attachmentCount || 0) >= 50)
    throw new AppError(
      409,
      'FILE_LIMIT',
      'Each lead can hold up to 50 files; remove a file or retry after pending uploads expire',
    );
  const record = {
    ...input,
    id,
    leadId,
    state: 'Pending',
    version: 1,
    createdAt: now,
    createdByUid: m.uid,
    assignmentRevision: lead.assignmentRevision || 1,
    expiresAt: new Date(Date.parse(now) + 3600000).toISOString(),
    objectPath: `workspaces/avinyatech/lead-files/${leadId}/${id}`,
  };
  tx.set(path('leads', leadId), {
    ...lead,
    attachmentCount: (lead.attachmentCount || 0) + 1,
  });
  tx.set(path('leadAttachments', id), record);
  return attachmentView(record);
}
export async function putAttachment({
  store,
  identity,
  leadId,
  id,
  bytes,
  files,
  now,
  commit,
}) {
  const original = await store.run(async (tx) => {
    const m = await requireMember(tx, identity, 'leads:edit'),
      { lead, record } = await attachmentAccess(tx, m, leadId, id);
    if (record.createdByUid !== m.uid)
      throw new AppError(
        403,
        'OWNER',
        'Only the uploader can finish this upload',
      );
    if (
      lead.archived ||
      (lead.assignmentRevision !== undefined &&
        lead.assignmentRevision !== record.assignmentRevision) ||
      (record.state === 'Pending' && record.expiresAt <= now())
    )
      throw new AppError(
        409,
        'UPLOAD_EXPIRED',
        'Start a new upload after lead access or assignment changes',
      );
    return record;
  });
  const checksum = validateBytes(bytes, original);
  if (original.state === 'Ready') {
    if (original.checksum !== checksum)
      throw new AppError(
        409,
        'FILE_CONFLICT',
        'This upload already contains a different file',
      );
    return attachmentView(original);
  }
  await files.save(original.objectPath, bytes, original.contentType, checksum);
  return commit(async (tx, m) => {
    const { lead, record } = await attachmentAccess(tx, m, leadId, id);
    if (
      record.createdByUid !== m.uid ||
      lead.archived ||
      (lead.assignmentRevision || 1) !== record.assignmentRevision ||
      record.expiresAt <= now()
    )
      throw new AppError(
        409,
        'UPLOAD_EXPIRED',
        'Start a new upload after lead access or assignment changes',
      );
    if (record.state === 'Ready') {
      if (record.checksum !== checksum)
        throw new AppError(409, 'FILE_CONFLICT', 'Upload conflict');
      return attachmentView(record);
    }
    const ready = {
      ...record,
      state: 'Ready',
      checksum,
      version: record.version + 1,
      completedAt: now(),
    };
    tx.set(path('leadAttachments', id), ready);
    return attachmentView(ready);
  });
}
// Remove access immediately. Physical cleanup waits past every in-flight upload's deadline.
export async function removeAttachment(
  tx,
  m,
  leadId,
  id,
  expectedVersion,
  now,
) {
  const { lead, record } = await attachmentAccess(tx, m, leadId, id);
  if (record.version !== expectedVersion)
    throw new AppError(
      409,
      'STALE_VERSION',
      'Refresh the file list before removing this file',
    );
  tx.set(path('leadAttachments', id), {
    ...record,
    state: 'Deleting',
    version: record.version + 1,
    deleteAfter: new Date(Date.parse(now) + 3600000).toISOString(),
  });
  tx.set(path('leads', leadId), {
    ...lead,
    attachmentCount: Math.max(0, (lead.attachmentCount || 1) - 1),
  });
  return { ok: true };
}
export async function cleanupAttachments({
  store,
  files,
  now = () => new Date().toISOString(),
}) {
  const stats = { removed: 0, failed: 0 };
  for (const state of ['Pending', 'Deleting']) {
    const order = state === 'Pending' ? 'expiresAt' : 'deleteAfter';
    const rows = await store.query(path('leadAttachments'), {
      filters: [['state', '==', state]],
      order,
      direction: 'asc',
      limit: 20,
    });
    for (const row of rows) {
      if (row[order] > now()) break;
      try {
        let current = await store.run(async (tx) => {
          const r = await tx.get(path('leadAttachments', row.id));
          if (!r || r.state !== state || r[order] > now()) return null;
          if (state === 'Pending') {
            const lead = await tx.get(path('leads', r.leadId));
            if (lead)
              tx.set(path('leads', lead.id), {
                ...lead,
                attachmentCount: Math.max(0, (lead.attachmentCount || 1) - 1),
              });
            const deleting = {
              ...r,
              state: 'Deleting',
              version: r.version + 1,
              deleteAfter: new Date(Date.parse(now()) + 3600000).toISOString(),
            };
            tx.set(path('leadAttachments', r.id), deleting);
            return deleting;
          }
          return r;
        });
        if (!current || state === 'Pending') continue;
        await files.delete(current.objectPath);
        const removed = await store.run(async (tx) => {
          const r = await tx.get(path('leadAttachments', row.id));
          if (r?.state === 'Deleting') {
            tx.set(path('leadAttachments', r.id), {
              ...r,
              state: 'Deleted',
              version: r.version + 1,
            });
            return true;
          }
          return false;
        });
        if (removed) stats.removed++;
      } catch {
        stats.failed++;
      }
    }
  }
  return stats;
}
