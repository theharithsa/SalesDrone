import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

function releaseCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'development';
  } catch {
    // Source archives can be built locally without Git metadata.
    return 'development';
  }
}

const metadata = {
  version,
  commit: releaseCommit(),
  builtAt: new Date().toISOString(),
};
if (process.env.VITE_DEPLOYMENT_ENVIRONMENT === 'pre-production') {
  metadata.environment = 'pre-production';
}
const json = JSON.stringify(metadata, null, 2) + '\n';
for (const file of ['functions/src/release.json', 'apps/web/public/version.json']) {
  await writeFile(new URL(file, root), json);
}
console.log('Release metadata: v' + version + ' / ' + metadata.commit.slice(0, 12));
