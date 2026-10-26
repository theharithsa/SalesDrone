import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executePlan, selectSuite } from '../scripts/test-plan.mjs';
test('QA suites select actual checks and reject arbitrary command names', () => {
  assert.ok(selectSuite('release').some((s) => s.id === 'emulator'));
  assert.ok(selectSuite('quick').every((s) => s.id !== 'emulator'));
  for (const name of ['deploy', '__proto__', 'toString', 'release;echo unsafe'])
    assert.throws(() => selectSuite(name));
});
test('QA runner stops on failure and marks later checks not-run without logging payloads', async () => {
  const seen = [];
  let now = 0;
  const result = await executePlan(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    async (step) => {
      seen.push(step.id);
      return step.id === 'b' ? 2 : 0;
    },
    () => ++now,
  );
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.results.map((r) => r.status),
    ['passed', 'failed', 'not-run'],
  );
  assert.equal(result.results[1].exitCode, 2);
  const thrown = await executePlan([{ id: 'x' }, { id: 'y' }], async () => {
    throw Error('Sensitive error text');
  });
  assert.equal(thrown.passed, false);
  assert.ok(!JSON.stringify(thrown).includes('Sensitive'));
});
import {readFileSync,existsSync} from 'node:fs';
test('QA catalog links real module skills and executable test entrypoints',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../qa/test-cases.json',import.meta.url),'utf8'));
 const seen=new Set();
 for(const module of catalog.modules){
  assert.ok(!seen.has(module.module));seen.add(module.module);
  assert.ok(existsSync(new URL('../'+module.ownerSkill,import.meta.url)));
  assert.ok(module.automatedTests.length && module.manualCases.length);
  for(const path of module.automatedTests)assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
  for(const c of module.manualCases)assert.ok(c.id && c.expected && c.fixture);
 }
 assert.ok(seen.has('salesdrone-testing'));
});
