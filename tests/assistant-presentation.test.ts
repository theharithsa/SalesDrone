import test from 'node:test';
import assert from 'node:assert/strict';
import {presentAssistantAnswer} from '../apps/web/src/lib/assistant-presentation.ts';
const total={state:'Grounded',count:20,text:'20 matching active leads.',coverage:{cohort:'Current access'}};
const closed={state:'Grounded',count:3,text:'3 matching leads currently in configured converted/closed stages. This is current stage status, not a claim about who closed them or when.',coverage:{cohort:'Current access'}};
test('natural count summaries use exact server facts including zero and singular values',()=>{
 assert.equal(presentAssistantAnswer([total,closed]).text,'You have 20 leads and 3 are closed.');
 assert.equal(presentAssistantAnswer([{...total,count:0,text:'0 matching active leads.'},{...closed,count:0,text:'0 matching leads currently in configured converted/closed stages. This is current stage status, not a claim about who closed them or when.'}]).text,'You have 0 leads and 0 are closed.');
 assert.equal(presentAssistantAnswer([{...total,count:1,text:'1 matching active leads.'},{...closed,count:1,text:'1 matching leads currently in configured converted/closed stages. This is current stage status, not a claim about who closed them or when.'}]).text,'You have 1 lead and 1 is closed.');
 const unknown=presentAssistantAnswer([{...closed,count:7}]);assert.equal(unknown.text,closed.text);
});
test('different cohorts, filtered dates and incomplete answers are never merged into an unqualified total',()=>{
 for(const coverage of [{...total.coverage,filters:[{field:'zone',value:'North'}]}, {...total.coverage,window:{startDate:'2026-11-01'}},{cohort:'Another scope'}]){
  assert.ok(!presentAssistantAnswer([{...total,coverage},closed]).text.includes('You have 20 leads and'));
 }
 const partial=presentAssistantAnswer([{...total,state:'Partial',text:'Only part of your records could be checked.'},closed]);
 assert.ok(partial.text.includes('Only part of your records could be checked.'));
 assert.equal(presentAssistantAnswer([{state:'Clarify',text:'Choose your closed stage first.'}]).text,'Choose your closed stage first.');
});
