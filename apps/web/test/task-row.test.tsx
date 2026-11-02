import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import TaskRow from '../src/components/TaskRow';
const props=()=>({task:{id:'task',title:'Check delivery',leadId:'fictional-one',dueAt:'2026-11-10T10:00:00Z',timezone:'Asia/Kolkata',version:2,state:'Pending'},lead:{id:'fictional-one',name:'Alex Morgan',company:'Fictional Supplies'},timezone:'Asia/Kolkata',onOpen:vi.fn(),onComplete:vi.fn(),onSnooze:vi.fn(),onReschedule:vi.fn(),disabled:false});
describe('Task lead context and rescheduling',()=>{
 it('links the lead independently of the task title and exposes Reschedule without opening a menu',()=>{
  const p=props();render(<TaskRow {...p}/>);
  expect(screen.getByRole('link',{name:'Alex Morgan'})).toHaveAttribute('href','/leads/fictional-one');
  fireEvent.click(screen.getByRole('button',{name:'Reschedule'}));expect(p.onReschedule).toHaveBeenCalledOnce();expect(p.onOpen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Check delivery'}));expect(p.onOpen).toHaveBeenCalledOnce();
 });
 it('does not offer rescheduling for completed tasks or create a link for personal reminders',()=>{
  const p=props();render(<TaskRow {...p} lead={undefined} task={{...p.task,leadId:null,state:'Completed'}}/>);
  expect(screen.queryByRole('button',{name:'Reschedule'})).not.toBeInTheDocument();expect(screen.queryByRole('link')).not.toBeInTheDocument();
 });
});
