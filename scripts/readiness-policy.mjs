export const preChecks = [
  'unit-tests',
  'types',
  'emulator',
  'api-contract',
  'settings-docs',
  'skill-tree',
  'security-scan',
  'production-build',
];
export const postChecks = [
  'live-version',
  'live-contract',
  'unauthenticated-denial',
  'function-revisions',
  'public-settings-guide',
  'dynatrace-receipts',
];
export function validateReleasePlan(
  plan,
  { version, contractVersion, skills, sections, files },
) {
  const text = (v) =>
    typeof v === 'string' &&
    v.trim().length >= 12 &&
    !/Complete impact review|TODO|TBD|Describe this release/i.test(v);
  if (
    plan.schemaVersion !== 1 ||
    plan.version !== version ||
    !text(plan.summary)
  )
    throw Error('Missing current release impact plan');
  if (
    !Array.isArray(plan.modules) ||
    !plan.modules.length ||
    new Set(plan.modules).size !== plan.modules.length ||
    plan.modules.some((s) => !skills.includes(s))
  )
    throw Error('Select valid affected modules');
  if (
    !plan.documentation?.length ||
    plan.documentation.some((f) => !files.includes(f))
  )
    throw Error('Link existing feature documentation');
  if (
    !Array.isArray(plan.settingsSections) ||
    plan.settingsSections.some((id) => !sections.includes(id))
  )
    throw Error('Document valid settings sections');
  const review = (v) =>
    v &&
    ['changed', 'existing', 'unchanged', 'not-applicable'].includes(v.status) &&
    text(v.reason) &&
    v.tests?.length &&
    v.tests.every(
      (f) => files.includes(f) && /(?:test|integration)\.(?:js|ts)$/.test(f),
    );
  if (
    !review(plan.api) ||
    plan.api.contractVersion !== contractVersion ||
    !text(plan.api.permissions)
  )
    throw Error('Review API contract, permissions and tests');
  for (const signal of [
    'metrics',
    'traces',
    'logs',
    'businessEvents',
    'deploymentEvents',
  ])
    if (!review(plan.observability?.[signal]))
      throw Error('Review observability signal: ' + signal);
  for (const [key, required] of [
    ['preDeployment', preChecks],
    ['postDeployment', postChecks],
  ])
    if (
      !Array.isArray(plan[key]) ||
      required.some((id) => !plan[key].includes(id))
    )
      throw Error('Incomplete ' + key + ' checks');
  if (!text(plan.manualVerification))
    throw Error('State the manual verification plan and limitations');
}
export function validateChangeCoverage(plan, changed) {
  const moduleUpdate = changed.some((p) =>
    /^skills\/salesdrone-[a-z0-9-]+\/SKILL\.md$/.test(p),
  );
  if (changed.length && !moduleUpdate)
    throw Error('Update an affected module skill');
  if (
    plan.settingsSections.length &&
    !changed.includes('docs/settings-reference.json')
  )
    throw Error('Changed settings need a control reference update');
  if (
    plan.api.status === 'changed' &&
    (!changed.includes('docs/API.md') ||
      !changed.includes('scripts/openapi.mjs') ||
      !plan.api.tests.some((p) => changed.includes(p)))
  )
    throw Error(
      'API changes need docs, generated-contract source and behavior/permission tests',
    );
}

export function validateScreenshotEvidence(plan, manifest) {
  for (const file of plan.screenshots || []) {
    const entry = manifest.find((item) => item.file === file);
    if (
      !entry ||
      entry.version !== plan.version ||
      !entry.viewport ||
      !entry.review ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !['synthetic-demo', 'public-contract'].includes(entry.mode)
    )
      throw Error('Missing current reviewed screenshot: ' + file);
  }
}
