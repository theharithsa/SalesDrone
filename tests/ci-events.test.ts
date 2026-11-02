import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ciEvent, sendCiEvent } from '../scripts/ci-events.mjs';
import { testCase } from '../scripts/ci-test-reporter.mjs';
import { readCaseEvidence } from '../scripts/ci-case-evidence.mjs';
const meta = {
  repository: 'theharithsa/SalesDrone',
  commit: 'a'.repeat(40),
  runId: '123',
  attempt: '1',
  version: '2.0.1',
  finishedAt: '2026-10-26T00:00:00Z',
};
test('CI envelopes have stable deduplication IDs, real results and explicit automation authority without errors or names', () => {
  const value = {
    check: 'functions',
    status: 'failed',
    caseId: 'b'.repeat(64),
    durationMs: 12,
    error: 'PRIVATE',
    name: 'PRIVATE',
  };
  const event = ciEvent(meta, value);
  assert.equal(event.id, ciEvent(meta, value).id);
  assert.notEqual(event.id, ciEvent({ ...meta, attempt: '2' }, value).id);
  assert.equal(event.data['event.authority'], 'automation-confirmed');
  assert.equal(event.data['ci.status'], 'failed');
  assert.ok(!JSON.stringify(event).includes('PRIVATE'));
  assert.throws(() => ciEvent(meta, { check: 'unknown', status: 'passed' }));
});
test('CI transport retries the identical event after lost response and stops on rejected credentials', async () => {
  const event = ciEvent(meta, { check: 'types', status: 'passed' });
  const bodies = [];
  const status = await sendCiEvent(
    'https://fixture.live.dynatrace.com',
    'synthetic',
    event,
    async (_url, options) => {
      bodies.push(options.body);
      if (bodies.length === 1) throw Error('lost');
      return new Response('', { status: 202 });
    },
  );
  assert.equal(status, 202);
  assert.equal(bodies[0], bodies[1]);
  let calls = 0;
  assert.equal(
    await sendCiEvent(
      'https://fixture.live.dynatrace.com',
      'synthetic',
      event,
      async () => {
        calls++;
        return new Response('', { status: 403 });
      },
    ),
    403,
  );
  assert.equal(calls, 1);
});
test('case extraction excludes raw failure messages and labels skipped work honestly', () => {
  const record = testCase({
    type: 'test:fail',
    data: {
      file: resolve('tests/ci-events.test.ts'),
      name: 'PRIVATE fixture title',
      skip: true,
      details: { type: 'test', duration_ms: 10, error: 'PRIVATE' },
    },
  });
  assert.equal(record.status, 'skipped');
  assert.ok(!JSON.stringify(record).includes('PRIVATE'));
  assert.equal(
    testCase({ type: 'test:stdout', data: { message: 'PRIVATE' } }),
    null,
  );
});

test('the real Node reporter retains pass/fail/skip without exporting failure output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'salesdrone-ci-reporter-'));
  try {
    const fs = requireFixture(dir);
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    delete childEnv.CI_CASE_SUITE;
    delete childEnv.CI_CASE_ROOT;
    const child = spawnSync(
      process.execPath,
      [
        '--test',
        '--test-reporter=' + resolve('scripts/ci-test-reporter.mjs'),
        fs,
      ],
      { cwd: dir, encoding: 'utf8', env: childEnv },
    );
    assert.equal(child.status, 1);
    const rows = child.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => r.status).sort(), [
      'failed',
      'passed',
      'skipped',
    ]);
    assert.ok(!child.stdout.includes('PRIVATE'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
function requireFixture(dir: string) {
  // Fixture lives outside the repository and uses the same allowed test path contract.
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  const file = join(dir, 'tests', 'ci-reporter.test.js');
  writeFileSync(
    file,
    "import {test} from 'node:test';test('pass',()=>{});test.skip('skip',()=>{});test('fail',()=>{throw Error('PRIVATE FIXTURE OUTPUT')});",
  );
  return file;
}

test('ingress and emulator cases survive the real reporter and reconcile with independent runner totals',async()=>{
 const root=mkdtempSync(join(tmpdir(),'salesdrone-owned-cases-'));
 try{
  mkdirSync(join(root,'test-results'));mkdirSync(join(root,'services/ingress/test'),{recursive:true});mkdirSync(join(root,'functions/test'),{recursive:true});
  writeFileSync(join(root,'package.json'),JSON.stringify({type:'module'}));
  for(const [suite,file] of [['ingress','services/ingress/test/probe.test.js'],['emulator','functions/test/emulator.integration.js']]){
   writeFileSync(join(root,file),"import{test}from'node:test';test('PRIVATE success',()=>{});test.skip('PRIVATE skip',()=>{});test('PRIVATE failure',()=>{throw Error('PRIVATE output')});");
   const env={...process.env,CI_CASE_ROOT:root,CI_CASE_SUITE:suite};delete env.NODE_TEST_CONTEXT;
   const child=spawnSync(process.execPath,['--test','--test-reporter='+resolve('scripts/ci-test-reporter.mjs'),'--test-reporter-destination='+join(root,'test-results/cases-'+suite+'.ndjson'),join(root,file)],{cwd:root,env,encoding:'utf8'});
   assert.equal(child.status,1);const rows=await readCaseEvidence(suite,join(root,'test-results'));assert.equal(rows.length,3);assert.ok(!JSON.stringify(rows).includes('PRIVATE'));assert.deepEqual(rows.map(r=>r.status).sort(),['failed','passed','skipped']);
   assert.equal(ciEvent(meta,rows[0]).data['ci.check'],suite);
  }
  writeFileSync(join(root,'test-results/cases-ingress.ndjson'),'');await assert.rejects(readCaseEvidence('ingress',join(root,'test-results')),/Incomplete/);
  assert.equal(testCase({type:'test:pass',data:{file:join(root,'outside.test.js'),details:{type:'test'}}}),null);
 }finally{rmSync(root,{recursive:true,force:true});}
});
