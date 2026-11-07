import ExcelJS from 'exceljs';
export type ReportComment = { leadId: string; leadName: string; createdAt: string; text: string };
export type ReportData = {
  columns: { key: string; label: string }[];
  rows: { id: string; values: (string | number)[] }[];
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
  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: ['latestComment', 'comments'].includes(c.key) ? 55 : 24,
  }));
  for (const row of rows)
    sheet.addRow(
      row.values.map((v) => (typeof v === 'number' ? v : String(v))),
    );
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF07549F' },
  };
  if (data.comments) {
    if (data.comments.length > 10000) throw Error('More than 10,000 comments match. Narrow the filters.');
    const comments = workbook.addWorksheet('Lead comments');
    const rowNumbers = new Map(rows.map((row, i) => [row.id, i + 2]));
    comments.columns = [
      { header: 'Row in Leads', width: 16 },
      { header: 'Lead ID', width: 28 },
      { header: 'Customer name', width: 24 },
      { header: 'Recorded at', width: 26 },
      { header: 'Comment', width: 70 },
    ];
    for (const comment of data.comments)
      comments.addRow([rowNumbers.get(comment.leadId), String(comment.leadId),
        String(comment.leadName), String(comment.createdAt), String(comment.text)]);
    comments.views = [{ state: 'frozen', ySplit: 1 }];
    comments.getRow(1).font = { bold: true };
    comments.getColumn(5).alignment = { wrapText: true, vertical: 'top' };
  }
  // ExcelJS writes user-entered text as string cells, never formulas or hyperlinks.
  const meta = workbook.addWorksheet('Report details');
  for (const line of context) meta.addRow([String(line)]);
  meta.getColumn(1).width = 100;
  const output = await workbook.xlsx.writeBuffer();
  const buffer =
    output instanceof ArrayBuffer ? output : new Uint8Array(output).buffer;
  return buffer;
}
