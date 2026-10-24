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
