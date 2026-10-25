import { readFile, writeFile } from 'node:fs/promises';
import { renderProductGuide } from './product-guide.mjs';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const { markdown } = renderProductGuide(
  JSON.parse(await readFile('docs/product-guide.json', 'utf8')),
  version,
);
if (process.argv.includes('--check')) {
  if ((await readFile('docs/PRODUCT-GUIDE.md', 'utf8')) !== markdown)
    throw Error('Stale product handbook');
} else await writeFile('docs/PRODUCT-GUIDE.md', markdown);
console.log('Product handbook is current.');
