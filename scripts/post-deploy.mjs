import { readFile, writeFile } from 'node:fs/promises';
import {
  checkPublishedVersion,
  checkProtectedResponse,
  checkContract,
  checkFunctions,
  checkSettingsPage,
  checkProductPage,
} from './post-deploy-checks.mjs';
const docs = process.argv.includes('--docs'),
  out = docs ? 'docs-verification.json' : 'release-verification.json',
  expected = JSON.parse(await readFile('functions/src/release.json', 'utf8'));
if (docs) {
  expected.version = JSON.parse(await readFile('package.json', 'utf8')).version;
  expected.commit = process.env.GITHUB_SHA || expected.commit;
}
const results = [];
async function check(id, fn) {
  try {
    await fn();
    results.push({ id, status: 'passed' });
  } catch {
    results.push({ id, status: 'failed' });
  }
}
async function get(url) {
  const r = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
  });
  return r;
}
try {
  if (docs) {
    await check('public-settings-guide', async () => {
      let good = false;
      for (let n = 0; n < 6; n++) {
        try {
          const r = await get(
            'https://theharithsa.github.io/SalesDrone/settings.html',
          );
          if (r.ok) {
            checkSettingsPage(
              await r.text(),
              expected.version,
              expected.commit,
            );
            good = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      if (!good) throw Error('Stale Pages guide');
    });
    await check('public-product-handbook', async () => {
      for (let n = 0; n < 6; n++) {
        try {
          const r = await get(
            'https://theharithsa.github.io/SalesDrone/product.html',
          );
          if (r.ok) {
            checkProductPage(await r.text(), expected.version, expected.commit);
            return;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      throw Error('Stale product handbook');
    });
  } else {
    await check('live-version', async () => {
      const r = await get(
        'https://sales-drone-avinya.firebaseapp.com/version.json',
      );
      if (!r.ok) throw Error('Version unavailable');
      checkPublishedVersion(await r.json(), expected);
    });
    await check('live-contract', async () => {
      const r = await get(
        'https://sales-drone-avinya.firebaseapp.com/openapi.json',
      );
      if (!r.ok) throw Error('Contract unavailable');
      checkContract(
        await r.json(),
        JSON.parse(await readFile('docs/openapi.json', 'utf8')),
      );
    });
    for (const resource of [
      'leads',
      'workspace-settings',
      'field-options',
      'personal-access-tokens',
    ])
      await check('unauthenticated-denial:' + resource, async () => {
        const r = await get(
            'https://sales-drone-avinya.firebaseapp.com/api/v1/' + resource,
          ),
          j = await r.json();
        checkProtectedResponse(
          {
            status: r.status,
            version: r.headers.get('x-app-version'),
            code: j.error?.code,
          },
          expected,
        );
      });
    await check('function-revisions', async () =>
      checkFunctions(
        JSON.parse(await readFile('deployment.json', 'utf8')),
        expected,
      ),
    );
  }
} finally {
  await writeFile(
    out,
    JSON.stringify(
      {
        version: expected.version,
        commit: process.env.GITHUB_SHA || expected.commit,
        checkedAt: new Date().toISOString(),
        results,
        customerDataRead: false,
        tenantSearchability: 'not verified by these checks',
      },
      null,
      2,
    ) + '\n',
  );
}
if (results.some((r) => r.status !== 'passed'))
  throw Error(
    'Post-deployment checks failed: ' +
      results
        .filter((r) => r.status !== 'passed')
        .map((r) => r.id)
        .join(', '),
  );
console.log('Post-deployment checks passed: ' + results.length);
