export const suites = {
  quick: ['unit', 'types', 'contracts', 'documentation', 'skills', 'readiness'],
  integration: ['emulator'],
  release: [
    'unit',
    'types',
    'contracts',
    'documentation',
    'skills',
    'readiness',
    'security',
    'emulator',
    'build',
  ],
};
export const steps = {
  unit: ['test'],
  types: ['run', 'check'],
  contracts: ['run', 'api:docs'],
  documentation: ['run', 'docs:check'],
  skills: ['run', 'skills:check'],
  readiness: ['run', 'release:readiness'],
  security: ['run', 'security:scan'],
  emulator: ['run', 'test:emulator'],
  build: ['run', 'build'],
};
export function selectSuite(name = 'quick') {
  if (!Object.hasOwn(suites, name)) throw new Error('Unknown suite: ' + name);
  return suites[name].map((id) => ({ id, args: steps[id] }));
}
/** Stop on first failed check; never convert unexecuted steps into successes. */
export async function executePlan(plan, run, clock = Date.now) {
  const results = [];
  let failed = false;
  for (const step of plan) {
    if (failed) {
      results.push({ id: step.id, status: 'not-run' });
      continue;
    }
    const started = clock();
    let exitCode;
    try {
      exitCode = await run(step);
    } catch {
      exitCode = 1;
    }
    failed = exitCode !== 0;
    results.push({
      id: step.id,
      status: failed ? 'failed' : 'passed',
      exitCode,
      durationMs: Math.max(0, clock() - started),
    });
  }
  return { passed: !failed, results };
}
