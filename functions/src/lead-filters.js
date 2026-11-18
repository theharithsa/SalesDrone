import { z } from 'zod';
import { AppError, IsoDate, parse } from './contracts.js';
export const FILTER_FIELDS = [
  'serial',
  'source',
  'name',
  'phone',
  'email',
  'company',
  'location',
  'zone',
  'enquiryDate',
  'legacyStatus',
  'stage',
  'initialDiscussion',
  'followUp1',
  'followUp2',
  'followUp3',
  'followUp4',
  'comments',
  'latestComment',
  'assignedToUid',
  'lastCallOutcome',
  'lastContactAt',
  'doNotContact',
  'needsReview',
];
export const LeadFilters = z
  .array(
    z
      .object({
        field: z.union([
          z.enum(FILTER_FIELDS),
          z.string().regex(/^cf_[a-z0-9_]{1,60}$/),
        ]),
        op: z.enum([
          'contains',
          'equals',
          'exact',
          'startsWith',
          'empty',
          'notEmpty',
          'before',
          'after',
        ]),
        value: z.string().max(400).default(''),
      })
      .strict(),
  )
  .max(16);
const normalized = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en');
export function parseLeadFilters(raw) {
  if (typeof raw !== 'string' || raw.length > 12000)
    throw new AppError(400, 'FILTER', 'Invalid column filters');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'FILTER', 'Column filters must be valid JSON');
  }
  const filters = parse(LeadFilters, data);
  for (const f of filters) {
    if (f.op === 'exact' && !['stage','source','company'].includes(f.field) && !f.field.startsWith('cf_'))
      throw new AppError(400, 'FILTER', 'Exact match supports company, source, stage and custom dropdown fields');
    if (!['empty', 'notEmpty'].includes(f.op) && !(f.op === 'exact' ? f.value.length : f.value.trim()))
      throw new AppError(400, 'FILTER', 'Enter a filter value');
    if (
      ['before', 'after'].includes(f.op) &&
      (!(f.field === 'enquiryDate' || f.field === 'lastContactAt' || f.field.startsWith('cf_')) ||
        !IsoDate.safeParse(f.value).success)
    )
      throw new AppError(
        400,
        'FILTER',
        'Date comparisons need a valid YYYY-MM-DD date',
      );
  }
  return filters;
}
export function matchesLead(lead, filters) {
  return filters.every((f) => {
    const raw =
      f.field === 'phone'
        ? lead.phone || lead.originalPhone
        : f.field === 'latestComment'
          ? lead.latestComment || lead.comments || lead.initialDiscussion
          : f.field.startsWith('cf_')
            ? lead.customFields?.[f.field]
            : lead[f.field];
    if (f.op === 'exact') return f.field === 'company'
      ? String(raw ?? '').trim().toLowerCase() === f.value.trim().toLowerCase()
      : raw === f.value;
    const value = normalized(raw),
      term = normalized(f.value);
    if (f.op === 'empty') return !value;
    if (f.op === 'notEmpty') return !!value;
    if (f.op === 'equals') return value === term;
    if (f.op === 'startsWith') return value.startsWith(term);
    if (f.op === 'before') return !!value && value.slice(0, 10) < term;
    if (f.op === 'after') return !!value && value.slice(0, 10) > term;
    return value.includes(term);
  });
}
