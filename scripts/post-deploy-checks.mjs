import { createHash } from 'node:crypto';
export function checkPublishedVersion(actual, expected) {
  if (actual.version !== expected.version || actual.commit !== expected.commit)
    throw Error('Published version/commit mismatch');
}
export function checkProtectedResponse({ status, version, code }, expected) {
  if (
    status !== 401 ||
    version !== expected.version ||
    code !== 'UNAUTHENTICATED'
  )
    throw Error('Protected API denial/version check failed');
}
export function checkContract(actual, expected) {
  const digest = (v) =>
    createHash('sha256').update(JSON.stringify(v)).digest('hex');
  if (digest(actual) !== digest(expected))
    throw Error('Published OpenAPI mismatch');
}
export function checkFunctions(metadata, expected) {
  checkPublishedVersion(metadata, expected);
  const names = [
    'api',
    'reminders',
    'analyzeNotes',
    'leadIntelligence',
    'exportTelemetry',
  ];
  if (
    metadata.functions?.length !== names.length ||
    names.some(
      (name) =>
        !metadata.functions.some(
          (f) =>
            f.name === name &&
            f.state === 'ACTIVE' &&
            typeof f.revision === 'string' &&
            f.revision,
        ),
    )
  )
    throw Error('Function revisions are incomplete or inactive');
}
export function checkSettingsPage(html, version, commit) {
  if (
    !html.includes(`name="salesdrone-version" content="${version}"`) ||
    (commit &&
      !html.includes(`name="salesdrone-commit" content="${commit}"`)) ||
    !html.includes('Manage fields') ||
    !html.includes('id="fields"') ||
    !html.includes('id="choices"')
  )
    throw Error('Public settings reference is missing or stale');
}

export function checkProductPage(html, version, commit) {
  if (
    !html.includes(`name="salesdrone-version" content="${version}"`) ||
    (commit &&
      !html.includes(`name="salesdrone-commit" content="${commit}"`)) ||
    !html.includes('id="lead-workspace"') ||
    !html.includes('id="api"') ||
    !html.includes('Handbook modules')
  )
    throw Error('Public product handbook is missing or stale');
}

export function checkStorage(metadata) {
  const s = metadata.storage;
  if (
    s?.bucket !== 'sales-drone-avinya.firebasestorage.app' ||
    s.state !== 'verified' ||
    s.deploymentOutcome !== 'success' ||
    s.publicAccessPrevention !== 'enforced'
  )
    throw Error('Private Storage configuration is unverified');
}
