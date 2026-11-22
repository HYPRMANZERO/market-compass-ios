import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {summarizeDocumentHistory} from '@/lib/documentHistory';

type Props={documents:LocalFinanceDocument[];currency:string};
const zar=(value:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',maximumFractionDigits:2
}).format(value);
const monthLabel=(month:string)=>new Date(month+'-01T00:00:00Z').toLocaleDateString(
  'en-ZA',{month:'long',year:'numeric',timeZone:'UTC'});

export default function DocumentHistorySummary({documents,currency}:Props){
  const history=summarizeDocumentHistory(documents);
  if(!history.documentsReviewed)return null;
  return <details className="mb-5 rounded-xl border border-border bg-background px-3 py-3">
    <summary className="min-h-9 cursor-pointer text-[13px] font-bold">
      Historical earnings &amp; expenses · imported evidence
    </summary>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Derived from {history.documentsReviewed} locally reviewed document summaries.
      Payslip net pay, receipt totals and statement debit rows are shown separately.
      These are historical, unverified amounts — not current balances, verified
      earnings, or transactions posted to Spend. Source currency is not yet verified;
      figures are shown as ZAR for review only. Overlapping source documents may
      repeat amounts, so do not add these columns together.
    </p>
    {history.duplicateSources>0&&<p role="status" className="mt-2 text-[11px] font-semibold text-muted-foreground">
      {history.duplicateSources} identical previously saved source
      {history.duplicateSources===1?' was':'s were'} excluded from the historical totals.
      Older overlapping or truncated statements may still require manual reconciliation.
    </p>}
    {currency!=='ZAR'?<p className="mt-3 text-[11px] font-semibold text-destructive">
      Imported document amounts have not been currency converted. Switch to ZAR
      to view their source-currency estimates safely.
    </p>:history.months.length===0?<p className="mt-3 text-[11px] text-muted-foreground">
      There are no explicitly dated historical income or spend figures yet.
      Review documents with a printed pay date or transaction date.
    </p>:<div className="mt-3 max-h-80 space-y-3 overflow-auto">
      {history.months.slice(0,24).map(month=><div key={month.month}
        className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-[12px] font-bold">{monthLabel(month.month)}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
          <div><span className="block text-muted-foreground">Payslip net pay evidence</span>
            <strong>{zar(month.netPay)}</strong>
            <span className="block text-[10px] text-muted-foreground">{month.payslipSources} selected payslip sources</span>
          </div>
          <div><span className="block text-muted-foreground">Receipt totals evidence</span>
            <strong>{zar(month.receiptSpend)}</strong>
            <span className="block text-[10px] text-muted-foreground">{month.receiptSources} selected receipt sources</span>
          </div>
          <div><span className="block text-muted-foreground">Statement debit evidence</span>
            <strong>{zar(month.statementDebits)}</strong>
            <span className="block text-[10px] text-muted-foreground">{month.debitRows} source-labelled debit rows</span>
          </div>
        </div>
      </div>)}
    </div>}
    {history.undatedEvidence>0&&<p className="mt-3 text-[11px] text-muted-foreground">
      {history.undatedEvidence} undated or ambiguous summary entries were excluded from monthly totals.
    </p>}
    <p className="mt-2 text-[11px] text-muted-foreground">
      To update the actual Spend ledger, open a saved document below and approve its
      dated lines individually. No auto-posting or lender verification occurs.
    </p>
  </details>;
}
