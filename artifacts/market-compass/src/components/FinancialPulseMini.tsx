import {useMemo} from 'react';
import {Link} from 'wouter';
import {Activity,ArrowRight,ShieldCheck} from 'lucide-react';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import {calculateFinancialPulse} from '@/lib/financialPulseForecast';
import {localDate} from '@/lib/dailyBackup';
import {recurringSpendCandidates} from '@/lib/recurringSpendInsights';
import {nextFinancialPulseReview} from '@/lib/financialPulseGuidance';

const zar=(n:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(n);

/** The owner-approved ledger does not establish a live bank balance. */
export default function FinancialPulseMini({entries,currency}:{entries:readonly ExpenseEntry[];currency:string}){
  const today=localDate();
  if(currency!=='ZAR')return <section className="mb-4 rounded-[18px] border border-border bg-card p-4 lg:hidden" aria-label="Financial Pulse">
    <h2 className="text-[14px] font-extrabold">Financial Pulse</h2>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">ZAR evidence only for now. No automatic currency conversion or bank balance is assumed.</p>
  </section>;
  // Documents and expense arrays can be large. Recalculate only when the
  // approved ledger or salary-cycle day changes, not on unrelated UI renders.
  const {pulse,out,patterns,nextReview}=useMemo(()=>{
    const pulse=calculateFinancialPulse({asOf:today,approvedEntries:entries});
    const out=pulse.recorded.expenses+pulse.recorded.debtPayments;
    const patterns=recurringSpendCandidates(entries,today,'ZAR');
    const nextReview=nextFinancialPulseReview(pulse,patterns.length);
    return {pulse,out,patterns,nextReview};
  },[entries,today]);
  const lastEntryDate=entries.filter(e=>e&&e.currency==='ZAR'&&e.date<=today&&/^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map(e=>e.date).sort().at(-1)??null;
  return <section className="mb-4 rounded-[18px] border border-border bg-card p-4 lg:hidden" aria-label="Financial Pulse" data-testid="financial-pulse-mobile">
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[14px] font-extrabold"><Activity size={17} className="text-primary" aria-hidden="true"/>Financial Pulse</h2>
      <Link href="/expenses" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-semibold">Review <ArrowRight size={13} aria-hidden="true"/></Link>
    </div>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Salary cycle {pulse.cycle.start} to {pulse.cycle.lastDay} · Calculated locally {pulse.asOf}</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-xl bg-muted/45 p-3"><p className="text-[10px] font-semibold text-muted-foreground">Recorded income</p><strong className="mt-1 block break-words text-[16px] font-bold tabular-nums">{pulse.recorded.income>0?zar(pulse.recorded.income):'Not recorded'}</strong></div>
      <div className="min-w-0 rounded-xl bg-muted/45 p-3"><p className="text-[10px] font-semibold text-muted-foreground">Recorded outflows</p><strong className="mt-1 block break-words text-[16px] font-bold tabular-nums">{out>0?zar(out):'Not recorded'}</strong></div>
    </div>
    <p className="mt-1 text-[10px] text-muted-foreground">Last locally recorded entry: {lastEntryDate??'none'} · No bank sync</p>
    <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true"/><span><strong className="text-foreground">Safe to spend: unknown.</strong> Requires a fresh verified bank balance, complete approved bills and a safety buffer. Recorded differences are not bank balances.</span></p>
    <p className="mt-2 rounded-xl bg-muted/35 px-3 py-2 text-[11px] leading-5" aria-label="Next Financial Pulse review">
      <strong>Next review:</strong> {nextReview.description} <Link href={nextReview.destination} className="font-bold text-primary underline underline-offset-2">Open review</Link>
    </p>
    {patterns.length>0&&<details className="mt-3 rounded-xl border border-border p-3" aria-label="Observed recurring spending">
      <summary className="cursor-pointer text-[11px] font-bold">Observed recurring spending ({patterns.length})</summary>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Three consecutive approved salary-cycle observations. Patterns are not confirmed future bills or bank debits.</p>
      <ul className="mt-2 space-y-2">{patterns.slice(0,4).map(item=><li key={item.key} className="flex items-start justify-between gap-3 text-[11px]">
        <span className="min-w-0 break-words">{item.label}<span className="block text-[10px] text-muted-foreground">Last observed {item.lastDate} · Review in Spend</span></span>
        <strong className="shrink-0 tabular-nums">{zar(item.recentAmount)}</strong>
      </li>)}</ul>
    </details>}
    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{pulse.recorded.count} approved or manually recorded entry(s); {pulse.recorded.excludedInvalidOrDuplicate} excluded. Read-only; no live bank sync.</p>
  </section>;
}
