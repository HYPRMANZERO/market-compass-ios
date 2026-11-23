/**
 * Read-only, on-device financial review. A saved bank statement or payslip is
 * evidence, not a posting. Only explicitly approved Spend entries are summed.
 */
import {
  cycleAnalysis,cycleEntries,shiftSalaryCycle,salaryCycle,validateExpenseEntry,
  type ExpenseEntry,type ExpenseSettings
} from './monthlyExpenses.ts';
import type {LocalFinanceDocument} from './localFinanceDocs.ts';

export type FinancialPulse = {
  period:{start:string;lastDay:string;endExclusive:string};
  totalEntries:number;
  income:number;outflows:number;expenses:number;debtPayments:number;transfers:number;
  hasIncome:boolean;hasOutflows:boolean;
  difference:number|null;
  categories:{category:string;label:string;amount:number;percent:number}[];
  recent:ExpenseEntry[];
  documentCount:number;
  lastDocumentImport:string|null;
  omittedOtherCurrency:number;
  spendingLimit:number|null;
  limitUsedPercent:number|null;
};
function safeEntry(value:ExpenseEntry):boolean{
  try{validateExpenseEntry(value);return true;}catch{return false;}
}
function safeLimit(input:string):string{
  if(typeof input!=='string'||!/^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(input.trim())||Number(input)<=0)return '';
  return input.trim();
}
export function financialPulse(
  entries:readonly ExpenseEntry[],documents:readonly LocalFinanceDocument[],
  start:string,currency:string,settings?:ExpenseSettings
):FinancialPulse{
  const valid=(Array.isArray(entries)?entries:[]).filter(safeEntry);
  const period=salaryCycle(start);
  const dated=valid.filter(e=>e.date>=period.start&&e.date<period.endExclusive);
  const own=cycleEntries(valid,period.start,currency);
  const limit=safeLimit(settings?.cycleBudget??'');
  const stats=cycleAnalysis(valid,period.start,currency,limit);
  const hasIncome=own.some(e=>e.kind==='income');
  const hasOutflows=own.some(e=>e.kind==='expense'||e.kind==='debt-payment');
  const outflows=stats.outflow;
  const documentsSaved=Array.isArray(documents)?documents.filter(d=>
    d && typeof d.importedAt==='string' && Array.isArray(d.lines)):[] as LocalFinanceDocument[];
  const imports=documentsSaved.map(d=>d.importedAt)
    .filter(x=>/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x)))
    .sort((a,b)=>b.localeCompare(a));
  return {
    period,totalEntries:own.length,income:stats.income,outflows,expenses:stats.expenses,
    debtPayments:stats.debtPayments,transfers:stats.transfers,
    hasIncome,hasOutflows,difference:hasIncome&&hasOutflows?stats.recordedDifference:null,
    categories:stats.byCategory.slice(0,4).map(c=>({
      ...c,percent:outflows>0?Math.min(100,c.amount/outflows*100):0
    })),
    recent:[...own].sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt)).slice(0,3),
    documentCount:documentsSaved.length,lastDocumentImport:imports[0]??null,
    omittedOtherCurrency:dated.filter(e=>e.currency!==currency).length,
    spendingLimit:stats.budget,
    limitUsedPercent:stats.percent
  };
}
export {shiftSalaryCycle,salaryCycle};
