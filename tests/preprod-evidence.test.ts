import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { preprodChecks, verifyPreprodArtifact } from '../scripts/preprod-evidence.mjs';

const run = { id: 123, run_attempt: 2, head_sha: 'a'.repeat(40) };
const tree = 'b'.repeat(40);
const version = '2.14.0';
const receipt = {
  origin: 'https://sales-drone-avinya-preprod.web.app',
  environment: 'pre-production', version, tree, commit: run.head_sha,
  runId: run.id, attempt: run.run_attempt, checkedAt: '2026-11-22T00:00:00Z',
  checks: preprodChecks,
};

function zippedReceipt(fields: Partial<typeof receipt> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'salesdrone-receipt-test-'));
  try {
    writeFileSync(join(dir, 'preproduction-verification.json'), JSON.stringify({ ...receipt, ...fields }));
    execFileSync('zip', ['-q', 'receipt.zip', 'preproduction-verification.json'], { cwd: dir });
    const archive = readFileSync(join(dir, 'receipt.zip'));
    return { archive, artifact: { digest: 'sha256:' + createHash('sha256').update(archive).digest('hex') } };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts the exact pre-production receipt and archive digest', () => {
  const { archive, artifact } = zippedReceipt();
  assert.doesNotThrow(() => verifyPreprodArtifact(archive, artifact, { run, tree, version }));
});

test('rejects missing or altered archive digests', () => {
  const { archive, artifact } = zippedReceipt();
  assert.throws(() => verifyPreprodArtifact(archive, {}, { run, tree, version }), /Missing receipt digest/);
  assert.throws(() => verifyPreprodArtifact(Buffer.concat([archive, Buffer.from('altered')]), artifact, { run, tree, version }), /digest mismatch/);
});

test('rejects a valid archive with stale release, wrong environment or incomplete smoke evidence', () => {
  const variants: Partial<typeof receipt>[] = [
    { commit: 'c'.repeat(40) }, { tree: 'd'.repeat(40) }, { version: '2.13.11' },
    { runId: 456 }, { attempt: 1 }, { environment: 'production' },
    { origin: 'https://salesdrone.in' }, { checks: ['hosting-identity'] },
  ];
  for (const fields of variants) {
    const { archive, artifact } = zippedReceipt(fields);
    assert.throws(() => verifyPreprodArtifact(archive, artifact, { run, tree, version }), { name: 'AssertionError' }, JSON.stringify(fields));
  }
});
