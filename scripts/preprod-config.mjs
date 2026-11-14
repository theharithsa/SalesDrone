import { readFile, writeFile } from 'node:fs/promises';
import { preproduction as target } from '../functions/src/preproduction.js';
import { functionEnvironment } from './function-environment.mjs';

if (process.env.GCP_PROJECT_ID !== target.project)
  throw Error('Wrong pre-production Firebase project');

const production = JSON.parse(await readFile('firebase.json', 'utf8'));
const config = {
  functions: [{ ...production.functions[0], codebase: 'salesdrone-preprod',
    ignore: [...production.functions[0].ignore, '.env.*.local'] }],
  firestore: [{ ...production.firestore, database: target.database }],
  hosting: {
    ...production.hosting,
    site: target.site,
    headers: [...production.hosting.headers,
      { source: '**', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }],
    rewrites: production.hosting.rewrites.map((rewrite) => rewrite.run
      ? { ...rewrite, run: { serviceId: target.ingress, region: target.region } }
      : rewrite),
  },
};
await writeFile('.firebase-preprod.generated.json', JSON.stringify(config, null, 2));
await writeFile('functions/.env.' + target.project, functionEnvironment(process.env));
const pkg = JSON.parse(await readFile('functions/package.json', 'utf8'));
pkg.main = 'src/preproduction-entry.js';
await writeFile('functions/package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Prepared pre-production-only Firebase configuration in the deployment checkout.');
