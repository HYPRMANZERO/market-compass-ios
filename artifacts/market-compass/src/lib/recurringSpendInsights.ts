/** Read-only recurring-spend candidates. Three dated, approved observations
 * are required. Never turn patterns into obligations or posted transactions.
 */
import {salaryCycle,shiftSalaryCycle,validateExpenseEntry,type ExpenseEntry} from './monthlyExpenses.ts';

export type RecurringSpendCandidate={
  key:string;label:string;category:string;currency:string;
  lastDate:string;observedCount:number;minAmount:number;maxAmount:number;
  recentAmount:number;dateWindowDays:number;
  sourceIds:string[];confidence:'observed-pattern';
};
const day=(value:string)=>Date.parse(value+'T00:00:00.000Z')/86400000;
const cleanLabel=(value:string)=>String(value||'').replace(/\b\d(?:[\d -]{6,}\d)?\b/g,'[masked]')
  .replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,70);
const keyFor=(entry:ExpenseEntry)=>cleanLabel(entry.description).toLowerCase()
  .replace(/\b(?:debit|check|payment|pos|eft|purchase)\b/g,'').replace(/\s+/g,' ').trim();
const safe=(entry:ExpenseEntry)=>{try{validateExpenseEntry(entry);return true;}catch{return false;}};

/** Includes *observed* outflows only, without a bank sync or future debit claim. */
export function recurringSpendCandidates(entries:readonly ExpenseEntry[],asOf:string,currency='ZAR'):RecurringSpendCandidate[]{
  salaryCycle(asOf);
  const groups=new Map<string,ExpenseEntry[]>();
  const seenIds=new Set<string>();
  const currentCycle=salaryCycle(asOf).start;
  const previousCycle=shiftSalaryCycle(currentCycle,-1).start;
  for(const entry of Array.isArray(entries)?entries:[]){
    if(!safe(entry)||entry.date>asOf||entry.currency!==currency||
      !['expense','debt-payment'].includes(entry.kind)||entry.amount<=0)continue;
    // An ID identifies one approved record. Repeated IDs cannot supply
    // independent recurring evidence and must not be counted twice.
    if(typeof entry.id!=='string'||entry.id.trim()===''||seenIds.has(entry.id))continue;
    seenIds.add(entry.id);
    const key=keyFor(entry);
    if(key.length<4||key==='[masked]')continue;
    const grouped=key+'|'+entry.kind+'|'+entry.category;
    let records=groups.get(grouped);
    if(!records){records=[];groups.set(grouped,records);}
    records.push(entry);
  }
  const out:RecurringSpendCandidate[]=[];
  for(const [key,records] of groups){
    const byCycle=new Map<string,ExpenseEntry[]>();
    for(const entry of records){
      const c=salaryCycle(entry.date).start;
      let observed=byCycle.get(c);
      if(!observed){observed=[];byCycle.set(c,observed);}
      observed.push(entry);
    }
    const ordered=[...byCycle.entries()].sort(([a],[b])=>b.localeCompare(a));
    // Never show an old, stopped debit pattern as an active review candidate.
    // An observation this cycle or the immediately prior cycle is necessary.
    if(!ordered.length||![currentCycle,previousCycle].includes(ordered[0][0]))continue;
    // The three latest cycles must be consecutive and uniquely observed.
    if(ordered.length<3||ordered.slice(0,3).some(([,items])=>items.length!==1))continue;
    const three=ordered.slice(0,3);
    const cycleMonth=(start:string)=>Number(start.slice(0,4))*12+Number(start.slice(5,7));
    if(cycleMonth(three[0][0])-cycleMonth(three[1][0])!==1||
       cycleMonth(three[1][0])-cycleMonth(three[2][0])!==1)continue;
    const observations=three.map(([cycle,[entry]])=>({entry,offset:day(entry.date)-day(cycle)}));
    const positions=observations.map(x=>x.offset);
    const spread=Math.max(...positions)-Math.min(...positions);
    if(spread>4)continue;
    const amounts=observations.map(x=>x.entry.amount);
    const min=Math.min(...amounts),max=Math.max(...amounts);
    if(min<=0||max>min*1.2)continue;
    const newest=observations[0].entry;
    out.push({key,label:cleanLabel(newest.description),category:newest.category,
      currency, lastDate:newest.date,observedCount:3,
      minAmount:min,maxAmount:max,recentAmount:newest.amount,
      dateWindowDays:spread,sourceIds:observations.map(x=>x.entry.id),
      confidence:'observed-pattern'});
  }
  return out.sort((a,b)=>b.recentAmount-a.recentAmount||a.label.localeCompare(b.label)).slice(0,8);
}
