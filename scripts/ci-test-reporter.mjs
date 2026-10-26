import { createHash } from 'node:crypto';
import { relative } from 'node:path';
/** Second Node reporter: emits result metadata only, never test output/errors. */
export function testCase(event) {
  if (
    !['test:pass', 'test:fail'].includes(event.type) ||
    event.data.details?.type === 'suite'
  )
    return null;
  const d = event.data;
  const file = relative(process.cwd(), d.file || '').replaceAll('\\', '/');
  if (!/^(?:functions\/test|tests)\/[a-z0-9.-]+\.(?:js|ts)$/.test(file))
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
  for await (const event of source) {
    const result = testCase(event);
    if (result) yield JSON.stringify(result) + '\n';
  }
}
