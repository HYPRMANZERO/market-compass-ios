/**
 * Read-only, owner-side integrity diagnostics for the approved Spend ledger.
 *
 * Similar transactions are warnings, never errors or automatic deduplication.
 * We do not infer bank account identity or treat an imported record as verified.
 */
import type {ExpenseEntry,ExpenseKind} from './monthlyExpenses.ts';
import type {LocalFinanceLine} from './localFinanceDocs.ts';
import {maskDocumentPII} from './documentIntelligence.ts';

export type PossibleDuplicateGroup={
  date:string;description:string;amount:number;kind:ExpenseKind;count:number;
};
export type LedgerIntegrityReport={
  approvedCount:number;importedCount:number;unsortedCount:number;
  otherCurrencyCount:number;invalidRecordCount:number;
  latestRecordDate:string|null;possibleDuplicates:PossibleDuplicateGroup[];
};
const validDate=(value:unknown):value is string=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
const canonical=(value:string)=>
  maskDocumentPII(value).normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const cents=(n:number)=>Math.round(n*100);
const validAmount=(n:unknown):n is number=>
  typeof n==='number'&&Number.isFinite(n)&&n>0&&Number.isSafeInteger(cents(n));
const isMovement=(kind:string)=>['income','expense','debt-payment','transfer'].includes(kind);
export function approvedLedgerIntegrity(
  entries:readonly ExpenseEntry[],currency:string
):LedgerIntegrityReport{
  const groups=new Map<string,ExpenseEntry[]>();
  const eligible:ExpenseEntry[]=[];
  let importedCount=0,unsortedCount=0,otherCurrencyCount=0,invalidRecordCount=0;
  for(const entry of Array.isArray(entries)?entries:[]){
    if(!entry||!validDate(entry.date)||!validAmount(entry.amount)||
       typeof entry.description!=='string'||!isMovement(entry.kind)){
      invalidRecordCount++;continue;
    }
    if(entry.currency!==currency){otherCurrencyCount++;continue;}
    eligible.push(entry);
    if(entry.id?.startsWith('doc-')||entry.paidVia==='Owner-reviewed document')importedCount++;
    if(entry.category==='unsorted')unsortedCount++;
    const desc=canonical(entry.description);
    // Without a sufficiently specific label, matching only a date and amount
    // would produce risky false positives (e.g. two coffee purchases).
    if(desc.length<5)continue;
    const key=[entry.date,entry.kind,String(cents(entry.amount)),desc].join('|');
    const bucket=groups.get(key)??[];
    bucket.push(entry);
    groups.set(key,bucket);
  }
  const possibleDuplicates:PossibleDuplicateGroup[]=[];
  for(const rows of groups.values()){
    if(rows.length<2)continue;
    // Separate known accounts so a legitimate match in a second account
    // cannot hide repeats within the first. Unknown provenance stays ambiguous.
    const byAccount=new Map<string,ExpenseEntry[]>();
    let hasUnknown=false;
    for(const row of rows){
      if(!row.debtAccountId){hasUnknown=true;continue;}
      const bucket=byAccount.get(row.debtAccountId)??[];
      bucket.push(row);
      byAccount.set(row.debtAccountId,bucket);
    }
    const candidates=hasUnknown?[rows]:Array.from(byAccount.values());
    for(const candidate of candidates){
      if(candidate.length<2)continue;
      const reference=candidate[0];
      possibleDuplicates.push({
        date:reference.date,kind:reference.kind,amount:reference.amount,
        description:maskDocumentPII(reference.description),count:candidate.length
      });
    }
  }
  possibleDuplicates.sort((a,b)=>b.date.localeCompare(a.date)||
    b.count-a.count||a.description.localeCompare(b.description));
  return {
    approvedCount:eligible.length,importedCount,unsortedCount,otherCurrencyCount,
    invalidRecordCount,
    latestRecordDate:eligible.length?
      eligible.reduce((last,x)=>x.date>last?x.date:last,''):null,
    possibleDuplicates
  };
}

/** A different file or a manual entry can describe the same bank movement.
 * Never hide or auto-delete a source line. The owner must confirm it. */
export function matchingApprovedEntriesForDocumentLine(
  line:LocalFinanceLine,entries:readonly ExpenseEntry[],currency:string
):ExpenseEntry[]{
  if(!validDate(line.date)||!validAmount(line.amount===null?null:Math.abs(line.amount))||
     typeof line.label!=='string')return [];
  const desc=canonical(line.label);
  if(desc.length<5)return [];
  const amount=cents(Math.abs(line.amount!));
  return (Array.isArray(entries)?entries:[]).filter(e=>
    e&&e.currency===currency&&e.date===line.date&&
    validAmount(e.amount)&&cents(e.amount)===amount&&
    typeof e.description==='string'&&canonical(e.description)===desc&&
    (line.direction==='incoming'?['income','transfer'].includes(e.kind):
     line.direction==='outgoing'?['expense','debt-payment','transfer'].includes(e.kind):
     isMovement(e.kind))
  ).slice(0,5);
}
