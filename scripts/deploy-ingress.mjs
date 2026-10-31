import {checkIngress,checkIngressIdentity} from './ingress-checks.mjs';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
try {
  const env = join(dir, 'runtime.json');
  await writeFile(env, JSON.stringify({ API_UPSTREAM: upstream, DYNATRACE_TENANT_URL: process.env.DYNATRACE_TENANT_URL }), { mode: 0o600 });
  const existingImage=gcloud(['artifacts','docker','images','describe',image,'--format=json'],true);
  if(!existingImage)gcloud(['builds', 'submit', '.', '--region', region, '--config', 'services/ingress/cloudbuild.yaml', '--substitutions', `_IMAGE=${image}`, '--service-account', `projects/${project}/serviceAccounts/salesdrone-ingress-build@${project}.iam.gserviceaccount.com`, '--gcs-source-staging-dir', `gs://${project}-ingress-build/source`, '--suppress-logs']);
  gcloud(['run', 'deploy', service, '--region', region, '--image', image, '--service-account', `salesdrone-ingress@${project}.iam.gserviceaccount.com`, '--allow-unauthenticated', '--ingress', 'all', '--env-vars-file', env, '--set-secrets', 'DYNATRACE_API_TOKEN=DYNATRACE_API_TOKEN:latest', '--cpu', '1', '--memory', '1Gi', '--concurrency', '2', '--min', '0', '--max', '3', '--timeout', '75s', '--no-cpu-throttling']);
  const deployed = JSON.parse(gcloud(['run', 'services', 'describe', service, '--region', region, '--format=json']));
  const url = deployed.status?.url;
  const identity=await checkIngressIdentity(url,release);
  const transportChecks=await checkIngress(url,release);
  await writeFile('ingress-deployment.json', JSON.stringify({ service, region, image, uri: url, revision: deployed.status.latestReadyRevisionName, version: identity.version, commit: identity.commit, parserBoundary: 'passed',transportChecks }, null, 2));
  console.log('Ingress identity and real parser boundary verified before Hosting cutover.');
} finally { await rm(dir, { recursive: true, force: true }); }
