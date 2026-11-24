/** Offline, deterministic salary-cycle ledger. No banking access or fund movement. */
import {matchRegionalCategory,regionalSalaryNarration} from './regionalSpendRules.ts';
export type ExpenseKind = 'income' | 'expense' | 'debt-payment' | 'transfer';
export type ExpenseCategory = 'salary' | 'side-income' | 'car' | 'credit-card' | 'personal-loan' | 'housing' | 'groceries' | 'transport' | 'utilities' | 'insurance' | 'fees' | 'subscriptions' | 'health' | 'dining' | 'pets' | 'personal-care' | 'taxes' | 'education' | 'childcare' | 'travel' | 'shopping' | 'entertainment' | 'donations' | 'business' | 'cash' | 'investments' | 'card-load' | 'savings' | 'other' | 'unsorted';
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
  {value:'car',label:'Car installment'},{value:'credit-card',label:'Credit card repayment'},{value:'personal-loan',label:'Personal loan repayment'},
  {value:'housing',label:'Housing / board'},{value:'groceries',label:'Groceries and food'},
  {value:'transport',label:'Fuel and transport'},{value:'utilities',label:'Utilities'},
  {value:'insurance',label:'Insurance'},{value:'fees',label:'Bank and finance fees'},
  {value:'subscriptions',label:'Subscriptions and gym'},{value:'health',label:'Healthcare'},
  {value:'dining',label:'Restaurants and coffee'},{value:'pets',label:'Pets and vet'},
  {value:'personal-care',label:'Personal care'},
  {value:'taxes',label:'Taxes and duties'},{value:'education',label:'Education'},
  {value:'childcare',label:'Childcare'},{value:'travel',label:'Travel and holidays'},
  {value:'shopping',label:'Shopping and retail'},{value:'entertainment',label:'Entertainment'},
  {value:'donations',label:'Charity and donations'},{value:'business',label:'Business expenses'},
  {value:'cash',label:'Cash withdrawal'},{value:'investments',label:'Investment transfers'},
  {value:'card-load',label:'Prepaid / virtual card loads'},
  {value:'savings',label:'Savings transfer'},{value:'other',label:'Other expense'},
  {value:'unsorted',label:'Unsorted · needs category'},
];
export const EXPENSE_KINDS: {value:ExpenseKind;label:string}[] = [
  {value:'expense',label:'Expense'},{value:'debt-payment',label:'Debt repayment'},
  {value:'income',label:'Income received'},{value:'transfer',label:'Internal transfer (not spending)'},
];
/**
 * Conservative local suggestion based on explicit transaction descriptions.
 * An unknown merchant is UNSORTED, not silently called groceries or income.
 * These suggestions never write to the ledger until the owner approves.
 */
