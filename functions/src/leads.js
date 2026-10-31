import { recordStage } from './journey.js';
import { AppError, LeadInput, parse } from './contracts.js';
import { hash, path, canReadLead } from './policy.js';
export function normalizeLead(value) {
  const l = parse(LeadInput, value);
  if (!l.needsReview && (!l.name || !l.enquiryDate))
    throw new AppError(
      400,
      'REQUIRED',
      'Name and enquiry date are required; incomplete imports must be marked for review',
    );
  const digits = l.phone.replace(/[^0-9]/g, '');
  if (l.phone && !/^\+?[0-9\s().-]+$/.test(l.phone))
    throw new AppError(400, 'PHONE', 'Enter a valid phone number');
  if (l.phone && (digits.length < 7 || digits.length > 15))
    throw new AppError(400, 'PHONE', 'Phone numbers need 7–15 digits');
  if (!l.phone && !l.email && !l.needsReview)
    throw new AppError(400, 'CONTACT', 'Add a phone number or email');
  if (l.email) l.email = l.email.toLowerCase();
  return {
    ...l,
    phoneNormalized: digits
      ? l.phone.trim().startsWith('+')
        ? '+' + digits
        : l.countryCode + digits.replace(/^0/, '')
      : '',
    nameNormalized: l.name.toLowerCase(),
    companyNormalized: l.company.toLowerCase(),
  };
}
export const contactKeys = (l) =>
  [
    l.phoneNormalized ? 'phone:' + l.phoneNormalized : '',
    l.email ? 'email:' + l.email : '',
  ]
    .filter(Boolean)
    .map(hash);
export async function prepareLead(tx, input, { uid, id, now, member }) {
  const lead = normalizeLead(input);
  const keys = contactKeys(lead);
  const matches = await Promise.all(
    keys.map((k) => tx.get(path('dedupeKeys', k))),
  );
  const duplicateIds = [...new Set(matches.flatMap((x) => x?.leadIds || []))];
  if (duplicateIds.length && !lead.allowDuplicate) {
    const records=member?await tx.getAll(duplicateIds.slice(0,100).map(id=>path('leads',id))):[];
    const archived=member?.capabilities?.includes('leads:read') && duplicateIds.length<=100 && records.length===duplicateIds.length && records.every(record=>record&&record.archived&&canReadLead(member,record));
    throw new AppError(409,archived?'DUPLICATE_ARCHIVED':'DUPLICATE',archived?'An archived enquiry uses this contact. Review Archives to restore it.':'A lead with this contact already exists');
  }
  const { allowDuplicate, ...fields } = lead;
  const record = {
    ...fields,
    id,
    assignedToUid: uid,
    assignmentRevision: 1,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
    lastContactAt: null,
    lastCallOutcome: null,
    doNotContact: false,
    suppressionReason: '',
    archived: false,
    version: 1,
  };
  return {
    record,
    write: () => {
      tx.set(path('leads', id), record);
      recordStage(tx, record, null, uid, now, 'created');
      keys.forEach((k, i) =>
        tx.set(path('dedupeKeys', k), {
          id: k,
          leadIds: [...new Set([...(matches[i]?.leadIds || []), id])],
        }),
      );
    },
  };
}
