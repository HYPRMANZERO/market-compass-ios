import { useState } from 'react';
import { CalendarDays, ClipboardCopy, FileText, Laptop, Lightbulb, ShieldCheck } from 'lucide-react';
import { makeCalendarFile, makeDailyPlan, makeMessageDraft } from '@/lib/personalTools';

type Props = { onAsk:(question:string)=>void; onImportDocuments?:()=>void };
const localDate=()=>{
  const now=new Date();
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
};
const field='min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] text-foreground';
const action='min-h-11 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[12px] font-semibold text-primary disabled:opacity-50';

export default function PersonalToolDeck({onAsk,onImportDocuments}:Props){
  const [goal,setGoal]=useState('');
  const [date,setDate]=useState(localDate);
  const [time,setTime]=useState('09:00');
  const [subject,setSubject]=useState('');
  const [message,setMessage]=useState('');
  const [draft,setDraft]=useState('');
  const [status,setStatus]=useState('');
  const run=(action:()=>void)=>{
    try{action();setStatus('Local draft prepared. No account, message or calendar was changed.');}
    catch(error){setStatus(error instanceof Error?error.message:'Could not prepare draft.');}
  };
  const createCalendar=()=>{
    const ics=makeCalendarFile(goal,date,time);
    const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='compass-personal-event.ics';
    document.body.appendChild(link);
    link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),0);
    setStatus('Calendar file downloaded. Review it before importing into your calendar.');
  };
  const copyDraft=async()=>{
    if(!draft){setStatus('Prepare a draft first.');return;}
    try{await navigator.clipboard.writeText(draft);setStatus('Draft copied. Nothing was sent.');}
    catch{setStatus('Automatic copy is unavailable. Select and copy the draft text below.');}
  };
  return <details className="rounded-[18px] border border-border bg-card p-3 shadow-sm" aria-label="Compass Personal productivity tools">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-bold">
      <Lightbulb size={18} className="text-primary"/> Personal tool desk
      <span className="ml-auto text-[11px] font-normal text-muted-foreground">Local drafts · explicit approvals</span>
    </summary>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      Plan and draft offline. No email is sent, no calendar entry is created and no device files are scanned.
      AI research and coding help need your authenticated private Compass model.
    </p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <section className="space-y-2 rounded-xl border border-border p-3" aria-label="Daily planning and calendar export">
        <label className="block text-[12px] font-semibold">Goal or event title
          <input value={goal} onChange={e=>setGoal(e.target.value)} maxLength={150}
            className={'mt-1 '+field} placeholder="What do you want to get done?"/>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={()=>run(()=>setDraft(makeDailyPlan(goal)))}>Create daily plan</button>
          <button type="button" className={action} onClick={()=>onAsk('Help me plan: '+goal)} disabled={!goal.trim()}>Ask Compass</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold">Event date
            <input type="date" className={'mt-1 '+field} value={date} onChange={e=>setDate(e.target.value)}/>
          </label>
          <label className="text-[11px] font-semibold">Local time
            <input type="time" className={'mt-1 '+field} value={time} onChange={e=>setTime(e.target.value)}/>
          </label>
        </div>
        <button type="button" className={action} onClick={()=>run(createCalendar)}>
          <CalendarDays size={15} className="mr-1 inline"/>Download 30-minute calendar event
        </button>
      </section>
      <section className="space-y-2 rounded-xl border border-border p-3" aria-label="Writing and research tools">
        <label className="block text-[12px] font-semibold">Message subject
          <input value={subject} onChange={e=>setSubject(e.target.value)}
            maxLength={120} className={'mt-1 '+field} placeholder="Project update"/>
        </label>
        <label className="block text-[12px] font-semibold">What should it say?
          <textarea value={message} onChange={e=>setMessage(e.target.value)}
            maxLength={800} rows={3} className={'mt-1 '+field} placeholder="Key points for your draft"/>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={()=>run(()=>setDraft(makeMessageDraft(subject,message)))}>Prepare message</button>
          <button type="button" className={action} onClick={()=>{void copyDraft();}}>
            <ClipboardCopy size={14} className="mr-1 inline"/>Copy draft
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={()=>onAsk('Explain this code or help me debug it: ' + (subject.trim()||'my code'))}>
            <Laptop size={14} className="mr-1 inline"/>Coding help
          </button>
          <button type="button" className={action} onClick={()=>onAsk('Search public info about '+(subject.trim()||'financial literacy'))}>
            <Lightbulb size={14} className="mr-1 inline"/>Source-backed research
          </button>
          {onImportDocuments&&<button type="button" className={action} onClick={onImportDocuments}>
            <FileText size={14} className="mr-1 inline"/>Choose documents
          </button>}
        </div>
      </section>
    </div>
    {draft&&<label className="mt-3 block text-[12px] font-semibold">Local draft preview (not automatically saved)
      <textarea readOnly rows={7} value={draft} className={'mt-1 '+field} aria-label="Prepared local draft"/>
    </label>}
    {status&&<p role="status" className="mt-2 text-[11px] text-muted-foreground">{status}</p>}
    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0"/>The tools on this panel do not have automatic email, calendar, contacts or operating-system access.</p>
  </details>;
}

export function FinanceFocusDeck({onAsk,onImportDocuments}:Props){
  return <details className="rounded-[18px] border border-border bg-card p-3 shadow-sm" aria-label="Financial Advisor focus tools">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-bold">
      <ShieldCheck size={18} className="text-primary"/> Finance review tools
      <span className="ml-auto text-[11px] font-normal text-muted-foreground">Read-only · verified sources labelled</span>
    </summary>
    <p className="my-2 text-[12px] leading-5 text-muted-foreground">
      Analyse accounts, debt, spending and markets. Imported statements are historical evidence, not live bank balances.
      General personal tasks belong in Compass Personal.
    </p>
    <div className="flex flex-wrap gap-2">
      {['Review my debt priorities','Summarize salary-cycle spending','What financial sources are verified?','Explain portfolio risk'].map(q=>
        <button type="button" className={action} key={q} onClick={()=>onAsk(q)}>{q}</button>)}
      {onImportDocuments&&<button type="button" className={action} onClick={onImportDocuments}>Import financial documents</button>}
    </div>
  </details>;
}
