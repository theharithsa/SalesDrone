// One-time, idempotent operator bootstrap. Existing OAuth stays in memory; no keys.
import { cloud } from './cloud-access.mjs';
const project = 'sales-drone-avinya';
const runtime = `salesdrone-ingress@${project}.iam.gserviceaccount.com`;
const builder = `salesdrone-ingress-build@${project}.iam.gserviceaccount.com`;
const deployer = `serviceAccount:salesdrone-github-deploy@${project}.iam.gserviceaccount.com`;
const region = 'asia-south1';
async function ensure(url, create) { try { return await cloud(url); } catch (e) { if (e.status !== 404) throw e; return create(); } }
async function bind(url, role, members, methods = [':getIamPolicy', ':setIamPolicy']) {
  const policy = await cloud(url + methods[0], (url.includes('artifactregistry') || url.includes('secretmanager')) ? {} : { method: 'POST', body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }) });
  policy.bindings ||= [];
  let binding = policy.bindings.find(b => b.role === role && !b.condition);
  if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
  for (const member of members) if (!binding.members.includes(member)) binding.members.push(member);
  await cloud(url + methods[1], { method: 'POST', body: JSON.stringify({ policy }) });
}
for (const api of ['run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'logging.googleapis.com']) await cloud(`https://serviceusage.googleapis.com/v1/projects/${project}/services/${api}:enable`, { method: 'POST', body: '{}' });
for (const [id, displayName] of [['salesdrone-ingress', 'SalesDrone transport only'], ['salesdrone-ingress-build', 'SalesDrone isolated ingress builder']]) {
  await ensure(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${id}@${project}.iam.gserviceaccount.com`, () => cloud(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`, { method: 'POST', body: JSON.stringify({ accountId: id, serviceAccount: { displayName } }) }));
  await bind(`https://iam.googleapis.com/v1/projects/-/serviceAccounts/${id}@${project}.iam.gserviceaccount.com`, 'roles/iam.serviceAccountUser', [deployer]);
}
const repo = `https://artifactregistry.googleapis.com/v1/projects/${project}/locations/${region}/repositories/salesdrone-ingress`;
await ensure(repo, () => cloud(`https://artifactregistry.googleapis.com/v1/projects/${project}/locations/${region}/repositories?repositoryId=salesdrone-ingress`, { method: 'POST', body: JSON.stringify({ format: 'DOCKER', description: 'Private immutable SalesDrone ingress build images', dockerConfig: { immutableTags: true } }) }));
await bind(repo, 'roles/artifactregistry.writer', ['serviceAccount:' + builder]);
const bucket = `${project}-ingress-build`;
await ensure(`https://storage.googleapis.com/storage/v1/b/${bucket}`, () => cloud(`https://storage.googleapis.com/storage/v1/b?project=${project}`, { method: 'POST', body: JSON.stringify({ name: bucket, location: region, iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' }, lifecycle: { rule: [{ action: { type: 'Delete' }, condition: { age: 7 } }] } }) }));
// Storage IAM uses GET/PUT and a direct policy, unlike the other APIs.
const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/iam`;
const bp = await cloud(bucketUrl + '?optionsRequestedPolicyVersion=3'); bp.bindings ||= [];
let objects = bp.bindings.find(b => b.role === 'roles/storage.objectAdmin' && !b.condition);
if (!objects) { objects = { role: 'roles/storage.objectAdmin', members: [] }; bp.bindings.push(objects); }
for (const member of [deployer, 'serviceAccount:' + builder]) if (!objects.members.includes(member)) objects.members.push(member);
await cloud(bucketUrl, { method: 'PUT', body: JSON.stringify(bp) });
const projectUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
await bind(projectUrl, 'roles/run.developer', [deployer]);
await bind(projectUrl, 'roles/cloudbuild.builds.editor', [deployer]);
await bind(projectUrl, 'roles/logging.logWriter', ['serviceAccount:' + builder]);
await bind(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/DYNATRACE_API_TOKEN`, 'roles/secretmanager.secretAccessor', ['serviceAccount:' + runtime]);
const exclusions = `https://logging.googleapis.com/v2/projects/${project}/exclusions`;
const exclusion = { name: 'salesdrone_ingress_request_privacy', description: 'Retain sanitized ingress outcome logs, exclude automatic request URLs and query strings.', filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="salesdrone-ingress" AND log_id("run.googleapis.com/requests")', disabled: false };
await ensure(exclusions + '/' + exclusion.name, () => cloud(exclusions, { method: 'POST', body: JSON.stringify(exclusion) }));
console.log(JSON.stringify({ project, runtime, builder, imageRepository: 'salesdrone-ingress', buildBucket: bucket, privacyExclusion: exclusion.name, keysCreated: false }));
