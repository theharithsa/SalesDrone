import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildReportWorkbook } from '../apps/web/src/features/report-workbook.ts';
test('Excel report preserves phone formatting, protects formula-like source text and records filter context', async () => {
  const data = {
    columns: [
      { key: 'name', label: 'Project contact' },
      { key: 'phone', label: 'Phone number' },
    ],
    rows: [
      {
        id: 'demo',
        values: ['=HYPERLINK("https://example.com")', '+001234567'],
      },
    ],
    context: ['Synthetic fixture', 'Filters: city equals Chennai'],
  };
  const file = await buildReportWorkbook(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);
  const sheet = workbook.getWorksheet('Leads')!;
  assert.equal(sheet.getCell('A1').value, 'Project contact');
  assert.equal(sheet.getCell('A2').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('A2').value, data.rows[0].values[0]);
  assert.equal(sheet.getCell('B2').value, '+001234567');
  assert.equal(
    workbook.getWorksheet('Report details')!.getCell('A2').value,
    data.context[1],
  );
  assert.equal(sheet.views[0].state, 'frozen');
});
