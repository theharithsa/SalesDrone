import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { checkContract, checkPublishedVersion } from './post-deploy-checks.mjs';

export function parseHostingPreview(receipt, site) {
  const entry = receipt.result?.[site];
  if (receipt.status !== 'success' || entry?.site !== site ||
      typeof entry.version !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.version)) {
    throw Error('Missing immutable Hosting preview version');
  }
  const url = new URL(entry.url);
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      !url.hostname.startsWith(site + '--') || !url.hostname.endsWith('.web.app')) {
    throw Error('Unexpected Hosting preview origin');
  }
  return { version: entry.version, url };
}

export async function verifyHostingPreview(preview, release, contract, fetchImpl = fetch) {
  const read = async (path) => {
    const response = await fetchImpl(new URL(path, preview.url), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('Staged Hosting metadata unavailable');
    return response.json();
  };
  const [published, openapi] = await Promise.all([
    read('/version.json'),
    read('/openapi.json'),
  ]);
  checkPublishedVersion(published, release);
  checkContract(openapi, contract);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const preview = parseHostingPreview(await json(process.argv[2]), process.env.GCP_PROJECT_ID);
  const release = await json('functions/src/release.json');
  const contract = await json('apps/web/dist/openapi.json');
  for (let attempt = 0; ; attempt++) {
    try {
      await verifyHostingPreview(preview, release, contract);
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await appendFile(process.env.GITHUB_OUTPUT, 'version=' + preview.version + '\n');
  console.log('Staged Hosting v' + release.version + ' at ' + release.commit);
}
