import {Link} from 'wouter';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import type {ExpenseEntry,ExpenseSettings} from '@/lib/monthlyExpenses';
import {DEFAULT_EXPENSE_SETTINGS,cycleAnalysis,salaryCycle} from '@/lib/monthlyExpenses';
import type {PrivateBudget} from '@/components/DebtAdvisor';
import {localDate} from '@/lib/dailyBackup';

type Props={
  documents:LocalFinanceDocument[];
  entries:ExpenseEntry[];
  settings:ExpenseSettings;
  accounts:{name:string;balance:string;apr:string;minimumPayment:string}[];
  budget:PrivateBudget;
  currency:string;
};

const hasAmount=(value:unknown):value is string=>
  typeof value==='string'&&value.trim()!==''&&
  /^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(value.trim())&&
  Number.isFinite(Number(value));
const money=(value:number,currency:string)=>{
  try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency,maximumFractionDigits:2}).format(value);}
  catch{return currency+' '+value.toFixed(2);}
};

/**
 * A read-only view of the same encrypted iPhone workspace.
 * Saved file excerpts are evidence, NOT ledger transactions or current balances.
 * No network calls, financial writes, bank verification or desktop sync.
 */
export default function HomeFinancialEvidence({documents,entries,settings,accounts,budget,currency}:Props){
  const safeDocs=Array.isArray(documents)?documents.filter(d=>d&&Array.isArray(d.lines)):[];
  const safeEntries=Array.isArray(entries)?entries:[];
  const cycle=salaryCycle(localDate());
  const stats=cycleAnalysis(safeEntries,cycle.start,currency,
    (settings??DEFAULT_EXPENSE_SETTINGS).cycleBudget);
  const budgetFields=[
    {title:'Monthly income',value:budget?.monthlyIncome},
    {title:'Essential monthly costs',value:budget?.monthlyEssentials},
    {title:'Liquid funds',value:budget?.liquidFunds},
    {title:'Emergency reserve target',value:budget?.reserveTarget}
  ].filter(f=>hasAmount(f.value));
  const reviewedLines=safeDocs.reduce((n,d)=>n+d.lines.length,0);
  const incompleteAccounts=accounts.filter(a=>!hasAmount(a.balance)).length;

  return <section aria-label="Saved financial evidence dashboard"
    className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold">Your saved financial picture</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Updated from this iPhone's unlocked encrypted workspace. Nothing here is a live bank balance.
        </p>
      </div>
      <Link href="/expenses" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[11px] font-semibold">
        Review in Spend
      </Link>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-muted/60 p-3">
        <p className="text-[11px] text-muted-foreground">Saved documents</p>
        <p className="mt-1 text-[20px] font-bold">{safeDocs.length}</p>
        <p className="text-[10px] text-muted-foreground">{reviewedLines} excerpt lines</p>
      </div>
      <div className="rounded-xl bg-muted/60 p-3">
        <p className="text-[11px] text-muted-foreground">Approved transactions</p>
        <p className="mt-1 text-[20px] font-bold">{safeEntries.length}</p>
        <p className="text-[10px] text-muted-foreground">All recorded cycles</p>
      </div>
      <div className="rounded-xl bg-muted/60 p-3">
        <p className="text-[11px] text-muted-foreground">Current-cycle income</p>
        <p className="mt-1 text-[17px] font-bold">{stats.count?money(stats.income,currency):'Not recorded'}</p>
        <p className="text-[10px] text-muted-foreground">Recorded only · not bank-verified</p>
      </div>
      <div className="rounded-xl bg-muted/60 p-3">
        <p className="text-[11px] text-muted-foreground">Current-cycle outflows</p>
        <p className="mt-1 text-[17px] font-bold">{stats.count?money(stats.expenses+stats.debtPayments,currency):'Not recorded'}</p>
        <p className="text-[10px] text-muted-foreground">Expenses + repayments · no transfers</p>
      </div>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
      Salary cycle: {cycle.start} to {cycle.lastDay}. Missing entries are not assumed to be zero.
      Documents only affect the transaction totals after you approve individual rows in Spend.
    </p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-border p-3">
        <h3 className="text-[12px] font-semibold">Saved document evidence</h3>
        {safeDocs.length===0?<p className="mt-2 text-[11px] text-muted-foreground">No documents saved on this device.</p>:
          <div className="mt-2 space-y-2">
            {safeDocs.slice(0,3).map(d=><details key={d.id} className="rounded-lg bg-muted/40 p-2">
              <summary className="cursor-pointer text-[11px] font-semibold">
                {d.label} · {d.lines.length} lines
              </summary>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Imported {d.importedAt.slice(0,10)} · partial, owner-reviewed evidence
              </p>
              <ul className="mt-2 space-y-1">
                {d.lines.slice(0,5).map((line,index)=><li key={index}
                  className="flex flex-wrap justify-between gap-2 text-[11px]">
                  <span className="min-w-0 break-words">{line.date??'Undated'} · {line.label}</span>
                  <span className="font-semibold">{line.amount===null?'Unspecified':money(line.amount,currency)}</span>
                </li>)}
              </ul>
              {d.lines.length>5&&<p className="mt-2 text-[10px] text-muted-foreground">
                Showing 5 of {d.lines.length} excerpts; review the rest in Spend.
              </p>}
            </details>)}
            {safeDocs.length>3&&<p className="text-[10px] text-muted-foreground">
              {safeDocs.length-3} more document(s) in Spend.
            </p>}
          </div>}
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          A settlement quote, financed principal or instalment is NOT a verified current debt balance.
        </p>
      </div>
      <div className="rounded-xl border border-border p-3">
        <h3 className="text-[12px] font-semibold">Planning figures entered separately</h3>
        {budgetFields.length===0&&accounts.length===0?
          <p className="mt-2 text-[11px] text-muted-foreground">
            Current income, essentials, available cash and debt accounts are not yet entered in Debt Plan.
          </p>:<>
          <dl className="mt-2 space-y-2 text-[11px]">
            {budgetFields.map(f=><div key={f.title} className="flex flex-wrap justify-between gap-2">
              <dt>{f.title}</dt><dd className="font-semibold">{money(Number(f.value),currency)}</dd>
            </div>)}
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Debt accounts saved</dt><dd className="font-semibold">{accounts.length}</dd>
            </div>
          </dl>
          {incompleteAccounts>0&&<p className="mt-2 text-[10px] text-muted-foreground">
            {incompleteAccounts} account(s) have missing balances.
          </p>}
        </>}
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          Entered amounts are owner-reported and must be checked against current records.
        </p>
        <Link href="/debt" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[11px] font-semibold">
          Review current figures in Debt Plan
        </Link>
      </div>
    </div>
  </section>;
}
