/** Development-only task screen: fictional rows, real controls, no API calls. */
import {useState} from 'react';
import TaskRow from '../components/TaskRow';
import {Modal} from '../components/UI';
import {RescheduleForm} from '../components/Forms';
import type {Task} from '../lib/types';
export default function TaskListPreview(){
 const [tasks,setTasks]=useState<Task[]>([
  {id:'preview-one',title:'Confirm the sample delivery',leadId:'fictional-one',lead:{id:'fictional-one',name:'Alex Morgan',company:'Fictional North Supplies'},dueAt:'2026-11-10T10:00:00Z',timezone:'Asia/Kolkata',state:'Pending',version:1},
  {id:'preview-two',title:'Discuss the next order',leadId:'fictional-two',lead:{id:'fictional-two',name:'Jordan Lee',company:'Fictional Partner Enquiry'},dueAt:'2026-11-11T06:30:00Z',timezone:'Asia/Kolkata',state:'Pending',version:1},
  {id:'preview-personal',title:'Review the weekly plan',leadId:null,dueAt:'2026-11-12T06:30:00Z',timezone:'Asia/Kolkata',state:'Pending',version:1}
 ]);
 const [focused,setFocused]=useState<Task|null>(null),[message,setMessage]=useState('');
 return <div className="page-body tasks-page">
  <header className="page-title"><div><h1>Tasks</h1><p>Your follow-ups, organised by what needs attention.</p></div></header>
  {message?<p role="status">{message}</p>:null}
  <section className="panel tasks-panel" aria-label="Pending tasks">
   <div className="task-list-context">Times in Asia/Kolkata</div>
   <div className="task-list-head" aria-hidden="true"><span/><span>Task</span><span>Lead</span><span>Due</span><span>Actions</span></div>
   {tasks.map(task=><TaskRow key={task.id} task={task} lead={task.lead || undefined} timezone="Asia/Kolkata" onOpen={()=>setMessage('Synthetic task details')} onComplete={()=>setTasks(rows=>rows.map(row=>row.id===task.id?{...row,state:'Completed'}:row))} onSnooze={()=>{}} onReschedule={()=>setFocused(task)} disabled={false}/>)}
  </section>
  <Modal open={!!focused} onClose={()=>setFocused(null)} title="Reschedule task" description={focused?.title}>
   {focused?<RescheduleForm task={focused} onCancel={()=>setFocused(null)} onSave={async data=>{setTasks(rows=>rows.map(row=>row.id===focused.id?{...row,dueAt:data.dueAt,version:row.version+1}:row));setMessage('Synthetic task time updated.');}}/>:null}
  </Modal>
 </div>;
}
