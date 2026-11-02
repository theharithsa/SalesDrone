import { CI_CHECKS } from '../functions/src/ci-contract.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createTelemetry } from '../functions/src/telemetry.js';
import { tenantOrigin } from '../functions/src/telemetry-outbox.js';
import { ciEvent, sendCiEvent } from './ci-events.mjs';
import { CASE_SUITES, readCaseEvidence } from './ci-case-evidence.mjs';
const token = process.env.DYNATRACE_API_TOKEN;
if (!token) throw Error('Missing trusted CI reporting secret');
const tenant = tenantOrigin(
  process.env.DYNATRACE_TENANT_URL || 'https://indiacs.live.dynatrace.com',
);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const meta = {
  repository: 'theharithsa/SalesDrone',
  commit: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  attempt: process.env.GITHUB_RUN_ATTEMPT,
  version,
  finishedAt: new Date().toISOString(),
};
let report;
try {
  report = JSON.parse(await readFile('test-results/ci-checks.json', 'utf8'));
} catch {
  report = { results: [] };
}
const sourceResults = report.results || [];
const results = CI_CHECKS.filter(
  (id) => !['workflow', 'deploy-job', 'docs-job'].includes(id),
)
  .map(
    (id) => sourceResults.find((r) => r.id === id) || { id, status: 'not-run' },
  )
  .map((r) => ({
    ...r,
    check: r.id,
    finishedAt: r.finishedAt || report.finishedAt,
  }));
const caseEvidenceFailures=[];
for (const check of CASE_SUITES) {
  // Only read cases when the corresponding command actually ran; no stale local artifacts.
  if (!results.some((r) => r.check === check && r.status !== 'not-run'))
    continue;
  try {results.push(...await readCaseEvidence(check));}
  catch {caseEvidenceFailures.push(check);}
}
const jobOutcome = (value) =>
  ({
    success: 'passed',
    failure: 'failed',
    cancelled: 'cancelled',
    skipped: 'skipped',
  })[value] || 'not-run';
results.push({
  check: 'deploy-job',
  status: jobOutcome(process.env.CI_DEPLOY_RESULT),
});
results.push({
  check: 'docs-job',
  status: jobOutcome(process.env.CI_DOCS_RESULT),
});
const jobs = ['VERIFY', 'DEPLOY', 'DOCS'].map(
  (job) => process.env['CI_' + job + '_RESULT'],
);
const status = jobs.every((s) => s === 'success')
  ? 'passed'
  : jobs.some((s) => s === 'failure')
    ? 'failed'
    : jobs.some((s) => s === 'cancelled')
      ? 'cancelled'
      : 'not-run';
results.push({ check: 'workflow', status });
if (results.length > 1000) throw Error('CI result bound exceeded');
const t = createTelemetry({
  tenant,
  key: token,
  service: 'salesdrone-ci',
  environment: 'ci',
});
const receipts = [];
try {
  await t.worker('ci.report', async () => {
    for (let start = 0; start < results.length; start += 4)
      await Promise.all(
        results.slice(start, start + 4).map(async (r) => {
          const event = ciEvent(
            r.check === 'workflow'
              ? meta
              : { ...meta, attempt: report.runAttempt || meta.attempt },
            r,
          );
          await t.span(
            'ci.result',
            async () => {
              const capture = t.capture();
              if (capture.traceparent) event.traceparent = capture.traceparent;
              t.quality(
                r.check,
                r.status,
                r.durationMs,
                r.caseId,
                String(meta.runId),
              );
              receipts.push({
                id: event.id,
                kind: event.data['ci.kind'],
                status: await sendCiEvent(tenant, token, event),
              });
            },
            {
              'ci.check': r.check,
              'ci.status': r.status,
              ...(r.caseId ? { 'ci.case.id': r.caseId } : {}),
            },
          );
        }),
      );
    return { processed: results.length };
  });
  await t.flush();
} finally {
  await t.shutdown();
  await mkdir('test-results', { recursive: true });
  await writeFile(
    'test-results/ci-monitoring.json',
    JSON.stringify(
      {
        version,
        commit: meta.commit,
        runId: meta.runId,
        receipts,
        caseEvidenceComplete:caseEvidenceFailures.length===0,
        caseEvidenceFailures,
        tenantSearchability:
          'requires separate tenant query; HTTP acceptance is not searchability',
      },
      null,
      2,
    ) + '\n',
  );
}
if (
  caseEvidenceFailures.length ||
  receipts.length !== results.length ||
  receipts.some((r) => r.status !== 202)
)
  throw Error(
    'CI telemetry was not fully accepted; do not redeploy the app to retry reporting',
  );
console.log('Reported CI metadata records:', receipts.length);
