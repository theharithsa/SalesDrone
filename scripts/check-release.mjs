import { authorizeMaintenance } from './maintenance-policy.mjs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw Error('Use stable semantic MAJOR.MINOR.PATCH version');
for (const file of ['apps/web/package.json', 'functions/package.json'])
  if (JSON.parse(readFileSync(file, 'utf8')).version !== version)
    throw Error('Version mismatch: ' + file);
const changelog = readFileSync('CHANGELOG.md', 'utf8'),
  section = changelog.split('## [' + version + '] - ')[1]?.split('\n## [')[0];
if (
  !section ||
  !/^\d{4}-\d{2}-\d{2}/.test(section) ||
  !section.includes('\n- ') ||
  /Describe this release|TODO|TBD/.test(section)
)
  throw Error('A dated, completed changelog entry is required for ' + version);
const base = process.env.BASE_SHA;
if (base && !/^0+$/.test(base)) {
  if (!/^[a-f0-9]{40}$/.test(base)) throw Error('Invalid base SHA');
  const r = spawnSync('git', ['show', base + ':package.json'], {
    encoding: 'utf8',
  });
  if (r.status)
    throw Error('Could not inspect the previous release; fetch full history');
  const old = JSON.parse(r.stdout).version;
  if (old) {
    const a = version.split('.').map(Number),
      b = old.split('.').map(Number);
    if (
      !(
        a[0] > b[0] ||
        (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
      )
    ) {
      if (version !== old)
        throw Error(
          `Advance SemVer and CHANGELOG before pushing: ${version} <= ${old}`,
        );
      const record = JSON.parse(
        readFileSync('releases/maintenance.json', 'utf8'),
      );
      authorizeMaintenance(record, { version, baseCommit: base });
      console.log(
        'Explicit same-version maintenance authorized for this base only.',
      );
    }
  }
}
console.log('Release contract valid: v' + version);

for (const file of ['package-lock.json', 'functions/package-lock.json']) {
  const lock = JSON.parse(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(lock.packages || {}))
    if (
      key.startsWith('../') ||
      key.includes('/tmp/') ||
      key.includes('/Volumes/') ||
      value.resolved?.startsWith('file:')
    )
      throw Error('Nonportable dependency path in ' + file);
}
