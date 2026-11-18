import ExcelJS from 'exceljs';
export type ReportComment = { leadId: string; leadName: string; createdAt: string; text: string };
export type ReportData = {
  columns: { key: string; label: string }[];
  rows: { id: string; version?: number; values: (string | number)[] }[];
  context: string[];
  comments?: ReportComment[];
};
export async function buildReportWorkbook(
  data: ReportData,
): Promise<ArrayBuffer> {
  const { columns, rows, context } = data;
  if (rows.length > 10000 || columns.length > 80)
    throw Error('Report exceeds the safe workbook size. Narrow your filters.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SalesDrone by AvinyaTech';
  const sheet = workbook.addWorksheet('Leads');
  const comments = data.comments ?? [];
  if (comments.length > 10000) throw Error('More than 10,000 comments match. Narrow the filters.');
  const commentsByLead = new Map<string, ReportComment[]>();
  for (const comment of comments) {
    const leadComments = commentsByLead.get(comment.leadId) ?? [];
    leadComments.push(comment);
    commentsByLead.set(comment.leadId, leadComments);
  }
  const commentCount = rows.reduce((max, row) => Math.max(max, commentsByLead.get(row.id)?.length ?? 0), 0);
  sheet.columns = [
    ...columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: ['latestComment', 'comments'].includes(c.key) ? 55 : 24,
    })),
    ...Array.from({ length: commentCount }, (_, index) => ({
      header: 'Comment ' + (index + 1),
      width: 55,
      style: { alignment: { wrapText: true, vertical: 'top' as const } },
    })),
    { header: 'SalesDrone lead ID', width: 40 },
    { header: 'SalesDrone version', width: 22 },
  ];
  // Header notes travel with columns when users reorder them or rename a label.
  columns.forEach((column, i) => { sheet.getCell(1, i + 1).note = 'SalesDrone field: ' + column.key; });
  for (let i = 0; i < commentCount; i++) sheet.getCell(1, columns.length + i + 1).note = 'SalesDrone field: recordedComment';
  const identityColumn = columns.length + commentCount + 1;
  sheet.getCell(1, identityColumn).note = 'SalesDrone field: leadId';
  sheet.getCell(1, identityColumn + 1).note = 'SalesDrone field: leadVersion';
  for (const row of rows) {
    const notes = commentsByLead.get(row.id) ?? [];
    notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const values = row.values.map((value) => typeof value === 'number' ? value : String(value));
    const record = sheet.addRow([...values, ...notes.map(note => note.text)]);
    record.getCell(identityColumn).value = row.id;
    record.getCell(identityColumn + 1).value = row.version ?? null;
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: sheet.columnCount },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF07549F' },
  };
  // ExcelJS writes user-entered text as string cells, never formulas or hyperlinks.
  const meta = workbook.addWorksheet('Report details');
  for (const line of context) meta.addRow([String(line)]);
  meta.addRow(['To update leads, edit the Leads sheet and upload it in Import enquiries. Keep each lead ID and version with its row. Blank cells keep saved values. Recorded comments and system columns are for reference.']);
  meta.getColumn(1).width = 100;
  const output = await workbook.xlsx.writeBuffer();
  const buffer =
    output instanceof ArrayBuffer ? output : new Uint8Array(output).buffer;
  return buffer;
}
