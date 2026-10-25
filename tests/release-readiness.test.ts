import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReleasePlan,
  validateChangeCoverage,
  preChecks,
  postChecks,
} from '../scripts/readiness-policy.mjs';
import {
  checkPublishedVersion,
  checkProtectedResponse,
  checkContract,
  checkFunctions,
  checkSettingsPage,
} from '../scripts/post-deploy-checks.mjs';
import {
  assertDeploymentReceipts,
  otlpReceipt,
} from '../scripts/deployment-signals.mjs';
import { probeSignals } from '../scripts/probe-deployment-signals.mjs';
const review = () => ({
  status: 'existing',
  reason: 'Reuse the tested safe instrumentation transport.',
  tests: ['functions/test/observability.test.js'],
});
function plan() {
  return {
    schemaVersion: 1,
    version: '1.5.0',
    summary: 'Group field settings and enforce complete release evidence.',
    modules: ['salesdrone-workspace-settings'],
    documentation: ['docs/SETTINGS.md'],
    settingsSections: ['fields'],
    api: {
      ...review(),
      status: 'unchanged',
      contractVersion: '1.12.0',
      permissions:
        'No access expansion; retain current Admin field-write policy.',
    },
    observability: Object.fromEntries(
      ['metrics', 'traces', 'logs', 'businessEvents', 'deploymentEvents'].map(
        (k) => [k, review()],
      ),
    ),
    preDeployment: preChecks,
    postDeployment: postChecks,
    manualVerification:
      'Verify the grouped menu using synthetic data and inspect the deployed page.',
  };
}
const context = {
  version: '1.5.0',
  contractVersion: '1.12.0',
  skills: ['salesdrone-workspace-settings'],
  sections: ['fields'],
  files: ['docs/SETTINGS.md', 'functions/test/observability.test.js'],
};
test('release gates reject missing documentation, API permission review, signal coverage and post-deployment checks', () => {
  validateReleasePlan(plan(), context);
  for (const signal of [
    'metrics',
    'traces',
    'logs',
    'businessEvents',
    'deploymentEvents',
  ]) {
    const p = plan();
    delete p.observability[signal];
    assert.throws(() => validateReleasePlan(p, context));
  }
  for (const mutate of [
    (p) => (p.documentation = []),
    (p) => (p.api.permissions = ''),
    (p) => (p.api.tests = ['not-a-test.md']),
    (p) => (p.summary = 'Complete impact review'),
    (p) => (p.postDeployment = []),
    (p) => (p.modules = ['unknown']),
    (p) => (p.settingsSections = ['unknown']),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateReleasePlan(p, context));
  }
});
test('live checks reject stale builds, public data responses, contract drift and missing/inactive functions', () => {
  const expected = { version: '1.5.0', commit: 'test-sha' };
  checkPublishedVersion(expected, expected);
  assert.throws(() =>
    checkPublishedVersion({ ...expected, commit: 'stale' }, expected),
  );
  checkProtectedResponse(
    { status: 401, version: '1.5.0', code: 'UNAUTHENTICATED' },
    expected,
  );
  for (const response of [
    { status: 200, version: '1.5.0', code: 'UNAUTHENTICATED' },
    { status: 401, version: '1.4.0', code: 'UNAUTHENTICATED' },
    { status: 401, version: '1.5.0', code: 'WRONG' },
  ])
    assert.throws(() => checkProtectedResponse(response, expected));
  checkContract({ paths: {} }, { paths: {} });
  assert.throws(() => checkContract({ paths: { a: {} } }, { paths: {} }));
  const functions = [
    'api',
    'reminders',
    'analyzeNotes',
    'leadIntelligence',
    'exportTelemetry',
  ].map((name) => ({ name, state: 'ACTIVE', revision: 'verified-revision' }));
  checkFunctions({ ...expected, functions }, expected);
  assert.throws(() =>
    checkFunctions({ ...expected, functions: functions.slice(1) }, expected),
  );
  functions[0].state = 'UNKNOWN';
  assert.throws(() => checkFunctions({ ...expected, functions }, expected));
  checkSettingsPage(
    '<meta name="salesdrone-version" content="1.5.0">Manage fields <article id="fields"></article><article id="choices"></article>',
    '1.5.0',
  );
  assert.throws(() => checkSettingsPage('old guide', '1.5.0'));
});
test('Dynatrace receipts require every signal and reject partial, malformed or missing acceptance', () => {
  const receipt = {
    signals: ['traces', 'logs', 'metrics'].map((signal) =>
      otlpReceipt(signal, 200, new Uint8Array()),
    ),
    bizEventStatus: 202,
    deploymentMarkerStatus: 201,
    markerResults: [{ status: 'OK' }],
  };
  assertDeploymentReceipts(receipt);
  for (const signal of ['traces', 'logs', 'metrics'])
    assert.throws(() =>
      assertDeploymentReceipts({
        ...receipt,
        signals: receipt.signals.filter((s) => s.signal !== signal),
      }),
    );
  const partial = otlpReceipt('traces', 200, new Uint8Array([10, 2, 8, 1]));
  assert.equal(partial.rejected, 1);
  assert.throws(() =>
    assertDeploymentReceipts({
      ...receipt,
      signals: [partial, ...receipt.signals.slice(1)],
    }),
  );
  assert.throws(() =>
    assertDeploymentReceipts({ ...receipt, bizEventStatus: 200 }),
  );
  assert.throws(() =>
    assertDeploymentReceipts({
      ...receipt,
      markerResults: [{ status: 'ERROR' }],
    }),
  );
  assert.throws(() =>
    assertDeploymentReceipts({
      ...receipt,
      signals: [
        otlpReceipt('traces', 200, new Uint8Array([255])),
        ...receipt.signals.slice(1),
      ],
    }),
  );
});
test('release probe produces real SDK OTLP signals and forwards each with bounded secret-bearing transport', async () => {
  const requests = [];
  const receipts = await probeSignals(
    'https://example.live.dynatrace.com',
    'synthetic-not-a-credential',
    async (url, options) => {
      requests.push({
        url,
        method: options.method,
        redirect: options.redirect,
        bytes: options.body.length,
        authorization: options.headers.Authorization,
      });
      return new Response(null, { status: 200 });
    },
  );
  for (const signal of ['traces', 'logs', 'metrics']) {
    assert.ok(
      receipts.some(
        (r) => r.signal === signal && r.status === 200 && r.rejected === 0,
      ),
    );
    assert.ok(
      requests.some(
        (r) =>
          r.url.endsWith('/' + signal) &&
          r.bytes > 0 &&
          r.redirect === 'error' &&
          r.authorization === 'Api-Token synthetic-not-a-credential',
      ),
    );
  }
});

