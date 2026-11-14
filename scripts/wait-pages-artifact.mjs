import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function waitForPagesArtifact({ name, id, list, now = Date.now,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)), timeoutMs = 90000, intervalMs = 2000 }) {
  if (!/^github-pages-\d+-\d+(?:-probe)?$/.test(name) || !/^\d+$/.test(String(id))) {
    throw Error('Invalid Pages artifact identity');
  }
  const deadline = now() + timeoutMs;
  let attempts = 0;
  while (now() < deadline) {
    const result = await list(Math.min(10000, deadline - now()));
    attempts++;
    if (result !== null) {
      if (!Array.isArray(result.artifacts)) throw Error('Invalid Pages artifact metadata');
      const matches = result.artifacts.filter((artifact) => artifact.name === name);
      if (matches.length > 1) throw Error('Ambiguous Pages artifact metadata');
      if (matches.length === 1) {
        const artifact = matches[0];
        if (String(artifact.id) !== String(id)) throw Error('Pages artifact ID does not match upload');
        if (artifact.expired || !(artifact.size_in_bytes > 0)) throw Error('Pages artifact is expired or empty');
        return { id: String(id), name, attempts };
      }
    }
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }
  throw Error('Pages artifact metadata was not ready before the deadline');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { DefaultArtifactClient } = await import('@actions/artifact');
  const client = new DefaultArtifactClient();
  const result = await waitForPagesArtifact({
    name: process.env.PAGES_ARTIFACT_NAME, id: process.env.PAGES_ARTIFACT_ID,
    list: async () => {
      const response = await client.listArtifacts();
      return { artifacts: response.artifacts.map(({ id, name, size }) => ({
        id, name, size_in_bytes: size, expired: false,
      })) };
    },
  });
  console.log(`Pages artifact ready: ${result.name}; matched uploaded ID; ${result.attempts} lookup(s).`);
}
