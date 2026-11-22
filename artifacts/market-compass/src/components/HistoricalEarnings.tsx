import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {buildHistoricalEarnings} from '@/lib/historicalEarnings';
const money=(n:number|null)=>n===null?'Not established':
 new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(n);
export default function HistoricalEarnings({documents,entries}:{
 documents:LocalFinanceDocument[];entries:ExpenseEntry[];
}){
 const history=buildHistoricalEarnings(documents,entries);
 if(history.months.length===0&&history.undatedPayslips===0)return null;
 return <details className="mt-5 rounded-2xl border border-border bg-background p-3 sm:p-4">
  <summary className="min-h-11 cursor-pointer text-[13px] font-bold">Historical earnings and reviewed spending</summary>
  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
    Payslip figures are historical payroll evidence, not proof the salary reached your bank.
    Approved salary deposits in Spend appear in a separate column and are never added to
    payslip net pay. Entries remain unverified against live bank feeds.
  </p>
  {history.undatedPayslips>0&&<p role="alert" className="mt-2 text-[11px] font-semibold">
    {history.undatedPayslips} payslip(s) have no confirmed period and are excluded from the dated history.
  </p>}
  {history.conflicts>0&&<p role="alert" className="mt-2 text-[11px] font-semibold">
    {history.conflicts} month(s) contain differing payroll figures. Those payroll totals are withheld until reviewed.
  </p>}
  <div className="mt-3 overflow-x-auto">
   <table className="min-w-[630px] w-full border-collapse text-left text-[11px]">
    <thead><tr className="border-b border-border text-muted-foreground">
     <th className="p-2">Month</th><th className="p-2">Payslip gross</th>
     <th className="p-2">Payslip net</th><th className="p-2">PAYE / UIF</th>
     <th className="p-2">Approved salary income</th>
     <th className="p-2">Approved expenses / debt</th></tr></thead>
    <tbody>{history.months.slice(0,48).map(item=><tr key={item.month} className="border-b border-border/60">
     <td className="p-2 font-semibold">{item.month}{item.conflict&&<span className="block text-[10px]">Needs payroll review</span>}</td>
     <td className="p-2 tabular-nums">{money(item.gross)}</td>
     <td className="p-2 tabular-nums">{money(item.net)}</td>
     <td className="p-2 tabular-nums">{money(item.paye)} / {money(item.uif)}</td>
     <td className="p-2 tabular-nums">{money(item.approvedSalaryIncome)}</td>
     <td className="p-2 tabular-nums">{money(item.approvedExpenses)} / {money(item.approvedDebtPayments)}</td>
    </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-[11px] text-muted-foreground">Monthly grouping is illustrative; it does not perform a bank reconciliation or infer unrecorded expenses.</p>
 </details>;
}