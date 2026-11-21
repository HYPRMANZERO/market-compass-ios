import type {OwnerBudgetView} from '@/lib/ownerBudgetView';

const rand=(n:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',minimumFractionDigits:2,maximumFractionDigits:2
}).format(n);
const range=(a:number,b:number)=>a===b?rand(a):rand(a)+'–'+rand(b);
type Props={view:OwnerBudgetView|null;connected:boolean;available:boolean};

/**
 * A remote, owner-approved read-only reference only.
 * Never persist this object to the PWA's origin-specific encrypted workspace,
 * and never suggest the listed salary remainder is spendable cash.
 */
export default function OwnerBudgetPanel({view,connected,available}:Props){
  return <div className="mt-3 space-y-3 rounded-xl border border-border p-3" aria-label="HYPRBOX shared owner financial baseline">
    <div>
      <h3 className="text-[12px] font-semibold">Shared owner financial baseline · HYPRBOX</h3>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Read-only and owner-reported. Both authorised apps can read this same
        desktop record; their individual encrypted browser vaults are not synchronized.
      </p>
    </div>
    {!available ? <p className="text-[11px] leading-5 text-muted-foreground">
      {connected?'The desktop has not returned the shared financial view yet. It may need the latest bridge update.':'Connect to HYPRBOX to view the shared baseline.'}
    </p> : !view ? <p className="text-[11px] leading-5 text-muted-foreground">
      No private owner budget has been imported on HYPRBOX yet. Missing is not zero income.
    </p> : <>
      <p className="text-[11px] text-muted-foreground">
        Owner-reported as of {view.recordedAt} · {connected?'Refreshed from the private desktop':'Last retrieved; desktop offline'}
        {' '}· Not bank or employer verified
      </p>
      <dl className="grid grid-cols-2 gap-3 text-[12px]">
        <div><dt className="text-muted-foreground">Monthly salary</dt><dd className="font-semibold">{rand(view.salary)}</dd></div>
        <div><dt className="text-muted-foreground">Conditional incentive</dt><dd className="font-semibold">{rand(view.incentive)}</dd></div>
        <div><dt className="text-muted-foreground">Hourly pay rate</dt><dd className="font-semibold">{rand(view.hourlyRate)}/hour</dd></div>
        <div><dt className="text-muted-foreground">Listed monthly costs</dt><dd className="font-semibold">{range(view.recurringExpenseMin,view.recurringExpenseMax)}</dd></div>
      </dl>
      <p className="rounded-lg bg-muted/60 p-2 text-[11px] leading-5">
        Listed salary-only difference: {range(view.salaryOnlyUnallocatedMin,view.salaryOnlyUnallocatedMax)}.
        This is an incomplete planning estimate, <strong>not spendable funds</strong>.
        Incentive is conditional, and hourly earnings may already be included in payroll.
      </p>
      <details className="text-[11px]">
        <summary className="cursor-pointer font-semibold">Recurring cost breakdown ({view.recurring.length})</summary>
        <ul className="mt-2 space-y-1">
          {view.recurring.map((line,i)=><li key={i} className="flex justify-between gap-2">
            <span>{line.label}{line.category==='debt_payment'?' · debt payment':line.category==='fee'?' · fee':''}</span>
            <strong className="text-right">{range(line.min,line.max)}</strong>
          </li>)}
        </ul>
      </details>
      {view.scheduledMonths.length>0 && <details className="text-[11px]">
        <summary className="cursor-pointer font-semibold">Month-specific exceptions ({view.scheduledMonths.length})</summary>
        <div className="mt-2 space-y-2">
          {view.scheduledMonths.map(item=><p key={item.month}>
            <strong>{item.month}</strong>: listed costs {range(item.listedExpenseMin,item.listedExpenseMax)}.
            {' '}Not verified disposable income.
          </p>)}
        </div>
      </details>}
      {view.historicalCycles.length>0 && <details className="text-[11px]">
        <summary className="cursor-pointer font-semibold">Historical incomplete snapshots ({view.historicalCycles.length})</summary>
        <div className="mt-2 space-y-2">
          {view.historicalCycles.map(item=><div key={item.date}>
            <strong>{item.date}</strong>: reported pay {rand(item.reportedIncome)}, listed costs {rand(item.listedExpenseTotal)}.
            {' '}This is not a complete statement reconciliation.
            {item.entries.length>0 && <ul className="mt-1 space-y-1 pl-2">
              {item.entries.map((entry,i)=><li key={i} className="flex justify-between gap-2">
                <span>{entry.label}</span>
                <strong>{rand(entry.min)}</strong>
              </li>)}
            </ul>}
          </div>)}
        </div>
      </details>}
      {view.creditCardFigureStatus==='unknown_balance_or_limit' && view.creditCardFigure!==null && <p className="text-[11px]">
        Reported credit-card figure: {rand(view.creditCardFigure)} · not yet established whether balance or credit limit.
      </p>}
      <p className="text-[11px] leading-5 text-muted-foreground">
        No bank feed, money transfer or trading permissions. Changes must be made through a separate owner-authorised desktop import.
      </p>
    </>}
  </div>;
}
