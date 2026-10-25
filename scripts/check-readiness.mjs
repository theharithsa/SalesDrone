import { spawnSync } from 'node:child_process';
import { readFile, readdir, access } from 'node:fs/promises';
import {
  validateReleasePlan,
  validateChangeCoverage,
} from './readiness-policy.mjs';
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const { version } = await read('package.json'),
  plan = await read(`releases/${version}.json`),
  spec = await read('docs/openapi.json');
const paths = [
  ...(plan.documentation || []),
  ...(plan.api?.tests || []),
  ...Object.values(plan.observability || {}).flatMap((s) => s.tests || []),
];
for (const p of paths) {
  if (p.startsWith('/') || p.split('/').includes('..'))
    throw Error('Nonportable release evidence path');
  await access(p);
}
validateReleasePlan(plan, {
  version,
  contractVersion: spec.info.version,
  skills: (await readdir('skills')).filter((s) => s.startsWith('salesdrone-')),
  sections: (await read('apps/web/src/lib/settings-sections.json')).map(
    (s) => s.id,
  ),
  files: paths,
});
console.log(
  'Release impact plan complete; execution evidence is collected separately by CI.',
);

const base = process.env.BASE_SHA;
if (base && !/^0+$/.test(base)) {
  if (!/^[a-f0-9]{40}$/.test(base)) throw Error('Invalid release base');
  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AMR', base, 'HEAD', '--'],
    { encoding: 'utf8' },
  );
  if (result.status) throw Error('Fetch complete release history');
  validateChangeCoverage(plan, result.stdout.split('\n').filter(Boolean));
  console.log('Changed settings/API/skill coverage verified.');
}
