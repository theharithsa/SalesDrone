import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
