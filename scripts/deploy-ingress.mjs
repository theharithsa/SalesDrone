import {checkIngress,checkIngressIdentity} from './ingress-checks.mjs';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
const stageOnly = process.argv[2] === '--stage-only';
const project = process.env.GCP_PROJECT_ID;
if (project !== 'sales-drone-avinya') throw Error('Unexpected ingress project');
const release = JSON.parse(await readFile('functions/src/release.json', 'utf8'));
if (!/^[a-f0-9]{40}$/.test(release.commit)) throw Error('Ingress requires exact build SHA');
function gcloud(args, allowMissing = false) {
  const r = spawnSync('gcloud', [...args, '--project', project, '--quiet'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (r.status && allowMissing && /NOT_FOUND|not found/i.test(r.stderr))return null;
  if (r.status) { console.error(r.stderr); throw Error('Ingress deployment command failed'); }
  return r.stdout.trim();
}
const region = 'asia-south1', service = 'salesdrone-ingress';
const image = `${region}-docker.pkg.dev/${project}/salesdrone-ingress/api:${release.commit}`;
const upstream = gcloud(['functions', 'describe', 'api', '--gen2', '--region', region, '--format=value(serviceConfig.uri)']);
if (!/^https:\/\/api-[a-z0-9-]+\.a\.run\.app$/.test(upstream)) throw Error('Unexpected API target');
const dir = await mkdtemp(join(tmpdir(), 'salesdrone-ingress-'));
const tag = 'verify-' + randomBytes(6).toString('hex');
const serviceArgs = ['--region', region];
const describe = () => JSON.parse(gcloud(['run', 'services', 'describe', service, ...serviceArgs, '--format=json']));
let tagged = false, keepTag = false;
try {
  const env = join(dir, 'runtime.json');
  await writeFile(env, JSON.stringify({ API_UPSTREAM: upstream, DYNATRACE_TENANT_URL: process.env.DYNATRACE_TENANT_URL }), { mode: 0o600 });
  const existingImage=gcloud(['artifacts','docker','images','describe',image,'--format=json'],true);
  if(!existingImage)gcloud(['builds', 'submit', '.', '--region', region, '--config', 'services/ingress/cloudbuild.yaml', '--substitutions', `_IMAGE=${image}`, '--service-account', `projects/${project}/serviceAccounts/salesdrone-ingress-build@${project}.iam.gserviceaccount.com`, '--gcs-source-staging-dir', `gs://${project}-ingress-build/source`, '--suppress-logs']);
  tagged = true;
  gcloud(['run', 'deploy', service, ...serviceArgs, '--image', image,
    '--service-account', `salesdrone-ingress@${project}.iam.gserviceaccount.com`,
    '--env-vars-file', env, '--set-secrets', 'DYNATRACE_API_TOKEN=DYNATRACE_API_TOKEN:latest',
    '--cpu', '1', '--memory', '1Gi', '--concurrency', '2', '--min-instances', '0',
    '--timeout', '75s', '--cpu-throttling', '--no-traffic', '--tag', tag]);
  const staged = describe();
  const candidate = staged.status?.traffic?.find(target => target.tag === tag);
  if (!candidate?.url || !candidate.revisionName || (candidate.percent || 0) !== 0)
    throw Error('Expected a tagged ingress revision with zero traffic');
  const revision = JSON.parse(gcloud(['run', 'revisions', 'describe', candidate.revisionName, ...serviceArgs, '--format=json']));
  const settings = revision.metadata?.annotations || {};
  const minimum = Number(staged.metadata?.annotations?.['run.googleapis.com/minScale'] || 0);
  if (settings['run.googleapis.com/cpu-throttling'] !== 'true' ||
      Number(settings['autoscaling.knative.dev/minScale'] || 0) !== 0 || minimum !== 0)
    throw Error('Ingress requires request-based billing and zero minimum instances');
  const identity = await checkIngressIdentity(candidate.url, release);
  let upstreamVersion = release.version;
  if (stageOnly) {
    // A staged gateway talks to the already active Function, which still has
    // the prior release's identity on its forwarded responses.
    const response = await fetch(upstream + '/api/v1/leads', {redirect: 'error', signal: AbortSignal.timeout(15000)});
    upstreamVersion = response.headers.get('x-app-version');
    const body = await response.json();
    if (response.status !== 401 || body.error?.code !== 'UNAUTHENTICATED' ||
        !/^\d+\.\d+\.\d+$/.test(upstreamVersion || ''))
      throw Error('Could not verify the active upstream identity');
  }
  const transportChecks = await checkIngress(candidate.url, release, { upstreamVersion });
  if (!stageOnly) {
    gcloud(['run', 'services', 'update-traffic', service, ...serviceArgs, '--to-revisions', candidate.revisionName + '=100']);
    const active = describe().status?.traffic?.find(target => target.revisionName === candidate.revisionName && target.percent === 100);
    if (!active) throw Error('Verified ingress revision did not receive production traffic');
  }
  await writeFile('ingress-deployment.json', JSON.stringify({
    service, region, image, uri: stageOnly ? candidate.url : staged.status.url, revision: candidate.revisionName,
    version: identity.version, commit: identity.commit, billing: 'request-based', minimumInstances: 0,
    parserBoundary: 'passed', transportChecks, ...(stageOnly ? { tag, trafficPercent: 0, upstreamVersion } : {}),
  }, null, 2));
  keepTag = stageOnly;
  console.log('Verified ingress identity, request billing, zero minimum instances and parser boundary.');
} finally {
  try {
    if (tagged && !keepTag)
      gcloud(['run', 'services', 'update-traffic', service, ...serviceArgs, '--remove-tags', tag]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
