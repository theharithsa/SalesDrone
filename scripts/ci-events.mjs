import { CI_CHECKS, CI_STATUSES } from '../functions/src/ci-contract.js';
import { createHash } from 'node:crypto';
export const CI_PROVIDER = 'com.avinyatech.salesdrone.github-actions';
const checks = new Set(CI_CHECKS);
const statuses = new Set(CI_STATUSES);
const digest = (value) => createHash('sha256').update(value).digest('hex');
/** Explicit extraction: no logs, error text, test names, paths from payloads or raw objects. */
export function ciEvent(meta, result) {
  if (
    !/^[a-f0-9]{40}$/.test(meta.commit) ||
    !/^\d+$/.test(String(meta.runId)) ||
    !/^\d+$/.test(String(meta.attempt)) ||
    !/^\d+\.\d+\.\d+$/.test(meta.version)
  )
    throw Error('Invalid CI identity');
  if (
    !checks.has(result.check) ||
    !statuses.has(result.status) ||
    (result.caseId && !/^[a-f0-9]{64}$/.test(result.caseId))
  )
    throw Error('Invalid CI result');
  const kind = result.caseId
    ? 'testcase'
    : result.check === 'workflow'
      ? 'workflow'
      : 'check';
  const id = digest(
    [
      meta.repository,
      meta.commit,
      meta.runId,
      meta.attempt,
      kind,
      result.check,
      result.caseId || '',
    ].join(':'),
  );
  const time = new Date(result.finishedAt || meta.finishedAt).toISOString();
  const durationMs = Number.isFinite(result.durationMs)
    ? Math.min(86400000, Math.max(0, result.durationMs))
    : 0;
  return {
    specversion: '1.0',
    id,
    source: CI_PROVIDER,
    type: `${CI_PROVIDER}.ci.${kind}.completed`,
    time,
    data: {
      'event.id': id,
      'event.provider': CI_PROVIDER,
      'event.authority': 'automation-confirmed',
      'schema.version': 1,
      'app.version': meta.version,
      'build.commit': meta.commit,
      'github.run.id': String(meta.runId),
      'github.run.attempt': String(meta.attempt),
      'github.run.url': `https://github.com/theharithsa/SalesDrone/actions/runs/${meta.runId}`,
      'ci.kind': kind,
      'ci.check': result.check,
      'ci.status': result.status,
      'ci.duration.available': Number.isFinite(result.durationMs),
      ...(Number.isFinite(result.durationMs)
        ? { 'ci.duration.ms': durationMs }
        : {}),
      ...(result.caseId ? { 'ci.case.id': result.caseId } : {}),
      'transaction.id': digest(
        [meta.commit, meta.runId, meta.attempt].join(':'),
      ),
      'correlation.origin': 'ci-report',
    },
  };
}
export async function sendCiEvent(tenant, token, event, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let status = 0;
    try {
      const r = await fetchImpl(tenant + '/api/v2/bizevents/ingest', {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'Api-Token ' + token,
          'Content-Type': 'application/cloudevent+json',
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10000),
      });
      status = r.status;
    } catch {}
    if (
      status === 202 ||
      (status >= 400 && status < 500 && ![408, 429].includes(status))
    )
      return status;
    if (attempt < 2)
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  return 0;
}
