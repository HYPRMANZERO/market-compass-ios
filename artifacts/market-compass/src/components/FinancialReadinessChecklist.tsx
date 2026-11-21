import {useState} from 'react';
import {ArrowRight,CheckCircle2, CircleAlert, CircleHelp, ShieldCheck} from 'lucide-react';
import {buildLocalLaunchGuideline} from '@/lib/localLaunchGuideline';
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
  const plan=buildLocalLaunchGuideline(data);
  const [copyState,setCopyState]=useState('');
  async function copyApprovedBrief(){
    if(!window.confirm('Copy this bounded owner-reported Agent brief? It contains entered totals but NO raw documents or password. You control whether it is sent to HYPRBOX Ollama.'))return;
    try{
      await navigator.clipboard.writeText(plan.agentBrief);
      setCopyState('Planning brief copied. Review it before pasting into the private Assistant. Nothing has been sent automatically.');
    }catch{
      setCopyState('Clipboard unavailable on this device. Select and copy the preview below manually.');
    }
  }
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
    <div className="mt-4">
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-[11px] font-semibold">Fields recorded for planning</p>
        <p className="text-[11px] font-medium text-muted-foreground">{result.recordedCount} of {result.items.length} · not independently verified</p>
      </div>
      <div role="progressbar" aria-label="Recorded financial evidence fields, not verified bank data"
        aria-valuemin={0} aria-valuemax={result.items.length} aria-valuenow={result.recordedCount}
        className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]"
          style={{width:Math.round(result.recordedCount/result.items.length*100)+'%'}}/>
      </div>
    </div>
    <details className="mt-4 rounded-xl border border-border bg-background">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 py-3 text-[12px] font-semibold sm:px-4">
        <span>Review all seven evidence checks</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">Expand</span>
      </summary>
      <div role="list" className="divide-y divide-border border-t border-border">
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
    </details>
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
    <details id="mc-launch-plan" className="mt-4 rounded-xl border border-border bg-background p-3">
      <summary className="min-h-10 cursor-pointer text-[13px] font-semibold">
        Your local 30 / 60 / 90-day planning guideline
      </summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Generated here from reviewed workspace entries without internet access,
        model inference or bank verification. This is a starting guideline, not
        advice to execute a payment or trade. Missing records never mean R0.
      </p>
      <p className="mt-2 text-[11px] font-medium">{plan.coverage}</p>
      <div className="mt-3 space-y-3">
        {plan.steps.map(step=><div key={step.period} className="rounded-lg bg-muted/50 p-3">
          <h3 className="text-[12px] font-semibold">{step.period} · {step.title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.detail}</p>
        </div>)}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        To ask your HYPRBOX Ollama Agent to discuss alternatives, first review the
        bounded planning brief below. You control any sharing: this app will not
        automatically send financial details or raw iPhone documents to the desktop.
        Paste the approved brief into the authenticated private Assistant with
        Agent mode on; its tools remain read-only.
      </p>
      <label className="mt-2 block text-[11px] font-semibold">
        Reviewable Agent brief (500 characters maximum) · no raw file text
        <textarea readOnly value={plan.agentBrief} rows={7}
          aria-label="Private financial planning brief for optional Ollama review"
          className="mt-2 w-full resize-y rounded-xl border border-input bg-muted/40 p-3 font-mono text-[11px] leading-5"/>
      </label>
      <button type="button" onClick={()=>{void copyApprovedBrief();}}
        className="mt-3 min-h-11 w-full rounded-xl border border-border px-3 text-[12px] font-semibold">
        Copy approved Agent brief for optional private Ollama review
      </button>
      {copyState&&<p role="status" className="mt-2 text-[11px] leading-5">{copyState}</p>}
    </details>
  </section>;
}