export function suggestKnownSpendCategory(kind:ExpenseKind,description:string,region='ZA'):ExpenseCategory{
  const text=description.toLowerCase().replace(/\s+/g,' ');
  if(kind==='income'){
    if(regionalSalaryNarration(description,region))return 'salary';
    if(/\b(?:freelance|side income|consulting income|interest earned|commission earned)\b/.test(text))return 'side-income';
    return 'unsorted';
  }
  if(kind==='transfer'){
    if(/\b(?:transfer to (?:investment|brokerage|trading) account|investment savings transfer)\b/.test(text))return 'investments';
    if(/\b(?:atm cash withdrawal|atm withdrawal|cash withdrawn from atm)\b/.test(text))return 'cash';
    return /\b(?:savings|save to|saving pocket|savings pocket)\b/.test(text)?'savings':'unsorted';
  }
  if(kind==='debt-payment'){
    if(/\b(?:vehicle finance|car (?:loan|instalment|installment|repayment)|auto loan)\b/.test(text))return 'car';
    if(/\b(?:credit card (?:repayment|payment)|card repayment)\b/.test(text))return 'credit-card';
    if(/\b(?:mortgage (?:repayment|payment)|home loan (?:repayment|payment))\b/.test(text))return 'housing';
    if(/\b(?:student loan repayment|education loan repayment)\b/.test(text))return 'education';
    if(/\b(?:personal loan (?:repayment|payment|instalment|installment))\b/.test(text))return 'personal-loan';
    return 'unsorted';
  }
  const regional=matchRegionalCategory(description,region);
  if(regional)return regional.category;
  if(/\b(?:bank (?:charge|fee)|service (?:charge|fee)|account (?:fee|charge)|transaction fee|payshap fee|monthly fee|commission fee|fees?)\b/.test(text))return 'fees';
  if(/\b(?:netflix|spotify|showmax|disney\+?|youtube premium|subscription|membership|gym|icloud|apple music)\b/.test(text))return 'subscriptions';
  if(/\b(?:rent|rental|housing|board payment|body corporate|levy)\b/.test(text))return 'housing';
  if(/\b(?:grocery|groceries|supermarket)\b/.test(text))return 'groceries';
  if(region==='ZA'&&/\b(?:checkers|pick n pay|pnp|spar|food lovers|foodlovers|shoprite)\b/.test(text))return 'groceries';
  if(/\b(?:fuel|petrol|diesel|transport|uber|bolt ride|taxi|bus ticket|shell fuel|bp fuel)\b/.test(text))return 'transport';
  if(region==='ZA'&&/\b(?:engen|caltex)\b/.test(text))return 'transport';
  if(/\b(?:electricity|municipal|water bill|airtime|mobile data|fibre|wifi|internet bill|utilities)\b/.test(text))return 'utilities';
  if(/\b(?:insurance|insurer|insurance premium|policy debit)\b/.test(text))return 'insurance';
  if(/\b(?:pharmacy|doctor|hospital|clinic|medical aid|healthcare|dentist)\b/.test(text))return 'health';
  if(/\b(?:dog food|cat food|pet food|pet store|veterinary|veterinarian|nexgard|bravecto|vet bill)\b/.test(text))return 'pets';
  if(/\b(?:restaurant|takeaway|fast food|kfc|nandos|mcdonalds|steers|coffee shop|cafe|coffee|dessert)\b/.test(text))return 'dining';
  if(/\b(?:haircut|hair cut|barber|hair salon|manicure|pedicure|grooming|toiletries)\b/.test(text))return 'personal-care';
  if(/\b(?:vehicle service|car service|vehicle repair|car repair)\b/.test(text))return 'car';
  return 'unsorted';
}

/** Scenario amounts are *illustrations* from approved entries, not AI predictions or guaranteed savings. */
export function cycleCashflowCutIdeas(entries:ExpenseEntry[],cycleStart:string,currency:string){
  const selected=cycleEntries(entries,cycleStart,currency).filter(e=>e.kind==='expense'&&e.category!=='unsorted');
  const targets=[
    {category:'subscriptions' as const,rate:0.20,action:'Check unused memberships, gym charges and streaming renewals before cancelling.'},
    {category:'fees' as const,rate:0.15,action:'Compare actual bank charges and payment methods; avoid fees you can safely reduce.'},
    {category:'transport' as const,rate:0.10,action:'Review repeated trips and fuel costs; preserve essential commuting.'},
    {category:'groceries' as const,rate:0.05,action:'Compare prices and reduce waste without cutting essential food.'}
  ];
  const ideas=targets.map(target=>{
    const recorded=selected.filter(e=>e.category===target.category).reduce((sum,e)=>sum+e.amount,0);
    return {...target,recorded,illustrativeSavings:Math.round(recorded*target.rate*100)/100};
  }).filter(x=>x.recorded>0&&x.illustrativeSavings>0);
  return {ideas,totalIllustrativeSavings:Math.round(ideas.reduce((sum,x)=>sum+x.illustrativeSavings,0)*100)/100};
}
/** Legacy “other” was the importer’s fallback; treat it as needing optional
 * category review for display, without mutating older encrypted records. */
