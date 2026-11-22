/**
 * Source-labelled historical pay evidence. Payslips never post expenses or
 * credits. A matched bank-credit amount is a hint, not verified reconciliation.
 */
import {validateLocalFinanceDocument,type LocalFinanceDocument} from './localFinanceDocs.ts';
import type {ExpenseEntry} from './monthlyExpenses.ts';
type Field='net-pay'|'gross-pay'|'paye'|'uif'|'total-deductions';
export type PayrollPeriodEvidence={
  documentId:string;period:string|null;netPay:number|null;grossPay:number|null;
  paye:number|null;uif:number|null;deductions:number|null;
  possibleBankMatch:boolean;possibleDuplicate:boolean;source:'reviewed-payslip';
};
const fieldValue=(doc:LocalFinanceDocument,field:Field):number|null=>{
  const facts=doc.accountProfile?.facts.filter(x=>x.field===field&&x.amount!==null)??[];
  return facts.length===1?facts[0].amount:null;
};
export function buildPayrollHistory(
 documents:readonly LocalFinanceDocument[],entries:readonly ExpenseEntry[]
):PayrollPeriodEvidence[]{
 const out:PayrollPeriodEvidence[]=[];
 const seen=new Set<string>();
 for(const document of documents){
  const doc=validateLocalFinanceDocument(document);
  if(!doc||doc.accountProfile?.category!=='payslip')continue;
  const netPay=fieldValue(doc,'net-pay'),grossPay=fieldValue(doc,'gross-pay');
  if(netPay===null&&grossPay===null)continue;
  const dates=(doc.accountProfile?.facts??[]).map(f=>f.asOf)
    .filter((v):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v));
  const date=dates[0]??null,period=date?.slice(0,7)??null;
  const fingerprint=JSON.stringify([period,netPay,grossPay,fieldValue(doc,'paye')]);
  const possibleDuplicate=seen.has(fingerprint);
  seen.add(fingerprint);
  const match=netPay!==null&&date!==null&&entries.some(entry=>{
    if(entry.kind!=='income'||entry.currency!=='ZAR'||entry.category!=='salary'||
      Math.abs(entry.amount-netPay)>0.01)return false;
    const days=(Date.parse(entry.date+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000;
    return Number.isFinite(days)&&Math.abs(days)<=14;
  });
  out.push({documentId:doc.id,period,netPay,grossPay,paye:fieldValue(doc,'paye'),
    uif:fieldValue(doc,'uif'),deductions:fieldValue(doc,'total-deductions'),
    possibleBankMatch:match,possibleDuplicate,source:'reviewed-payslip'});
 }
 return out.sort((a,b)=>(b.period??'').localeCompare(a.period??''));
}
