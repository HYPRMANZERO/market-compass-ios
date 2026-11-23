/**
 * Read-only review inbox based exclusively on owner-selected local evidence.
 * It NEVER imports transactions, assumes a completed payment, or records a
 * live bank balance. A dated excerpt is only a POSSIBLE review candidate.
 */
import type {LocalFinanceDocument,LocalFinanceLine} from './localFinanceDocs.ts';
import type {ExpenseEntry} from './monthlyExpenses.ts';
import {documentAppliedIndices} from './reviewedDocumentLedger.ts';
import {isFinanceReferenceLabel} from './vehicleFinance.ts';

export type InboxDocument={
  id:string;label:string;format:string;importedAt:string;
  reviewable:number;approved:number;needsReview:number;
  undated:number;referenceOnly:number;otherCurrencyUnverified:boolean;
};
export type InboxSummary={
  documents:number;reviewable:number;approved:number;needsReview:number;
  undated:number;referenceOnly:number;items:InboxDocument[];
};
function validDate(value:string|null):boolean{
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
/** Mirror the no-reference/no-unknown-amount eligibility of the Spend reviewer.
 * This is for queue presentation only. Actual approval remains in Spend. */
export function isReviewableLine(document:LocalFinanceDocument,line:LocalFinanceLine):boolean{
  if(!line||line.amount===null||!Number.isFinite(line.amount)||line.amount===0)return false;
  if(['contract-term','balance-reference','rate-reference'].includes(line.semanticRole||''))return false;
  if(isFinanceReferenceLabel(line.label))return false;
  if(document.documentKind&&document.documentKind!=='unclassified'&&line.semanticRole!=='transaction')return false;
  if(document.format==='pdf'&&document.accountProfile?.category==='bank-statement'&&
    (line.semanticRole!=='transaction'||!validDate(line.date)))return false;
  return true;
}
export function reviewInbox(documents:LocalFinanceDocument[],entries:ExpenseEntry[]):InboxSummary{
  const items:InboxDocument[]=[];
  for(const doc of Array.isArray(documents)?documents:[]){
    if(!doc||!Array.isArray(doc.lines)||typeof doc.id!=='string')continue;
    const applied=documentAppliedIndices(doc,Array.isArray(entries)?entries:[]);
    let reviewable=0,approved=0,undated=0,referenceOnly=0;
    doc.lines.forEach((line,index)=>{
      if(!isReviewableLine(doc,line)){referenceOnly++;return;}
      if(!validDate(line.date))undated++;
      reviewable++;
      if(applied.has(index))approved++;
    });
    items.push({
      id:doc.id,label:doc.label,format:doc.format,importedAt:doc.importedAt,
      reviewable,approved,needsReview:reviewable-approved,undated,referenceOnly,
      otherCurrencyUnverified:true
    });
  }
  items.sort((a,b)=>b.needsReview-a.needsReview||
    b.importedAt.localeCompare(a.importedAt)||a.id.localeCompare(b.id));
  return {
    documents:items.length,
    reviewable:items.reduce((sum,item)=>sum+item.reviewable,0),
    approved:items.reduce((sum,item)=>sum+item.approved,0),
    needsReview:items.reduce((sum,item)=>sum+item.needsReview,0),
    undated:items.reduce((sum,item)=>sum+item.undated,0),
    referenceOnly:items.reduce((sum,item)=>sum+item.referenceOnly,0),
    items
  };
}