export const expenseCategoryNeedsSorting=(category:ExpenseCategory)=>category==='unsorted'||category==='other';
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
  const unsorted=within.filter(e=>expenseCategoryNeedsSorting(e.category));
  const unsortedOutflow=unsorted.filter(e=>e.kind==='expense'||e.kind==='debt-payment').reduce((sum,e)=>sum+e.amount,0);
  const unsortedIncome=unsorted.filter(e=>e.kind==='income').reduce((sum,e)=>sum+e.amount,0);
  const budget=budgetInput.trim()?parseMoneyAmount(budgetInput):null;
  const percent=budget&&budget>0?outflow/budget*100:null;
  const byCategory=EXPENSE_CATEGORIES.filter(c=>c.value!=='other').map(c=>({
    category:c.value,label:c.label,
    amount:within.filter(e=>(e.category===c.value || c.value==='unsorted'&&e.category==='other') &&
      (e.kind==='expense'||e.kind==='debt-payment')).reduce((a,e)=>a+e.amount,0),
  })).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  // Payment-app totals only represent manually recorded outflows, not bank feeds.
  const byPaymentMethod=Object.values(within.filter(e=>e.kind==='expense'||e.kind==='debt-payment')
    .reduce<Record<string,{app:string;amount:number;count:number}>>((acc,e)=>{
      const key=e.paidVia.trim().toLowerCase();
      if(!acc[key])acc[key]={app:e.paidVia.trim(),amount:0,count:0};
      acc[key].amount+=e.amount;
      acc[key].count++;
      return acc;
    },{})).sort((a,b)=>b.amount-a.amount).slice(0,8);
  const flags:string[]=[];
  if(budget!==null && outflow>budget)flags.push('Recorded spending and repayments exceed your chosen cycle limit. Pause nonessential purchases and review recurring bills.');
  else if(percent!==null && percent>=80)flags.push('You have used at least 80% of the cycle spending limit. Keep cash available for bills not yet recorded.');
  if(income===0)flags.push('No salary or income is logged for this cycle. Do not assume planned income is available cash.');
  if(within.some(e=>e.kind==='expense' && ['subscriptions','fees'].includes(e.category)))
    flags.push('Review bank fees, subscriptions and gym charges for services you no longer use.');
  if(transfers>0)flags.push('Internal transfers are tracked separately from spending. Reconcile them before classifying any as leakage.');
  if(unsorted.length>0)flags.push('Unsorted entries need optional category review; they remain included in the correct income/outflow/transfer movement, not automatically treated as waste.');
  if(within.some(e=>e.kind==='expense' && /virtual.card|cash.advance/i.test(e.description+' '+e.note)))
    flags.push('Review virtual-card loads and cash advances: verify their destination and any associated fees.');
  const latestBalances=within.filter(e=>e.kind==='debt-payment' && typeof e.remainingBalance==='number')
    .sort((a,b)=>b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt))
    .filter((e,i,arr)=>arr.findIndex(x=>(x.accountLabel||x.category)===(e.accountLabel||e.category))===i)
    .map(e=>({account:e.accountLabel||e.category,balance:e.remainingBalance!,date:e.date}));
  return {cycle:salaryCycle(cycleStart),count:within.length,income,expenses,debtPayments,transfers,outflow,
    recordedDifference:income-outflow,budget,percent,byCategory,byPaymentMethod,flags,latestBalances,
    unsortedCount:unsorted.length,unsortedOutflow,unsortedIncome};
}

/** Compare only two FINISHED salary cycles; do not overstate an incomplete month. */
export function cycleSpendingTrends(entries:ExpenseEntry[], selectedCycleStart:string, today:string, currency:string){
  dateParts(today);
  const selected=salaryCycle(selectedCycleStart);
  const lastCompleted=selected.endExclusive<=today?selected.start:shiftSalaryCycle(selected.start,-1).start;
  const preceding=shiftSalaryCycle(lastCompleted,-1).start;
  const recent=cycleAnalysis(entries,lastCompleted,currency);
  const older=cycleAnalysis(entries,preceding,currency);
  if(!recent.count || !older.count)return {available:false,first:lastCompleted,previous:preceding,
    message:'Enter transactions across at least two completed salary cycles to compare spending reliably.',highlights:[] as string[]};
  const money=(n:number)=>'R '+n.toFixed(2);
  const highlights:string[]=[];
  const change=recent.outflow-older.outflow;
  const percent=older.outflow>0?Math.round(change/older.outflow*100):null;
  highlights.push('Recorded outflows changed from '+money(older.outflow)+' to '+money(recent.outflow)+
    ' ('+(change>=0?'+':'')+money(change)+', '+(percent===null?'no comparable percentage':String(percent)+'%')+
    '). Historical records may be incomplete.');
  const oldCategory=new Map(older.byCategory.map(x=>[x.category,x.amount]));
  for(const x of recent.byCategory){
    const baseline=oldCategory.get(x.category)||0;
    if(baseline>0&&x.amount-baseline>=100 && x.amount>=baseline*1.25){
      highlights.push(x.label+' rose from '+money(baseline)+' to '+money(x.amount)+
        '. Review invoices and recurring charges before deciding whether this is avoidable.');
    }
  }
  if(recent.debtPayments<older.debtPayments && older.debtPayments>0){
    highlights.push('Recorded debt repayments were lower than the preceding cycle. Check lender minimums and due dates before making additional purchases.');
  }
  return {available:true,first:lastCompleted,previous:preceding,highlights:highlights.slice(0,4),
    message:'Compares manually entered complete salary cycles only; not live banking data.'};
}
