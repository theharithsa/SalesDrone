import { readFile, writeFile } from 'node:fs/promises';
import { renderSettings } from './settings-reference.mjs';
import { TOKEN_SCOPES } from '../functions/src/api-scopes.js';
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const output = renderSettings(
  await read('docs/settings-reference.json'),
  await read('apps/web/src/lib/settings-sections.json'),
  TOKEN_SCOPES,
  (await read('package.json')).version,
);
if (process.argv.includes('--check')) {
  if ((await readFile('docs/SETTINGS.md', 'utf8')) !== output.markdown)
    throw Error('Regenerate the settings guide: npm run docs:settings');
  console.log('Settings reference matches the UI catalog and token scopes.');
} else {
  await writeFile('docs/SETTINGS.md', output.markdown);
  console.log('Generated complete settings reference.');
}
