import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForPagesArtifact } from '../scripts/wait-pages-artifact.mjs';
const name = 'github-pages-123-2';
const valid = { id: 42, name, size_in_bytes: 1000, expired: false };
const fixture = (responses: unknown[], timeoutMs = 6000) => {
  let time = 0, calls = 0;
  return { name, id: '42', now: () => time, sleep: async (ms: number) => { time += ms; },
    timeoutMs, list: async () => responses[Math.min(calls++, responses.length - 1)] };
};
test('Pages waits for the uploaded ID to become visible and ignores prior-attempt artifacts', async () => {
  const result = await waitForPagesArtifact(fixture([null, { artifacts: [{ ...valid, name: 'github-pages-123-1', id: 41 }] }, { artifacts: [valid] }]));
  assert.deepEqual(result, { id: '42', name, attempts: 3 });
});
test('Pages readiness stops at its deadline rather than deploying a missing artifact', async () => {
  await assert.rejects(waitForPagesArtifact(fixture([{ artifacts: [] }])), /deadline/);
});
test('Pages refuses an ambiguous or mismatched artifact instead of guessing', async () => {
  await assert.rejects(waitForPagesArtifact(fixture([{ artifacts: [valid, valid] }])), /Ambiguous/);
  await assert.rejects(waitForPagesArtifact(fixture([{ artifacts: [{ ...valid, id: 99 }] }])), /ID does not match/);
});
test('Pages rejects unusable metadata and invalid attempt identity', async () => {
  for (const artifact of [{ ...valid, expired: true }, { ...valid, size_in_bytes: 0 }]) {
    await assert.rejects(waitForPagesArtifact(fixture([{ artifacts: [artifact] }])), /expired or empty/);
  }
  await assert.rejects(waitForPagesArtifact(fixture([{}])), /Invalid Pages artifact metadata/);
  await assert.rejects(waitForPagesArtifact({ ...fixture([]), name: 'github-pages' }), /identity/);
});

test('Pages upload, readiness and deploy share an attempt-specific identity', async () => {
  const { readFile } = await import('node:fs/promises');
  const workflow = await readFile('.github/workflows/public-docs.yml', 'utf8');
  assert.equal(workflow.match(/github-pages-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/g)?.length, 3);
  assert.match(workflow, /PAGES_ARTIFACT_ID: \$\{\{ steps.pages-artifact.outputs.artifact_id \}\}/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/pages-artifact-ready/);
  assert.match(workflow, /Wait for publishing artifact metadata\n        timeout-minutes: 2/);
});
