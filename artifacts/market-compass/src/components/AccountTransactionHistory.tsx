import {maskDocumentPII} from '@/lib/documentIntelligence';
import {accountTransactionHistory} from '@/lib/accountTransactionHistory';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';

type Account={id:string;name:string};
type Props={accounts:Account[];entries:ExpenseEntry[];currency:string;onAssign:(id:string,accountId:string)=>void};
const money=(n:number,currency:string)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(n);
/** Only explicit owner links appear as account history, not inferred bank matches. */
export default function AccountTransactionHistory({accounts,entries,currency,onAssign}:Props){
  const history=accountTransactionHistory(accounts,entries,currency);
  return <section aria-label="Account-level transaction history" className="mb-5 rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
    <h2 className="text-[15px] font-bold">Account transaction history</h2>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Only owner-approved entries that you explicitly link to an account appear here. These are local ledger records, never synchronized bank transactions or live balances.</p>
    {history.groups.length===0&&<p className="mt-3 text-[12px] text-muted-foreground">Add an account in Debt Plan to start linking saved entries.</p>}
    <div className="mt-3 space-y-2">{history.groups.map(group=><details key={group.id} className="rounded-xl border border-border bg-background p-3">
      <summary className="cursor-pointer text-[12px] font-semibold">
        <span className="block break-words">{maskDocumentPII(group.name||'Unnamed account')} · {group.entries.length} linked</span>
        <span className="mt-1 block text-[10px] font-normal text-muted-foreground">Recorded outflows {money(group.outflow,currency)} · Recorded inflows {money(group.inflow,currency)} · Incomplete history possible</span>
      </summary>
      {group.entries.length?<ul className="mt-3 divide-y divide-border">{group.entries.slice(0,25).map(e=><li key={e.id} className="flex items-start justify-between gap-2 py-2 text-[11px]">
        <div className="min-w-0"><span className="block break-words font-medium">{maskDocumentPII(e.description)}</span><span className="text-muted-foreground">{e.date} · {e.kind}</span></div>
        <strong className="shrink-0 tabular-nums">{money(e.amount,currency)}</strong>
      </li>)}</ul>:<p className="mt-2 text-[11px] text-muted-foreground">No approved entries linked to this account yet.</p>}
      {group.entries.length>25&&<p className="text-[10px] text-muted-foreground">Showing 25 latest entries. Open Spend for full activity.</p>}
    </details>)}</div>
    {history.unlinked.length>0&&<details className="mt-3 rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-[12px] font-semibold">{history.unlinked.length} unlinked approved transaction(s) · assign manually</summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Only assign a row when its source account is confirmed. Linking never moves money, updates balances, or changes transaction totals.</p>
      <div className="mt-2 space-y-2">{history.unlinked.slice(0,30).map(e=><label key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-2 text-[11px]">
        <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{maskDocumentPII(e.description)}</span><span className="text-muted-foreground">{e.date} · {money(e.amount,currency)}</span></span>
        <select aria-label={'Assign approved transaction '+maskDocumentPII(e.description)} value="" onChange={event=>{if(event.target.value)onAssign(e.id,event.target.value);}} className="min-h-10 max-w-full rounded-lg border border-input bg-background px-2 text-[12px]">
          <option value="">Choose account</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{maskDocumentPII(a.name||'Unnamed account')}</option>)}
        </select>
      </label>)}</div>
      {history.unlinked.length>30&&<p className="mt-2 text-[10px] text-muted-foreground">Showing 30 latest unlinked entries.</p>}
    </details>}
  </section>;
}
