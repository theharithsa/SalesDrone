// Run a bounded check using an existing pre-prod image, then remove the Job.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { cloud } from './cloud-access.mjs';
import { preproduction } from '../functions/src/preproduction.js';
import { productionRuntime } from '../functions/src/runtime-identity.js';

const [mode, expectedCommit] = process.argv.slice(2);
assert.ok(['production-identity', 'preprod-outbox'].includes(mode));
assert.match(expectedCommit || '', /^[a-f0-9]{40}$/);
assert.equal(process.env.GCP_PROJECT_ID, preproduction.project);
const live = await fetch(preproduction.origin + '/version.json?candidate=' + expectedCommit, {
  redirect: 'error', signal: AbortSignal.timeout(10000),
});
assert.ok(live.ok);
const metadata = await live.json();
assert.equal(metadata.commit, expectedCommit);
assert.equal(metadata.environment, 'pre-production');

const { project, region } = preproduction;
const parent = `projects/${project}/locations/${region}`;
const runApi = 'https://run.googleapis.com/v2/';
const name = 'salesdrone-acceptance-' + randomBytes(6).toString('hex');
const jobURL = runApi + parent + '/jobs/' + name;
const invocation = (url, body = {}) => cloud(url, { method: 'POST', body: JSON.stringify(body) });
const deployed = await cloud('https://cloudfunctions.googleapis.com/v2/' + parent + '/functions/preprodApi');
assert.equal(deployed.state, 'ACTIVE');
assert.equal(deployed.serviceConfig?.serviceAccountEmail, preproduction.runtimeAccount);
assert.ok(deployed.serviceConfig.service.startsWith(parent + '/services/'));
const service = mode === 'production-identity'
  ? parent + '/services/' + preproduction.ingress
  : deployed.serviceConfig.service;
const published = await cloud(runApi + service);
const revision = await cloud(runApi + published.latestReadyRevision);
const image = revision.containers[0]?.image;
assert.ok(image?.startsWith(`${region}-docker.pkg.dev/${project}/salesdrone-preprod-ingress/`), 'Unexpected image repository');

const env = ['DYNATRACE_API_TOKEN'].map(key => ({
  name: key, valueSource: { secretKeyRef: { secret: key, version: 'latest' } },
}));
let args;
let command = ['node'];
let serviceAccount = preproduction.runtimeAccount;
if (mode === 'production-identity') {
  serviceAccount = productionRuntime.email;
  for (const key of ['CURSOR_SECRET', 'GEMINI_API_KEY'])
    env.push({ name: key, valueSource: { secretKeyRef: { secret: key, version: 'latest' } } });
  args = ['--input-type=module', '-e', await readFile(new URL('./runtime-access-probe.mjs', import.meta.url), 'utf8')];
} else {
  env.push({ name: 'DYNATRACE_TENANT_URL', value: 'https://indiacs.live.dynatrace.com' },
    { name: 'SDR_PREFLIGHT_ENVIRONMENT', value: 'pre-production' },
    { name: 'SDR_PREFLIGHT_COMMIT', value: expectedCommit });
  command = ['/cnb/lifecycle/launcher'];
  args = ['node', '/workspace/src/preprod-outbox-check.js'];
}

async function completed(operation) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (operation.done) {
      if (operation.error) throw Error('Cloud Run acceptance operation failed (' + operation.error.code + '): ' + operation.error.message);
      return operation.response;
    }
    await delay(3000);
    operation = await cloud(runApi + operation.name);
  }
  throw Error('Cloud Run acceptance operation timed out');
}

let created = false;
try {
  const creation = await invocation(runApi + parent + '/jobs?jobId=' + name, {
    template: { taskCount: 1, parallelism: 1, template: {
      serviceAccount, maxRetries: 0, timeout: '120s',
      containers: [{ image, command, args, env, resources: { limits: { cpu: '1', memory: '512Mi' } } }],
    } },
  });
  created = true;
  await completed(creation);
  const execution = await completed(await invocation(jobURL + ':run'));
  assert.equal(execution.succeededCount, 1, 'Acceptance execution did not pass');
  console.log(JSON.stringify({ mode, commit: expectedCommit, execution: execution.name, succeeded: true }));
} finally {
  if (created) await completed(await cloud(jobURL, { method: 'DELETE' }));
}
