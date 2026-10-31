import { requireMilestoneReference, readMilestoneWithGh, validateMilestoneSnapshot } from './milestone-policy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const bump = process.argv[2],
  index = { major: 0, minor: 1, patch: 2 }[bump];
if (index === undefined)
  throw Error('Usage: npm run release -- major|minor|patch');
const current = JSON.parse(readFileSync('package.json', 'utf8')).version,
  parts = current.split('.').map(Number);
parts[index]++;
for (let i = index + 1; i < 3; i++) parts[i] = 0;
const version = parts.join('.');
let planned;
try {planned=JSON.parse(readFileSync('releases/'+version+'.json','utf8'));}
catch {throw Error('Create the GitHub milestone, assign scoped issues, then run release:plan before advancing '+version);}
requireMilestoneReference(planned,version);
const snapshot=readMilestoneWithGh(planned.milestone.number);
validateMilestoneSnapshot(planned,snapshot.milestone,snapshot.issues,{mode:'prepare'});
for (const f of [
  'package.json',
  'apps/web/package.json',
  'functions/package.json',
]) {
  const j = JSON.parse(readFileSync(f));
  j.version = version;
  writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
}
for (const f of ['package-lock.json', 'functions/package-lock.json']) {
  const j = JSON.parse(readFileSync(f));
  j.version = version;
  for (const p of [
    '',
    ...(f === 'package-lock.json' ? ['apps/web', 'functions'] : []),
  ])
    if (j.packages?.[p]) j.packages[p].version = version;
  writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
}
writeFileSync(
  'functions/src/release.json',
  JSON.stringify({ version, commit: 'development', builtAt: null }, null, 2) +
    '\n',
);
const file = 'CHANGELOG.md',
  old = readFileSync(file, 'utf8'),
  at = old.indexOf('\n## [');
writeFileSync(
  file,
  old.slice(0, at) +
    `\n\n## [${version}] - ${new Date().toISOString().slice(0, 10)}\n\n### Changed\n- Describe this release before committing.\n` +
    old.slice(at),
);
console.log(
  `Version advanced ${current} → ${version}. Complete CHANGELOG.md before pushing.`,
);

console.log('Preserved the existing milestone-scoped release impact plan.');
