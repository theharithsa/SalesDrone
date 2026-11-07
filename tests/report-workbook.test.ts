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
      { id: 'second', values: ['Second lead', '001234568'] },
      { id: 'third', values: ['Third lead', '001234569'] },
    ],
    comments: [
      { leadId: 'demo', leadName: 'Example', createdAt: '2026-11-02T00:00:00Z', text: 'Follow-up' },
      { leadId: 'second', leadName: 'Second lead', createdAt: '2026-11-02T00:00:00Z', text: 'Second lead only' },
      { leadId: 'demo', leadName: 'Example', createdAt: '2026-11-01T00:00:00Z', text: '=SUM(1,2)' },
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
  assert.equal(workbook.getWorksheet('Lead comments'), undefined);
  assert.equal(sheet.getCell('C1').value, 'Comment 1');
  assert.equal(sheet.getCell('D1').value, 'Comment 2');
  assert.equal(sheet.getCell('C2').value, '=SUM(1,2)');
  assert.equal(sheet.getCell('C2').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('D2').value, 'Follow-up');
  assert.equal(sheet.getCell('C3').value, 'Second lead only');
  assert.equal(sheet.getCell('D3').value, null);
  assert.equal(sheet.getCell('C4').value, null);
});
