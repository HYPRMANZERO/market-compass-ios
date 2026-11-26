import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import {incomeAllocation} from '@/lib/incomeAllocation';
import {localDate} from '@/lib/dailyBackup';

type Props={entries:ExpenseEntry[];currency:string};
const tones=['#245447','#e4c87e','#729f8b','#b38b67','#98b5be','#8a947c','#bd9e99','#c4cdbf'];
const money=(n:number,currency:string)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency,maximumFractionDigits:2}).format(n);
export default function IncomeAllocation({entries,currency}:Props){
 const breakdown=incomeAllocation(entries,currency,localDate());
 const total=breakdown.spent||0;
 let position=0;
 const stops=breakdown.categories.map((item,i)=>{
   const start=position;position+=item.spendPercent;
   return tones[i%tones.length]+' '+start.toFixed(2)+'% '+position.toFixed(2)+'%';
 });
 return <section aria-label="Spend and income allocation" className="mb-5 rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-[16px] font-bold">Where your income goes</h2>
     <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Approved entries · salary cycle {breakdown.cycle.start} – {breakdown.cycle.lastDay}</p>
    </div><span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold">Not bank-verified</span>
   </div>
   <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
    <div role="img" aria-label={total>0?'Category shares of recorded outgoing transactions':'No approved outgoings recorded'}
      className="relative grid h-[180px] w-[180px] shrink-0 place-items-center rounded-full"
      style={{background:total>0?'conic-gradient('+stops.join(',')+')':'conic-gradient(#e8e8e4 0% 100%)'}}>
      <div className="grid h-[118px] w-[118px] place-content-center rounded-full bg-card text-center">
       <span className="text-[10px] font-semibold text-muted-foreground">Recorded outflow</span>
       <strong className="mt-1 text-[15px] tabular-nums">{total>0?money(total,currency):'Unknown'}</strong>
      </div>
    </div>
    <dl className="grid w-full min-w-0 flex-1 grid-cols-2 gap-2">
      <div className="rounded-xl bg-muted/40 p-3"><dt className="text-[11px] text-muted-foreground">Recorded income</dt><dd className="mt-1 text-[15px] font-bold tabular-nums">{breakdown.income===null?'Not recorded':money(breakdown.income,currency)}</dd></div>
      <div className="rounded-xl bg-muted/40 p-3"><dt className="text-[11px] text-muted-foreground">After recorded outflows</dt><dd className="mt-1 text-[15px] font-bold tabular-nums">{breakdown.remaining===null?'Unknown':money(breakdown.remaining,currency)}</dd></div>
    </dl>
   </div>
   <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
     Ring segments show each category's share of <strong>recorded outflows</strong>, not your entire salary.
     The percentage alongside each category shows the portion of <strong>recorded income</strong> spent.
     {!breakdown.income?' No approved income was recorded in this cycle, so salary percentages are unavailable.':''}
     {' '}Unrecorded payments or income can change these proportions.
   </p>
   {breakdown.categories.length?<ul className="mt-3 space-y-2">{breakdown.categories.map((item,index)=><li key={item.category} className="rounded-xl border border-border px-3 py-3">
     <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
       <span className="flex min-w-0 items-center gap-2 font-semibold"><span className="h-3 w-3 shrink-0 rounded-full" style={{background:tones[index%tones.length]}}/>{item.category}</span>
       <span className="text-right tabular-nums">{money(item.amount,currency)} · {item.incomePercent===null?'Income % unavailable':item.incomePercent.toFixed(1)+'% of recorded income'}</span>
     </div>
     <div role="progressbar" aria-label={item.category+' share of recorded spending'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,item.spendPercent)}
       className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
       <div className="h-full rounded-full" style={{width:Math.min(100,item.spendPercent)+'%',background:tones[index%tones.length]}}/>
     </div>
    </li>)}</ul>:<p className="mt-3 rounded-xl bg-muted/35 p-3 text-[12px] text-muted-foreground">No approved expense or debt-payment transactions in the selected salary cycle.</p>}
 </section>;
}
