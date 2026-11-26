import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { productionRuntime, productionFunctions } from '../functions/src/runtime-identity.js';
import { preproduction } from '../functions/src/preproduction.js';

function endpoints(entry: string): Record<string, string> {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    const handlers = await import(${JSON.stringify(entry)});
    console.log(JSON.stringify(Object.fromEntries(Object.entries(handlers)
      .map(([name, handler]) => [name, handler.__endpoint?.serviceAccountEmail]))));
  `], {
    encoding: 'utf8',
    env: { ...process.env, FIREBASE_CONFIG: JSON.stringify({ projectId: preproduction.project }) },
  }));
}

test('all deployed production functions use the dedicated runtime identity', () => {
  assert.deepEqual(endpoints('./functions/src/index.js'),
    Object.fromEntries(productionFunctions.map(name => [name, productionRuntime.email])));
});

test('pre-production exports only its isolated API and email worker', () => {
  assert.deepEqual(endpoints('./functions/src/preproduction-entry.js'), {
    preprodApi: preproduction.runtimeAccount,
    preprodEmail: preproduction.runtimeAccount,
  });
  assert.notEqual(productionRuntime.email, preproduction.runtimeAccount);
  assert.notEqual(productionRuntime.database, preproduction.database);
  assert.notEqual(productionRuntime.bucket, preproduction.bucket);
});

test('pre-production source uploads are unique across runs and retries of the same commit', t => {
  const bin = mkdtempSync(join(tmpdir(), 'salesdrone-deploy-'));
  t.after(() => rmSync(bin, { recursive: true, force: true }));
  const log = join(bin, 'archive-paths');
  writeFileSync(join(bin, 'zip'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  writeFileSync(join(bin, 'gcloud'), `#!/bin/sh
if [ "$1" = storage ] && [ "$2" = cp ]; then
  printf '%s\\n' "$4" >> "$SDR_BUILD_OBJECTS_LOG"
fi
if [ "$1" = functions ] && [ "$2" = describe ]; then exit 1; fi
exit 0
`, { mode: 0o700 });
  const sha = 'a'.repeat(40);
  const attempts = [['101', '1'], ['102', '1'], ['102', '2']];
  for (const [run, attempt] of attempts) {
    execFileSync('bash', ['scripts/deploy-preprod-api.sh'], { env: {
      ...process.env, PATH: bin + ':' + process.env.PATH, SDR_BUILD_OBJECTS_LOG: log,
      GCP_PROJECT_ID: preproduction.project, GITHUB_SHA: sha, GITHUB_RUN_ID: run, GITHUB_RUN_ATTEMPT: attempt,
      DYNATRACE_TENANT_URL: 'https://example.test', PREPROD_EMAIL_ENABLED: 'false',
    } });
  }
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), attempts.map(([run, attempt]) =>
    `gs://${preproduction.project}-preprod-build/functions/${sha}-${run}-${attempt}.zip`));
});
