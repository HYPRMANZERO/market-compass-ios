/**
 * Strict allowlisted client view for the private HYPRBOX owner-budget endpoint.
 * This is a read-only in-memory snapshot, NOT a browser vault or bank feed.
 */
export type OwnerBudgetLine = {
  label:string;category:'expense'|'debt_payment'|'fee';min:number;max:number;
};
export type OwnerBudgetOverride = {month:string;label:string;amount:number};
export type OwnerBudgetCycle = {
  date:string;reportedIncome:number;listedExpenseTotal:number;
  listedDifference:number;complete:false;
};
export type OwnerBudgetMonth = {
  month:string;listedExpenseMin:number;listedExpenseMax:number;
  salaryOnlyUnallocatedMin:number;salaryOnlyUnallocatedMax:number;complete:false;
};
export type OwnerBudgetView = {
  schema:'market-compass-owner-budget-view-v1';
  readOnly:true;sourceType:'desktop-owner-reported';recordedAt:string;
  bankVerified:false;employerVerified:false;
  currentBalance:null;spendableCash:null;currency:'ZAR';
  salary:number;incentive:number;incentiveGuaranteed:false;
  hourlyRate:number;hourlyAlreadyIncluded:'unknown';
  recurring:OwnerBudgetLine[];scheduledOverrides:OwnerBudgetOverride[];
  recurringExpenseMin:number;recurringExpenseMax:number;
  salaryOnlyUnallocatedMin:number;salaryOnlyUnallocatedMax:number;
  conditionalIncentiveUnallocatedMin:number;conditionalIncentiveUnallocatedMax:number;
  historicalCycles:OwnerBudgetCycle[];scheduledMonths:OwnerBudgetMonth[];
  creditCardFigureStatus:'not_provided'|'unknown_balance_or_limit';
  creditCardFigure:number|null;
  coverage:'owner_reported_partial';
  note:string;
};
const isObject=(v:unknown): v is Record<string,unknown> =>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const money=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e9;
const date=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z')) &&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const month=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(x);
const names=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=70&&!/[\x00-\x1f<>]/.test(x);

/** Never trust arbitrary JSON, unexpected claims of verified funds, or extra keys. */
export function parseOwnerBudgetView(data:unknown):OwnerBudgetView|null {
  if(!isObject(data)||data.schema!=='market-compass-owner-budget-view-v1'||
     data.readOnly!==true||data.sourceType!=='desktop-owner-reported'||
     !date(data.recordedAt)||data.bankVerified!==false||
     data.employerVerified!==false||data.currentBalance!==null||
     data.spendableCash!==null||data.currency!=='ZAR'||
     data.incentiveGuaranteed!==false||data.hourlyAlreadyIncluded!=='unknown'||
     data.coverage!=='owner_reported_partial'||
     !money(data.salary)||!money(data.incentive)||!money(data.hourlyRate)||
     !money(data.recurringExpenseMin)||!money(data.recurringExpenseMax)||
     !money(data.salaryOnlyUnallocatedMin)||!money(data.salaryOnlyUnallocatedMax)||
     !money(data.conditionalIncentiveUnallocatedMin)||
     !money(data.conditionalIncentiveUnallocatedMax)||
     !Array.isArray(data.recurring)||data.recurring.length>30||
     !Array.isArray(data.scheduledOverrides)||data.scheduledOverrides.length>24||
     !Array.isArray(data.historicalCycles)||data.historicalCycles.length>12||
     !Array.isArray(data.scheduledMonths)||data.scheduledMonths.length>24||
     !['not_provided','unknown_balance_or_limit'].includes(String(data.creditCardFigureStatus))||
     (data.creditCardFigure!==null&&!money(data.creditCardFigure))||
     typeof data.note!=='string'||data.note.length>450) return null;
  const recurring:OwnerBudgetLine[]=[];
  for(const x of data.recurring){
    if(!isObject(x)||!names(x.label)||!['expense','debt_payment','fee'].includes(String(x.category))||
       !money(x.min)||!money(x.max)||x.min<0||x.max<x.min)return null;
    recurring.push({label:x.label,category:x.category as OwnerBudgetLine['category'],min:x.min,max:x.max});
  }
  const scheduledOverrides:OwnerBudgetOverride[]=[];
  for(const x of data.scheduledOverrides){
    if(!isObject(x)||!month(x.month)||!names(x.label)||!money(x.amount)||x.amount<0)return null;
    scheduledOverrides.push({month:x.month,label:x.label,amount:x.amount});
  }
  const historicalCycles:OwnerBudgetCycle[]=[];
  for(const x of data.historicalCycles){
    if(!isObject(x)||!date(x.date)||!money(x.reportedIncome)||
       !money(x.listedExpenseTotal)||!money(x.listedDifference)||x.complete!==false)return null;
    historicalCycles.push({
      date:x.date,reportedIncome:x.reportedIncome,
      listedExpenseTotal:x.listedExpenseTotal,listedDifference:x.listedDifference,complete:false
    });
  }
  const scheduledMonths:OwnerBudgetMonth[]=[];
  for(const x of data.scheduledMonths){
    if(!isObject(x)||!month(x.month)||!money(x.listedExpenseMin)||!money(x.listedExpenseMax)||
       !money(x.salaryOnlyUnallocatedMin)||!money(x.salaryOnlyUnallocatedMax)||x.complete!==false)return null;
    scheduledMonths.push({
      month:x.month,listedExpenseMin:x.listedExpenseMin,
      listedExpenseMax:x.listedExpenseMax,
      salaryOnlyUnallocatedMin:x.salaryOnlyUnallocatedMin,
      salaryOnlyUnallocatedMax:x.salaryOnlyUnallocatedMax,complete:false
    });
  }
  // Whitelist only the documented fields: never pass through raw statements,
  // filenames, tokens, private documents or unrecognized provider claims.
  return {
    schema:'market-compass-owner-budget-view-v1',readOnly:true,
    sourceType:'desktop-owner-reported',recordedAt:data.recordedAt,
    bankVerified:false,employerVerified:false,currentBalance:null,spendableCash:null,
    currency:'ZAR',salary:data.salary,incentive:data.incentive,
    incentiveGuaranteed:false,hourlyRate:data.hourlyRate,hourlyAlreadyIncluded:'unknown',
    recurring,scheduledOverrides,
    recurringExpenseMin:data.recurringExpenseMin,recurringExpenseMax:data.recurringExpenseMax,
    salaryOnlyUnallocatedMin:data.salaryOnlyUnallocatedMin,
    salaryOnlyUnallocatedMax:data.salaryOnlyUnallocatedMax,
    conditionalIncentiveUnallocatedMin:data.conditionalIncentiveUnallocatedMin,
    conditionalIncentiveUnallocatedMax:data.conditionalIncentiveUnallocatedMax,
    historicalCycles,scheduledMonths,
    creditCardFigureStatus:data.creditCardFigureStatus as OwnerBudgetView['creditCardFigureStatus'],
    creditCardFigure:data.creditCardFigure as number|null,
    coverage:'owner_reported_partial',note:data.note
  };
}
