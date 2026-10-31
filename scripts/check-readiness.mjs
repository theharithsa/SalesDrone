import { requireMilestoneReference, verifyGitHubMilestone } from './milestone-policy.mjs';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, access } from 'node:fs/promises';
import {
  validateReleasePlan,
  validateScreenshotEvidence,
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
validateScreenshotEvidence(
  plan,
  await read('site/assets/screenshots/manifest.json'),
);
if(plan.milestone){
  requireMilestoneReference(plan);
  if(plan.milestone.readiness!=='ready')throw Error('Milestone #'+plan.milestone.number+' is still in planning; production publication is held');
  if(process.env.GITHUB_ACTIONS==='true'){
    const event=process.env.GITHUB_EVENT_PATH?JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8')):{};
    await verifyGitHubMilestone(plan,{repository:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN,mode:process.env.GITHUB_EVENT_NAME==='pull_request'?'pull_request':'publication',body:event.pull_request?.body||'',apiUrl:process.env.GITHUB_API_URL});
  }
}else if((Number(version.split('.')[0])>2||(Number(version.split('.')[0])===2&&Number(version.split('.')[1])>=6)))throw Error('Current releases require a scoped milestone reference');
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
