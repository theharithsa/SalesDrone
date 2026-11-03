import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ESLint } from 'eslint';
import { accessibilityLinter } from '../tools/accessibility/lint.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test('native TypeScript 7 CLI rejects invalid assignments independently of the lint API compiler', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'salesdrone-compiler-'));
  const cli = join(root, 'scripts/typecheck.mjs');
  try {
    const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    assert.equal(version.status, 0);
    assert.match(version.stdout, /Version 7\./);
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [], target: 'ES2022' }, files: ['probe.ts'] }));
    const check = () => spawnSync(process.execPath, [cli, '-p', join(dir, 'tsconfig.json')], { encoding: 'utf8' });
    await writeFile(join(dir, 'probe.ts'), 'const value: number = 1;\n');
    assert.equal(check().status, 0);
    await writeFile(join(dir, 'probe.ts'), 'const value: number = "wrong";\n');
    const invalid = check();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout, /TS2322/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('ESLint 10 still rejects unused bindings and conditional React hooks', async () => {
  assert.match(ESLint.version, /^10\./);
  const lint = new ESLint({ cwd: root, overrideConfigFile: join(root, 'eslint.config.mjs') });
  const [result] = await lint.lintText('import {useState} from "react"; export function Probe({active}: {active: boolean}) { const unused = 1; if (active) useState(0); return <div/>; }', { filePath: 'apps/web/src/ToolchainProbe.tsx' });
  const rules = new Set(result.messages.filter(m => m.severity === 2).map(m => m.ruleId));
  assert.ok(rules.has('@typescript-eslint/no-unused-vars'));
  assert.ok(rules.has('react-hooks/rules-of-hooks'));
});

test('isolated accessibility pass detects actual TSX violations and accepts labelled controls', async () => {
  const lint = accessibilityLinter();
  const [invalid] = await lint.lintText('export const Probe = () => <><img src="sample.png"/><label/><div onClick={() => {}}>Click</div></>;', { filePath: 'apps/web/src/ToolchainProbe.tsx' });
  const rules = new Set(invalid.messages.map(m => m.ruleId));
  assert.ok(rules.has('jsx-a11y/alt-text'));
  assert.ok(rules.has('jsx-a11y/label-has-associated-control'));
  assert.ok(rules.has('jsx-a11y/click-events-have-key-events'));
  const [valid] = await lint.lintText('export const Probe = () => <><img src="sample.png" alt="Sample"/><label htmlFor="name">Name</label><input id="name"/><button type="button">Open</button></>;', { filePath: 'apps/web/src/ToolchainProbe.tsx' });
  assert.deepEqual(valid.messages, []);
});
