import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { executePlan } from './test-plan.mjs';
await mkdir('test-results', { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const files = async (dir, ext) =>
  (await readdir(dir))
    .filter((f) => f.endsWith('.test.' + ext))
    .sort()
    .map((f) => dir + '/' + f);
const tests = async (id, dir, ext) => [
  'node',
  [
    '--test',
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    '--test-reporter=./scripts/ci-test-reporter.mjs',
    '--test-reporter-destination=test-results/cases-' + id + '.ndjson',
    ...(await files(dir, ext)),
  ],
];
const commands = {
  metadata: [npm, ['run', 'build:metadata']],
  security: [npm, ['run', 'security:scan']],
  'docs-check': [npm, ['run', 'docs:check']],
  readiness: [npm, ['run', 'release:readiness']],
  skills: [npm, ['run', 'skills:check']],
  version: [npm, ['run', 'release:check']],
  functions: await tests('functions', 'functions/test', 'js'),
  web: await tests('web', 'tests', 'ts'),
  types: [npm, ['run', 'check']],
  forms: [npm, ['run', 'design:forms']],
  contracts: [npm, ['run', 'api:docs']],
  'contract-diff': [
    'git',
    [
      'diff',
      '--exit-code',
      '--',
      'docs/openapi.json',
      'apps/web/public/openapi.json',
    ],
  ],
  emulator: [npm, ['run', 'test:emulator']],
  audit: [npm, ['audit', '--omit=dev', '--audit-level=high']],
  docs: [npm, ['run', 'docs:build']],
  build: [npm, ['run', 'build']],
  fixture: ['node', ['scripts/check-design-build.mjs']],
};
const startedAt = new Date().toISOString();
const report = await executePlan(
  Object.keys(commands).map((id) => ({ id })),
  async ({ id }) => {
    const [command, args] = commands[id];
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: 'inherit', shell: false });
      child.once('error', () => resolve(1));
      child.once('exit', (code) => resolve(code ?? 1));
    });
  },
);
await writeFile(
  'test-results/ci-checks.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || '1',
      startedAt,
      finishedAt: new Date().toISOString(),
      ...report,
    },
    null,
    2,
  ) + '\n',
);
process.exitCode = report.passed ? 0 : 1;
