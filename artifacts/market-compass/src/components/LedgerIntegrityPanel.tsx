import {maskDocumentPII} from '@/lib/documentIntelligence';
import {approvedLedgerIntegrity} from '@/lib/ledgerIntegrity';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';

type Props={entries:ExpenseEntry[];currency:string};
/** Visible, read-only confidence cues rather than a claim of bank reconciliation. */
export default function LedgerIntegrityPanel({entries,currency}:Props){
  const report=approvedLedgerIntegrity(entries,currency);
  const format=(n:number)=>new Intl.NumberFormat('en-ZA',
    {style:'currency',currency,maximumFractionDigits:2}).format(n);
  return <section aria-label="Ledger integrity review" className="mb-4 rounded-2xl border border-border bg-card px-3 py-3 sm:p-4">
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-[12px] font-bold">
        <span>Ledger reliability checks</span>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">
          {report.possibleDuplicates.length} possible repeat(s)
        </span>
      </summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        These checks use saved, owner-approved entries only. They are not evidence
        of a live bank connection, and do not change your balances or records.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Saved entries',report.approvedCount],
          ['From documents',report.importedCount],
          ['Unsorted categories',report.unsortedCount],
          ['Possible repeats',report.possibleDuplicates.length]
        ].map(([label,value])=><div key={label} className="rounded-xl bg-muted/45 px-3 py-2.5">
          <span className="block text-[10px] leading-4 text-muted-foreground">{label}</span>
          <strong className="mt-1 block text-[16px] tabular-nums">{value}</strong>
        </div>)}
      </div>
      <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
        Latest recorded transaction date: {report.latestRecordDate??'Not available'}.
        {report.otherCurrencyCount>0?' '+report.otherCurrencyCount+' other-currency record(s) excluded.':''}
        {report.invalidRecordCount>0?' '+report.invalidRecordCount+' incomplete record(s) excluded.':''}
      </p>
      {report.possibleDuplicates.length>0?
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <strong className="block text-[11px]">Compare possible repeat entries</strong>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            Same date, type, amount and description can occur legitimately.
            Compare the original source in Spend before editing anything.
            Nothing is merged, hidden or removed automatically.
          </p>
          <ul className="mt-2 space-y-2">
            {report.possibleDuplicates.slice(0,8).map((group,i)=><li key={i}
              className="rounded-lg bg-muted/35 px-2.5 py-2 text-[11px]">
              <span className="block break-words font-semibold">{maskDocumentPII(group.description)}</span>
              <span className="text-muted-foreground">
                {group.date} ? {group.kind} ? {format(group.amount)} ? {group.count} matching entries
              </span>
            </li>)}
          </ul>
          {report.possibleDuplicates.length>8&&<p className="mt-2 text-[10px] text-muted-foreground">
            Showing 8 of {report.possibleDuplicates.length} possible repeat groups.
          </p>}
        </div>:
        <p className="mt-3 text-[11px] text-muted-foreground">
          No exact-match repeats found in saved entries. This cannot prove that the ledger is complete.
        </p>}
    </details>
  </section>;
}
