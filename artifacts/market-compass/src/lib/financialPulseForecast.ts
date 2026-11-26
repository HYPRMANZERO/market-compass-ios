/**
 * Financial Pulse v1: read-only, deterministic facts from the OWNER-APPROVED
 * Spend ledger. Never infer a bank balance from transaction differences.
 * No I/O, network access, localStorage, side effects or record mutation.
 */
import {salaryCycle, validateExpenseEntry, type ExpenseEntry} from './monthlyExpenses.ts';

export type PulseQuality='confirmed'|'unverified'|'stale'|'missing';
export type PulseBalance={
  amount:number;
  currency:'ZAR';
  asOf:string;
  sourceId:string;
  bankVerified:boolean;
};
export type PulseCommitment={
  id:string;
  amount:number;
  currency:'ZAR';
  dueDate:string;
  sourceId:string;
  approved:boolean;
  settled:boolean;
};
export type PulseInput={
  asOf:string;
  approvedEntries:readonly ExpenseEntry[];
  balance?:PulseBalance|null;
  commitments?:readonly PulseCommitment[];
  /** Must mean the owner explicitly confirmed every known commitment. */
  commitmentsComplete?:boolean;
  /** An explicit, nonnegative user-selected reserve; absence means unknown. */
  safetyBuffer?:number|null;
};
export type PulseSummary={
  readOnly:true;
  currency:'ZAR';
  asOf:string;
  cycle:{start:string;endExclusive:string;lastDay:string};
  recorded:{
    income:number;
    expenses:number;
    debtPayments:number;
    transfers:number;
    difference:number;
    count:number;
    excludedInvalidOrDuplicate:number;
  };
  balance:{amount:number|null;asOf:string|null;quality:PulseQuality;sourceId:string|null};
  obligations:{unsettled:number;count:number;overdueCount:number;coverage:'complete'|'incomplete'};
  safetyBuffer:number|null;
  /** Null whenever availability cannot be supported by complete fresh evidence. */
  afterCommitments:number|null;
  safeToSpend:number|null;
  sourceIds:{recorded:string[];balance:string|null;commitments:string[]};
  warnings:string[];
};
const roundCents=(cents:number)=>Math.round(cents)/100;
const cents=(n:number):number=>{
  if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1e10)
    throw Error('Financial Pulse requires valid nonnegative amounts.');
  return Math.round(n*100);
};
const days=(value:string)=>{
  salaryCycle(value); // strict Gregorian date validation, including leap days
  return Date.parse(value+'T00:00:00.000Z')/86400000;
};
const validId=(value:string)=>typeof value==='string'&&value.trim().length>0&&value.length<=120;

