import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { preproduction as target } from '../functions/src/preproduction.js';

const sha = process.env.GITHUB_SHA;
assert.match(sha || '', /^[a-f0-9]{40}$/);
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const request = (path, options) => fetch(target.origin + path, {
  ...options, redirect: 'error', signal: AbortSignal.timeout(10000),
});
let metadata;
for (let attempt = 0; attempt < 18; attempt++) {
  try {
    const r = await request('/version.json?candidate=' + sha);
    if (r.ok) metadata = await r.json();
    if (metadata?.commit === sha) break;
  } catch { /* Hosting propagation is bounded by this loop. */ }
  if (attempt < 17) await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.equal(metadata?.commit, sha, 'Pre-production candidate did not propagate');
assert.equal(metadata.version, version);
assert.equal(metadata.environment, 'pre-production');
const unauthenticated = await request('/api/v1/leads');
assert.equal(unauthenticated.status, 401);
assert.equal((await unauthenticated.json()).error.code, 'UNAUTHENTICATED');
assert.equal(unauthenticated.headers.get('x-app-version'), version);
const malformed = await request('/api/v1/leads', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
});
assert.equal(malformed.status, 400);
assert.equal((await malformed.json()).error.code, 'BAD_JSON');
await writeFile('preproduction-verification.json', JSON.stringify({
  environment: metadata.environment, origin: target.origin, version, commit: sha,
  tree: process.env.PREPROD_TESTED_TREE, checkedAt: new Date().toISOString(),
  checks: ['hosting-identity', 'anonymous-denial', 'malformed-json-boundary'],
}, null, 2));
console.log('Verified pre-production version, anonymous lead denial and JSON boundary.');
