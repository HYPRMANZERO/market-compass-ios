/** Offline, deterministic salary-cycle ledger. No banking access or fund movement. */
export type ExpenseKind = 'income' | 'expense' | 'debt-payment' | 'transfer';
export type ExpenseCategory = 'salary' | 'side-income' | 'car' | 'credit-card' | 'housing' | 'groceries' | 'transport' | 'utilities' | 'insurance' | 'fees' | 'subscriptions' | 'health' | 'savings' | 'other';
export type ExpenseEntry = {
  id: string;
  date: string;
  recordedAt: string;
  kind: ExpenseKind;
  category: ExpenseCategory;
  description: string;
  paidVia: string;
  amount: number;
  currency: string;
  debtAccountId?: string;
  accountLabel?: string;
  remainingBalance?: number | null;
  note?: string;
};
export type ExpenseSettings = {
  cycleBudget: string;
  expectedSalary: string;
  salaryReminderEnabled: boolean;
  lastSalaryReminderCycle: string;
};
export const DEFAULT_EXPENSE_SETTINGS: ExpenseSettings = {
  cycleBudget: '', expectedSalary: '',
  salaryReminderEnabled: false, lastSalaryReminderCycle: '',
};
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  {value:'salary',label:'Salary'},{value:'side-income',label:'Other income'},
  {value:'car',label:'Car installment'},{value:'credit-card',label:'Credit card repayment'},
  {value:'housing',label:'Housing / board'},{value:'groceries',label:'Groceries and food'},
  {value:'transport',label:'Fuel and transport'},{value:'utilities',label:'Utilities'},
  {value:'insurance',label:'Insurance'},{value:'fees',label:'Bank and finance fees'},
  {value:'subscriptions',label:'Subscriptions and gym'},{value:'health',label:'Healthcare'},
  {value:'savings',label:'Savings transfer'},{value:'other',label:'Other expense'},
];
export const EXPENSE_KINDS: {value:ExpenseKind;label:string}[] = [
  {value:'expense',label:'Expense'},{value:'debt-payment',label:'Debt repayment'},
  {value:'income',label:'Income received'},{value:'transfer',label:'Internal transfer (not spending)'},
];
const pad=(n:number)=>String(n).padStart(2,'0');
const iso=(year:number, monthIndex:number, day:number)=>String(year)+'-'+pad(monthIndex+1)+'-'+pad(day);
function dateParts(date:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Enter a valid payment date.');
  const y=Number(date.slice(0,4)),m=Number(date.slice(5,7)),d=Number(date.slice(8,10));
  const constructed=new Date(Date.UTC(y,m-1,d));
  if(y<2000 || y>2100 || constructed.getUTCFullYear()!==y ||
    constructed.getUTCMonth()!==m-1 || constructed.getUTCDate()!==d)throw Error('Enter a valid calendar date.');
  return {y,m,d};
}
/** [start inclusive, end exclusive) so the 26th belongs to exactly one cycle. */
export function salaryCycle(date:string) {
  const {y,m,d}=dateParts(date);
  const first=new Date(Date.UTC(y,m-1-(d<26?1:0),26));
  const next=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,26));
  const last=new Date(next.getTime()-86400000);
  const start=iso(first.getUTCFullYear(),first.getUTCMonth(),26);
  return {start,endExclusive:iso(next.getUTCFullYear(),next.getUTCMonth(),26),
    lastDay:iso(last.getUTCFullYear(),last.getUTCMonth(),last.getUTCDate())};
}
export function shiftSalaryCycle(cycleStart:string, months:number) {
  const {y,m,d}=dateParts(cycleStart);
  if(d!==26 || !Number.isInteger(months) || Math.abs(months)>36)throw Error('Invalid salary cycle.');
  const date=new Date(Date.UTC(y,m-1+months,27));
  return salaryCycle(iso(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
}
export function parseMoneyAmount(text:string, {zeroAllowed=false}:{zeroAllowed?:boolean}={}) {
  const value=String(text).trim();
  if(!/^\d{1,11}(?:\.\d{1,2})?$/.test(value))throw Error('Enter an amount with up to two decimal places.');
  const num=Number(value);
  if(!Number.isFinite(num) || (zeroAllowed?num<0:num<=0) || num>1e10)throw Error('Enter a valid positive amount.');
  return num;
}
export function validateExpenseEntry(value:ExpenseEntry) {
  dateParts(value.date);
  if(!EXPENSE_KINDS.some(x=>x.value===value.kind) || !EXPENSE_CATEGORIES.some(x=>x.value===value.category))
    throw Error('Choose a valid payment type and category.');
  if(typeof value.id!=='string' || value.id.length>120 || typeof value.recordedAt!=='string')throw Error('Invalid payment record.');
  if(!Number.isFinite(value.amount) || value.amount<=0 || value.amount>1e10)throw Error('Invalid payment amount.');
  if(!/^[A-Z]{3}$/.test(value.currency))throw Error('Invalid currency.');
  if(!value.description.trim() || value.description.length>100)throw Error('Describe the payment.');
  if(!value.paidVia.trim() || value.paidVia.length>60)throw Error('Enter the payment app or method.');
  if(value.accountLabel && value.accountLabel.length>80)throw Error('Account nickname is too long.');
  if(value.note && value.note.length>240)throw Error('Note is too long.');
  if(value.remainingBalance!==null && value.remainingBalance!==undefined &&
    (!Number.isFinite(value.remainingBalance)||value.remainingBalance<0||value.remainingBalance>1e11))throw Error('Invalid remaining debt balance.');
  if(value.remainingBalance!==null && value.remainingBalance!==undefined && value.kind!=='debt-payment')
    throw Error('Remaining debt balance belongs on a debt repayment.');
  return value;
}
export function cycleEntries(entries:ExpenseEntry[], cycleStart:string, currency:string) {
  const range=salaryCycle(cycleStart);
  return entries.filter(e=>e.currency===currency && e.date>=range.start && e.date<range.endExclusive);
}
export function cycleAnalysis(entries:ExpenseEntry[], cycleStart:string, currency:string, budgetInput='') {
  const within=cycleEntries(entries,cycleStart,currency);
  const sum=(kind:ExpenseKind)=>within.filter(e=>e.kind===kind).reduce((a,e)=>a+e.amount,0);
  const income=sum('income'),expenses=sum('expense'),debtPayments=sum('debt-payment'),transfers=sum('transfer');
  const outflow=expenses+debtPayments;
  const budget=budgetInput.trim()?parseMoneyAmount(budgetInput):null;
  const percent=budget&&budget>0?outflow/budget*100:null;
  const byCategory=EXPENSE_CATEGORIES.map(c=>({
    category:c.value,label:c.label,
    amount:within.filter(e=>e.category===c.value && (e.kind==='expense'||e.kind==='debt-payment')).reduce((a,e)=>a+e.amount,0),
  })).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  const flags:string[]=[];
  if(budget!==null && outflow>budget)flags.push('Recorded spending and repayments exceed your chosen cycle limit. Pause nonessential purchases and review recurring bills.');
  else if(percent!==null && percent>=80)flags.push('You have used at least 80% of the cycle spending limit. Keep cash available for bills not yet recorded.');
  if(income===0)flags.push('No salary or income is logged for this cycle. Do not assume planned income is available cash.');
  if(within.some(e=>e.kind==='expense' && ['subscriptions','fees'].includes(e.category)))
    flags.push('Review bank fees, subscriptions and gym charges for services you no longer use.');
  if(transfers>0)flags.push('Internal transfers are tracked separately from spending. Reconcile them before classifying any as leakage.');
  if(within.some(e=>e.kind==='expense' && /virtual.card|cash.advance/i.test(e.description+' '+e.note)))
    flags.push('Review virtual-card loads and cash advances: verify their destination and any associated fees.');
  const latestBalances=within.filter(e=>e.kind==='debt-payment' && typeof e.remainingBalance==='number')
    .sort((a,b)=>b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt))
    .filter((e,i,arr)=>arr.findIndex(x=>(x.accountLabel||x.category)===(e.accountLabel||e.category))===i)
    .map(e=>({account:e.accountLabel||e.category,balance:e.remainingBalance!,date:e.date}));
  return {cycle:salaryCycle(cycleStart),count:within.length,income,expenses,debtPayments,transfers,outflow,
    recordedDifference:income-outflow,budget,percent,byCategory,flags,latestBalances};
}
