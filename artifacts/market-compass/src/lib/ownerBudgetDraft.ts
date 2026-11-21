/**
 * Safari-only, encrypted-workspace owner budget draft.
 * Kept in the existing passphrase-encrypted PWA vault, NOT in Git, localStorage,
 * an AI prompt, remote desktop storage or another web origin.
 * Compatible with HYPRBOX owner-budget-v1 validation for a later owner-approved import.
 */
export type OwnerBudgetExpense = {label:string;min:number;max:number;category:'expense'|'debt_payment'|'fee'};
export type OwnerBudgetSnapshot = {date:string;reportedIncome:number;entries:OwnerBudgetExpense[]};
export type OwnerBudgetException = {month:string;label:string;amount:number};
export type OwnerBudgetDraft = {
  schema:'market-compass-owner-budget-v1';
  recordedAt:string;currency:'ZAR';
  salary:number;incentive:number;incentiveGuaranteed:false;
  hourlyRate:number;hourlyAlreadyIncluded:'unknown';
  recurring:OwnerBudgetExpense[];
  scheduledOverrides:OwnerBudgetException[];
  historicalCycles:OwnerBudgetSnapshot[];
  creditCardFigure:{amount:number;meaning:'unknown_balance_or_limit'}|null;
};
const isObject=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isMoney=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=10_000_000&&
  Math.abs(x*100-Math.round(x*100))<0.000001;
const isDate=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const isLabel=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=70&&
  !/[\x00-\x1f<>]/.test(x);
const toMoney=(x:number)=>Math.round(x*100);
const validMonth=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s);

function validExpense(x:unknown):OwnerBudgetExpense{
  if(!isObject(x)||!isLabel(x.label)||!isMoney(x.min)||!isMoney(x.max)||
    x.max<x.min||!['expense','debt_payment','fee'].includes(String(x.category)))
    throw Error('Check each cost label, category, and min/max rand amount.');
  return {label:x.label.trim(),min:x.min,max:x.max,category:x.category as OwnerBudgetExpense['category']};
}

