import { AppError } from './contracts.js';
import { path } from './policy.js';

const fold = (value) => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export function matchesLeadText(lead, query, config) {
  const term = fold(query);
  const fields = ['name', 'company', 'phone', 'email', 'source', 'location', 'zone',
    'stage', 'legacyStatus', 'initialDiscussion', 'comments', 'latestComment'];
  const digits = term.replace(/\D/g, '');
  return fields.some((key) => !config.hiddenFields.includes(key) && fold(lead[key]).includes(term)) ||
    (!config.hiddenFields.includes('phone') && digits.length >= 3 && /^\+?[\d\s().-]+$/.test(term) &&
      [lead.phone, lead.phoneNormalized, lead.originalPhone].some((phone) => String(phone ?? '').replace(/\D/g, '').includes(digits))) ||
    config.customFields.some((field) => !field.deleted && fold(lead.customFields?.[field.id]).includes(term));
}
export async function leadComments(store, leadId) {
  const rows = await store.query(path('activities'), {
    filters: [['leadId', '==', leadId], ['type', '==', 'note']],
    order: '__name__',
    fields: ['id', 'notes', 'createdAt'],
    limit: 201,
  });
  if (rows.length > 200)
    throw new AppError(413, 'LEAD_COMMENT_LIMIT', 'A lead has more than 200 comments. Narrow the search or export.');
  return rows.filter((row) => row.notes).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
}
export const matchesCommentText = (comments, query) =>
  comments.some((row) => fold(row.notes).includes(fold(query)));
