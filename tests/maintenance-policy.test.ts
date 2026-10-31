import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeMaintenance } from '../scripts/maintenance-policy.mjs';
const record = {
  version: '1.6.1',
  baseCommit: 'a'.repeat(40),
  authorizedByUser: true,
  date: '2026-10-25',
  instruction: 'Keep the same version no changes.',
  reason: 'UI maintenance authorized explicitly by the user.',
};
test('same-version authorization is bound to one exact base and cannot authorize a later push', () => {
  assert.ok(
    authorizeMaintenance(record, {
      version: '1.6.1',
      baseCommit: 'a'.repeat(40),
    }),
  );
  for (const change of [
    { version: '1.6.2' },
    { baseCommit: 'b'.repeat(40) },
    { authorizedByUser: false },
    { instruction: '' },
  ])
    assert.throws(() =>
      authorizeMaintenance(
        { ...record, ...change },
        { version: '1.6.1', baseCommit: 'a'.repeat(40) },
      ),
    );
});

test('release gate rejects an undeclared same-version push and scopes the override to its base', async () => {
  const { mkdtemp, writeFile, copyFile, mkdir, rm } =
    await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'salesdrone-maintenance-'));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'apps/web'), { recursive: true });
    await mkdir(join(root, 'functions'));
    await mkdir(join(root, 'releases'));
    for (const script of ['check-release.mjs', 'maintenance-policy.mjs','index-readiness.mjs','candidate-recovery.mjs'])
      await copyFile(
        new URL('../scripts/' + script, import.meta.url),
        join(root, 'scripts', script),
      );
    await writeFile(join(root,'firestore.indexes.json'),JSON.stringify({indexes:[],fieldOverrides:[]}));
    for (const name of [
      'package.json',
      'apps/web/package.json',
      'functions/package.json',
    ])
      await writeFile(join(root, name), JSON.stringify({ version: '1.6.1' }));
    for (const name of ['package-lock.json', 'functions/package-lock.json'])
      await writeFile(join(root, name), JSON.stringify({ packages: {} }));
    await writeFile(
      join(root, 'CHANGELOG.md'),
      '## [1.6.1] - 2026-10-25\n\n- Maintained release.\n',
    );
    const git = (args: string[]) => {
      const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout.trim();
    };
    git(['init', '-q']);
    git(['add', '.']);
    git([
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'base',
    ]);
    const base = git(['rev-parse', 'HEAD']);
    const check = (sha: string) =>
      spawnSync(process.execPath, ['scripts/check-release.mjs'], {
        cwd: root,
        env: { ...process.env, BASE_SHA: sha },
        encoding: 'utf8',
      });
    assert.notEqual(check(base).status, 0);
    await writeFile(
      join(root, 'releases/maintenance.json'),
      JSON.stringify({ ...record, baseCommit: base }),
    );
    const accepted=check(base);
    assert.equal(accepted.status, 0, accepted.stderr);
    git(['add', '.']);
    git([
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'maintenance',
    ]);
    assert.notEqual(check(git(['rev-parse', 'HEAD'])).status, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a second authorized maintenance preserves the original tag and rejects a stale base', async () => {
  const { mkdtemp, writeFile, copyFile, mkdir, rm, chmod } =
    await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'salesdrone-tag-'));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'releases'));
    for (const name of ['github-release.mjs', 'maintenance-policy.mjs'])
      await copyFile(
        new URL('../scripts/' + name, import.meta.url),
        join(root, 'scripts', name),
      );
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ version: '1.6.1' }),
    );
    await writeFile(
      join(root, 'releases/maintenance.json'),
      JSON.stringify(record),
    );
    // Only three read-only gh calls are allowed. A mutation or release rewrite fails.
    const fake =
      '#!' +
      process.execPath +
      `
const args = process.argv.slice(2);
if (args[0] !== 'api' || args.length !== 2) process.exit(8);
const path = args[1];
if (path.endsWith('/git/ref/tags/v1.6.1')) console.log(JSON.stringify({object:{sha:'original-tag'}}));
else if (path.endsWith('/commits/current')) console.log(JSON.stringify({parents:[{sha:process.env.FIXTURE_PARENT}]}));
else if (path.endsWith('/compare/original-tag...current')) console.log(JSON.stringify({status:process.env.FIXTURE_COMPARISON}));
else process.exit(9);
`;
    await writeFile(join(root, 'gh'), fake);
    await chmod(join(root, 'gh'), 0o755);
    const run = (parent: string, comparison = 'ahead') =>
      spawnSync(process.execPath, ['scripts/github-release.mjs'], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: root + ':' + process.env.PATH,
          GITHUB_REPOSITORY: 'fixture/repo',
          GITHUB_SHA: 'current',
          FIXTURE_PARENT: parent,
          FIXTURE_COMPARISON: comparison,
        },
      });
    const valid = run(record.baseCommit);
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /original v1.6.1 tag and release preserved/);
    assert.notEqual(run('stale-base').status, 0);
    assert.notEqual(run(record.baseCommit, 'diverged').status, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