/** Reject the whole document on a bad record; never turn missing records into R0. */
export function validateOwnerBudgetDraft(raw:unknown,now=new Date()):OwnerBudgetDraft{
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!isObject(raw)||
    raw.schema!=='market-compass-owner-budget-v1'||raw.currency!=='ZAR'||
    !isDate(raw.recordedAt)||Date.parse(raw.recordedAt+'T00:00:00Z')>now.getTime())
    throw Error('Owner budget must have a valid source date, ZAR currency and v1 schema.');
  if(!isMoney(raw.salary)||!isMoney(raw.incentive)||!isMoney(raw.hourlyRate)||raw.hourlyRate===0||
    raw.incentiveGuaranteed!==false||raw.hourlyAlreadyIncluded!=='unknown')
    throw Error('Enter salary, conditional incentive and a positive hourly rate without double counting.');
  if(!Array.isArray(raw.recurring)||raw.recurring.length<1||raw.recurring.length>30)
    throw Error('Include between 1 and 30 recurring costs.');
  const recurring=raw.recurring.map(validExpense);
  const recurringNames=new Set(recurring.map(x=>x.label.toLowerCase()));
  if(recurringNames.size!==recurring.length)throw Error('Recurring labels must be unique.');
  const overrideRaw=raw.scheduledOverrides ?? [];
  if(!Array.isArray(overrideRaw)||overrideRaw.length>24)
    throw Error('Include no more than 24 month-specific exceptions.');
  const scheduledOverrides:OwnerBudgetException[]=overrideRaw.map(x=>{
    if(!isObject(x)||!validMonth(x.month)||!isLabel(x.label)||!isMoney(x.amount))
      throw Error('A scheduled exception needs a valid month, label and amount.');
    const match=recurring.find(e=>e.label.toLowerCase()===x.label.trim().toLowerCase());
    if(!match)throw Error('Each month-specific exception must match a normal recurring label.');
    return {month:x.month,label:match.label,amount:x.amount};
  });
  if(new Set(scheduledOverrides.map(x=>x.month+'/'+x.label.toLowerCase())).size!==scheduledOverrides.length)
    throw Error('A cost can only have one exception per month.');
  if(!Array.isArray(raw.historicalCycles)||raw.historicalCycles.length>12)
    throw Error('Include no more than 12 dated historical snapshots.');
  const historicalCycles:OwnerBudgetSnapshot[]=raw.historicalCycles.map(x=>{
    if(!isObject(x)||!isDate(x.date)||Date.parse(x.date+'T00:00:00Z')>now.getTime()||
      !isMoney(x.reportedIncome)||!Array.isArray(x.entries)||x.entries.length>60)
      throw Error('A historical snapshot needs a valid past date and itemized costs.');
    const entries=x.entries.map(validExpense);
    if(entries.some(e=>e.min!==e.max))
      throw Error('Historical costs must have exact amounts, not ranges.');
    return {date:x.date,reportedIncome:x.reportedIncome,entries};
  });
  if(new Set(historicalCycles.map(c=>c.date)).size!==historicalCycles.length)
    throw Error('Historical snapshot dates must be unique.');
  const credit=raw.creditCardFigure;
  if(credit!==null&&credit!==undefined&&(!isObject(credit)||!isMoney(credit.amount)||
    credit.meaning!=='unknown_balance_or_limit'))
    throw Error('Credit-card figure must be explicitly labelled as an unverified balance-or-limit.');
  // Only allowed properties are returned; secrets or extra JSON fields cannot
  // silently become persisted data in the encrypted workspace.
  return {
    schema:'market-compass-owner-budget-v1',recordedAt:raw.recordedAt,currency:'ZAR',
    salary:raw.salary,incentive:raw.incentive,incentiveGuaranteed:false,
    hourlyRate:raw.hourlyRate,hourlyAlreadyIncluded:'unknown',
    recurring,scheduledOverrides,historicalCycles,
    creditCardFigure:credit?{amount:credit.amount as number,meaning:'unknown_balance_or_limit'}:null
  };
}
export function parseOwnerBudgetDraft(text:string,now=new Date()):OwnerBudgetDraft{
  if(typeof text!=='string'||text.length<5||new TextEncoder().encode(text).length>20_000)
    throw Error('Paste your budget as a JSON document smaller than 20 KB.');
  let raw:unknown;
  try{raw=JSON.parse(text);}catch{throw Error('Budget JSON could not be read. Check commas and quotes.');}
  return validateOwnerBudgetDraft(raw,now);
}
export function summarizeOwnerBudgetDraft(value:OwnerBudgetDraft,now=new Date()){
  const v=validateOwnerBudgetDraft(value,now);
  const low=v.recurring.reduce((sum,x)=>sum+toMoney(x.min),0);
  const high=v.recurring.reduce((sum,x)=>sum+toMoney(x.max),0);
  const monthly=v.scheduledOverrides.map(exception=>{
    const normal=v.recurring.find(x=>x.label===exception.label)!;
    const min=low-toMoney(normal.min)+toMoney(exception.amount);
    const max=high-toMoney(normal.max)+toMoney(exception.amount);
    return {month:exception.month,label:exception.label,cost:exception.amount,listedMin:min/100,listedMax:max/100};
  });
  return {
    recordedAt:v.recordedAt,salary:v.salary,hourlyRate:v.hourlyRate,
    conditionalIncentive:v.incentive, recurringMin:low/100,recurringMax:high/100,
    salaryOnlyDifferenceMin:(toMoney(v.salary)-high)/100,
    salaryOnlyDifferenceMax:(toMoney(v.salary)-low)/100,
    recurring:v.recurring,scheduledMonths:monthly,
    historicalCycles:v.historicalCycles.map(x=>{
      const listed=x.entries.reduce((sum,e)=>sum+toMoney(e.min),0);
      return {date:x.date,income:x.reportedIncome,listedExpenses:listed/100,
        incomplete:true,entries:x.entries};
    }),
    creditCardFigureStatus:v.creditCardFigure?.meaning??'not_provided',
    sourceType:'encrypted-device-draft' as const,
    bankVerified:false as const,currentBalance:null,spendableCash:null,
    pendingDesktopMirror:true as const,
  };
}
