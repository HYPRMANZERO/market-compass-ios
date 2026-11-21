import {ArrowRight,CheckCircle2, CircleAlert, CircleHelp, ShieldCheck} from 'lucide-react';
import {Link} from 'wouter';
import {evaluateFinancialReadiness,type FinancialReadinessInputs,type ReadinessStatus}
  from '@/lib/financialReadiness';

type Props={data:FinancialReadinessInputs};
const statusLabel:Record<ReadinessStatus,string>={
  missing:'Not entered',
  review:'Review needed',
  recorded:'Saved locally · unverified',
};

/** Coverage-only: no financial amounts, documents, passwords or API calls. */
export default function FinancialReadinessChecklist({data}:Props){
  const result=evaluateFinancialReadiness(data);
  return <section
    className="mb-5 scroll-mt-28 rounded-2xl border border-border bg-card p-4 shadow-sm"
    aria-label="What is missing for financial planning">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold">What's missing for a financial plan?</h2>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
          Launch-day checklist from your unlocked iPhone workspace only.
          No document contents or financial figures are sent anywhere by this check.
        </p>
      </div>
      <span className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold">
        {result.missingCount} missing · {result.reviewCount} need review
      </span>
    </div>
    <div role="list" className="mt-4 divide-y divide-border rounded-xl border border-border">
      {result.items.map(item=><div role="listitem" key={item.id}
        className="flex items-start gap-3 px-3 py-3 sm:px-4">
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {item.status==='recorded'?<CheckCircle2 size={17} aria-hidden="true"/>:
            item.status==='review'?<CircleAlert size={17} aria-hidden="true"/>:
              <CircleHelp size={17} aria-hidden="true"/>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[12px] font-semibold">{item.title}</h3>
            <span className="text-[10px] font-medium text-muted-foreground">
              {statusLabel[item.status]}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {item.detail}
          </p>
          {item.status!=='recorded'&&
            <p className="mt-1 text-[11px] leading-5">Next: {item.nextStep}</p>}
        </div>
        <Link href={item.route}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 text-[11px] font-semibold text-primary"
          aria-label={`Review ${item.title} in ${item.route==='/debt'?'Debt Plan':'Spend'}`}>
          {item.route==='/debt'?'Debt':'Spend'} <ArrowRight size={13} aria-hidden="true"/>
        </Link>
      </div>)}
    </div>
    <div className="mt-3 rounded-xl bg-muted/45 p-3">
      <div className="flex gap-2">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true"/>
        <p className="text-[11px] leading-5 text-muted-foreground">
          {result.requiredInputsRecorded
            ? 'Core debt-planning fields are entered. You can review a provisional payoff scenario after explicitly confirming current figures in Debt Plan. This is not bank verification.'
            : 'A reliable payoff estimate still needs the required debt-planning fields. Do not calculate missing income, costs, debt or cash as zero.'}
          {' '}{result.warning}
        </p>
      </div>
    </div>
  </section>;
}
