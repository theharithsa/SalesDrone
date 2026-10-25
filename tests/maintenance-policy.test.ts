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
  const { mkdtemp, writeFile, copyFile, mkdir, rm } = await import(
    'node:fs/promises'
  );
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'salesdrone-maintenance-'));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'apps/web'), { recursive: true });
    await mkdir(join(root, 'functions'));
    await mkdir(join(root, 'releases'));
    for (const script of ['check-release.mjs', 'maintenance-policy.mjs'])
      await copyFile(
        new URL('../scripts/' + script, import.meta.url),
        join(root, 'scripts', script),
      );
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
    assert.equal(check(base).status, 0);
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
