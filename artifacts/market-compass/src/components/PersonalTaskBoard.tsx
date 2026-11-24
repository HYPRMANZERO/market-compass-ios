import {useState} from 'react';
import {CheckCircle2, ListTodo, Plus, Trash2} from 'lucide-react';
import {
  addPersonalTask, normalizePersonalTasks, removePersonalTask, setPersonalTaskDone,
  type PersonalTask
} from '@/lib/personalTasks';

type Props={
  tasks:PersonalTask[];
  onChange:(tasks:PersonalTask[])=>void;
};
export default function PersonalTaskBoard({tasks,onChange}:Props){
  const [title,setTitle]=useState('');
  const [dueDate,setDueDate]=useState('');
  const [error,setError]=useState('');
  const safe=normalizePersonalTasks(tasks);
  const pending=safe.filter(t=>!t.done).length;
  const add=()=>{
    try{
      onChange(addPersonalTask(safe,title,dueDate||null,crypto.randomUUID()));
      setTitle('');setDueDate('');setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not save the task.');}
  };
  return <details className="mt-3 rounded-[18px] border border-border bg-card p-3 shadow-sm" aria-label="Encrypted Personal task planner">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-bold">
      <ListTodo size={18} className="text-primary"/> Personal tasks
      <span className="ml-auto text-[11px] font-medium text-muted-foreground">{pending} open · encrypted vault</span>
    </summary>
    <p className="my-2 text-[12px] leading-5 text-muted-foreground">Saved in this app's encrypted vault. Tasks do not trigger background reminders, emails or calendar events.</p>
    <form onSubmit={e=>{e.preventDefault();add();}} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}
        aria-label="New Personal task" placeholder="Add a task" className="min-h-11 rounded-xl border border-input bg-background px-3 text-[16px]"/>
      <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}
        aria-label="Optional task due date" className="min-h-11 rounded-xl border border-input bg-background px-2 text-[16px]"/>
      <button type="submit" disabled={!title.trim()||safe.length>=100}
        className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-40"><Plus size={16}/>Add task</button>
    </form>
    {error&&<p role="alert" className="mt-2 text-[11px] text-destructive">{error}</p>}
    {safe.length===0?<p className="mt-3 text-[12px] text-muted-foreground">No tasks yet. Your Personal workspace is ready.</p>:
      <ul className="mt-3 space-y-2" aria-label="Saved Personal tasks">
        {safe.map(task=><li key={task.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-2 py-2">
          <button type="button" aria-label={task.done?'Mark task unfinished':'Mark task complete'}
            aria-pressed={task.done} onClick={()=>onChange(setPersonalTaskDone(safe,task.id,!task.done))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border">
            <CheckCircle2 size={18} className={task.done?'text-emerald-600':'text-muted-foreground'}/>
          </button>
          <div className="min-w-0 flex-1">
            <p className={'break-words text-[12px] font-semibold '+(task.done?'text-muted-foreground line-through':'')}>{task.title}</p>
            {task.dueDate&&<p className="mt-1 text-[10px] text-muted-foreground">Due {task.dueDate} · manual reminder only</p>}
          </div>
          <button type="button" aria-label={'Delete task: '+task.title} onClick={()=>onChange(removePersonalTask(safe,task.id))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground"><Trash2 size={15}/></button>
        </li>)}
      </ul>}
  </details>;
}
