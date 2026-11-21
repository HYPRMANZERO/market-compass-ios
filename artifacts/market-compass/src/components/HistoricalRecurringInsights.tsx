import {Link} from 'wouter';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {localDate} from '@/lib/dailyBackup';
import {historicalEvidence,recurringPatterns} from '@/lib/historicalRecurring';

type Props={documents:LocalFinanceDocument[];entries:ExpenseEntry[];currency:string};
const cash=(n:number,currency:string)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency,maximumFractionDigits:2
}).format(n);

/** Read-only, on-device history. Never auto-posts document excerpts. */
export default function HistoricalRecurringInsights({documents,entries,currency}:Props){
  const today=localDate();
  const coverage=historicalEvidence(documents,entries,today);
  const patterns=recurringPatterns(entries,currency,today);
  return <section aria-label="Historical transactions and recurring patterns"
    className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold">Historical records & recurring activity</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Based on dated local evidence and owner-approved transactions, not a live bank feed.
        </p>
      </div>
      <Link href="/expenses" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[11px] font-semibold">
        Review source entries
      </Link>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-muted/50 p-3"><dt className="text-[11px] text-muted-foreground">Dated source lines</dt>
        <dd className="mt-1 text-[18px] font-bold">{coverage.datedLines}</dd></div>
      <div className="rounded-xl bg-muted/50 p-3"><dt className="text-[11px] text-muted-foreground">Undated excerpts</dt>
        <dd className="mt-1 text-[18px] font-bold">{coverage.undatedLines}</dd></div>
      <div className="rounded-xl bg-muted/50 p-3"><dt className="text-[11px] text-muted-foreground">Historical ledger entries</dt>
        <dd className="mt-1 text-[18px] font-bold">{coverage.approvedHistoricalEntries}</dd></div>
      <div className="rounded-xl bg-muted/50 p-3"><dt className="text-[11px] text-muted-foreground">Cycles represented</dt>
        <dd className="mt-1 text-[18px] font-bold">{coverage.historicalCycles.length}</dd></div>
    </dl>
    {coverage.unapprovedDatedLines>0&&<p className="mt-3 text-[11px] leading-5 text-muted-foreground">
      {coverage.unapprovedDatedLines} dated excerpt line(s) have not been approved as transactions.
      Only genuine, dated payments or receipts should be posted into their original salary cycle.
      Outstanding balances, interest rates and quoted instalments are reference figures, not proof of a transaction.
    </p>}
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="text-[12px] font-semibold">Possible recurring transactions</h3>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        A match needs approved transactions in at least two separate 26th–25th salary cycles,
        with comparable amounts and descriptions. These are observations, not scheduled payments.
      </p>
      {patterns.length===0?
        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
          No recurring pattern has sufficient transaction evidence yet.
          Historical loan rates or a single instalment quote cannot establish payments made.
        </p>:
        <ul className="mt-3 space-y-2">
          {patterns.map(p=><li key={p.key} className="rounded-lg border border-border p-3 text-[11px]">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{p.description}</span>
              <span className="font-semibold">{cash(p.typicalAmount,currency)} typical</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {p.observedCycles} observed cycles · {p.firstDate} to {p.lastDate} · {p.kind}
              {' · '}{p.confidence==='strong'?'3+ separate cycles':'2 separate cycles'}
            </p>
            {p.minAmount!==p.maxAmount&&<p className="mt-1 text-muted-foreground">
              Recorded range: {cash(p.minAmount,currency)} – {cash(p.maxAmount,currency)}
            </p>}
          </li>)}
        </ul>}
    </div>
    <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
      Saving a source document retains its dated lines as historical evidence.
      It does not automatically update the ledger, Debt Plan, salary totals or future forecasts.
      Review in Spend to approve transactions; do not duplicate manually logged entries.
    </p>
  </section>;
}
