/**
 * Offline recurring-transaction evidence from explicitly approved ledger entries.
 * A single loan quotation, APR or unapproved file excerpt is never a payment.
 * No inference from missing cycles and no future ledger writes.
 */
import {salaryCycle,type ExpenseEntry,type ExpenseKind} from './monthlyExpenses.ts';
import type {LocalFinanceDocument} from './localFinanceDocs.ts';

export type HistoricalEvidence={
  documents:number; datedLines:number; undatedLines:number;
  approvedHistoricalEntries:number; historicalCycles:string[];
  unapprovedDatedLines:number;
};
export type RecurringPattern={
  key:string;description:string;kind:ExpenseKind;
  category:string;observedCycles:number;firstDate:string;lastDate:string;
  minAmount:number;maxAmount:number;typicalAmount:number;
  confidence:'repeated'|'strong';cadence:'observed across salary cycles';
};
const validDate=(s:unknown):s is string=>{
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const stamp=new Date(s+'T00:00:00Z');
  return !Number.isNaN(stamp.valueOf())&&stamp.toISOString().slice(0,10)===s;
};
const descriptionKey=(s:string)=>s.toLowerCase().replace(/\b\d{4,}\b/g,' ')
  .replace(/\b(?:ref|reference|txn|transaction|payment no|receipt)\b/g,' ')
  .replace(/[^a-z]+/g,' ').replace(/\s+/g,' ').trim().slice(0,65);

/** Counts historical approvals once per stable row id, leaving excerpts as separate evidence. */
export function historicalEvidence(documents:LocalFinanceDocument[],entries:ExpenseEntry[],today:string):HistoricalEvidence{
  const docs=Array.isArray(documents)?documents:[];
  const approved=Array.isArray(entries)?entries:[];
  const ids=new Set(approved.map(e=>e.id));
  const cycles=new Set<string>();
  let datedLines=0,undatedLines=0,unapprovedDatedLines=0;
  for(const doc of docs){
    if(!doc||!Array.isArray(doc.lines))continue;
    doc.lines.forEach((line,i)=>{
      if(!validDate(line.date)){undatedLines++;return;}
      datedLines++;
      if(!ids.has('doc-'+doc.id+'-'+i))unapprovedDatedLines++;
    });
  }
  let approvedHistoricalEntries=0;
  for(const item of approved){
    if(!item||!validDate(item.date)||item.date>=today)continue;
    approvedHistoricalEntries++;
    cycles.add(salaryCycle(item.date).start);
  }
  return {documents:docs.length,datedLines,undatedLines,unapprovedDatedLines,
    approvedHistoricalEntries,historicalCycles:[...cycles].sort()};
}

/**
 * Requires at least two separate observed cycles with matching category,
 * direction, normalised description and comparable payment size.
 * Multiple same-cycle transactions are not recurring monthly evidence.
 * Gaps/changes remain visible; no claims about future or current obligations.
 */
export function recurringPatterns(entries:ExpenseEntry[],currency:string,today:string):RecurringPattern[]{
  const groups=new Map<string,ExpenseEntry[]>();
  const unique=new Set<string>();
  for(const e of Array.isArray(entries)?entries:[]){
    if(!e||e.currency!==currency||!validDate(e.date)||e.date>today||
      !Number.isFinite(e.amount)||e.amount<=0||
      !['income','expense','debt-payment','transfer'].includes(e.kind))continue;
    const description=descriptionKey(e.description||'');
    if(description.length<4)continue;
    const key=[e.kind,e.category,description].join('|');
    const once=e.id || [key,e.date,e.amount].join('|');
    if(unique.has(once))continue;
    unique.add(once);
    groups.set(key,[...(groups.get(key)||[]),e]);
  }
  const results:RecurringPattern[]=[];
  for(const [key,items] of groups){
    const byCycle=new Map<string,ExpenseEntry[]>();
    for(const e of items){
      const cycle=salaryCycle(e.date).start;
      byCycle.set(cycle,[...(byCycle.get(cycle)||[]),e]);
    }
    if(byCycle.size<2)continue;
    // One observation per cycle; avoid claiming recurring monthly patterns
    // from multiple payments within a single salary cycle.
    const representative=[...byCycle.values()].map(list=>
      [...list].sort((a,b)=>a.date.localeCompare(b.date))[0]);
    const amounts=representative.map(e=>e.amount).sort((a,b)=>a-b);
    const median=amounts[Math.floor((amounts.length-1)/2)];
    if(amounts[0]<median*0.5||amounts.at(-1)!>median*1.5)continue;
    const dates=representative.map(e=>e.date).sort();
    results.push({key,description:representative[0].description.slice(0,85),
      kind:representative[0].kind,category:representative[0].category,
      observedCycles:byCycle.size,firstDate:dates[0],lastDate:dates.at(-1)!,
      minAmount:amounts[0],maxAmount:amounts.at(-1)!,
      typicalAmount:median,confidence:byCycle.size>=3?'strong':'repeated',
      cadence:'observed across salary cycles'});
  }
  return results.sort((a,b)=>b.observedCycles-a.observedCycles||
    b.lastDate.localeCompare(a.lastDate)).slice(0,12);
}
