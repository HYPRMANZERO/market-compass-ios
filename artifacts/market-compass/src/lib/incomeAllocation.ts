/** Read-only expense allocation from owner-approved, same-currency salary-cycle entries. */
import {salaryCycle,type ExpenseEntry} from './monthlyExpenses.ts';
export type Allocation={category:string;amount:number;incomePercent:number|null;spendPercent:number};
const labels:Record<string,string>={housing:'Housing',groceries:'Groceries',transport:'Transport',utilities:'Utilities',insurance:'Insurance',fees:'Bank fees',subscriptions:'Subscriptions',health:'Healthcare',car:'Vehicle', 'credit-card':'Credit card',other:'Other',savings:'Savings'};
export function incomeAllocation(entries:ExpenseEntry[],currency:string,asOf:string){
 const cycle=salaryCycle(asOf);
 const eligible=(Array.isArray(entries)?entries:[]).filter(e=>e&&e.currency===currency&&
   e.date>=cycle.start&&e.date<cycle.endExclusive&&Number.isFinite(e.amount)&&e.amount>0);
 const income=eligible.filter(e=>e.kind==='income').reduce((sum,e)=>sum+e.amount,0);
 const outgoing=eligible.filter(e=>e.kind==='expense'||e.kind==='debt-payment');
 const spent=outgoing.reduce((sum,e)=>sum+e.amount,0);
 const byCategory=new Map<string,number>();
 for(const e of outgoing)byCategory.set(e.category,(byCategory.get(e.category)||0)+e.amount);
 const categories=[...byCategory].map(([category,amount])=>({
   category:labels[category]||category,amount,
   incomePercent:income>0?amount/income*100:null,
   spendPercent:spent>0?amount/spent*100:0
 })).sort((a,b)=>b.amount-a.amount);
 return {cycle,income:income>0?income:null,spent:outgoing.length?spent:null,
   incomeRecords:eligible.filter(e=>e.kind==='income').length,
   categories,remaining:income>0?income-spent:null};
}
