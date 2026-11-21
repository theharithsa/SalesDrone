// Cloud Run operator probe. Never read a customer document or send a notification.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const project = 'sales-drone-avinya';
const expectedAccount = 'salesdrone-production-runtime@' + project + '.iam.gserviceaccount.com';
const metadata = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/';
const metadataHeaders = { 'Metadata-Flavor': 'Google' };
assert.equal(await fetch(metadata + 'email', { headers: metadataHeaders }).then(response => response.text()), expectedAccount);
for (const name of ['CURSOR_SECRET', 'GEMINI_API_KEY', 'DYNATRACE_API_TOKEN'])
  assert.ok(process.env[name], 'Missing runtime secret binding');
const { access_token } = await fetch(metadata + 'token', { headers: metadataHeaders }).then(response => response.json());
assert.ok(access_token);
const headers = { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' };
const request = (url, body) => fetch(url, {
  headers, method: body ? 'POST' : 'GET',
  ...(body ? { body: JSON.stringify(body) } : {}),
  signal: AbortSignal.timeout(6000),
});
const id = 'sdr-iam-check-' + randomUUID();
const firestore = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/';
const probe = '/documents/preprodAcceptance/' + id + '?mask.fieldPaths=synthetic';
const storage = 'https://storage.googleapis.com/storage/v1/b/';
const emptyPrefix = '/o?maxResults=1&fields=kind&prefix=' + id;
const [prodRead, preprodDenied, prodBucket, preprodBucket, lookup, push] = await Promise.all([
  request(firestore + '(default)' + probe),
  request(firestore + 'preprod' + probe),
  request(storage + project + '.firebasestorage.app' + emptyPrefix),
  request(storage + project + '-preprod-files' + emptyPrefix),
  request('https://identitytoolkit.googleapis.com/v1/projects/' + project + '/accounts:lookup', { localId: [id] }),
  request('https://fcm.googleapis.com/v1/projects/' + project + '/messages:send',
    { validate_only: true, message: { token: id, data: { purpose: 'runtime-validation' } } }),
]);
assert.equal(prodRead.status, 404, 'Production Firestore probe must find no record');
assert.equal(preprodDenied.status, 403, 'Production runtime must be denied pre-production Firestore');
assert.equal(prodBucket.status, 200, 'Production bucket cannot be listed');
assert.equal(preprodBucket.status, 403, 'Production runtime can list the pre-production bucket');
assert.equal(lookup.status, 200, 'Firebase Auth lookup permission is missing');
assert.equal((await lookup.json()).users?.length || 0, 0);
assert.ok([200, 400].includes(push.status), 'FCM must accept or validate the synthetic dry-run input');
console.log('Verified read isolation, empty-prefix Storage access, Auth lookup, secret bindings and FCM validation only.');
