/** Personal tasks live only inside the existing password-encrypted workspace. */
export type PersonalTask = {
  id:string;
  title:string;
  createdAt:string;
  dueDate:string|null;
  done:boolean;
};
const validDay=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&
  !Number.isNaN(Date.parse(date+'T12:00:00Z'))&&
  new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
export function normalizePersonalTasks(value:unknown):PersonalTask[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  const tasks:PersonalTask[]=[];
  for(const v of value.slice(0,120)){
    if(!v||typeof v!=='object'||Array.isArray(v))continue;
    const x=v as Partial<PersonalTask>;
    if(typeof x.id!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(x.id)||seen.has(x.id)||
       typeof x.title!=='string'||!x.title.trim()||x.title.length>160||
       typeof x.createdAt!=='string'||!Number.isFinite(Date.parse(x.createdAt))||
       (x.dueDate!==null&&x.dueDate!==undefined&&(typeof x.dueDate!=='string'||!validDay(x.dueDate)))||
       typeof x.done!=='boolean')continue;
    tasks.push({id:x.id,title:x.title.trim(),createdAt:x.createdAt,dueDate:x.dueDate??null,done:x.done});
    seen.add(x.id);
    if(tasks.length===100)break;
  }
  return tasks;
}
export function addPersonalTask(tasks:PersonalTask[],title:string,dueDate:string|null,id:string,now=new Date()):PersonalTask[]{
  if(typeof title!=='string'||!title.trim()||title.trim().length>160||
     /[\u0000-\u001f\u007f]/.test(title))throw Error('Task must be 1–160 characters.');
  if(dueDate!==null&&!validDay(dueDate))throw Error('Invalid task date.');
  if(!/^[-a-zA-Z0-9]{8,80}$/.test(id))throw Error('Invalid task ID.');
  const normalized=normalizePersonalTasks(tasks);
  if(normalized.length>=100)throw Error('100-task limit reached. Finish or remove older tasks first.');
  if(normalized.some(task=>task.id===id))throw Error('Duplicate task ID.');
  return [...normalized,{id,title:title.trim(),dueDate,done:false,createdAt:now.toISOString()}];
}
export function setPersonalTaskDone(tasks:PersonalTask[],id:string,done:boolean):PersonalTask[]{
  return normalizePersonalTasks(tasks).map(t=>t.id===id?{...t,done}:t);
}
export function removePersonalTask(tasks:PersonalTask[],id:string):PersonalTask[]{
  return normalizePersonalTasks(tasks).filter(t=>t.id!==id);
}
