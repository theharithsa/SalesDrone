import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const [mode, base, candidate] = process.argv.slice(2);
const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8' }).trim();
const gh = (...argv) => JSON.parse(execFileSync('gh', ['api', ...argv], { encoding: 'utf8' }));
const repository = process.env.GITHUB_REPOSITORY;
assert.equal(repository, 'theharithsa/SalesDrone');
assert.ok(['pull-request', 'main'].includes(mode));
const tree = git('rev-parse', 'HEAD^{tree}');
const query = 'branch=pre-prod&status=success&per_page=30';
if (mode === 'pull-request') {
  assert.equal(process.env.PREPROD_PR_HEAD, 'pre-prod', 'Promote from the pre-prod branch');
  assert.equal(process.env.PREPROD_PR_REPO, repository, 'Promote from the canonical repository');
  assert.match(base || '', /^[a-f0-9]{40}$/);
  assert.match(candidate || '', /^[a-f0-9]{40}$/);
  git('merge-base', '--is-ancestor', base, candidate);
  assert.equal(git('rev-parse', candidate + '^{tree}'), tree, 'Merged result differs from the tested source');
}
const { workflow_runs: runs } = gh(
  'repos/' + repository + '/actions/workflows/pre-production.yml/runs?' + query +
  (mode === 'pull-request' ? '&head_sha=' + candidate : ''),
);
for (const run of runs) {
  if (run.head_repository?.full_name !== repository || run.head_branch !== 'pre-prod') continue;
  if (mode === 'pull-request' && run.head_sha !== candidate) continue;
  const { commit } = gh('repos/' + repository + '/commits/' + run.head_sha);
  if (commit.tree.sha !== tree) continue;
  const { jobs } = gh('repos/' + repository + '/actions/runs/' + run.id + '/attempts/' + run.run_attempt + '/jobs');
  if (!jobs.some(job => job.conclusion === 'success' && job.steps?.some(
    step => step.name === 'Verify published pre-production candidate' && step.conclusion === 'success',
  ))) continue;
  console.log('Matched source tree to successful pre-production verification in run ' + run.id);
  process.exit(0);
}
throw Error('No successful pre-production deployment verifies this source tree');
