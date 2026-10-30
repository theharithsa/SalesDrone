/** Focused synthetic import presentation checks; no live API or workbook data. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  viewport,
  nav,
  js,
  click,
  screenshot,
  close,
  delay,
  send,
  wait,
} from './local-browser.mjs';
await mkdir('test-results/imports', { recursive: true });
const results = [];
try {
  for (const width of [320, 390, 599, 600, 768, 1024, 1280, 1440, 1920]) {
    await viewport(width, width === 1024 ? 600 : 1000);
    await nav('/design-admin.html?preview=import-review');
    for (const theme of ['light', 'dark']) {
      await js(
        `document.documentElement.dataset.colorScheme='${theme}';document.documentElement.dataset.theme='${theme}'`,
      );
      assert.ok(
        await js(
          '!!(document.querySelector(".import-history") && document.querySelector(".import-field-diff"))',
        ),
      );
      assert.ok(
        await js('document.documentElement.scrollWidth <= innerWidth + 1'),
        `Overflow ${width} ${theme}`,
      );
      assert.equal(
        await js('document.querySelector(".import-field-diff input").checked'),
        false,
      );
      results.push({ width, theme, overflow: false, conflictUnchecked: true });
      if (width === 1440 && theme === 'light')
        await screenshot('test-results/imports/import-review-demo.jpg');
      if (width === 390 && theme === 'dark') {
        await js(
          'document.querySelector(".import-result-card").scrollIntoView(); true',
        );
        await screenshot('test-results/imports/import-review-mobile-demo.jpg');
        await js('scrollTo(0,0); true');
      }
    }
  }
  await viewport(390, 1000);
  await nav('/design-admin.html?preview=import-review');
  await js('document.querySelector(".import-field-diff input").click()');
  await click('Accept selected changes');
  assert.ok(
    await js(
      'document.querySelector(".import-result-card").textContent.includes("Approved")',
    ),
  );
  await nav('/design-admin.html');
  await click('Import preview');
  assert.ok(await js('document.body.textContent.includes("Import" )'));
  await viewport(1440, 1000);
  await writeFile(
    '/tmp/salesdrone-import-synthetic.csv',
    'Name,Phone,Enquiry date,Company\nAsha Raman,+12025550123,2026-10-20,Northstar Buildworks\n',
  );
  const doc = await send('DOM.getDocument');
  const input = await send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'input[type=file]',
  });
  await send('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: ['/tmp/salesdrone-import-synthetic.csv'],
  });
  await wait('document.body.textContent.includes("Choose another workbook")');
  await screenshot('test-results/imports/import-demo.jpg');
  await writeFile(
    'test-results/imports/browser-results.json',
    JSON.stringify(
      {
        cases: results,
        decisionInteraction: true,
        limits:
          'Fictional component fixture; no server writes, physical device or Safari testing.',
      },
      null,
      2,
    ),
  );
  console.log(
    `Passed ${results.length} synthetic width/theme cases plus decision interaction.`,
  );
} finally {
  await close();
}
