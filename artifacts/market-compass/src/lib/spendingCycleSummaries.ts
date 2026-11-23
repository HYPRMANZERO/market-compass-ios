import {salaryCycle,type ExpenseEntry} from './monthlyExpenses.ts';

export type SpendingCycleSummary={
  start:string;
  spending:number;
  expenseCount:number;
  income:number;
  debtRepayments:number;
};
/** Portfolio timeline uses approved Spend entries only, never unapproved excerpts.
 * Source/account filtering belongs to the caller and happens before aggregation. */
export function spendingCycleSummaries(entries:ExpenseEntry[],limit=6):SpendingCycleSummary[]{
  if(!Array.isArray(entries)||!Number.isInteger(limit)||limit<1||limit>36)
    throw Error('Invalid spending-history request.');
  const grouped=new Map<string,SpendingCycleSummary>();
  for(const entry of entries){
    if(entry.currency!=='ZAR'||!Number.isFinite(entry.amount)||entry.amount<=0)continue;
    let start:string;
    try{start=salaryCycle(entry.date).start;}catch{continue;}
    const current=grouped.get(start)??{
      start,spending:0,expenseCount:0,income:0,debtRepayments:0
    };
    if(entry.kind==='expense'||entry.kind==='debt-payment'){
      current.spending+=entry.amount;
      current.expenseCount++;
      if(entry.kind==='debt-payment')current.debtRepayments+=entry.amount;
    }else if(entry.kind==='income')current.income+=entry.amount;
    grouped.set(start,current);
  }
  return [...grouped.values()].sort((a,b)=>b.start.localeCompare(a.start)).slice(0,limit)
    .map(group=>({...group,spending:Math.round(group.spending*100)/100,
      income:Math.round(group.income*100)/100,
      debtRepayments:Math.round(group.debtRepayments*100)/100}));
}
