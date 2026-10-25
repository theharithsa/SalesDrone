import { readFile, writeFile } from 'node:fs/promises';
import { probeSignals } from './probe-deployment-signals.mjs';
import { assertDeploymentReceipts } from './deployment-signals.mjs';
import { createHash } from 'node:crypto';
const token = process.env.DYNATRACE_API_TOKEN,
  tenant =
    process.env.DYNATRACE_TENANT_URL || 'https://indiacs.live.dynatrace.com';
if (!token) throw Error('Missing Dynatrace deployment secret');
const u = new URL(tenant);
if (
  u.protocol !== 'https:' ||
  !/^[-a-z0-9]+\.live\.dynatrace\.com$/.test(u.hostname) ||
  u.username ||
  u.password ||
  u.pathname !== '/'
)
  throw Error('Invalid Dynatrace origin');
const metadata = JSON.parse(await readFile('deployment.json', 'utf8')),
  outcome = process.env.DEPLOYMENT_OUTCOME || 'unknown',
  id = createHash('sha256')
    .update(
      [
        metadata.repository,
        metadata.commit,
        metadata.runId,
        metadata.runAttempt,
        outcome,
      ].join(':'),
    )
    .digest('hex');
const version = metadata.version;
async function send(path, body, contentType = 'application/json') {
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await fetch(u.origin + path, {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'Api-Token ' + token,
          'Content-Type': contentType,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      if (attempt === 2) throw Error('Deployment telemetry network failure');
    }
    if (r && r.status < 500 && r.status !== 429) return r;
    if (attempt === 2) throw Error('Deployment telemetry unavailable');
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}
const data = {
  'event.id': id,
  'event.provider': 'com.avinyatech.salesdrone.github-actions',
  'event.authority': 'automation-confirmed',
  'schema.version': 1,
  'app.version': version,
  'deployment.outcome': outcome,
  'build.commit': metadata.commit,
  'github.run.id': metadata.runId,
  'github.run.attempt': metadata.runAttempt,
  'github.run.url': metadata.runUrl,
  repository: metadata.repository,
  'deployment.project': metadata.project,
  'deployment.region': metadata.region,
  'deployment.hosting': metadata.hosting,
  'deployment.functions': JSON.stringify(metadata.functions),
  'changelog.url': metadata.changelogUrl,
};
const biz = await send(
  '/api/v2/bizevents/ingest',
  {
    specversion: '1.0',
    id,
    source: 'com.avinyatech.salesdrone.github-actions',
    type: 'com.avinyatech.salesdrone.deployment.' + outcome,
    time: new Date().toISOString(),
    data,
  },
  'application/cloudevent+json',
);
const marker = await send('/api/v2/events/ingest', {
  eventType: 'CUSTOM_DEPLOYMENT',
  title: `SalesDrone v${version} · ${outcome}`,
  properties: {
    'dt.event.deployment.name': 'SalesDrone',
    'dt.event.deployment.version': version,
    'dt.event.deployment.release_stage': 'production',
    'dt.event.deployment.ci_back_link': metadata.runUrl,
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  },
});
let result;
try {
  result = await marker.json();
} catch {}
const receipts = {
  version,
  outcome,
  eventId: id,
  signals: await probeSignals(u.origin, token),
  bizEventStatus: biz.status,
  deploymentMarkerStatus: marker.status,
  markerResults: result?.eventIngestResults?.map((r) => ({
    status: r.status,
    correlationId: r.correlationId,
  })),
  tenantSearchability: 'not verified by HTTP acceptance',
};
let accepted = false;
try {
  assertDeploymentReceipts(receipts);
  accepted = true;
} finally {
  await writeFile(
    'monitoring.json',
    JSON.stringify({ ...receipts, accepted }, null, 2) + '\n',
  );
  console.log(JSON.stringify({ ...receipts, accepted }));
}
