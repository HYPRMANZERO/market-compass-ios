/** Payslip numbers are historical evidence, NOT bank deposits. Never add
 * payslip net and bank-statement salary together as separate earnings. */
import {validateLocalFinanceDocument,type LocalFinanceDocument} from './localFinanceDocs.ts';
import type {ExpenseEntry} from './monthlyExpenses.ts';
import type {PayrollField} from './payslipIntelligence.ts';
export type EarningsMonth={
  month:string;payrollDocuments:number;verifiedByBank:false;conflict:boolean;
  gross:number|null;net:number|null;paye:number|null;uif:number|null;deductions:number|null;
  approvedSalaryIncome:number;approvedExpenses:number;approvedDebtPayments:number;
};
const round=(v:number)=>Math.round(v*100)/100;
export function buildHistoricalEarnings(
  documents:ReadonlyArray<LocalFinanceDocument>,ledger:ReadonlyArray<ExpenseEntry>
):{months:EarningsMonth[];undatedPayslips:number;conflicts:number}{
 const payroll=new Map<string,{signatures:Set<string>;rows:Map<PayrollField,number>[] }>();
 let undatedPayslips=0;
 for(const raw of documents){
  const doc=validateLocalFinanceDocument(raw);
  if(!doc||doc.accountProfile?.category!=='payslip')continue;
  const items=doc.lines.filter(x=>x.payrollField!==undefined&&x.amount!==null&&x.amount>=0);
  if(!items.length)continue;
  const date=items.find(x=>x.date)?.date;
  if(!date){undatedPayslips++;continue;}
  const month=date.slice(0,7),values=new Map<PayrollField,number>();
  for(const row of items)if(row.payrollField)values.set(row.payrollField,row.amount as number);
  const signature=[...values.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([key,value])=>key+'='+value.toFixed(2)).join('|');
  const previous=payroll.get(month)??{signatures:new Set<string>(),rows:[]};
  if(!previous.signatures.has(signature)){previous.signatures.add(signature);previous.rows.push(values);}
  payroll.set(month,previous);
 }
 const approved=new Map<string,{salary:number;expenses:number;debt:number}>();
 for(const entry of ledger){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(entry.amount)||entry.amount<0)continue;
  const month=entry.date.slice(0,7);
  const current=approved.get(month)??{salary:0,expenses:0,debt:0};
  if(entry.kind==='income'&&entry.category==='salary')current.salary+=entry.amount;
  if(entry.kind==='expense')current.expenses+=entry.amount;
  if(entry.kind==='debt-payment')current.debt+=entry.amount;
  approved.set(month,current);
 }
 const months=[...new Set([...payroll.keys(),...approved.keys()])].sort().reverse().map(month=>{
  const source=payroll.get(month),conflict=(source?.rows.length??0)>1;
  const values=conflict?null:source?.rows[0];
  const approvedRow=approved.get(month)??{salary:0,expenses:0,debt:0};
  return {month,payrollDocuments:source?.rows.length??0,verifiedByBank:false as const,conflict,
    gross:values?.get('gross-pay')??null,net:values?.get('net-pay')??null,
    paye:values?.get('paye')??null,uif:values?.get('uif')??null,
    deductions:values?.get('total-deductions')??null,
    approvedSalaryIncome:round(approvedRow.salary),approvedExpenses:round(approvedRow.expenses),
    approvedDebtPayments:round(approvedRow.debt)
  };
 });
 return {months,undatedPayslips,conflicts:months.filter(x=>x.conflict).length};
}
