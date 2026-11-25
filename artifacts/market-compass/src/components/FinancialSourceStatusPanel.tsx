import {CalendarClock,FileText,Landmark,ShieldCheck} from 'lucide-react';
import {financialSourceStatus} from '@/lib/financialSourceStatus';
import {localDate} from '@/lib/dailyBackup';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';

type Props={entries:ExpenseEntry[];documents:LocalFinanceDocument[]};
/** Compact source confidence on Home and Spend. Local evidence, never bank sync. */
export default function FinancialSourceStatusPanel({entries,documents}:Props){
  const report=financialSourceStatus(entries,documents,localDate());
  const unknown='Not available';
  return <section aria-label="Financial source freshness" className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[13px] font-bold">
        <ShieldCheck size={17} aria-hidden="true"/> Source freshness
      </h2>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
        Encrypted local records · No live sync
      </span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Dates of local source evidence">
      <div className="min-w-0 rounded-xl bg-muted/40 p-2.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarClock size={13}/> Latest approved entry</span>
        <strong className="mt-1 block break-words text-[12px] tabular-nums">{report.latestApprovedDay??unknown}</strong>
        <small className="mt-1 block text-[10px] text-muted-foreground">Transaction date, not bank sync</small>
      </div>
      <div className="min-w-0 rounded-xl bg-muted/40 p-2.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><FileText size={13}/> Document reports through</span>
        <strong className="mt-1 block break-words text-[12px] tabular-nums">{report.latestReportedDay??unknown}</strong>
        <small className="mt-1 block text-[10px] text-muted-foreground">Source period or as-of date</small>
      </div>
      <div className="min-w-0 rounded-xl bg-muted/40 p-2.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><FileText size={13}/> Last file imported</span>
        <strong className="mt-1 block break-words text-[12px] tabular-nums">{report.latestImportedDay??unknown}</strong>
        <small className="mt-1 block text-[10px] text-muted-foreground">Import time, not report time</small>
      </div>
      <div className="min-w-0 rounded-xl bg-muted/40 p-2.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Landmark size={13}/> Official bank feed</span>
        <strong className="mt-1 block text-[12px]">Not connected</strong>
        <small className="mt-1 block text-[10px] text-muted-foreground">No current balance verified</small>
      </div>
    </div>
    {report.daysSinceReport!==null&&report.daysSinceReport>30&&<p className="mt-2 text-[11px] leading-5 text-muted-foreground" role="status">
      Your latest document reporting date is {report.daysSinceReport} days ago. Import a newer statement if available. Past source data may not reflect recent payments.
    </p>}
    {(report.futureApprovedCount>0||report.futureDocumentCount>0)&&<p className="mt-2 text-[11px] leading-5 text-muted-foreground" role="status">
      {report.futureApprovedCount} future-dated approved entry/entries and {report.futureDocumentCount} future-dated source document(s) need a date check. They are excluded from the latest-known dates above.
    </p>}
    <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
      {report.approvedCount} approved transaction(s) and {report.documentCount} saved document(s) on this device. Dates show available historical evidence, not a complete account reconciliation or spendable balance. Nothing is changed by this check.
    </p>
  </section>;
}
