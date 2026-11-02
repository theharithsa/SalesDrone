import { readFile } from 'node:fs/promises';
export const CASE_SUITES = ['functions','ingress','web','components','emulator'];
// Project only allowlisted metadata; never send paths, titles or error objects.
export async function readCaseEvidence(suite, directory='test-results') {
  if (!CASE_SUITES.includes(suite)) throw Error('Unknown case suite');
  const text=await readFile(`${directory}/cases-${suite}.ndjson`,'utf8');
  if(text.length>2000000)throw Error('Oversized CI case evidence');
  const summary=JSON.parse(await readFile(`${directory}/cases-${suite}.summary.json`,'utf8'));
  const rows=text.split('\n').filter(Boolean).map(line=>JSON.parse(line));
  if(!summary.completed || !Number.isInteger(summary.expected) || summary.expected<1 || rows.length!==summary.expected || rows.length!==summary.emitted)throw Error(`Incomplete ${suite} case evidence`);
  const seen=new Set();
  const files={functions:/^functions\/test\/[a-z0-9.-]+\.test\.js$/,ingress:/^services\/ingress\/test\/[a-z0-9.-]+\.test\.js$/,web:/^tests\/[a-z0-9.-]+\.test\.ts$/,components:/^apps\/web\/test\/[a-z0-9.-]+\.test\.tsx$/,emulator:/^functions\/test\/emulator\.integration\.js$/};
  return rows.map(c=>{
    if(!files[suite].test(c.file)||!/^[a-f0-9]{64}$/.test(c.id)||seen.has(c.id)||!['passed','failed','skipped'].includes(c.status)||!Number.isFinite(c.durationMs)||c.durationMs<0||c.durationMs>86400000||!Number.isFinite(Date.parse(c.finishedAt)))throw Error(`Invalid ${suite} case evidence`);
    seen.add(c.id);
    return {check:suite,status:c.status,caseId:c.id,durationMs:c.durationMs,finishedAt:c.finishedAt};
  });
}
