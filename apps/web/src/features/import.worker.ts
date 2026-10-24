/// <reference lib="webworker" />
import ExcelJS from 'exceljs';
self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const bytes = new Uint8Array(e.data);
    if (bytes.length > 10 * 1024 * 1024) throw Error('Workbook exceeds 10 MB.');
    const view = new DataView(e.data);
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
    await workbook.xlsx.load(e.data);
    if (workbook.worksheets.length > 10)
      throw Error('Use a workbook with at most 10 worksheets.');
    const sheets = workbook.worksheets.slice(0, 1).map((sheet) => {
      if (sheet.rowCount > 5025 || sheet.columnCount > 40)
        throw Error(
          'Use at most 5,000 data rows and 40 columns per worksheet.',
        );
      const rows: string[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row) => {
        const values: string[] = [];
        for (let i = 1; i <= Math.min(sheet.columnCount, 40); i++) {
          const cell = row.getCell(i);
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
      return { name: sheet.name, rows };
    });
    self.postMessage({ sheets });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Could not read workbook',
    });
  }
};
