import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { deploymentOutcome } from '../scripts/deployment-outcome.mjs';
const success = {
  firestore: 'success',
  indexes: 'success',
  storage: 'success',
  functions: 'success',
  ingress: 'success',
  hosting: 'success',
  published: 'success',
  postcheck: 'success',
};
test('deployment reporting requires every infrastructure, application and live verification phase', () => {
  assert.equal(deploymentOutcome(success), 'succeeded');
  for (const phase of Object.keys(success)) {
    for (const outcome of [
      'failure',
      'cancelled',
      'skipped',
      'unknown',
      undefined,
    ])
      assert.equal(
        deploymentOutcome({ ...success, [phase]: outcome }),
        'failed',
        phase + ':' + outcome,
      );
  }
  assert.equal(deploymentOutcome({}), 'failed');
});
test('workflow CLI computes reporting outcome from explicit step results', () => {
  const run = (values: Record<string, string>) =>
    execFileSync(process.execPath, ['scripts/deployment-outcome.mjs'], {
      env: { ...process.env, ...values },
      encoding: 'utf8',
    }).trim();
  const env = Object.fromEntries(
    Object.entries(success).map(([phase, status]) => [
      'DEPLOY_' + phase.toUpperCase(),
      status,
    ]),
  );
  assert.equal(run(env), 'succeeded');
  assert.equal(run({ ...env, DEPLOY_STORAGE: 'failure' }), 'failed');
  assert.equal(run({ ...env, DEPLOY_INDEXES: '' }), 'failed');
});
