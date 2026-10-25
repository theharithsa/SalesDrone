import { execFileSync } from 'node:child_process';
import { renderProductGuide } from './product-guide.mjs';
import { renderSettings } from './settings-reference.mjs';
import { TOKEN_SCOPES } from '../functions/src/api-scopes.js';
// Curated public build: never copy docs/, arbitrary captures or workspace files.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const pkg = JSON.parse(await readFile('package.json', 'utf8')),
  out = 'site/.build';
const sourceCommit =
  process.env.GITHUB_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceCommit))
  throw Error('Invalid documentation source commit');
await mkdir(out, { recursive: true });
const manifest = JSON.parse(
  await readFile('site/assets/screenshots/manifest.json', 'utf8'),
);
function stamp(html) {
  return html
    .replace(
      '<head>',
      '<head><meta name="salesdrone-commit" content="' + sourceCommit + '">',
    )
    .replace(/assets\/screenshots\/([a-z0-9-]+\.jpg)/g, (_match, name) => {
      const item = manifest.find((r) => r.file === name);
      if (!item) throw Error('Unreviewed screenshot reference');
      return 'assets/screenshots/' + name + '?sha=' + item.sha256.slice(0, 12);
    });
}
const screenshots = [
  'dashboard-demo.jpg',
  'leads-demo.jpg',
  'mobile-leads-demo.jpg',
  'journey-demo.jpg',
  'lead-overlay-demo.jpg',
  'lead-workspace-demo.jpg',
  'notifications-demo.jpg',
  'mobile-demo.jpg',
  'api-portal-demo.jpg',
  'developer-settings-demo.jpg',
  'book-mode-light.jpg',
  'book-mode-dark.jpg',
  'book-mode-mobile.jpg',
  'book-settings-demo.jpg',
];
for (const name of screenshots) {
  const source = 'site/assets/screenshots/' + name,
    bytes = await readFile(source);
  const record = manifest.find((r) => r.file === name);
  if (
    !record ||
    !['synthetic-demo', 'public-contract'].includes(record.mode) ||
    record.sha256 !== createHash('sha256').update(bytes).digest('hex')
  )
    throw Error('Screenshot is not a reviewed public capture: ' + name);
  await mkdir(out + '/assets/screenshots', { recursive: true });
  await copyFile(source, out + '/assets/screenshots/' + name);
}
for (const name of [
  '01-one-lead-many-conversations.png',
  '02-notes-to-reminders.png',
  '03-tested-release-observed.png',
]) {
  await mkdir(out + '/assets/illustrations', { recursive: true });
  await copyFile(
    'assets/salesdrone-guide-illustrations/' + name,
    out + '/assets/illustrations/' + name,
  );
}
for (const [source, target] of [
  [
    'apps/web/public/brand/avinya-enterprises-mark.svg',
    'assets/brand/avinya-enterprises-mark.svg',
  ],
  ['apps/web/public/icon.svg', 'assets/brand/icon.svg'],
  [
    'apps/web/public/fonts/google-sans/google-sans-latin-wght-normal.woff2',
    'assets/fonts/google-sans.woff2',
  ],
  [
    'node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
    'assets/fonts/manrope.woff2',
  ],
  [
    'apps/web/public/licenses/google-sans-OFL.txt',
    'assets/fonts/google-sans-LICENSE.txt',
  ],
  [
    'apps/web/public/licenses/Manrope-OFL.txt',
    'assets/fonts/manrope-LICENSE.txt',
  ],
]) {
  await mkdir(out + '/' + target.split('/').slice(0, -1).join('/'), {
    recursive: true,
  });
  await copyFile(source, out + '/' + target);
}
const template = await readFile('site/index.html', 'utf8');
const sectionIds = [...template.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(
  (match) => match[1],
);
const navigation = template.match(
  /<nav aria-label="Guide sections">([\s\S]*?)<\/nav>/,
)?.[1];
const linkIds = [...(navigation || '').matchAll(/href="#([^"]+)"/g)].map(
  (match) => match[1],
);
if (
  !sectionIds.length ||
  new Set(sectionIds).size !== sectionIds.length ||
  JSON.stringify(sectionIds) !== JSON.stringify(linkIds)
)
  throw Error(
    'Guide navigation must match the unique section anchors in document order.',
  );
for (const id of sectionIds) {
  const marker = '{{SECTION_NUMBER:' + id + '}}';
  if (template.split(marker).length - 1 !== 2)
    throw Error(
      'Each guide section needs matching navigation and heading numbers: ' + id,
    );
}
const html = template
  .replace(/\{\{SECTION_NUMBER:([^}]+)\}\}/g, (_marker, id) => {
    const index = sectionIds.indexOf(id);
    if (index < 0) throw Error('Unknown guide section: ' + id);
    return String(index + 1).padStart(2, '0');
  })
  .replaceAll('{{APP_VERSION}}', pkg.version)
  .replaceAll(
    '{{API_COUNT}}',
    String(
      Object.values(
        JSON.parse(await readFile('docs/openapi.json', 'utf8')).paths,
      ).reduce(
        (n, p) =>
          n +
          Object.keys(p).filter((m) =>
            ['get', 'post', 'patch', 'put', 'delete'].includes(m),
          ).length,
        0,
      ),
    ),
  );
await writeFile(out + '/index.html', stamp(html));
await copyFile('site/guide.css', out + '/guide.css');
await writeFile(out + '/.nojekyll', '');
console.log(
  'Built curated public guide v' +
    pkg.version +
    ' with ' +
    screenshots.length +
    ' reviewed public screenshots.',
);

const settings = renderSettings(
  JSON.parse(await readFile('docs/settings-reference.json', 'utf8')),
  JSON.parse(await readFile('apps/web/src/lib/settings-sections.json', 'utf8')),
  TOKEN_SCOPES,
  pkg.version,
);
await writeFile(out + '/settings.html', stamp(settings.html));
if ((await readFile('docs/SETTINGS.md', 'utf8')) !== settings.markdown)
  throw Error('Stale settings reference: npm run docs:settings');

const product = renderProductGuide(
  JSON.parse(await readFile('docs/product-guide.json', 'utf8')),
  pkg.version,
);
await writeFile(out + '/product.html', stamp(product.html));
await copyFile('site/product.css', out + '/product.css');
if ((await readFile('docs/PRODUCT-GUIDE.md', 'utf8')) !== product.markdown)
  throw Error('Stale product handbook: npm run docs:product');
