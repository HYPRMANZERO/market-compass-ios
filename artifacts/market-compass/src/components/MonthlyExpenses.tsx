import { type FormEvent, useEffect, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, CircleAlert, Edit2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { localDate } from '@/lib/dailyBackup';
import SalaryPush from './SalaryPush';
import {Link} from 'wouter';
import {allowedDocumentCategories} from '@/lib/reviewedDocumentLedger';
import type { DesktopAiSettings } from '@/lib/desktopAiSettings';
import {
  type ExpenseEntry, type ExpenseKind, type ExpenseCategory, type ExpenseSettings,
  EXPENSE_CATEGORIES, EXPENSE_KINDS, cycleAnalysis, cycleEntries, parseMoneyAmount,
  salaryCycle, shiftSalaryCycle, validateExpenseEntry, cycleSpendingTrends,
  cycleCashflowCutIdeas, suggestKnownSpendCategory,
} from '@/lib/monthlyExpenses';

type DebtAccount = {id:string;name:string;balance:string};
type Props = {
  entries:ExpenseEntry[];
  settings:ExpenseSettings;
  currency:string;
  debtAccounts:DebtAccount[];
  desktopAi:DesktopAiSettings;
  onSave:(entry:ExpenseEntry,syncDebtBalance:boolean)=>void;
  onDelete:(id:string)=>void;
  onSettingsChange:(settings:ExpenseSettings)=>void;
};
const field='mt-1 block min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px]';
const cash=(value:number,code:string)=>{
  try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency:code,maximumFractionDigits:2}).format(value);}
  catch{return code+' '+value.toFixed(2);}
};
const readable=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
const suggestCategory=(_kind:ExpenseKind):ExpenseCategory=>'unsorted';
export default function MonthlyExpenses({entries,settings,currency,debtAccounts,desktopAi,onSave,onDelete,onSettingsChange}:Props){
  const today=localDate();
  const calendarUrl = new URL(import.meta.env.BASE_URL + 'salary-reminder.ics',window.location.origin).toString();
  const [cycleStart,setCycleStart]=useState(()=>salaryCycle(today).start);
  const [editingId,setEditingId]=useState('');
  const [date,setDate]=useState(today);
  const [kind,setKind]=useState<ExpenseKind>('expense');
  const [category,setCategory]=useState<ExpenseCategory>('unsorted');
  const [viewFilter,setViewFilter]=useState('all');
  const [description,setDescription]=useState('');
  const [paidVia,setPaidVia]=useState('');
  const [amount,setAmount]=useState('');
  const [linkedDebtId,setLinkedDebtId]=useState('');
  const [accountLabel,setAccountLabel]=useState('');
  const [remaining,setRemaining]=useState('');
  const [syncDebt,setSyncDebt]=useState(false);
  const [note,setNote]=useState('');
  const [budgetDraft,setBudgetDraft]=useState(settings.cycleBudget);
  const [salaryDraft,setSalaryDraft]=useState(settings.expectedSalary);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [reminderNote,setReminderNote]=useState('');
  const [nowTick,setNowTick]=useState(0);
  const activeRange=salaryCycle(today),selected=salaryCycle(cycleStart);
  const active=selected.start===activeRange.start;
  const allEntries=Array.isArray(entries)?entries:[];
  const analysis=cycleAnalysis(allEntries,cycleStart,currency,settings.cycleBudget);
  const historicalTrends=cycleSpendingTrends(allEntries,cycleStart,today,currency);
  const cutIdeas=cycleCashflowCutIdeas(allEntries,cycleStart,currency);
  const suggestedManualCategory=suggestKnownSpendCategory(kind,description);
  const selectedEntries=cycleEntries(allEntries,cycleStart,currency)
    .slice().sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  const shownEntries=selectedEntries.filter(e=>{
    if(viewFilter==='all')return true;
    if(viewFilter==='unsorted')return e.category==='unsorted';
    if(viewFilter==='income')return e.kind==='income';
    if(viewFilter==='outflow')return e.kind==='expense'||e.kind==='debt-payment';
    if(viewFilter==='transfers')return e.kind==='transfer';
    return viewFilter.startsWith('category:')&&e.category===viewFilter.slice(9);
  });
  const currentSalaryEntered=cycleEntries(allEntries,activeRange.start,currency)
    .some(e=>e.kind==='income'&&e.category==='salary');
  const salaryDay=today.endsWith('-26');
  const salaryReminderDue=salaryDay&&!currentSalaryEntered;
  function reset(){
    setEditingId('');setDate(today);setKind('expense');setCategory('unsorted');setDescription('');
    setPaidVia('');setAmount('');setLinkedDebtId('');setAccountLabel('');setRemaining('');setSyncDebt(false);setNote('');
  }
  function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setMessage('');
    try{
      const balance=remaining.trim()===''?null:parseMoneyAmount(remaining,{zeroAllowed:true});
      const linked=debtAccounts.find(x=>x.id===linkedDebtId);
      const original=allEntries.find(x=>x.id===editingId);
      const entry=validateExpenseEntry({
        id:original?.id||crypto.randomUUID(),recordedAt:original?.recordedAt||new Date().toISOString(),
        date,kind,category,description:description.trim(),paidVia:paidVia.trim(),
        amount:parseMoneyAmount(amount),currency,
        debtAccountId:kind==='debt-payment'&&linked?linked.id:undefined,
        accountLabel:kind==='debt-payment'?(linked?.name||accountLabel.trim()):undefined,
        remainingBalance:kind==='debt-payment'?balance:undefined,note:note.trim(),
      });
      if(syncDebt&&kind==='debt-payment'&&linked&&balance!==null) {
        if(!window.confirm('Replace the current Debt Plan balance for '+linked.name+
          ' with '+cash(balance,currency)+'? This is an owner-entered value, not bank verified.'))return;
      }
      onSave(entry,syncDebt&&kind==='debt-payment'&&Boolean(linked)&&balance!==null);
      setCycleStart(salaryCycle(date).start);
      setMessage(original?'Payment entry updated in the encrypted vault.':'Payment entry recorded in the encrypted vault.');
      reset();
    }catch(e){setError(e instanceof Error?e.message:'Unable to save payment.');}
  }
  function edit(e:ExpenseEntry){
    setEditingId(e.id);setDate(e.date);setKind(e.kind);setCategory(e.category);
    setDescription(e.description);setPaidVia(e.paidVia);setAmount(String(e.amount));
    setLinkedDebtId(e.debtAccountId||'');setAccountLabel(e.accountLabel||'');
    setRemaining(e.remainingBalance===undefined||e.remainingBalance===null?'':String(e.remainingBalance));
    setSyncDebt(false);setNote(e.note||'');setError('');setMessage('Editing existing payment entry.');
    document.getElementById('mc-expense-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function saveBudget(){
    try{
      if(budgetDraft.trim())parseMoneyAmount(budgetDraft);
      if(salaryDraft.trim())parseMoneyAmount(salaryDraft);
      onSettingsChange({...settings,cycleBudget:budgetDraft.trim(),expectedSalary:salaryDraft.trim()});
      setMessage('Cycle limits saved in your encrypted workspace. Expected salary is not treated as received income.');setError('');
    }catch(e){setError(e instanceof Error?e.message:'Invalid target amount.');}
  }
  async function enableReminder(){
    if(!('Notification' in window)){
      setReminderNote('Browser notifications are not available here. Your salary-day reminder will still appear inside the app.');return;
    }
    try{
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){
        setReminderNote('Notification permission was not granted. In-app salary-day reminders remain available.');return;
      }
      onSettingsChange({...settings,salaryReminderEnabled:true});
      setReminderNote('Salary-day reminder enabled while Market Compass is open. Closed-app iPhone push is not configured.');
    }catch{setReminderNote('Notification permission could not be requested on this device.');}
  }
  useEffect(()=>{
    if(!settings.salaryReminderEnabled || !salaryReminderDue || settings.lastSalaryReminderCycle===activeRange.start)return;
    if(document.visibilityState!=='visible'||!('Notification' in window)||Notification.permission!=='granted')return;
    let live=true;
    const show=async()=>{
      try{
        if('serviceWorker' in navigator){
          const registration=await navigator.serviceWorker.getRegistration();
          if(registration && live)await registration.showNotification('Market Compass: salary-day check-in',{
            body:'Record your received salary and confirm upcoming bills in Monthly Expenses.',
            tag:'mc-salary-'+activeRange.start,
          });
          else if(live && !/iphone|ipad|ipod/i.test(navigator.userAgent))
            new Notification('Market Compass: salary-day check-in',{body:'Record your salary and upcoming bills.'});
        }else if(live){
          new Notification('Market Compass: salary-day check-in',{body:'Record your salary and upcoming bills.'});
        }
        if(live)onSettingsChange({...settings,lastSalaryReminderCycle:activeRange.start});
      }catch{/* App reminder remains visible even when OS notifications are unavailable. */}
    };
    void show();
    return()=>{live=false;};
  // Intentional: once-per-cycle foreground reminder, not a background scheduler.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[settings.salaryReminderEnabled,settings.lastSalaryReminderCycle,salaryReminderDue,activeRange.start,nowTick]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible')setNowTick(n=>n+1);};
    document.addEventListener('visibilitychange',refresh);
    return()=>document.removeEventListener('visibilitychange',refresh);
  },[]);
  const incomeNotYetConfirmed=analysis.income===0;
  const guidance=[
    ...analysis.flags,
    ...(analysis.unsortedCount>0?['Review '+analysis.unsortedCount+' Unsorted record(s) at your convenience. Categorization is optional and does not change the recorded money movement.']:[]),
    ...(analysis.debtPayments>0?['Keep the latest lender-confirmed outstanding balance distinct from the installment amount. Do not infer remaining debt by simple subtraction when interest or fees apply.']:[]),
    'Pay essential bills and contractual debt minimums first; preserve a cash buffer before considering extra repayments.',
    'Review high-APR revolving credit before adding speculative investments. Cash flow and income-producing assets matter more than an unverified return forecast.',
  ].slice(0,6);
  return <div className="space-y-4">
    <header className="border-b border-border pb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Your salary-cycle ledger</p>
      <h1 className="serif mt-2 text-[30px]">Monthly expenses</h1>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">Each cycle runs from the 26th through the 25th. Enter payments after they happen. No transactions are sent, imported automatically or verified with a bank.</p>
    </header>
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-xl border border-border" aria-label="Previous salary cycle"
          onClick={()=>setCycleStart(shiftSalaryCycle(cycleStart,-1).start)}><ChevronLeft size={19}/></button>
        <div className="text-center">
          <div className="text-[11px] text-muted-foreground">{active?'Current salary cycle':'Salary cycle history'}</div>
          <div className="mt-1 text-[14px] font-bold">{readable(selected.start)} – {readable(selected.lastDay)}</div>
        </div>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-xl border border-border" aria-label="Next salary cycle"
          onClick={()=>setCycleStart(shiftSalaryCycle(cycleStart,1).start)}><ChevronRight size={19}/></button>
      </div>
      {!active&&<button type="button" onClick={()=>setCycleStart(activeRange.start)} className="mt-3 w-full rounded-lg border border-border py-2 text-[12px] font-semibold">Jump to current cycle</button>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Received income',analysis.income],
          ['Expenses',analysis.expenses],
          ['Debt repayments',analysis.debtPayments],
          ['Other transfers',analysis.transfers],
        ].map(([label,value])=><div key={String(label)} className="rounded-xl bg-muted/60 p-3">
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-[17px] font-bold">{cash(Number(value),currency)}</p>
        </div>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-3" aria-label="Cash flow and unsorted totals">
        <div><p className="text-[10px] text-muted-foreground">Recorded outflow</p>
          <p className="mt-1 text-[14px] font-bold">{cash(analysis.outflow,currency)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Unsorted outflow (included)</p>
          <p className="mt-1 text-[14px] font-bold">{cash(analysis.unsortedOutflow,currency)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Unsorted income (included)</p>
          <p className="mt-1 text-[14px] font-bold">{cash(analysis.unsortedIncome,currency)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Unsorted entries</p>
          <p className="mt-1 text-[14px] font-bold">{analysis.unsortedCount}</p></div>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">Recorded income less expenses and debt payments: <strong className="text-foreground">{cash(analysis.recordedDifference,currency)}</strong>. This is not a verified bank balance. Internal transfers are excluded to avoid double counting.</p>
      {analysis.budget!==null&&<div className="mt-3">
        <div className="flex justify-between text-[11px]"><span>Cycle outflow vs planned limit</span><strong>{Math.round(analysis.percent??0)}%</strong></div>
        <div className="mt-2 h-2 rounded-full bg-muted"><div className={'h-2 rounded-full '+((analysis.percent??0)>100?'bg-destructive':'bg-primary')} style={{width:Math.min(100,analysis.percent??0)+'%'}} /></div>
        <p className="mt-1 text-[11px] text-muted-foreground">{cash(analysis.outflow,currency)} of {cash(analysis.budget,currency)}. Excludes internal transfers.</p>
      </div>}
      {salaryReminderDue&&<p role="status" className="mt-4 rounded-xl border border-border bg-muted/70 px-3 py-3 text-[12px] leading-5"><Bell size={15} className="mr-2 inline"/>It's the 26th: record your actual salary when it arrives, then check car, credit-card and essential payment dates.</p>}
    </section>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[14px] font-bold">Salary-cycle targets and reminders</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold">Planned cycle outflow limit ({currency})
          <input type="number" min="0" step=".01" className={field} placeholder="Optional" value={budgetDraft} onChange={e=>setBudgetDraft(e.target.value)}/>
        </label>
        <label className="text-[12px] font-semibold">Expected salary ({currency})
          <input type="number" min="0" step=".01" className={field} placeholder="Not counted until received" value={salaryDraft} onChange={e=>setSalaryDraft(e.target.value)}/>
        </label>
      </div>
      <button type="button" className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground" onClick={saveBudget}>Save targets</button>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="max-w-sm text-[11px] leading-5 text-muted-foreground">Salary-day alerts are optional and appear inside Market Compass. Browser notifications can appear while this app is open, but reliable iPhone alerts while the app is closed require a separate push service.</p>
        {settings.salaryReminderEnabled?<button type="button" className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold" onClick={()=>onSettingsChange({...settings,salaryReminderEnabled:false})}>Disable browser reminders</button>:
          <button type="button" className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold" onClick={()=>void enableReminder()}><Bell size={15} className="mr-1 inline"/> Enable browser reminders</button>}
      </div>
      <div className="mt-4 rounded-xl bg-muted/40 p-3">
        <p className="text-[12px] font-semibold">iPhone alerts when the app is closed</p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          For a free monthly system reminder, subscribe to the Market Compass calendar on your iPhone.
          In Calendar → Calendars → Add Calendar → Add Subscription Calendar, paste the URL below and enable alerts.
          This is an Apple Calendar reminder on the 26th, not a live expense-triggered push message.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={calendarUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-[12px] font-semibold">Open reminder calendar (.ics)</a>
          <button type="button" className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold"
            onClick={()=>void navigator.clipboard.writeText(calendarUrl).then(
              ()=>setReminderNote('Calendar subscription URL copied. Add it to Calendar on your iPhone.'),
              ()=>setReminderNote('Copy the link from the .ics link using your browser instead.')
            )}>Copy calendar URL</button>
        </div>
      </div>
      <div className="mt-4"><SalaryPush settings={desktopAi}/></div>
      {reminderNote&&<p role="status" className="mt-2 text-[11px] text-muted-foreground">{reminderNote}</p>}
    </section>
    <section id="mc-expense-form" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[15px] font-bold">{editingId?'Edit payment':'Record a payment or salary'}</h2>
      <form onSubmit={save} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] font-semibold">Payment date
            <input required type="date" className={field} value={date} onChange={e=>setDate(e.target.value)}/>
          </label>
          <label className="text-[12px] font-semibold">Entry type
            <select className={field} value={kind} onChange={e=>{const k=e.target.value as ExpenseKind;setKind(k);setCategory(suggestCategory(k));setRemaining('');setLinkedDebtId('');setSyncDebt(false);}}>
              {EXPENSE_KINDS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold">Category
            <select className={field} value={category} onChange={e=>setCategory(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          {category==='unsorted'&&suggestedManualCategory!=='unsorted'&&
            <button type="button" className="min-h-11 self-end rounded-xl border border-primary/30 px-3 text-[12px] font-semibold"
              onClick={()=>setCategory(suggestedManualCategory)}>
              Use suggested category: {EXPENSE_CATEGORIES.find(x=>x.value===suggestedManualCategory)?.label}
            </button>}
          <label className="text-[12px] font-semibold">Amount ({currency})
            <input required type="number" min=".01" step=".01" value={amount} onChange={e=>setAmount(e.target.value)} className={field} placeholder="0.00"/>
          </label>
          <label className="text-[12px] font-semibold">Description
            <input required maxLength={100} value={description} onChange={e=>setDescription(e.target.value)} className={field} placeholder={kind==='income'?'Salary received':'What was paid?'}/>
          </label>
          <label className="text-[12px] font-semibold">App / payment method
            <input required maxLength={60} value={paidVia} onChange={e=>setPaidVia(e.target.value)} className={field} placeholder="e.g. Standard Bank, Cash, Capitec"/>
          </label>
        </div>
        {kind==='debt-payment'&&<div className="space-y-3 rounded-xl bg-muted/60 p-3">
          <p className="text-[12px] font-semibold">Debt account details (optional)</p>
          {debtAccounts.length>0&&<label className="block text-[12px]">Link to saved Debt Plan account
            <select value={linkedDebtId} className={field} onChange={e=>setLinkedDebtId(e.target.value)}>
              <option value="">No saved account selected</option>
              {debtAccounts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>}
          <label className="block text-[12px]">Account nickname (no full account number)
            <input maxLength={80} disabled={Boolean(linkedDebtId)} className={field} value={linkedDebtId?debtAccounts.find(x=>x.id===linkedDebtId)?.name??'':accountLabel} onChange={e=>setAccountLabel(e.target.value)} placeholder="Car loan or credit card"/>
          </label>
          <label className="block text-[12px]">Outstanding debt balance after payment ({currency})
            <input type="number" min="0" step=".01" className={field} value={remaining} onChange={e=>setRemaining(e.target.value)} placeholder="Optional, confirmed from lender"/>
          </label>
          {linkedDebtId&&remaining.trim()!==''&&<label className="flex items-start gap-2 text-[12px] leading-5">
            <input type="checkbox" className="mt-1" checked={syncDebt} onChange={e=>setSyncDebt(e.target.checked)}/>
            Also replace this Debt Plan account's saved balance after confirmation. Never recalculated from installment alone.
          </label>}
        </div>}
        <label className="block text-[12px] font-semibold">Notes (optional)
          <textarea rows={2} maxLength={240} value={note} onChange={e=>setNote(e.target.value)}
            className={field+' py-3'} placeholder="Due date, fees, anything unusual"/>
        </label>
        {error&&<p role="alert" className="rounded-lg bg-destructive/10 p-3 text-[12px] text-destructive">{error}</p>}
        {message&&<p role="status" className="rounded-lg bg-muted/60 p-3 text-[12px]">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground"><Plus size={16}/>{editingId?'Update entry':'Save entry to vault'}</button>
          {editingId&&<button type="button" className="min-h-12 rounded-xl border border-border px-4 text-[12px]" onClick={reset}>Cancel edit</button>}
        </div>
      </form>
    </section>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[14px] font-bold">Cash-flow guidance · expense cuts</h2>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
        Cash-flow-first principles inspired by Rich Dad Poor Dad: track money coming in, separate
        necessary outflows from optional spending, protect debt minimums and a cash buffer,
        then consider how surplus could support productive assets. Category patterns are owner-reviewed observations, not live bank data.
      </p>
      {cutIdeas.ideas.length>0?<div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-[11px] font-semibold">Illustrative room to improve cash flow</p>
        <p className="mt-1 text-[18px] font-bold">{cash(cutIdeas.totalIllustrativeSavings,currency)} <span className="text-[11px] font-normal text-muted-foreground">potential scenario per recorded cycle; not guaranteed savings</span></p>
        <div className="mt-2 space-y-3">{cutIdeas.ideas.map(idea=><div key={idea.category} className="border-t border-border pt-2">
          <p className="text-[12px] font-semibold">{EXPENSE_CATEGORIES.find(c=>c.value===idea.category)?.label}: {cash(idea.recorded,currency)} recorded</p>
          <p className="mt-1 text-[11px] leading-5">A hypothetical {Math.round(idea.rate*100)}% reduction would free {cash(idea.illustrativeSavings,currency)}. {idea.action}</p>
        </div>)}</div>
      </div>:<p className="mt-3 text-[12px] text-muted-foreground">No eligible categorized discretionary costs recorded for this cycle yet. Label purchases when convenient to unlock evidence-based cut scenarios.</p>}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">For tailored conversational analysis, ask Compass AI: “Based on my recorded category spending, what could I cut to improve cash flow?” AI responses come from HYPRBOX Ollama only while connected; aggregate finance context is shared only if you enable it in Assistant. No raw ledger is uploaded automatically.</p>
      <Link href="/assistant" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-primary/40 px-4 text-[12px] font-semibold">
        Open Compass AI · cash-flow review
      </Link>
      <h3 className="mt-4 text-[14px] font-bold">Spending patterns and recommendations</h3>
      <div className="mt-3 space-y-2">
        {guidance.map((item,i)=><p key={i} className="flex items-start gap-2 text-[12px] leading-5"><CircleAlert size={16} className="mt-0.5 shrink-0 text-muted-foreground"/>{item}</p>)}
      </div>
      {analysis.byCategory.length>0&&<div className="mt-4 border-t border-border pt-3">
        <h3 className="text-[12px] font-semibold">Largest categories (excluding transfers)</h3>
        <div className="mt-2 space-y-2">{analysis.byCategory.map(x=><div key={x.category} className="flex justify-between gap-3 text-[12px]"><span>{x.label}</span><strong>{cash(x.amount,currency)}</strong></div>)}</div>
      </div>}
      {analysis.byPaymentMethod.length>0&&<div className="mt-4 border-t border-border pt-3">
        <h3 className="text-[12px] font-semibold">Payment apps and methods used</h3>
        <div className="mt-2 space-y-2">{analysis.byPaymentMethod.map(item=><div key={item.app} className="flex justify-between gap-3 text-[12px]">
          <span>{item.app} <span className="text-muted-foreground">({item.count})</span></span>
          <strong>{cash(item.amount,currency)}</strong>
        </div>)}</div>
        <p className="mt-2 text-[11px] text-muted-foreground">Only manually recorded spending and debt repayments. Internal transfers excluded.</p>
      </div>}
      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-[12px] font-semibold">Completed salary-cycle trends</h3>
        {historicalTrends.available?<div className="mt-2 space-y-2">
          {historicalTrends.highlights.map((item,i)=><p key={i} className="text-[12px] leading-5">{item}</p>)}
        </div>:<p className="mt-2 text-[12px] text-muted-foreground">{historicalTrends.message}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">Partial cycles are not compared as complete months. Categories are spending observations, not proof of waste.</p>
      </div>
      {analysis.latestBalances.length>0&&<div className="mt-4 border-t border-border pt-3">
        <h3 className="text-[12px] font-semibold">Latest manually entered debt balances</h3>
        {analysis.latestBalances.map(x=><p key={x.account} className="mt-2 text-[12px]">{x.account}: <strong>{cash(x.balance,currency)}</strong> <span className="text-muted-foreground">({readable(x.date)}; unverified)</span></p>)}
      </div>}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={14} className="mr-1 inline"/>This is a budgeting tool, not a bank feed. Principles about cash flow, assets and liabilities are educational; avoid speculative investments until debt, essentials and your buffer are manageable.</p>
    </section>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[14px] font-bold">Entries · {analysis.count}</h2>
      <label className="mt-3 block text-[12px] font-semibold">Filter money movements
        <select value={viewFilter} onChange={e=>setViewFilter(e.target.value)} className={field}>
          <option value="all">All ({analysis.count})</option>
          <option value="unsorted">Unsorted ({analysis.unsortedCount})</option>
          <option value="income">Incoming</option>
          <option value="outflow">Expenses and debt repayments</option>
          <option value="transfers">Internal transfers</option>
          <optgroup label="Known categories">
            {EXPENSE_CATEGORIES.filter(c=>c.value!=='unsorted').map(c=>
              <option key={c.value} value={'category:'+c.value}>{c.label}</option>)}
          </optgroup>
        </select>
      </label>
      <p className="mt-2 text-[11px] text-muted-foreground">Showing {shownEntries.length} of {analysis.count} reviewed entries. Filters never remove or modify saved money movements.</p>
      {selectedEntries.length===0?<p className="mt-3 text-[12px] text-muted-foreground">No entries recorded for this salary cycle. Start with your next payment or salary deposit.</p>:
        <div className="mt-3 space-y-2">{shownEntries.map(e=><div key={e.id} className="rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">
            <div className="text-[12px] font-bold">{e.description}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{readable(e.date)} · {e.paidVia} · {EXPENSE_KINDS.find(x=>x.value===e.kind)?.label}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Category: {EXPENSE_CATEGORIES.find(c=>c.value===e.category)?.label??'Unsorted'}</div>
            {e.category==='unsorted'&&<label className="mt-2 block text-[11px] font-semibold">
              Label this entry (optional)
              <select aria-label={'Label category for '+e.description}
                value="unsorted"
                onChange={event=>{
                  const next=event.target.value as ExpenseCategory;
                  if(next==='unsorted'||!allowedDocumentCategories(e.kind).includes(next))return;
                  try{onSave(validateExpenseEntry({...e,category:next}),false);setMessage('Category updated without changing movement totals.');setError('');}
                  catch(err){setError(err instanceof Error?err.message:'Unable to label entry.');}
                }}
                className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-2 text-[13px]">
                <option value="unsorted">Unsorted · choose a category</option>
                {EXPENSE_CATEGORIES.filter(c=>c.value!=='unsorted'&&allowedDocumentCategories(e.kind).includes(c.value))
                  .map(c=><option value={c.value} key={c.value}>{c.label}</option>)}
              </select>
            </label>}
            {e.accountLabel&&<p className="mt-1 text-[11px] text-muted-foreground">{e.accountLabel}</p>}
            {e.remainingBalance!==undefined&&e.remainingBalance!==null&&<p className="mt-1 text-[11px] text-muted-foreground">Remaining debt (entered): {cash(e.remainingBalance,e.currency)}</p>}
            {e.note&&<p className="mt-1 text-[11px] text-muted-foreground">{e.note}</p>}
          </div><strong className="shrink-0 text-[13px]">{e.kind==='income'?'+':e.kind==='transfer'?'↔':'−'}{cash(e.amount,e.currency)}</strong></div>
          <div className="mt-2 flex justify-end gap-2 border-t border-border pt-2">
            <button type="button" onClick={()=>edit(e)} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold"><Edit2 size={13}/> Edit</button>
            <button type="button" onClick={()=>{if(window.confirm('Delete this locally saved entry? Any manually updated Debt Plan balance will remain unchanged.'))onDelete(e.id);}} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-destructive"><Trash2 size={13}/> Delete</button>
          </div>
        </div>)}</div>}
      {selectedEntries.length>0&&shownEntries.length===0&&<p className="mt-3 text-[12px] text-muted-foreground">No recorded movements match this filter.</p>}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Entries are encrypted in this device's vault. Export your vault backup to move records to another device; they are not automatically synchronized with the desktop's AI memory.</p>
    </section>
  </div>;
}
