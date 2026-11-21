import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preproduction } from '../functions/src/preproduction.js';

export const preprodChecks = Object.freeze([
  'hosting-identity', 'anonymous-denial', 'malformed-json-boundary',
]);

export function verifyPreprodArtifact(archive, artifact, { run, tree, version }) {
  assert.match(artifact.digest || '', /^sha256:[a-f0-9]{64}$/, 'Missing receipt digest');
  const digest = 'sha256:' + createHash('sha256').update(archive).digest('hex');
  assert.equal(digest, artifact.digest, 'Pre-production receipt digest mismatch');
  const temp = mkdtempSync(join(tmpdir(), 'salesdrone-preprod-'));
  try {
    const archivePath = join(temp, 'receipt.zip');
    writeFileSync(archivePath, archive);
    const receipt = JSON.parse(execFileSync('unzip', ['-p', archivePath, 'preproduction-verification.json'], {
      encoding: 'utf8', maxBuffer: 64 * 1024,
    }));
    assert.equal(receipt.environment, 'pre-production');
    assert.equal(receipt.origin, preproduction.origin);
    assert.equal(receipt.version, version);
    assert.equal(receipt.commit, run.head_sha);
    assert.equal(receipt.tree, tree);
    assert.equal(receipt.runId, run.id);
    assert.equal(receipt.attempt, run.run_attempt);
    assert.ok(Number.isFinite(Date.parse(receipt.checkedAt)), 'Missing receipt timestamp');
    assert.deepEqual([...receipt.checks].sort(), [...preprodChecks].sort());
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
