import ExcelJS from 'exceljs';

export async function readWorkbook(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > 10 * 1024 * 1024) throw Error('Workbook exceeds 10 MB.');
  const view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw Error('Workbook is not a valid .xlsx archive.');
  const entries = view.getUint16(end + 10, true);
  if (entries > 10000)
    throw Error('Workbook contains too many archive entries.');
  let cursor = view.getUint32(end + 16, true),
    expanded = 0;
  for (let i = 0; i < entries; i++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw Error('Invalid workbook archive.');
    expanded += view.getUint32(cursor + 24, true);
    if (expanded > 50 * 1024 * 1024)
      throw Error('Workbook expanded content exceeds 50 MB.');
    cursor +=
      46 +
      view.getUint16(cursor + 28, true) +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length > 10)
    throw Error('Use a workbook with at most 10 worksheets.');
  const sheets = workbook.worksheets.slice(0, 1).map((sheet) => {
    if (sheet.rowCount > 5025 || sheet.columnCount > 10082)
      throw Error('Choose up to 5,000 lead rows. Split larger reports before importing.');
    const headers = Array.from({ length: sheet.columnCount }, (_, i) => sheet.getCell(1, i + 1).text.trim());
    const report = headers.includes('SalesDrone version') && headers.includes('SalesDrone lead ID') ||
      (sheet.name === 'Leads' && workbook.getWorksheet('Report details')?.getCell('A1').text === 'SalesDrone by AvinyaTech');
    if (!report && sheet.columnCount > 40) throw Error('Use at most 40 columns per worksheet.');
    const fields = headers.map((_, i) => {
      const note = sheet.getCell(1, i + 1).note;
      const text = typeof note === 'string' ? note : note?.texts?.map(run => run.text).join('') ?? '';
      return /^SalesDrone field: ([a-zA-Z0-9_]+)$/.exec(text)?.[1] ?? '';
    });
    const reference = new Set(['recordedComment', 'latestComment', 'comments', 'assignedToUid', 'lastCallOutcome', 'lastContactAt', 'doNotContact', 'needsReview', 'createdAt']);
    const indices = headers.flatMap((label, i) => report && (reference.has(fields[i]) ||
      (!fields[i] && /^(Comment \d+|Latest comment|Initial comment|Assigned user ID|Last call outcome|Last contacted|Do not contact|Needs review|Created at)$/i.test(label))) ? [] : [i]);
    if (indices.length > 80) throw Error('Use at most 80 editable columns from an exported workbook.');
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values: string[] = [];
      for (const i of indices) {
        const cell = row.getCell(i + 1);
        if (cell.type === ExcelJS.ValueType.Formula)
          values.push('[FORMULA — replace with literal value]');
        else if (cell.value instanceof Date)
          values.push(cell.value.toISOString().slice(0, 10));
        else if (
          cell.value &&
          typeof cell.value === 'object' &&
          'hyperlink' in cell.value
        )
          values.push('[LINK — replace with literal value]');
        else values.push(cell.text || '');
        if (values.at(-1)!.length > 4000)
          throw Error('A cell exceeds 4,000 characters.');
      }
      rows.push(values);
    });
    return { name: sheet.name, rows, report, fieldKeys: report ? indices.map(i => fields[i]) : undefined };
  });
  return sheets;
}