test('published settings and API changes require matching reference and permission-test updates', () => {
  const p = plan();
  const changes = [
    'skills/salesdrone-workspace-settings/SKILL.md',
    'docs/settings-reference.json',
  ];
  validateChangeCoverage(p, changes);
  assert.throws(() => validateChangeCoverage(p, changes.slice(0, 1)));
  p.api.status = 'changed';
  assert.throws(() => validateChangeCoverage(p, changes));
  validateChangeCoverage(p, [
    ...changes,
    'docs/API.md',
    'scripts/openapi.mjs',
    'functions/test/observability.test.js',
  ]);
});

test('changed UI screenshots need current reviewed release evidence', async () => {
  const { validateScreenshotEvidence } = await import(
    '../scripts/readiness-policy.mjs'
  );
  const plan = { version: '1.6.0', screenshots: ['screen.jpg'] };
  const entry = {
    file: 'screen.jpg',
    version: '1.6.0',
    mode: 'synthetic-demo',
    viewport: '1200 × 900',
    review: 'Fictional records reviewed',
    sha256: 'a'.repeat(64),
  };
  assert.doesNotThrow(() => validateScreenshotEvidence(plan, [entry]));
  assert.throws(() =>
    validateScreenshotEvidence(plan, [{ ...entry, version: '1.5.1' }]),
  );
  assert.throws(() =>
    validateScreenshotEvidence(plan, [{ ...entry, mode: 'production' }]),
  );
  assert.throws(() => validateScreenshotEvidence(plan, []));
});
