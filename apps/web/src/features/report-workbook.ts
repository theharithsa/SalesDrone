import ExcelJS from 'exceljs';
export type ReportData = {
  columns: { key: string; label: string }[];
  rows: { id: string; values: (string | number)[] }[];
  context: string[];
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
  // ExcelJS writes user-entered text as string cells, never formulas or hyperlinks.
  const meta = workbook.addWorksheet('Report details');
  for (const line of context) meta.addRow([String(line)]);
  meta.getColumn(1).width = 100;
  const output = await workbook.xlsx.writeBuffer();
  const buffer =
    output instanceof ArrayBuffer ? output : new Uint8Array(output).buffer;
  return buffer;
}
