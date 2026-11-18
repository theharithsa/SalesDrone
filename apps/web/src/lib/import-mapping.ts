import { type FieldOptions, labelFor } from './field-options.ts';
import { legacyImportColumns, worksheetColumns } from './lead-fields.ts';
import { fieldNameKey } from './import-fields.ts';

export const importColumns: Record<string, string> = Object.fromEntries([
  ...worksheetColumns.map(([key, label]) => [label, key]),
  ['Email (optional)', 'email'],
  ['Country code', 'countryCode'],
  ['Sales stage', 'stage'],
  ['Job title', 'jobTitle'],
  ['Website', 'website'],
  ['SalesDrone lead ID (optional)', 'leadId'],
  ['SalesDrone version', 'leadVersion'],
]);

export function matchWorkbookColumns(headers: string[], columns: Record<string,string>, config: FieldOptions, fieldKeys: string[] = []) {
  const used = new Set<number>();
  const mapping: Record<string,string> = {};
  for (const [label, key] of Object.entries(columns)) {
    const aliases = [key, label, labelFor(config,key,label), ...legacyImportColumns.filter(([id]) => id === key).map(([,name]) => name)];
    if (key === 'leadId') aliases.push('SalesDrone lead ID');
    if (key === 'zone') aliases.push('Zone / Sector');
    const names = new Set(aliases.map(fieldNameKey));
    let index = fieldKeys.indexOf(key);
    if (index < 0) index = headers.findIndex((header, i) => !used.has(i) && !fieldKeys[i] && names.has(fieldNameKey(header)));
    mapping[key] = String(index);
    if (index >= 0) used.add(index);
  }
  return mapping;
}

export type ImportedComment = {
  sourceColumn: string;
  sourceIndex: number;
  notes: string;
};
export type MappedImportRow = Record<
  string,
  string | ImportedComment[] | undefined
> & {
  name?: string;
  phone?: string;
  company?: string;
  enquiryDate?: string;
  legacyStatus: string;
  importComments: ImportedComment[];
};
export const isCommentHeader = (header: string) =>
  /comment|note|discussion|follow[\s_-]*up/i.test(header);
export function mapImportRows(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  commentColumns: number[],
): MappedImportRow[] {
  const selected = [...new Set(commentColumns)]
    .filter((i) => i >= 0 && i < headers.length)
    .sort((a, b) => a - b);
  return rows.map((row) => {
    const fields: Record<string, string> = Object.fromEntries(
      Object.entries(mapping)
        .filter(([, index]) => Number(index) >= 0)
        .map(([key, index]) => [key, row[Number(index)] || '']),
    );
    const importComments: ImportedComment[] = selected
      .map((index) => ({
        sourceColumn:
          headers[index].trim().slice(0, 100) || `Column ${index + 1}`,
        sourceIndex: index,
        notes: (row[index] || '').trim(),
      }))
      .filter((comment) => comment.notes);
    return {
      ...fields,
      legacyStatus: fields.legacyStatus || '',
      importComments,
    };
  });
}
