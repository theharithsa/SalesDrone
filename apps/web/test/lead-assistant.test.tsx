import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import LeadAssistantView from '../src/features/LeadAssistantView';
const props=()=>({messages:[],draft:'Show leads in North',onDraft:vi.fn(),onSend:vi.fn(),onNewChat:vi.fn(),onSelectChat:vi.fn(),onClarify:vi.fn()});
describe('Assistant conversation interaction',()=>{
  it('sends Enter but preserves Shift-Enter and IME composition',()=>{
    const p=props();render(<LeadAssistantView {...p}/>);const input=screen.getByRole('textbox',{name:'Ask about your leads'});
    fireEvent.keyDown(input,{key:'Enter',shiftKey:true});fireEvent.keyDown(input,{key:'Enter',isComposing:true});expect(p.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input,{key:'Enter'});expect(p.onSend).toHaveBeenCalledExactlyOnceWith('Show leads in North');
  });
  it('renders untrusted source text literally and fetches matching records only on request',()=>{
    const p=props(),onLoad=vi.fn();render(<LeadAssistantView {...p} onLoadResults={onLoad} messages={[{id:'result',role:'assistant',text:'2 matching leads.',resultRequestId:'request',resultCount:2,sources:[{id:'s',label:'Fictional note',excerpt:'<img src=x onerror=alert(1)>'}]}]}/>);
    expect(document.querySelector('img')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'View matching leads (2)'}));expect(onLoad).toHaveBeenCalledWith('request');
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});

describe('Compound Assistant answers',()=>{
 it('renders each grounded part and requests only its own matching result set',async()=>{
  const {default:LeadAssistantPage}=await import('../src/features/LeadAssistantPage');
  const request=vi.fn(async(p:string,m?:string)=>{
   if(p.endsWith('/messages'))return {conversation:{id:'chat'},items:[{id:'answer',createdAt:'2026-11-02T00:00:00Z',status:'Completed',question:'How many leads and which are closed?',answer:{parts:[{state:'Grounded',text:'2 matching active leads.',count:2,coverage:{cohort:'Current access'},hasResults:true},{state:'Grounded',text:'1 matching leads currently in configured converted/closed stages. This is current stage status, not a claim about who closed them or when.',count:1,coverage:{cohort:'Current access'},hasResults:true}]}}]};
   if(p.includes('/requests/'))return {items:[{id:'fictional',name:'Fictional record',stage:'Won'}],nextCursor:null};
   if(m==='POST')return {id:'chat'};
   return {items:[],nextCursor:null};
  });
  render(<LeadAssistantPage request={request} demo={false}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Ask about your leads'}),{target:{value:'How many leads and which are closed?'}});
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Ask about your leads'}),{key:'Enter'});
  await screen.findByText('You have 2 leads and 1 is closed.');
  expect(screen.getAllByLabelText('Lead Assistant answer')).toHaveLength(1);
  expect(document.querySelector('details.assistant-answer-details')).not.toHaveAttribute('open');
  fireEvent.click(screen.getByText('Answer details'));
  expect(document.querySelector('details.assistant-answer-details')).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button',{name:'View matching leads (1)'}));
  await screen.findByText('Fictional record');expect(request).toHaveBeenCalledWith('/lead-assistant/requests/answer/leads?part=1');
 });
});

// The server redacts stale answers but must preserve chronology for mixed histories.
describe('Stale Assistant history',()=>{
 it('renders a redacted prior answer alongside a current compound answer',async()=>{
  const {default:LeadAssistantPage}=await import('../src/features/LeadAssistantPage');
  const request=vi.fn(async(p:string,m?:string)=>{
   if(p.endsWith('/messages'))return {conversation:{id:'chat'},items:[
    {id:'current',createdAt:'2026-11-02T01:00:00Z',status:'Completed',question:'How many now?',answer:{parts:[{text:'2 active leads.'},{text:'1 closed lead.'}]}},
    {id:'old',createdAt:'2026-11-02T00:00:00Z',status:'Stale',question:'How many before?',answer:{text:'Lead data or reporting settings changed. Ask again for current results.'}}
   ]};
   if(m==='POST')return {id:'chat'};
   return {items:[],nextCursor:null};
  });
  render(<LeadAssistantPage request={request} demo={false}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Ask about your leads'}),{target:{value:'How many now?'}});
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Ask about your leads'}),{key:'Enter'});
  await screen.findByText('2 active leads. 1 closed lead.');
  const text=document.body.textContent!;
  expect(text.indexOf('How many before?')).toBeLessThan(text.indexOf('How many now?'));
  expect(screen.getByText('Lead data or reporting settings changed. Ask again for current results.')).toBeInTheDocument();
 });
});
