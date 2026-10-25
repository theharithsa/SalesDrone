import { authorizeMaintenance } from './maintenance-policy.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const pkg = JSON.parse(await readFile('package.json', 'utf8')),
  tag = 'v' + pkg.version,
  repo = process.env.GITHUB_REPOSITORY,
  sha = process.env.GITHUB_SHA;
if (!repo || !sha) throw Error('GitHub release context required');
const call = (args, input) =>
  spawnSync('gh', args, { input, encoding: 'utf8' });
const existing = call(['api', `repos/${repo}/git/ref/tags/${tag}`]);
if (existing.status === 0) {
  const value = JSON.parse(existing.stdout);
  if (value.object.sha !== sha) {
    const record = JSON.parse(
      await readFile('releases/maintenance.json', 'utf8'),
    );
    authorizeMaintenance(record, {
      version: pkg.version,
      baseCommit: value.object.sha,
    });
    const comparison = call([
      'api',
      `repos/${repo}/compare/${record.baseCommit}...${sha}`,
    ]);
    if (comparison.status || JSON.parse(comparison.stdout).status !== 'ahead')
      throw Error('Maintenance commit must descend from the original release');
    console.log(
      'Maintenance deployment complete; original ' +
        tag +
        ' tag and release preserved. Commit ' +
        sha,
    );
    process.exit(0);
  }
} else {
  const created = call(
    ['api', `repos/${repo}/git/refs`, '--method', 'POST', '--input', '-'],
    JSON.stringify({ ref: 'refs/tags/' + tag, sha }),
  );
  if (created.status) throw Error('Could not publish release tag');
}
const changelog = await readFile('CHANGELOG.md', 'utf8'),
  section = changelog
    .split('## [' + pkg.version + '] - ')[1]
    ?.split('\n## [')[0];
if (!section) throw Error('Missing release notes');
const path = process.env.RUNNER_TEMP + '/salesdrone-release-notes.md';
await writeFile(
  path,
  `SalesDrone by AvinyaTech — ${tag}\n\n` +
    section.replace(/^\d{4}-\d{2}-\d{2}\n/, ''),
);
const known = call(['release', 'view', tag, '--repo', repo]);
if (known.status) {
  const released = call([
    'release',
    'create',
    tag,
    '--repo',
    repo,
    '--verify-tag',
    '--title',
    'SalesDrone ' + tag,
    '--notes-file',
    path,
  ]);
  if (released.status) throw Error('Could not create release notes');
}
console.log('Release ' + tag + ' published.');
