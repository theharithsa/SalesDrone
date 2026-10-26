import { storageDeployment } from './storage-deployment.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const release = JSON.parse(
    await readFile('functions/src/release.json', 'utf8'),
  ),
  project = process.env.GCP_PROJECT_ID || 'sales-drone-avinya',
  functions = [];
for (const name of [
  'api',
  'reminders',
  'analyzeNotes',
  'leadIntelligence',
  'exportTelemetry',
]) {
  const r = spawnSync(
    'gcloud',
    [
      'functions',
      'describe',
      name,
      '--gen2',
      '--region=asia-south1',
      '--project',
      project,
      '--format=json',
    ],
    { encoding: 'utf8' },
  );
  if (r.status) {
    functions.push({ name, state: 'unverified' });
    continue;
  }
  const j = JSON.parse(r.stdout);
  functions.push({
    name,
    state: j.state,
    updatedAt: j.updateTime,
    revision: j.serviceConfig?.revision,
    uri: j.serviceConfig?.uri,
  });
}
const bucket = 'sales-drone-avinya.firebasestorage.app';
const sr = spawnSync(
  'gcloud',
  ['storage', 'buckets', 'describe', 'gs://' + bucket, '--format=json'],
  { encoding: 'utf8' },
);
let storage = storageDeployment(null, process.env.STORAGE_DEPLOYMENT_OUTCOME);
if (sr.status === 0)
  try {
    storage = storageDeployment(
      JSON.parse(sr.stdout),
      process.env.STORAGE_DEPLOYMENT_OUTCOME,
    );
  } catch {}
const metadata = {
  storage,
  application: 'SalesDrone',
  version: release.version,
  commit: release.commit,
  builtAt: release.builtAt,
  project,
  region: 'asia-south1',
  hosting: 'https://sales-drone-avinya.firebaseapp.com',
  repository: process.env.GITHUB_REPOSITORY,
  ref: process.env.GITHUB_REF,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  changelogUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/blob/${release.commit}/CHANGELOG.md`,
  functions,
};
await writeFile('deployment.json', JSON.stringify(metadata, null, 2));
console.log(
  'Captured safe deployment metadata for ' + functions.length + ' functions.',
);
