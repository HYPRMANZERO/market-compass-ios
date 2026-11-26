import {useMemo,useState} from 'react';
import {Link} from 'wouter';
import {
  ArrowDownLeft,ArrowRight,ArrowUpRight,CalendarDays,FileText,Landmark,
  ShieldCheck
} from 'lucide-react';
import {financialPulse,shiftSalaryCycle,salaryCycle} from '@/lib/financialPulse';
import {localDate} from '@/lib/dailyBackup';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import type {ExpenseEntry,ExpenseSettings} from '@/lib/monthlyExpenses';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';

type Props={
  entries:ExpenseEntry[];
  documents:LocalFinanceDocument[];
  currency:string;
  settings?:ExpenseSettings;
};
const fmt=(n:number,currency:string)=>{
  try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency,maximumFractionDigits:2}).format(n)}
  catch{return currency+' '+n.toFixed(2)}
};
const dateLabel=(iso:string)=>{
  const date=new Date(iso+'T12:00:00Z');
  return Number.isNaN(date.getTime())?iso:date.toLocaleDateString('en-ZA',{
    day:'numeric',month:'short',timeZone:'UTC'
  });
};
/** Financial records shown here are unlocked-vault data, never bank synced. */
export default function FinancialPulse({entries,documents,currency,settings}:Props){
  const [offset,setOffset]=useState(0);
  const today=localDate();
  const current=salaryCycle(today);
  const chosen=shiftSalaryCycle(current.start,offset);
  // Imported files can be large; unrelated navigation/state changes should
  // not re-validate every record or rebuild all category totals.
  const pulse=useMemo(()=>financialPulse(entries,documents,chosen.start,currency,settings),
    [entries,documents,chosen.start,currency,settings]);
  const lastImport=pulse.lastDocumentImport?.slice(0,10);
  const recent=pulse.recent;
  return <section className="mc-financial-pulse min-w-0 rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5"
    aria-label="Monthly financial review">
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2 text-primary"><CalendarDays size={17} className="shrink-0" aria-hidden="true"/>
        <h2 className="text-[16px] font-extrabold tracking-tight">Monthly review</h2>
      </div>
      <Link href="/expenses" className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-border px-2.5 text-[11px] font-bold text-primary">
        Spend <ArrowRight size={14} aria-hidden="true"/>
      </Link>
    </div>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
      Approved entries only · Not live banking data
    </p>
    <div className="mt-3 flex gap-2" role="group" aria-label="Choose salary cycle">
      {([{offset:0,label:'Current'},{offset:-1,label:'Previous'},{offset:-2,label:'Earlier'}] as const)
        .map(item=><button key={item.offset} type="button" aria-pressed={offset===item.offset}
          onClick={()=>setOffset(item.offset)}
          className={`min-h-10 min-w-0 flex-1 rounded-xl border px-2 text-[11px] font-bold transition-colors ${offset===item.offset
            ?'border-primary bg-primary text-primary-foreground'
            :'border-border bg-muted/35 text-muted-foreground'}`}>
          {item.label}
        </button>)}
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
      {dateLabel(pulse.period.start)}{pulse.period.start.slice(0,4)!==pulse.period.lastDay.slice(0,4)?' '+pulse.period.start.slice(0,4):''} – {dateLabel(pulse.period.lastDay)} {pulse.period.lastDay.slice(0,4)}
      {' · '}{offset===0?'In progress':'Past salary cycle'}
      {' · '}{pulse.totalEntries} {pulse.totalEntries===1?'entry':'entries'}
    </p>
    {pulse.excludedInvalidOrDuplicate>0&&<p role="status" className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950">
      {pulse.excludedInvalidOrDuplicate} invalid, duplicated or conflicting saved record(s) were excluded from this review. Check your source records in Spend before relying on the totals. This does not delete or alter any entry.
    </p>}
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      <div className="min-w-0 rounded-[16px] border border-border bg-muted/30 p-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <ArrowDownLeft size={14} aria-hidden="true"/> Money in
        </span>
        <strong className="mt-2 block break-words text-[clamp(15px,4vw,20px)] font-extrabold tracking-tight tabular-nums">
          {pulse.hasIncome?fmt(pulse.income,currency):'Not recorded'}
        </strong>
        <small className="mt-1 block text-[10px] leading-4 text-muted-foreground">Recorded income only</small>
      </div>
      <div className="min-w-0 rounded-[16px] border border-border bg-muted/30 p-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <ArrowUpRight size={14} aria-hidden="true"/> Money out
        </span>
        <strong className="mt-2 block break-words text-[clamp(15px,4vw,20px)] font-extrabold tracking-tight tabular-nums">
          {pulse.hasOutflows?fmt(pulse.outflows,currency):'Not recorded'}
        </strong>
        <small className="mt-1 block text-[10px] leading-4 text-muted-foreground">Spending + debt repayments</small>
      </div>
    </div>
    {pulse.difference!==null?<p className="mt-3 rounded-xl bg-muted/45 px-3 py-2 text-[11px] leading-5">
      Recorded difference: <strong className="tabular-nums">{fmt(pulse.difference,currency)}</strong>
      <span className="text-muted-foreground"> · Not your available bank balance</span>
    </p>:<p className="mt-3 rounded-xl bg-muted/45 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
      Income and outflow entries are both needed for a useful comparison. Missing entries do not mean zero.
    </p>}
    {pulse.spendingLimit!==null&&<div className="mt-4" aria-label="Recorded outflows against entered spending limit">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
        <span className="font-semibold">Recorded against cycle limit</span>
        <span className="tabular-nums text-muted-foreground">{Math.round(pulse.limitUsedPercent??0)}% of {fmt(pulse.spendingLimit,currency)}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar"
        aria-label="Recorded spending limit used" aria-valuemin={0}
        aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(pulse.limitUsedPercent??0))}>
        <div className="h-full rounded-full bg-[hsl(165,34%,37%)]"
          style={{width:Math.min(100,pulse.limitUsedPercent??0)+'%'}}/>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Limit is owner-entered; unrecorded bills may remain.</p>
    </div>}
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-bold">Spending by category</h3>
        <span className="text-[10px] text-muted-foreground">Recorded outflows</span>
      </div>
      {pulse.categories.length?<div className="mt-3 space-y-3">
        {pulse.categories.map(category=><div key={category.category}>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate font-medium">{category.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{fmt(category.amount,currency)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[hsl(165,30%,39%)]"
              style={{width:category.percent.toFixed(2)+'%'}}/>
          </div>
        </div>)}
      </div>:<p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        No approved spending categories for this cycle. Importing a document alone will not fill these bars.
      </p>}
    </div>
    {recent.length>0&&<details className="mt-4 border-t border-border pt-3">
      <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-[12px] font-bold">
        Recent approved entries <span className="text-[11px] font-normal text-muted-foreground">Show {recent.length}</span>
      </summary>
      <ul className="mt-2 space-y-2">
        {recent.map(entry=><li key={entry.id} className="flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[11px]">{maskDocumentPII(entry.description)}</strong>
            <small className="mt-0.5 block text-[10px] text-muted-foreground">
              {dateLabel(entry.date)} · {entry.kind==='debt-payment'?'Debt repayment':entry.kind==='income'?'Income':entry.kind==='transfer'?'Transfer':'Expense'}
            </small>
          </span>
          <span className="shrink-0 text-[11px] font-bold tabular-nums">
            {entry.kind==='income'?'+':entry.kind==='transfer'?'':'−'}{fmt(entry.amount,currency)}
          </span>
        </li>)}
      </ul>
    </details>}
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="flex items-center gap-2 text-[12px] font-bold"><ShieldCheck size={15} aria-hidden="true"/> Financial sources</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-xl bg-muted/40 p-2.5">
          <div className="flex items-center gap-1.5 font-bold"><FileText size={14} aria-hidden="true"/> File evidence</div>
          <p className="mt-1 leading-4 text-muted-foreground">{pulse.documentCount} saved · {lastImport?('Last imported '+lastImport):'No import date'}</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5">
          <div className="flex items-center gap-1.5 font-bold"><Landmark size={14} aria-hidden="true"/> Bank connection</div>
          <p className="mt-1 leading-4 text-muted-foreground">Not connected · No automatic sync</p>
        </div>
      </div>
      {pulse.omittedOtherCurrency>0&&<p className="mt-2 text-[10px] leading-4 text-muted-foreground">
        {pulse.omittedOtherCurrency} transaction(s) in other currencies excluded. No automatic currency conversion.
      </p>}
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
        Files, payslips and statements are separate evidence until you explicitly approve dated transactions in Spend.
        No bank balance or unrecorded expense is inferred.
      </p>
    </div>
  </section>;
}
