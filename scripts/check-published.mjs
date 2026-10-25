import { readFile } from 'node:fs/promises';
import { checkPublishedVersion } from './post-deploy-checks.mjs';
const expected = JSON.parse(
  await readFile('functions/src/release.json', 'utf8'),
);
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const r = await fetch(
      'https://sales-drone-avinya.firebaseapp.com/version.json',
      { cache: 'no-store', signal: AbortSignal.timeout(12000) },
    );
    if (!r.ok) throw Error('Version unavailable');
    checkPublishedVersion(await r.json(), expected);
    console.log('Published v' + expected.version + ' ' + expected.commit);
    process.exit(0);
  } catch {
    if (attempt === 5) throw Error('Published version/commit did not converge');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
