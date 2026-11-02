import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import {realpathSync} from 'node:fs';
/** Second Node reporter: emits result metadata only, never test output/errors. */
export function testCase(event) {
  if (
    !['test:pass', 'test:fail'].includes(event.type) ||
    event.data.details?.type === 'suite'
  )
    return null;
  const d = event.data;
  let file;
  try {file=relative(realpathSync(process.env.CI_CASE_ROOT || process.cwd()),realpathSync(d.file)).replaceAll('\\','/');}
  catch {return null;}
  if (!/^(?:functions\/test|services\/ingress\/test|tests)\/[a-z0-9.-]+\.(?:js|ts)$/.test(file))
    return null;
  const durationMs = Number(d.details?.duration_ms || 0);
  return {
    id: createHash('sha256')
      .update(file + ':' + d.name)
      .digest('hex'),
    file,
    status:
      d.skip || d.todo
        ? 'skipped'
        : event.type === 'test:pass'
          ? 'passed'
          : 'failed',
    durationMs: Number.isFinite(durationMs)
      ? Math.min(86400000, Math.max(0, durationMs))
      : 0,
    finishedAt: new Date().toISOString(),
  };
}
export default async function* reporter(source) {
  let emitted = 0, expected = null;
  for await (const event of source) {
    if (event.type === 'test:summary' && !event.data.file) expected = event.data.counts?.tests;
    const result = testCase(event);
    if (result) { emitted++; yield JSON.stringify(result) + '\n'; }
  }
  const suite = process.env.CI_CASE_SUITE;
  if (suite) {
    if (!['functions','ingress','web','emulator'].includes(suite)) throw Error('Unknown case suite');
    const root = process.env.CI_CASE_ROOT || process.cwd();
    await mkdir(root + '/test-results', {recursive:true});
    await writeFile(root + '/test-results/cases-' + suite + '.summary.json', JSON.stringify({expected,emitted,completed:true})+'\n');
  }
}
