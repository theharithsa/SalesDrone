import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { selectSuite, executePlan } from './test-plan.mjs';
const suite = process.argv[2] || 'quick';
if (process.argv.length > 3)
  throw Error('Usage: npm run qa -- quick|integration|release');
const plan = selectSuite(suite),
  { version } = JSON.parse(await readFile('package.json', 'utf8'));
const signatures = async () =>
  Promise.all(
    ['docs/openapi.json', 'apps/web/public/openapi.json'].map(async (p) =>
      createHash('sha256')
        .update(await readFile(p))
        .digest('hex'),
    ),
  );
const report = await executePlan(plan, async (step) => {
  const before = step.id === 'contracts' ? await signatures() : null;
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      step.args,
      { stdio: 'inherit', shell: false },
    );
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (
    exitCode === 0 &&
    before &&
    JSON.stringify(before) !== JSON.stringify(await signatures())
  ) {
    console.error(
      'Generated API contract changed during verification. Review the generated diff and rerun.',
    );
    return 1;
  }
  return exitCode;
});
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/qa-' + suite + '.json',
  JSON.stringify(
    {
      version,
      suite,
      checkedAt: new Date().toISOString(),
      ...report,
      browserVerification:
        'separate manual check via approved browser tools; not inferred from CLI success',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'QA suite ' +
    suite +
    ': ' +
    (report.passed ? 'passed' : 'failed') +
    '. Report: test-results/qa-' +
    suite +
    '.json',
);
process.exitCode = report.passed ? 0 : 1;
