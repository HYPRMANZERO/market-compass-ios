/** Explicit, owner-selected detail tags. Legacy ledger categories never change automatically. */
import {salaryCycle,type ExpenseCategory,type ExpenseEntry,type ExpenseKind} from './monthlyExpenses.ts';

export type DetailOption={id:string;label:string;category:ExpenseCategory;kind:ExpenseKind};
export type DetailGroup={id:string;title:string;items:readonly DetailOption[]};
const option=(id:string,label:string,category:ExpenseCategory,kind:ExpenseKind='expense'):DetailOption=>({id,label,category,kind});
export const BUDGET_DETAIL_GROUPS:readonly DetailGroup[]=[
  {id:'bank-fees',title:'Bank Fees',items:[
    option('account-fees','Account Fees / Monthly Fee','fees'),
    option('atm-fees','ATM Fees / ATM Withdrawal Charges','fees'),
    option('bank-charges','Bank Charges','fees'),
    option('card-replacement','Card Replacement Fee','fees'),
    option('eft-fees','EFT / Interbank Fees','fees')]},
  {id:'utilities',title:'Utilities',items:[
    option('electricity','Electricity','utilities'),
    option('security-alarm','Security / Alarm','utilities'),
    option('utility-subscription','Subscriptions','subscriptions'),
    option('water','Water','utilities')]},
  {id:'debt',title:'Debt',items:[
    option('buy-now-pay-later','Buy Now Pay Later','personal-loan','debt-payment'),
    option('credit-card-repayment','Credit Card Repayment','credit-card','debt-payment'),
    option('home-loan','Home Loan / Bond','housing','debt-payment'),
    option('interest-paid','Interest Paid','fees'),
    option('late-payment-fees','Late Payment Fees','fees'),
    option('overdraft','Overdraft','personal-loan','debt-payment'),
    option('personal-loan','Personal Loan','personal-loan','debt-payment'),
    option('store-credit','Store Account / Retail Credit','personal-loan','debt-payment'),
    option('student-loan','Student Loan','education','debt-payment'),
    option('vehicle-loan','Vehicle Loan / Car Loan','car','debt-payment')]},
  {id:'communications',title:'Communications',items:[
    option('airtime-data','Airtime & Data','utilities'),
    option('cellphone','Cellphone','utilities'),
    option('internet-fibre','Internet & Fibre','utilities'),
    option('mobile-contract','Mobile Phone Contract','utilities'),
    option('other-phone-internet','Other Phone & Internet','utilities')]}
];
export const budgetDetailOptions=(kind:ExpenseKind,category:ExpenseCategory)=>
  BUDGET_DETAIL_GROUPS.flatMap(group=>group.items).filter(x=>x.kind===kind&&x.category===category);
export const budgetDetailValid=(detail:string,kind:ExpenseKind,category:ExpenseCategory)=>
  budgetDetailOptions(kind,category).some(x=>x.id===detail);
export type BudgetDetailRow={id:string;label:string;spent:number;budget:number|null;historicalAverage:number|null};
export type BudgetDetailSummary={id:string;title:string;rows:BudgetDetailRow[];spent:number;budget:number|null;unassigned:number};
const sumCents=(rows:ExpenseEntry[])=>rows.reduce((total,e)=>total+Math.round(e.amount*100),0)/100;
const safeCycleStart=(date:string)=>{try{return salaryCycle(date).start;}catch{return null;}};
export function budgetDetailSummary(
  entries:ExpenseEntry[],cycleDate:string,currency:string,budgets:Record<string,string>={},today=cycleDate
):BudgetDetailSummary[]{
  const chosen=salaryCycle(cycleDate),current=salaryCycle(today);
  const relevant=entries.filter(e=>e.currency===currency&&safeCycleStart(e.date)===chosen.start&&
    Number.isFinite(e.amount)&&e.amount>0&&(e.kind==='expense'||e.kind==='debt-payment'));
  const outflow=entries.filter(e=>e.currency===currency&&safeCycleStart(e.date)!==null&&Number.isFinite(e.amount)&&e.amount>0&&
    (e.kind==='expense'||e.kind==='debt-payment'));
  // Average only when the same detailed tag was observed in two finished salary cycles.
  // This is a partial *recorded* historical average, never a monthly bank average.
  const priorStarts=[-1,-2].map(months=>{
    const base=new Date(current.start+'T00:00:00Z');
    return salaryCycle(new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+months,27)).toISOString().slice(0,10)).start;
  });
  return BUDGET_DETAIL_GROUPS.map(group=>{
    const rows=group.items.map(item=>{
      const spent=sumCents(relevant.filter(e=>e.subcategory===item.id&&e.category===item.category&&e.kind===item.kind));
      const budgetText=budgets[item.id];
      const budget=typeof budgetText==='string'&&/^\d{1,11}(?:\.\d{1,2})?$/.test(budgetText)&&Number.isFinite(Number(budgetText))?Number(budgetText):null;
      const completed=priorStarts.map(start=>sumCents(outflow.filter(e=>{
        return e.subcategory===item.id&&e.category===item.category&&e.kind===item.kind&&safeCycleStart(e.date)===start;
      })));
      const historicalAverage=completed.every(value=>value>0)?Math.round((completed[0]+completed[1])*50)/100:null;
      return {id:item.id,label:item.label,spent,budget,historicalAverage};
    });
    const setBudgets=rows.filter(r=>r.budget!==null);
    const budget=setBudgets.length===rows.length?
      Math.round(setBudgets.reduce((n,r)=>n+Math.round(r.budget!*100),0))/100:null;
    // Older records have no detail tag. Include their category total exactly
    // once, never guess a subcategory from a provider name or payment rail.
    const unassigned=sumCents(relevant.filter(e=>{
      if(e.subcategory)return false;
      if(group.id==='bank-fees')return e.kind==='expense'&&e.category==='fees';
      if(group.id==='utilities')return e.kind==='expense'&&e.category==='utilities';
      if(group.id==='debt')return e.kind==='debt-payment';
      return false;
    }));
    const spent=Math.round((rows.reduce((n,r)=>n+Math.round(r.spent*100),0)
      +Math.round(unassigned*100)))/100;
    return {id:group.id,title:group.title,rows,spent,budget,unassigned};
  });
}
