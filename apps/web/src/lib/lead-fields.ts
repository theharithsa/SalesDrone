export const legacyImportColumns = [
  ['serial', 'Sl No'],
  ['source', 'Enq Source'],
  ['name', 'Name'],
  ['phone', 'Contact No.'],
  ['company', 'Company Name'],
  ['location', 'Location, City'],
  ['zone', 'Sector'],
  ['enquiryDate', 'Enq Date'],
  ['legacyStatus', 'Status'],
  ['initialDiscussion', 'Initial discussion'],
  ['followUp1', '1st follow up'],
  ['followUp2', '2nd follow up'],
  ['followUp3', '3rd follow up'],
  ['followUp4', '4th follow up'],
] as const;
export const worksheetColumns = [
  ['source', 'Enquiry source'],
  ['name', 'Customer name'],
  ['phone', 'Phone number'],
  ['company', 'Company name'],
  ['location', 'City / location'],
  ['zone', 'Sector'],
  ['enquiryDate', 'Enquiry date'],
  ['legacyStatus', 'Enquiry status'],
] as const;
export const filterColumns = [
  ...worksheetColumns,
  ['email', 'Email'],
  ['stage', 'Sales stage'],
  ['latestComment', 'Latest comment'],
  ['comments', 'Other initial comment'],
  ['assignedToUid', 'Assigned user ID'],
  ['lastCallOutcome', 'Last call outcome'],
  ['lastContactAt', 'Last contacted'],
  ['doNotContact', 'Do not contact'],
  ['needsReview', 'Needs review'],
] as const;
export type ColumnFilter = { field: string; op: string; value: string };
export function matchesColumnFilters(
  lead: Record<string, any>,
  filters: ColumnFilter[],
) {
  return filters.every((f) => {
    const raw =
      f.field === 'phone'
        ? lead.phone || lead.originalPhone
        : f.field === 'latestComment'
          ? lead.latestComment || lead.comments || lead.initialDiscussion
          : f.field.startsWith('cf_')
            ? lead.customFields?.[f.field]
            : lead[f.field];
    const value = String(raw ?? '')
        .normalize('NFKC')
        .trim()
        .toLowerCase(),
      term = f.value.trim().toLowerCase();
    return f.op === 'empty'
      ? !value
      : f.op === 'notEmpty'
        ? !!value
        : f.op === 'equals'
          ? value === term
          : f.op === 'startsWith'
            ? value.startsWith(term)
            : f.op === 'before'
              ? !!value && value.slice(0, 10) < term
              : f.op === 'after'
                ? !!value && value.slice(0, 10) > term
                : value.includes(term);
  });
}
export function detectHeaderRow(rows: string[][]) {
  const aliases = new Set([
    'sl no',
    'enq source',
    'enquiry source',
    'customer name',
    'phone number',
    'city / location',
    'enquiry date',
    'name',
    'customer name',
    'contact no.',
    'company name',
    'location, city',
    'sector',
    'zone / sector',
    'enq date',
    'status',
    'initial discussion',
    '1st follow up',
  ]);
  let best = 0,
    score = 0;
  rows.slice(0, 25).forEach((row, index) => {
    const s = row.filter((v) => aliases.has(v.trim().toLowerCase())).length;
    if (s > score) {
      score = s;
      best = index;
    }
  });
  return best;
}
