import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const project = 'sales-drone-avinya';
const database = 'preprod';
const { indexes } = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
const needed = indexes.filter(index =>
  index.collectionGroup === 'emailJobs' ||
  (index.collectionGroup === 'tasks' && index.fields.some(field => field.fieldPath === 'completedAt')));
const args = ['--project', project, '--database', database, '--quiet'];
const gcloud = process.env.SDR_GCLOUD_BIN || 'gcloud';
function cli(command) {
  return execFileSync(gcloud, ['firestore', 'indexes', 'composite', ...command, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
}
const match = (request, actual) =>
  actual.queryScope === 'COLLECTION' &&
  actual.name.includes('/collectionGroups/' + request.collectionGroup + '/') &&
  actual.fields.length >= request.fields.length &&
  actual.fields.filter(field => field.fieldPath !== '__name__').length === request.fields.length &&
  request.fields.every((field, index) =>
    field.fieldPath === actual.fields[index].fieldPath && field.order === actual.fields[index].order);
const list = () => JSON.parse(cli(['list', '--format=json']));
let current = list();
for (const index of needed) {
  if (current.some(value => match(index, value))) continue;
  if (process.argv.includes('--verify'))
    throw Error('Missing email index on the pre-production database');
  try {
    cli(['create', '--async', '--collection-group=' + index.collectionGroup, '--query-scope=collection',
      ...index.fields.map(field => '--field-config=field-path=' + field.fieldPath + ',order=' + field.order.toLowerCase())]);
  } catch (error) {
    current = list();
    if (!current.some(value => match(index, value))) throw error;
  }
}
for (let attempt = 0; attempt < 90; attempt++) {
  current = list();
  if (needed.every(index => current.some(value => match(index, value) && value.state === 'READY'))) {
    console.log('Pre-production email and digest indexes are ready.');
    process.exit(0);
  }
  await setTimeout(5000);
}
throw Error('Pre-production email indexes are still building');
