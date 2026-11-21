import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { productionRuntime, productionFunctions } from '../functions/src/runtime-identity.js';

const { project, email } = productionRuntime;
const region = 'asia-south1';
const describe = (...args) => JSON.parse(execFileSync('gcloud', args, { encoding: 'utf8' }));
assert.equal(process.env.GCP_PROJECT_ID, project);
for (const name of productionFunctions) {
  const deployed = describe('functions', 'describe', name, '--gen2', '--region', region,
    '--project', project, '--format=json');
  assert.equal(deployed.state, 'ACTIVE', name + ' must be active');
  assert.equal(deployed.serviceConfig?.serviceAccountEmail, email, name + ' has the wrong runtime identity');
  if (name === 'api') continue;
  const schedule = describe('scheduler', 'jobs', 'describe', `firebase-schedule-${name}-${region}`,
    '--location', region, '--project', project, '--format=json');
  assert.equal(schedule.httpTarget?.oidcToken?.serviceAccountEmail, email, name + ' has the wrong scheduler identity');
}
console.log('Verified the runtime identities of all five production functions and four scheduled invocations.');