/** Read-only summary: approved entries != available bank money. */
export function calculateFinancialPulse(input:PulseInput):PulseSummary{
  if(!input||!Array.isArray(input.approvedEntries))
    throw Error('Financial Pulse requires an approved ledger array.');
  const asOfDay=days(input.asOf);
  const cycle=salaryCycle(input.asOf);
  const recordedCents={income:0,expenses:0,debtPayments:0,transfers:0};
  const sourceIds:string[]=[];
  const seenEntries=new Set<string>();
  let excluded=0;
  // Limit the absolute cumulative cents, not just each movement bucket. This
  // ensures income-minus-outflow arithmetic stays exact at large import sizes.
  let absoluteCents=0;
  for(const entry of input.approvedEntries){
    try{
      validateExpenseEntry(entry);
      if(entry.currency!=='ZAR'||entry.date>input.asOf||entry.date<cycle.start||
         entry.date>=cycle.endExclusive||seenEntries.has(entry.id)){
        if(entry.currency==='ZAR'&&seenEntries.has(entry.id))excluded++;
        continue;
      }
      const amount=cents(entry.amount);
      if(!entry.id.trim()||amount===0||absoluteCents>Number.MAX_SAFE_INTEGER-amount){
        // A blank provenance ID, fractional subcent amount or unsafe sum
        // cannot be presented as approved evidence. Do not mutate the ledger.
        excluded++;
        continue;
      }
      absoluteCents+=amount;
      seenEntries.add(entry.id);
      sourceIds.push(entry.id);
      if(entry.kind==='income')recordedCents.income+=amount;
      else if(entry.kind==='expense')recordedCents.expenses+=amount;
      else if(entry.kind==='debt-payment')recordedCents.debtPayments+=amount;
      else recordedCents.transfers+=amount;
    }catch{
      excluded++;
    }
  }
  const warnings:string[]=[];
  if(excluded)warnings.push('Some invalid or repeated approved entries were excluded; review the ledger.');
  const b=input.balance;
  let balanceQuality:PulseQuality='missing';
  let balanceCents:number|null=null;
  let balanceDate:string|null=null;
  let balanceSource:string|null=null;
  if(b){
    if(b.currency!=='ZAR'||!validId(b.sourceId))
      throw Error('Financial Pulse balance needs an identified ZAR source.');
    balanceCents=cents(b.amount);
    const balanceDay=days(b.asOf);
    if(balanceDay>asOfDay)throw Error('Balance evidence cannot be future-dated.');
    balanceDate=b.asOf;
    balanceSource=b.sourceId;
    balanceQuality=!b.bankVerified?'unverified':asOfDay-balanceDay>3?'stale':'confirmed';
  }
  if(balanceQuality==='missing')warnings.push('No confirmed account balance; recorded cash flow is not spendable cash.');
  if(balanceQuality==='unverified')warnings.push('Balance is not bank-verified; do not treat it as available money.');
  if(balanceQuality==='stale')warnings.push('Verified balance is older than three days; refresh it before spending decisions.');

  const obligations=input.commitments??[];
  if(!Array.isArray(obligations))throw Error('Financial Pulse commitments must be a list.');
  let obligationsCents=0;
  let overdueCount=0;
  let pendingCount=0;
  const commitmentSources:string[]=[];
  const seenCommitments=new Set<string>();
  let ambiguous=false;
  for(const obligation of obligations){
    if(!obligation||obligation.currency!=='ZAR'||!validId(obligation.id)||
       !validId(obligation.sourceId)){
      ambiguous=true;continue;
    }
    const dueDay=days(obligation.dueDate);
    const amount=cents(obligation.amount);
    if(seenCommitments.has(obligation.id)){ambiguous=true;continue;}
    seenCommitments.add(obligation.id);
    if(!obligation.approved){ambiguous=true;continue;}
    if(obligation.settled||obligation.dueDate>=cycle.endExclusive)continue;
    obligationsCents+=amount;
    pendingCount++;
    if(dueDay<asOfDay)overdueCount++;
    commitmentSources.push(obligation.sourceId);
  }
  const coverage=input.commitmentsComplete===true&&!ambiguous?'complete':'incomplete';
  if(coverage==='incomplete')warnings.push('Upcoming commitments are not confirmed complete; safe-to-spend is unknown.');
  if(overdueCount)warnings.push('There are unpaid commitments past their due dates.');
  let bufferCents:number|null=null;
  if(input.safetyBuffer!==undefined&&input.safetyBuffer!==null)bufferCents=cents(input.safetyBuffer);
  else warnings.push('No approved safety buffer; safe-to-spend is unknown.');

  // Existing balance ALREADY reflects posted payments; never subtract ledger
  // spending again. Deduct only explicitly approved, unsettled commitments.
  const canEstimate=balanceQuality==='confirmed'&&coverage==='complete'&&
    balanceCents!==null&&bufferCents!==null&&excluded===0;
  const after=canEstimate?balanceCents!-obligationsCents:null;
  const spendable=after!==null?Math.max(0,after-bufferCents!):null;
  return {
    readOnly:true,currency:'ZAR',asOf:input.asOf,cycle,
    recorded:{
      income:roundCents(recordedCents.income),
      expenses:roundCents(recordedCents.expenses),
      debtPayments:roundCents(recordedCents.debtPayments),
      transfers:roundCents(recordedCents.transfers),
      difference:roundCents(recordedCents.income-recordedCents.expenses-recordedCents.debtPayments),
      count:sourceIds.length,excludedInvalidOrDuplicate:excluded
    },
    balance:{amount:balanceCents===null?null:roundCents(balanceCents),
      asOf:balanceDate,quality:balanceQuality,sourceId:balanceSource},
    obligations:{unsettled:roundCents(obligationsCents),
      count:pendingCount,overdueCount,coverage},
    safetyBuffer:bufferCents===null?null:roundCents(bufferCents),
    afterCommitments:after===null?null:roundCents(after),
    safeToSpend:spendable===null?null:roundCents(spendable),
    sourceIds:{recorded:sourceIds,balance:balanceSource,commitments:commitmentSources},
    warnings
  };
}
