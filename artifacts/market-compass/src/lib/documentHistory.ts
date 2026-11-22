import {validateLocalFinanceDocument,type LocalFinanceDocument} from './localFinanceDocs.ts';
import {makeAccountProfile} from './documentIntelligence.ts';

/** Document-derived historical evidence, NEVER a verified income/spend ledger.
 * Totals are source-labelled and are not merged into posted transactions.
 * Overlapping documents can duplicate evidence; the UI must say so.
 */
export type DocumentMonthEvidence={
  month:string;
  netPay:number;receiptSpend:number;statementDebits:number;
  payslipSources:number;receiptSources:number;debitRows:number;
};
export type DocumentHistory={
  months:DocumentMonthEvidence[];
  undatedEvidence:number;
  documentsReviewed:number;
};

const monthOf=(value:string|null)=>{
  if(!value||!/\d{4}-\d{2}-\d{2}/.test(value))return null;
  const time=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(time)?value.slice(0,7):null;
};
export function summarizeDocumentHistory(source:readonly LocalFinanceDocument[]):DocumentHistory{
  const months=new Map<string,DocumentMonthEvidence>();
  let undatedEvidence=0,documentsReviewed=0;
  function row(month:string){
    let existing=months.get(month);
    if(!existing){
      existing={month,netPay:0,receiptSpend:0,statementDebits:0,
        payslipSources:0,receiptSources:0,debitRows:0};
      months.set(month,existing);
    }
    return existing;
  }
  for(const sourceDocument of source){
    const document=validateLocalFinanceDocument(sourceDocument);
    if(!document)continue;
    documentsReviewed++;
    const profile=document.accountProfile??makeAccountProfile(
      document.lines.map(line=>line.label).join('\n'),document.label,document.lines);
    // A normal payslip/receipt has a single summary net amount or paid total.
    // Multiple conflicting numbers are ambiguous: never sum them blindly.
    if(profile.category==='payslip'||profile.category==='receipt'){
      const field=profile.category==='payslip'?'net-pay':'receipt-total';
      const facts=profile.facts.filter(f=>f.field===field&&f.amount!==null);
      const unique=new Map(facts.map(f=>[String(f.asOf)+'|'+f.amount,f]));
      if(unique.size!==1){undatedEvidence+=unique.size>1?1:0;continue;}
      const fact=[...unique.values()][0];
      const month=monthOf(fact.asOf);
      if(!month){undatedEvidence++;continue;}
      if(profile.category==='payslip'){
        row(month).netPay+=fact.amount!;
        row(month).payslipSources++;
      }else{
        row(month).receiptSpend+=fact.amount!;
        row(month).receiptSources++;
      }
    }
    if(profile.category==='bank-statement'){
      for(const line of document.lines){
        if(line.direction!=='outgoing'||line.amount===null||line.amount<=0||
          ['balance-reference','contract-term','rate-reference'].includes(line.semanticRole??''))continue;
        const month=monthOf(line.date);
        if(!month){undatedEvidence++;continue;}
        row(month).statementDebits+=line.amount;
        row(month).debitRows++;
      }
    }
  }
  return {months:[...months.values()].sort((a,b)=>b.month.localeCompare(a.month)),
    undatedEvidence,documentsReviewed};
}
