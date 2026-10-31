import { applyImportStatus, importStatusTarget } from './import-status.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError, LeadInput, } from './contracts.js';
import {
  path,
  hash,
  canReadLead,
  leadAccess,
  assertVersion,
} from './policy.js';
import { previewRows, IMPORT_CHUNK_SIZE } from './imports.js';
import { normalizeLead, contactKeys, prepareLead } from './leads.js';
import {
  readFieldOptions,
  assertFieldOption,
  validateCustomValues,
} from './field-options.js';
import { recordStage } from './journey.js';

export const ImportVersion = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const ImportDecision = ImportVersion.extend({
  action: z.enum(['accept', 'skip', 'create', 'match']),
  leadId: z
    .string()
    .regex(/^[A-Za-z0-9_.:-]{1,150}$/)
    .optional(),
  incomingFields: z.array(z.string().max(100)).max(70).default([]),
  clearFields: z.array(z.string().max(100)).max(30).default([]),
}).strict();
export const ImportDelete = ImportVersion.extend({
  confirmation: z.literal('DELETE IMPORT DETAILS'),
}).strict();
const editable = [
  'name',
  'phone',
  'email',
  'company',
  'jobTitle',
  'source',
  'location',
  'zone',
  'enquiryDate',
  'legacyStatus',
  'stage',
  'countryCode',
  'website',
];
const nameKey = (name) =>
  String(name || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const value = (lead, key) =>
  key.startsWith('cf_')
    ? (lead.customFields?.[key] ?? null)
    : (lead[key] ?? '');
const assign = (lead, key, v) =>
  key.startsWith('cf_')
    ? (lead.customFields = { ...lead.customFields, [key]: v })
    : (lead[key] = v);
const baselinePath = (datasetId, leadId) =>
  path('importBaselines', hash(datasetId + ':' + leadId));
const chunkPath = (id, index) =>
  path(
    'importChunks',
    id + '_' + String(Math.floor(index / IMPORT_CHUNK_SIZE)).padStart(4, '0'),
  );
const tag = (baseline) => hash(JSON.stringify(baseline || null));
const fail = (code, message, status = 409) => {
  throw new AppError(status, code, message);
};
export const sharedImports = (m) =>
  !m.personalAccess &&
  (m.role === 'Admin' || m.capabilities.includes('imports:share'));
export async function readImport(tx, m, id, write = false) {
  const j = await tx.get(path('imports', id));
  if (!j || (j.createdByUid !== m.uid && !sharedImports(m)))
    fail('NOT_FOUND', 'Import not found', 404);
  if (write && !m.capabilities.includes('imports:write'))
    fail('FORBIDDEN', 'Import write permission is required', 403);
  return j;
}
export function importSummary(j) {
  // Never return inline legacy validation errors/source values in job summaries.
  const { errors, ...summary } = j;
  return summary;
}
function changeJob(tx, j, now, change) {
  const next = {
    ...j,
    ...change,
    version: (j.version || 1) + 1,
    updatedAt: now,
  };
  tx.set(path('imports', j.id), next);
  return importSummary(next);
}
function assertDraft(j, version) {
  assertVersion(j, version);
  if (
    j.formatVersion !== 3 ||
    ['Completed', 'Deleting', 'DetailsDeleted'].includes(j.status)
  )
    fail('IMPORT_STATE', 'This import cannot be changed');
}
function normalizeSource(raw, input, options, index) {
  const { leadId, sourceRow, ...originalFields } = raw;
  let transformed;
  try { transformed=applyImportStatus(originalFields,input,options); }
  catch(e){return {index,sourceRow:sourceRow||index+1,error:e.message,decision:'skip',row:null};}
  const fields=transformed.row;
  if (leadId && !/^[A-Za-z0-9_.:-]{1,150}$/.test(leadId))
    return {
      index,
      sourceRow: sourceRow || index + 1,
      error: 'Invalid lead ID',
      decision: 'skip',
    };
  const custom = {};
  for (const f of options.customFields.filter((f) => !f.deleted)) {
    if (!Object.hasOwn(fields, f.id)) continue;
    const rawValue = fields[f.id];
    delete fields[f.id];
    custom[f.id] =
      rawValue === ''
        ? null
        : f.type === 'number'
          ? Number(rawValue)
          : f.type === 'checkbox'
            ? rawValue === 'true'
              ? true
              : rawValue === 'false'
                ? false
                : rawValue
            : rawValue;
  }
  const result = previewRows(
    { ...input, rows: [fields] },
    options.values.stage,
    {stageHidden:!transformed.legacyStageMapping || options.hiddenFields.includes('stage')},
  )[0];
  if (result.row) {
    result.row.customFields = custom;
    try {
      validateCustomValues(options, result.row.customFields, {}, false);
    } catch (e) {
      result.error = e.message;
      result.row = null;
    }
  }
  const mapped = editable.filter((k) => Object.hasOwn(fields, k) && (k!=='stage'||String(fields.stage||'').trim()));
  if (transformed.legacyStageMapping && fields.legacyStatus && !options.hiddenFields.includes('stage') && !mapped.includes('stage')) mapped.push('stage');
  mapped.push(...Object.keys(custom));
  return {
    ...result,
    ...(input.statusField!==undefined?{sourceStatus:String(raw.legacyStatus||'')}:{}),
    index,
    sourceRow:
      Number.isInteger(sourceRow) && sourceRow > 0 ? sourceRow : index + 1,
    suppliedLeadId: leadId || null,
    mapped,
    decision: result.error ? 'skip' : 'pending',
  };
}
export async function createImportReview(tx, m, input, now) {
  const options = await readFieldOptions(tx);
  importStatusTarget(input.statusField,options);
  const source = input.sourceImportId
    ? await readImport(tx, m, input.sourceImportId)
    : null;
  if (source && source.status !== 'Completed')
    fail(
      'IMPORT_SOURCE',
      'Choose a completed import with retained details',
      400,
    );
  const rows = input.rows.map((r, i) => normalizeSource(r, input, options, i));
  // Mark every member of an overlapping workbook group, not just a later row.
  const groups = new Map();
  for (const r of rows.filter((r) => !r.error)) {
    const keys = [
      ...contactKeys(r.row),
      ...(r.row.name ? ['name:' + nameKey(r.row.name)] : []),
      ...(r.suppliedLeadId ? ['id:' + r.suppliedLeadId] : []),
    ];
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r.index);
    }
  }
  for (const indices of groups.values())
    if (indices.length > 1)
      for (const i of indices)
        rows[i].relatedRows = [
          ...new Set([...(rows[i].relatedRows || []), ...indices.slice(0, 20)]),
        ].slice(0, 20);
  for (const r of rows)
    if (r.relatedRows)
      r.relatedSourceRows = r.relatedRows.map((i) => rows[i].sourceRow);
  if (Buffer.byteLength(JSON.stringify(rows)) > 6 * 1024 * 1024)
    fail(
      'IMPORT_SIZE',
      'Parsed import exceeds the safe transaction budget; split the workbook',
      413,
    );
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE)
    if (
      Buffer.byteLength(JSON.stringify(rows.slice(i, i + IMPORT_CHUNK_SIZE))) >
      200 * 1024
    )
      fail(
        'IMPORT_SIZE',
        'A source chunk is too large; split the workbook or reduce comment columns',
        413,
      );
  const id = randomUUID(),
    datasetId = source?.datasetId || source?.id || id;
  const j = {
    id,
    datasetId,
    sourceImportId: source?.id || null,
    filename: input.filename,
    sheet: input.sheet,
    formatVersion: 3,
    newLeadAssigneeUid: m.role === 'Admin' ? null : m.uid,
    duplicateMode: input.duplicateMode,
    ...(input.statusField!==undefined?{statusField:input.statusField}:{}),
    chunkSize: IMPORT_CHUNK_SIZE,
    createdByUid: m.uid,
    createdByName: m.name || m.email || 'Member',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.parse(now) + 86400000).toISOString(),
    version: 1,
    configVersion: options.version,
    total: rows.length,
    valid: rows.filter((r) => !r.error).length,
    invalid: rows.filter((r) => r.error).length,
    blank: input.blankRows,
    needsReview: rows.filter((r) => r.row?.needsReview).length,
    offset: 0,
    planOffset: 0,
    reviewOffset: 0,
    pending: 0,
    imported: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    planCounts: {},
    status: rows.length ? 'Preparing' : 'Completed',
  };
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE)
    tx.set(chunkPath(id, i), {
      id: id + '_' + String(i / IMPORT_CHUNK_SIZE).padStart(4, '0'),
      importId: id,
      rows: rows.slice(i, i + IMPORT_CHUNK_SIZE),
    });
  tx.set(path('imports', id), j);
  return j;
}
async function candidates(tx, m, row) {
  const ids = new Set();
  for (const key of contactKeys(row.row)) {
    const keyDoc = await tx.get(path('dedupeKeys', key));
    if ((keyDoc?.leadIds?.length || 0) > 20)
      return { restricted: true, leads: [] };
    for (const id of keyDoc?.leadIds || []) ids.add(id);
  }
  if (row.suppliedLeadId) ids.add(row.suppliedLeadId);
  const names = row.row.name
    ? await tx.query(path('leads'), {
        filters: [['nameNormalized', '==', row.row.name.trim().toLowerCase()]],
        limit: 21,
      })
    : [];
  for (const l of names) ids.add(l.id);
  if (ids.size > 20) return { restricted: true, leads: [] };
  const leads = (
    await Promise.all([...ids].map((id) => tx.get(path('leads', id))))
  ).filter(Boolean);
  if (leads.some((l) => !canReadLead(m, l)))
    return { restricted: true, leads: [] };
  return { restricted: false, leads };
}
async function compare(tx, j, r, lead) {
  const baseline = await tx.get(baselinePath(j.datasetId, lead.id));
  const changes = [],
    patch = {};
  for (const key of r.mapped) {
    const incoming = value(r.row, key),
      current = value(lead, key);
    if (incoming === '' || incoming === null || same(incoming, current))
      continue;
    if (
      baseline &&
      Object.hasOwn(baseline.values, key) &&
      same(incoming, baseline.values[key])
    )
      continue;
    const conflict =
      !baseline ||
      !Object.hasOwn(baseline.values, key) ||
      !same(current, baseline.values[key]);
    changes.push({
      key,
      current,
      incoming,
      conflict,
      ...(baseline && Object.hasOwn(baseline.values, key)
        ? { previous: baseline.values[key] }
        : {}),
    });
    if (!conflict) patch[key] = incoming;
  }
  const comments = [],
    seen = new Map();
  for (const c of r.comments || []) {
    const label = nameKey(c.sourceColumn),
      ordinal = seen.get(label) || 0;
    seen.set(label, ordinal + 1);
    const key = hash(label + ':' + ordinal),
      prior = baseline?.comments?.[key],
      activity = prior
        ? await tx.get(path('activities', prior.activityId))
        : null;
    if (prior && c.notes === prior.notes) continue;
    if (activity?.notes === c.notes) continue;
    comments.push({
      key,
      sourceColumn: c.sourceColumn,
      sourceIndex: c.sourceIndex,
      incoming: c.notes,
      current: activity?.notes || null,
      activityId: activity?.id || null,
      revision: activity?.revision || null,
      conflict:
        !baseline ||
        (!prior && Object.keys(baseline.comments || {}).length > 0) ||
        (!!prior &&
          (!activity ||
            activity.notes !== prior.notes ||
            prior.sourceIndex !== c.sourceIndex)) ||
        !!activity?.autoReminder,
    });
  }
  return {
    ...r,
    leadId: lead.id,
    expectedLeadVersion: lead.version,
    baselineTag: tag(baseline),
    changes,
    patch,
    commentChanges: comments,
    initialComparison: !baseline,
    classification: changes.length || comments.length ? 'Update' : 'Unchanged',
    reason: !baseline
      ? 'No previous source baseline; compare explicitly'
      : 'Matched existing lead',
  };
}
async function planRow(tx, m, j, r, forcedId) {
  if (r.error) return { ...r, classification: 'Invalid', decision: 'skip' };
  const found = await candidates(tx, m, r);
  if (found.restricted)
    return {
      ...r,
      candidates: [],
      classification: 'Restricted',
      reason: 'Cannot process this row with current lead access',
      decision: 'pending',
    };
  const summaries = found.leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    company: l.company,
    archived: l.archived,
  }));
  const base = { ...r, candidates: summaries, decision: 'pending' };
  const contacts = contactKeys(r.row),
    contactLeads = found.leads.filter((l) =>
      contactKeys(l).some((k) => contacts.includes(k)),
    );
  let match = forcedId
    ? await leadAccess(tx, m, forcedId)
    : r.suppliedLeadId
      ? found.leads.find((l) => l.id === r.suppliedLeadId)
      : null;
  if (
    !match &&
    !r.suppliedLeadId &&
    contactLeads.length === 1 &&
    nameKey(contactLeads[0].name) === nameKey(r.row.name)
  )
    match = contactLeads[0];
  if (j.duplicateMode === 'keep' && !forcedId)
    return {
      ...base,
      classification: 'New',
      reason: 'Explicitly keep separate enquiries',
    };
  if (
    j.duplicateMode === 'skip' &&
    contactLeads.length === 1 &&
    match &&
    !forcedId &&
    nameKey(match.name) === nameKey(r.row.name)
  )
    return {
      ...base,
      classification: 'Duplicate',
      reason: 'Existing name and contact match',
    };
  if ((r.relatedRows?.length || 0) > 1 && !forcedId)
    return {
      ...base,
      classification: 'Conflict',
      reason: 'Overlapping rows in this workbook; choose an action for each',
    };
  if (match && contactLeads.some((l) => l.id !== match.id))
    return {
      ...base,
      classification: 'Conflict',
      reason: 'Phone or email belongs to another lead',
    };
  if (match?.archived)
    return {
      ...base,
      classification: 'Conflict',
      reason: 'Archived leads cannot be updated by import',
    };
  if (match && j.duplicateMode === 'update') return compare(tx, j, base, match);
  if (found.leads.length || r.suppliedLeadId)
    return {
      ...base,
      classification: 'Conflict',
      reason: 'Name/contact do not identify one lead; select a match or skip',
    };
  try {
    validateCustomValues(await readFieldOptions(tx), r.row.customFields);
  } catch (e) {
    return {
      ...base,
      classification: 'Invalid',
      error: e.message,
      decision: 'skip',
    };
  }
  return { ...base, classification: 'New', reason: 'No existing match' };
}
export async function planImportChunk(tx, m, id, input, now) {
  const j = await readImport(tx, m, id, true);
  assertDraft(j, input.expectedVersion);
  if (j.status !== 'Preparing') fail('IMPORT_STATE', 'Import is not preparing');
  const c = await tx.get(chunkPath(id, j.planOffset));
  if (!c) fail('IMPORT_CHUNK', 'Import chunk missing');
  const rows = [];
  for (const r of c.rows) {
    const source = Object.fromEntries(
      [
        'index',
        'sourceRow',
        'sourceStatus',
        'error',
        'row',
        'comments',
        'mapped',
        'suppliedLeadId',
        'relatedRows',
        'relatedSourceRows',
        'warnings',
      ]
        .filter((k) => Object.hasOwn(r, k))
        .map((k) => [k, r[k]]),
    );
    rows.push(await planRow(tx, m, j, source));
  }
  if (Buffer.byteLength(JSON.stringify(rows)) > 850 * 1024)
    fail(
      'IMPORT_SIZE',
      'Comparison chunk is too large; split the workbook',
      413,
    );
  tx.set(path('importChunks', c.id), { ...c, rows });
  const planOffset = rows.at(-1).index + 1;
  const planCounts = { ...j.planCounts };
  for (const r of rows.filter((r) => r.index >= j.planOffset))
    planCounts[r.classification] = (planCounts[r.classification] || 0) + 1;
  return changeJob(tx, j, now, {
    planOffset,
    planCounts,
    pending:
      j.pending +
      rows.filter((r) => r.index >= j.planOffset && r.decision === 'pending')
        .length,
    status: planOffset >= j.total ? 'Preview' : 'Preparing',
  });
}
export async function visibleImportRows(tx, m, j, rows) {
  const result = [];
  for (const r of rows) {
    const lead = r.leadId ? await tx.get(path('leads', r.leadId)) : null;
    const own = j.createdByUid === m.uid || m.scope === 'all';
    if (!own && !canReadLead(m, lead)) {
      result.push({
        index: r.index,
        sourceRow: r.sourceRow,
        classification: 'Restricted',
        decision: r.decision,
        reason: 'Row details require lead access',
      });
      continue;
    }
    const safe = { ...r };
    delete safe.baselineTag;
    delete safe.patch;
    safe.candidates = [];
    for (const c of r.candidates || []) {
      const current = await tx.get(path('leads', c.id));
      if (canReadLead(m, current))
        safe.candidates.push({
          id: current.id,
          name: current.name,
          phone: current.phone,
          email: current.email,
          company: current.company,
          archived: current.archived,
        });
    }
    if (r.leadId && !canReadLead(m, lead)) {
      delete safe.leadId;
      delete safe.expectedLeadVersion;
      delete safe.changes;
      delete safe.commentChanges;
      safe.classification = 'Restricted';
      safe.reason = 'Lead access changed';
    }
    result.push(safe);
  }
  return result;
}
export async function decideImportRow(tx, m, id, index, input, now) {
  const j = await readImport(tx, m, id, true);
  assertDraft(j, input.expectedVersion);
  if (index < j.offset || j.status !== 'Preview')
    fail(
      'IMPORT_STATE',
      'Refresh remaining matches before changing a running import',
    );
  const c = await tx.get(chunkPath(id, index)),
    row = c?.rows.find((r) => r.index === index);
  if (!row) fail('NOT_FOUND', 'Row not found', 404);
  let next = row;
  if (input.action === 'skip') next = { ...row, decision: 'skip' };
  else {
    next = await planRow(
      tx,
      m,
      j,
      row,
      input.action === 'match' ? input.leadId : row.leadId,
    );
    if (input.action === 'match' && !input.leadId)
      fail('IMPORT_MATCH', 'Choose a lead', 400);
    if (input.action === 'match') {
      if (!['Update', 'Unchanged'].includes(next.classification))
        fail('IMPORT_MATCH', 'This target cannot be updated');
    } else if (input.action === 'create') {
      if (row.suppliedLeadId)
        fail(
          'IMPORT_MATCH',
          'Clear the mapped lead ID before creating a different lead',
          400,
        );
      const found = await candidates(tx, m, row);
      if (
        found.restricted ||
        found.leads.some((l) =>
          contactKeys(l).some((k) => contactKeys(row.row).includes(k)),
        )
      )
        fail(
          'IMPORT_MATCH',
          'A contact already exists; select a match or skip',
        );
      next = {
        ...row,
        classification: 'New',
        decision: 'accept',
        reason: 'Explicit create after review',
      };
    } else {
      if (
        !['Update', 'Unchanged', 'New', 'Duplicate'].includes(
          next.classification,
        )
      )
        fail('IMPORT_MATCH', 'Resolve the match or skip this row');
      const allowed = new Set((next.changes || []).map((c) => c.key));
      for (const key of input.incomingFields)
        if (
          !allowed.has(key) &&
          !(next.commentChanges || []).some((c) => 'comment:' + c.key === key)
        )
          fail('IMPORT_FIELD', 'Choose a displayed field', 400);
      const patch = {};
      for (const c of next.changes || [])
        if (input.incomingFields.includes(c.key)) patch[c.key] = c.incoming;
      for (const key of input.clearFields) {
        if (
          !['Update', 'Unchanged'].includes(next.classification) ||
          !row.mapped.includes(key) ||
          ['name', 'enquiryDate', 'stage', 'countryCode'].includes(key)
        )
          fail(
            'IMPORT_FIELD',
            'Only mapped optional fields may be cleared',
            400,
          );
        patch[key] = key.startsWith('cf_') ? null : '';
        const existing = next.changes.find((c) => c.key === key);
        const current = value(await tx.get(path('leads', next.leadId)), key);
        if (existing) {
          existing.incoming = patch[key];
          existing.explicitClear = true;
        } else
          next.changes.push({
            key,
            current,
            incoming: patch[key],
            conflict: true,
            explicitClear: true,
          });
      }
      next = {
        ...next,
        patch,
        clearFields: input.clearFields,
        incomingFields: input.incomingFields,
        classification:
          next.classification === 'Unchanged' && Object.keys(patch).length
            ? 'Update'
            : next.classification,
        commentChanges: (next.commentChanges || []).filter((c) =>
          input.incomingFields.includes('comment:' + c.key),
        ),
        decision: next.classification === 'Duplicate' ? 'skip' : 'accept',
      };
    }
  }
  if (
    next.decision === 'accept' &&
    ['Update', 'Unchanged'].includes(next.classification)
  )
    await prepareUpdate(tx, m, j, next, now, await readFieldOptions(tx));
  next = { ...next, reviewedByUid: m.uid };
  tx.set(path('importChunks', c.id), {
    ...c,
    rows: c.rows.map((r) => (r.index === index ? next : r)),
  });
  const planCounts = { ...j.planCounts };
  if (next.classification !== row.classification) {
    planCounts[row.classification] = (planCounts[row.classification] || 1) - 1;
    planCounts[next.classification] =
      (planCounts[next.classification] || 0) + 1;
  }
  return changeJob(tx, j, now, {
    planCounts,
    pending:
      j.pending -
      Number(row.decision === 'pending') +
      Number(next.decision === 'pending'),
    reviewedByUid: m.uid,
  });
}
export async function approveImportChunk(tx, m, id, input, now) {
  const j = await readImport(tx, m, id, true);
  assertDraft(j, input.expectedVersion);
  if (j.status !== 'Preview' || j.reviewOffset >= j.total)
    fail('IMPORT_STATE', 'Review is not available');
  const c = await tx.get(chunkPath(id, j.reviewOffset));
  let resolved = 0;
  const rows = c.rows.map((r) => {
    if (r.index < j.reviewOffset || r.decision !== 'pending') return r;
    if (
      ['New', 'Duplicate', 'Unchanged'].includes(r.classification) ||
      (r.classification === 'Update' &&
        !r.initialComparison &&
        !r.changes.some((c) => c.conflict) &&
        !r.commentChanges.some((c) => c.conflict))
    ) {
      resolved++;
      return {
        ...r,
        reviewedByUid: m.uid,
        decision: r.classification === 'Duplicate' ? 'skip' : 'accept',
      };
    }
    return r;
  });
  if (Buffer.byteLength(JSON.stringify(rows)) > 850 * 1024)
    fail(
      'IMPORT_SIZE',
      'Comparison chunk is too large; split the workbook',
      413,
    );
  tx.set(path('importChunks', c.id), { ...c, rows });
  return changeJob(tx, j, now, {
    reviewOffset: rows.at(-1).index + 1,
    pending: j.pending - resolved,
    reviewedByUid: m.uid,
  });
}
async function prepareUpdate(tx, m, j, r, now, options) {
  if (!m.capabilities.includes('leads:edit'))
    fail('FORBIDDEN', 'Lead edit permission is required', 403);
  const old = await leadAccess(tx, m, r.leadId);
  assertVersion(old, r.expectedLeadVersion);
  if (old.archived) fail('ARCHIVED', 'Archived leads cannot be updated');
  const baseline = await tx.get(baselinePath(j.datasetId, old.id));
  if (tag(baseline) !== r.baselineTag)
    fail(
      'STALE_VERSION',
      'Source comparison changed; refresh remaining matches',
    );
  const candidate = { ...old, customFields: { ...old.customFields } };
  for (const [k, v] of Object.entries(r.patch || {})) assign(candidate, k, v);
  assertFieldOption(options, 'stage', candidate.stage, old.stage);
  validateCustomValues(
    options,
    candidate.customFields,
    old.customFields || {},
    false,
  );
  for (const f of options.customFields.filter((f) => f.required && !f.deleted))
    if (
      Object.hasOwn(r.patch || {}, f.id) &&
      [null, '', false, undefined].includes(candidate.customFields[f.id])
    )
      fail(
        'CUSTOM_FIELD_REQUIRED',
        'A required custom value cannot be cleared',
        400,
      );
  const base = Object.fromEntries(
    Object.keys(LeadInput.shape)
      .filter((k) => k in candidate)
      .map((k) => [k, candidate[k]]),
  );
  const { allowDuplicate, ...normalized } = normalizeLead(base);
  const keys = [...new Set([...contactKeys(old), ...contactKeys(normalized)])],
    docs = [];
  for (const key of keys) docs.push(await tx.get(path('dedupeKeys', key)));
  if (
    docs.some(
      (d, i) =>
        contactKeys(normalized).includes(keys[i]) &&
        d?.leadIds.some((id) => id !== old.id),
    )
  )
    fail('DUPLICATE', 'Contact matching changed; refresh remaining matches');
  const comments = [];
  for (const c of r.commentChanges || []) {
    const previous = c.activityId
      ? await tx.get(path('activities', c.activityId))
      : null;
    if (previous?.autoReminder)
      fail(
        'DISCUSSION_REVIEW',
        'Correct reminder-linked discussions from the lead timeline',
      );
    if (c.activityId && (!previous || previous.revision !== c.revision))
      fail('STALE_VERSION', 'A discussion changed; refresh remaining matches');
    comments.push({ c, previous });
  }
  const changed =
    Object.keys(r.patch || {}).some(
      (k) => !same(value(old, k), value(candidate, k)),
    ) || comments.length > 0;
  const updated = changed
    ? { ...old, ...normalized, version: old.version + 1, updatedAt: now }
    : old;
  return {
    record: updated,
    changed,
    write: () => {
      if (changed) {
        tx.set(path('leads', old.id), updated);
        recordStage(tx, updated, old.stage, m.uid, now, 'edited');
        const aid = hash(j.id + ':change:' + r.index);
        tx.set(path('activities', aid), {
          id: aid,
          leadId: old.id,
          type: 'change',
          notes: 'Lead updated from a reviewed workbook',
          actorUid: m.uid,
          createdAt: now,
        });
        keys.forEach((k, i) =>
          tx.set(path('dedupeKeys', k), {
            id: k,
            leadIds: [
              ...(docs[i]?.leadIds || []).filter((id) => id !== old.id),
              ...(contactKeys(normalized).includes(k) ? [old.id] : []),
            ],
          }),
        );
      }
    },
    comments,
    baseline,
  };
}
function sourceBaseline(tx, j, r, lead, m, now, oldBaseline, comments) {
  const values = { ...oldBaseline?.values };
  for (const k of r.mapped) {
    const v = value(r.row, k);
    if ((v !== '' && v !== null) || Object.hasOwn(r.patch || {}, k))
      values[k] = v;
  }
  const priorComments = { ...oldBaseline?.comments };
  for (const { c, previous } of comments) {
    const aid =
      previous?.id || hash(j.datasetId + ':' + lead.id + ':comment:' + c.key);
    if (previous)
      tx.set(path('activityRevisions', aid + '_' + previous.revision), {
        ...previous,
        id: aid + '_' + previous.revision,
        activityId: aid,
        replacedAt: now,
        replacedByUid: m.uid,
      });
    const activity = {
      ...(previous || {}),
      id: aid,
      leadId: lead.id,
      type: 'note',
      notes: c.incoming,
      actorUid: m.uid,
      createdAt: previous?.createdAt || now,
      revision: (previous?.revision || 0) + 1,
      sourceColumn: c.sourceColumn,
      sourceColumnIndex: c.sourceIndex,
      sourceOrder: c.sourceIndex,
      occurredAt: previous?.occurredAt || null,
      importId: j.id,
      imported: true,
    };
    tx.set(path('activities', aid), activity);
    priorComments[c.key] = {
      notes: c.incoming,
      activityId: aid,
      sourceIndex: c.sourceIndex,
    };
  }
  // Kept-current conflicts still advance the source baseline, not the lead value.
  const seen = new Map();
  for (const c of r.comments || []) {
    const label = nameKey(c.sourceColumn),
      n = seen.get(label) || 0;
    seen.set(label, n + 1);
    const key = hash(label + ':' + n);
    priorComments[key] = {
      activityId: null,
      ...priorComments[key],
      notes: c.notes,
      sourceIndex: c.sourceIndex,
    };
  }
  const id = hash(j.datasetId + ':' + lead.id);
  tx.set(baselinePath(j.datasetId, lead.id), {
    id,
    datasetId: j.datasetId,
    leadId: lead.id,
    lastImportId: j.id,
    values,
    comments: priorComments,
    updatedAt: now,
  });
}
export async function commitImportReview(tx, m, id, input, now) {
  const j = await readImport(tx, m, id, true);
  if (j.status === 'Completed') return importSummary(j);
  assertDraft(j, input.expectedVersion);
  if (j.planOffset < j.total || j.reviewOffset < j.total || j.pending)
    fail(
      'IMPORT_REVIEW',
      'Finish planning and resolve every pending row before importing',
    );
  if (!j.offset && j.expiresAt <= now)
    return changeJob(tx, j, now, { status: 'Blocked', lastError: 'EXPIRED' });
  const options = await readFieldOptions(tx);
  importStatusTarget(j.statusField,options);
  if (options.version !== j.configVersion)
    return changeJob(tx, j, now, {
      status: 'Blocked',
      lastError: 'FIELD_CONFIGURATION_CHANGED',
    });
  const c = await tx.get(chunkPath(id, j.offset));
  if (!c) fail('IMPORT_CHUNK', 'Import chunk missing');
  const updateTargets = new Set();
  const reserved = new Map(),
    plans = [],
    counts = {
      imported: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      duplicates: 0,
    };
  try {
    let budget = 0;
    for (const r of c.rows.filter((r) => r.index >= j.offset)) {
      const cost =
        8 + 2 * (r.commentChanges?.length || r.comments?.length || 0);
      if (budget + cost > 300 && plans.length) break;
      budget += cost;
      if (r.decision === 'pending') fail('IMPORT_REVIEW', 'Pending row');
      if (r.decision === 'skip' || r.error) {
        plans.push({
          r,
          outcome: r.classification === 'Duplicate' ? 'Duplicate' : 'Skipped',
        });
        counts.skipped++;
        if (r.classification === 'Duplicate') counts.duplicates++;
        continue;
      }
      if (r.classification === 'New') {
        if (!m.capabilities.includes('leads:create'))
          fail('FORBIDDEN', 'Lead create permission is required', 403);
        const found = await candidates(tx, m, r);
        if (
          found.restricted ||
          (j.duplicateMode !== 'keep' &&
            found.leads.some((l) =>
              contactKeys(l).some((k) => contactKeys(r.row).includes(k)),
            ))
        )
          fail('STALE_VERSION', 'New contact matching changed');
        validateCustomValues(options, r.row.customFields);
        assertFieldOption(options, 'stage', r.row.stage);
        const { phoneNormalized, nameNormalized, companyNormalized, ...raw } =
          r.row;
        const prepared = await prepareLead(
          tx,
          { ...raw, allowDuplicate: j.duplicateMode === 'keep' },
          {
            uid: m.uid,
            id: hash(j.id + ':' + r.index).slice(0, 40),
            now,
          },
        );
        prepared.record.assignedToUid = j.newLeadAssigneeUid;
        if (!canReadLead(m, prepared.record))
          fail(
            'FORBIDDEN',
            'The planned assignment is outside your scope',
            403,
          );
        if (j.newLeadAssigneeUid) {
          const target = await tx.get(path('members', j.newLeadAssigneeUid));
          if (!target?.active || !target.capabilities.includes('leads:read'))
            fail('ASSIGNEE', 'The planned owner is no longer active');
        }
        prepared.record.createdByUid = m.uid;
        prepared.record.importId = j.id;
        for (const key of contactKeys(prepared.record)) {
          if (j.duplicateMode !== 'keep' && reserved.has(key))
            fail('IMPORT_MATCH', 'Workbook contacts overlap');
          if (!reserved.has(key))
            reserved.set(
              key,
              new Set((await tx.get(path('dedupeKeys', key)))?.leadIds || []),
            );
          reserved.get(key).add(prepared.record.id);
        }
        const seen = new Map(),
          comments = (r.comments || []).map((comment) => {
            const label = nameKey(comment.sourceColumn),
              n = seen.get(label) || 0;
            seen.set(label, n + 1);
            return {
              c: {
                ...comment,
                incoming: comment.notes,
                key: hash(label + ':' + n),
              },
              previous: null,
            };
          });
        plans.push({ r, prepared, comments, outcome: 'Created' });
        counts.imported++;
      } else {
        if (updateTargets.has(r.leadId))
          fail(
            'IMPORT_MATCH',
            'Multiple source rows update one lead; keep one and skip the others',
          );
        updateTargets.add(r.leadId);
        const prepared = await prepareUpdate(tx, m, j, r, now, options);
        plans.push({
          r,
          prepared,
          comments: prepared.comments,
          outcome: prepared.changed ? 'Updated' : 'Unchanged',
        });
        counts[prepared.changed ? 'updated' : 'unchanged']++;
      }
    }
    if (
      Buffer.byteLength(JSON.stringify(plans.map((p) => p.prepared?.record))) >
      2 * 1024 * 1024
    )
      fail('IMPORT_SIZE', 'Stored rows exceed the chunk budget');
  } catch (e) {
    // No domain writes have been queued before all row plans validate.
    return changeJob(tx, j, now, {
      status: 'Blocked',
      lastError: ['FORBIDDEN', 'NOT_FOUND'].includes(e.code)
        ? 'ACCESS_CHANGED'
        : e.code || 'IMPORT_FAILED',
      executedByUid: m.uid,
    });
  }
  for (const p of plans)
    if (p.prepared) {
      p.prepared.write();
      sourceBaseline(
        tx,
        j,
        p.r,
        p.prepared.record,
        m,
        now,
        p.prepared.baseline,
        p.comments,
      );
    }
  for (const [key, ids] of reserved)
    tx.set(path('dedupeKeys', key), { id: key, leadIds: [...ids] });
  tx.set(path('importChunks', c.id), {
    ...c,
    rows: c.rows.map((r) => {
      const p = plans.find((p) => p.r.index === r.index);
      return p
        ? {
            ...p.r,
            outcome: p.outcome,
            leadId: p.prepared?.record.id || p.r.leadId || null,
            committedAt: now,
            committedByUid: m.uid,
          }
        : r;
    }),
  });
  const offset = plans.at(-1).r.index + 1,
    change = {
      offset,
      status: offset >= j.total ? 'Completed' : 'Importing',
      executedByUid: m.uid,
      lastError: null,
    };
  for (const key of Object.keys(counts))
    change[key] = (j[key] || 0) + counts[key];
  if (offset >= j.total) change.completedAt = now;
  return changeJob(tx, j, now, change);
}
export async function refreshImportReview(tx, m, id, input, now) {
  const j = await readImport(tx, m, id, true);
  assertDraft(j, input.expectedVersion);
  const options = await readFieldOptions(tx);
  return changeJob(tx, j, now, {
    planOffset: j.offset,
    reviewOffset: j.offset,
    pending: 0,
    planCounts: {},
    configVersion: options.version,
    status: 'Preparing',
    expiresAt: new Date(Date.parse(now) + 86400000).toISOString(),
    lastError: null,
  });
}
export async function deleteImportDetails(tx, m, id, input, now) {
  if (m.role !== 'Admin' || m.personalAccess)
    fail(
      'FORBIDDEN',
      'Only Google-signed-in administrators can delete import details',
      403,
    );
  const j = await readImport(tx, m, id);
  assertVersion(j, input.expectedVersion);
  if (j.status === 'DetailsDeleted') return importSummary(j);
  const rows = await tx.query(path('importChunks'), {
    filters: [['importId', '==', id]],
    limit: 50,
  });
  const baselines = rows.length
    ? []
    : await tx.query(path('importBaselines'), {
        filters: [['datasetId', '==', j.datasetId || id]],
        limit: 50,
      });
  for (const d of rows) tx.delete(path('importChunks', d.id));
  for (const d of baselines) tx.delete(path('importBaselines', d.id));
  const done = !rows.length && !baselines.length;
  const { errors, ...kept } = j;
  return changeJob(tx, kept, now, {
    status: done ? 'DetailsDeleted' : 'Deleting',
    filename: done ? 'Details deleted' : j.filename,
    sheet: done ? 'Details deleted' : j.sheet,
    detailsDeletedByUid: m.uid,
    ...(done ? { detailsDeletedAt: now } : {}),
    pending: 0,
  });
}
