import {useEffect,useState} from 'react';
import {ChevronDown,ChevronUp,Save,ShieldCheck} from 'lucide-react';
import {localDate} from '@/lib/dailyBackup';
import {budgetDetailSummary} from '@/lib/budgetDetailGroups';
import {salaryCycle,type ExpenseEntry,type ExpenseSettings} from '@/lib/monthlyExpenses';

type Props={entries:ExpenseEntry[];currency:string;settings:ExpenseSettings;
  onSettingsChange:(settings:ExpenseSettings)=>void};
const format=(n:number,currency:string)=>{
  try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}
  catch{return currency+' '+n.toFixed(2);}
};
/** Grouped budget controls, separate from the original transaction record/approval flow. */
export default function BudgetDetailReview({entries,currency,settings,onSettingsChange}:Props){
  const [cycle,setCycle]=useState(()=>salaryCycle(localDate()).start);
  const [expanded,setExpanded]=useState<string|null>('bank-fees');
  const [draft,setDraft]=useState<Record<string,string>>(settings.subcategoryBudgets??{});
  const [status,setStatus]=useState('');
  const [editing,setEditing]=useState(false);
  useEffect(()=>{if(!editing)setDraft(settings.subcategoryBudgets??{});},[settings.subcategoryBudgets,editing]);
  const cycles=[...new Set(entries.filter(e=>e.currency===currency).map(e=>{
    try{return salaryCycle(e.date).start;}catch{return null;}
  }).filter((x):x is string=>x!==null))];
  const current=salaryCycle(localDate()).start;
  if(!cycles.includes(current))cycles.push(current);
  cycles.sort().reverse();
  const summary=budgetDetailSummary(entries,cycle,currency,settings.subcategoryBudgets??{},localDate());
  const save=()=>{
    for(const [id,value] of Object.entries(draft)){
      if(value.trim()!==''&&(!/^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(value.trim())||
        Number(value)>1e11)){setStatus('Enter valid non-negative budgets with at most two decimals.');return;}
    }
    const normalized=Object.fromEntries(Object.entries(draft).filter(([,v])=>v.trim()!=='')
      .map(([k,v])=>[k,v.trim()]));
    onSettingsChange({...settings,subcategoryBudgets:normalized});
    setStatus('Detailed budget limits saved locally. No transaction categories or amounts were changed.');
    setEditing(false);
  };
  return <section className="mb-5 min-w-0 rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Detailed budget category groups" data-testid="budget-detail-groups">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-bold">Budget · detailed categories</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Spent / Budget / Recorded average, using the same 26th–25th salary cycle as Spend.
          Existing transactions keep their main categories until you choose a detail in Edit payment.
        </p>
      </div>
      <label className="text-[11px] font-semibold">Salary cycle
        <select className="mt-1 block min-h-11 w-full max-w-full rounded-xl border border-input bg-background px-3 text-[13px]"
          aria-label="Detailed budget salary cycle" value={cycle} onChange={e=>setCycle(e.target.value)}>
          {cycles.map(start=><option key={start} value={start}>{start} to {salaryCycle(start).lastDay}</option>)}
        </select>
      </label>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] leading-5 text-muted-foreground">
        A dash means no budget or enough completed history was recorded. It does not mean zero.
      </p>
      <button type="button" onClick={()=>{setEditing(old=>!old);setStatus('');}}
        className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">
        {editing?'Close budget editor':'Set detailed budgets'}
      </button>
    </div>
    {status&&<p role="status" className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px]">{status}</p>}
    <div className="mt-4 space-y-3">
      {summary.map(group=><section key={group.id} className="overflow-hidden rounded-2xl border border-border bg-background">
        <button type="button" aria-expanded={expanded===group.id}
          onClick={()=>setExpanded(old=>old===group.id?null:group.id)}
          className="flex min-h-[66px] w-full items-center justify-between gap-3 px-3 py-3 text-left sm:px-4">
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">{group.title}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {format(group.spent,currency)} spent / {group.budget===null?'Budget not fully set':format(group.budget,currency)+' budget'}
            </span>
          </span>
          {expanded===group.id?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
        </button>
        {expanded===group.id&&<div className="border-t border-border px-3 pb-3 sm:px-4">
          <p className="py-2 text-[10px] text-muted-foreground">Category · Spent / Budget / Recorded average</p>
          {group.rows.map(row=><div key={row.id} className="border-t border-border/70 py-3">
            <p className="text-[12px] font-medium">{row.label}</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold tabular-nums">{format(row.spent,currency)}</span>
              <span className="text-muted-foreground tabular-nums">
                / {row.budget===null?'—':format(row.budget,currency)}
                {' / '}{row.historicalAverage===null?'—':format(row.historicalAverage,currency)}
              </span>
            </div>
            {row.budget!==null&&row.budget>0&&<div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{Math.round(row.spent/row.budget*100)}% of entered budget</span>
              <span className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-primary" style={{width:Math.min(100,row.spent/row.budget*100)+'%'}}/>
              </span>
            </div>}
            {editing&&<label className="mt-2 block text-[11px] font-semibold">Budget ({currency})
              <input inputMode="decimal" type="number" min="0" step="0.01" value={draft[row.id]??''}
                onChange={e=>setDraft(old=>({...old,[row.id]:e.target.value}))} placeholder="Not set"
                aria-label={'Budget for '+row.label}
                className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[16px]"/>
            </label>}
          </div>)}
          {group.unassigned>0&&<p className="mt-2 rounded-xl bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
            {format(group.unassigned,currency)} in existing broad categories has no detailed label.
            It is included in the group total, but not guessed into a subcategory.
          </p>}
        </div>}
      </section>)}
    </div>
    {editing&&<button type="button" onClick={save}
      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground">
      <Save size={16}/>Save detailed budgets
    </button>}
    <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
      <ShieldCheck size={15} className="mt-0.5 shrink-0"/>Unassigned entries, debit and credit direction, savings transfers and income are not silently rewritten. Historical averages use two prior cycles with recorded detail-tagged activity and can be incomplete.
    </p>
  </section>;
}
