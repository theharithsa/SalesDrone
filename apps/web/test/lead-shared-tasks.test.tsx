import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import LeadTaskTab from '../src/components/LeadTaskTab';
describe('Shared tasks on a lead',()=>{
 it('shows the responsible person and completes a shared task through the lead-scoped versioned API',async()=>{
  let done=false;
  const request=vi.fn(async(p:string,method?:string,body?:any,key?:string)=>{
   if(method==='PATCH'){expect(p).toBe('/leads/lead/tasks/task');expect(body).toEqual({expectedVersion:2,state:'Completed'});done=true;return {};}
   expect(p).toContain('/leads/lead/tasks?');return {items:[{id:'task',leadId:'lead',title:'Fictional work',dueAt:'2026-11-10T10:00:00Z',state:done?'Completed':'Pending',version:2,canManage:true,responsible:{name:'Another member'}}],nextCursor:null};
  });
  render(<LeadTaskTab leadId="lead" request={request} timezone="Asia/Kolkata" refreshKey={0} onOpen={()=>{}}/>);
  await screen.findByText('Responsible: Another member');fireEvent.click(screen.getByRole('button',{name:'Complete task'}));
  await screen.findByText('Completed');expect(screen.queryByRole('button',{name:'Complete task'})).not.toBeInTheDocument();
  const patch=request.mock.calls.find(c=>c[1]==='PATCH');expect(patch?.[3]).toMatch(/^[a-f0-9-]{36}$/);
 });
 it('offers readers the shared task context without a completion control',async()=>{
  render(<LeadTaskTab leadId="lead" request={async()=>({items:[{id:'task',title:'Read-only work',dueAt:'2026-11-10T10:00:00Z',state:'Pending',canManage:false,responsible:{name:'Team member'}}]})} timezone="Asia/Kolkata" refreshKey={0} onOpen={()=>{}}/>);
  await screen.findByText('Responsible: Team member');expect(screen.queryByRole('button',{name:'Complete task'})).not.toBeInTheDocument();
 });
});
