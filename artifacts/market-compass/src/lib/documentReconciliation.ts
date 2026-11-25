/**
 * Read-only, owner-side document reconciliation. A possible match, unusual
 * source date or conflicting merchant classification is a review flag, not a
 * transaction and never an instruction to delete or rewrite records.
 */
import type {LocalFinanceDocument,LocalFinanceLine} from './localFinanceDocs.ts';
import type {ExpenseEntry} from './monthlyExpenses.ts';
import {maskDocumentPII} from './documentIntelligence.ts';
import {sourceTimeContext} from './documentTimeContext.ts';
import {preparedDocumentReview} from './reviewSuggestions.ts';
import {conflictingApprovedCategory,type ApprovedPayeeCategory} from './approvedPayeeCategory.ts';
import {documentAppliedIndices,documentRowBlockReason,type ReviewedLedgerDecision} from './reviewedDocumentLedger.ts';
import {matchingApprovedEntriesForDocumentLine} from './ledgerIntegrity.ts';

export type DocumentReconciliationFinding={
  index:number;
  alreadyApproved:boolean;
  reviewable:boolean;
  matchesApproved:boolean;
  repeatedInFile:boolean;
  outsideReportingPeriod:boolean;
  futureDated:boolean;
  categoryConflict:ApprovedPayeeCategory|null;
  bulkSafe:boolean;
};
export type DocumentReconciliationReport={
  findings:DocumentReconciliationFinding[];
  pendingReviewable:number;
  matchesApproved:number;
  repeatedInFile:number;
  outsideReportingPeriod:number;
  futureDated:number;
  categoryConflicts:number;
  bulkSafeCount:number;
};

const validDay=(day:unknown):day is string=>{
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const parsed=new Date(day+'T12:00:00Z');
  return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===day;
};
const canonical=(value:string)=>maskDocumentPII(value).normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const rowFingerprint=(line:LocalFinanceLine):string|null=>{
  const label=canonical(line.label);
  if(!validDay(line.date)||label.length<5||line.amount===null||
     !Number.isFinite(line.amount)||line.amount===0)return null;
  const cents=Math.round(Math.abs(line.amount)*100);
  if(!Number.isSafeInteger(cents))return null;
  return [line.date,line.direction,cents,label].join('|');
};
/** Eligible for the owner-reviewed queue, never proof of a completed movement. */
function reviewable(document:LocalFinanceDocument,line:LocalFinanceLine):boolean{
  return !!line&&line.amount!==null&&Number.isFinite(line.amount)&&line.amount!==0&&
    !documentRowBlockReason(document,line);
}
/**
 * Guard the actual PWA approval path without changing the protected finance
 * parser or shared ledger core. Source dates are not user-editable during
 * review, and scheduled future movements cannot enter completed Spend.
 * Unverified rows remain saved as review evidence, never auto-posted.
 */
export function assertDocumentApprovalDates(
  document:LocalFinanceDocument,
  choices:ReadonlyArray<Pick<ReviewedLedgerDecision,'lineIndex'|'date'>>,
  now=new Date()
):void{
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))
    throw Error('Invalid local approval date');
  const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
    String(now.getDate()).padStart(2,'0')].join('-');
  for(const selected of choices){
    if(!selected||!Number.isInteger(selected.lineIndex)||
       selected.lineIndex<0||selected.lineIndex>=document.lines.length)
      throw Error('Invalid source line selected for reconciliation.');
    const source=document.lines[selected.lineIndex];
    if(source.date!==null&&selected.date!==source.date)
      throw Error('The source transaction date must be preserved. Re-import corrected evidence.');
    if(validDay(selected.date)&&selected.date>today)
      throw Error('Future-dated transactions cannot be recorded as completed historical Spend.');
  }
}
export function documentReconciliation(
  document:LocalFinanceDocument,entries:readonly ExpenseEntry[],
  currency:string,region:string,today:string
):DocumentReconciliationReport{
  if(!validDay(today))throw Error('Invalid local reconciliation date');
  const saved=Array.isArray(entries)?entries:[];
  const applied=documentAppliedIndices(document,saved as ExpenseEntry[]);
  const sourcePeriod=sourceTimeContext(document);
  // A row-derived period necessarily contains its own rows. Only an explicitly
  // stated document period can identify a potentially inconsistent row date.
  const explicitPeriod=sourcePeriod?.basis==='explicit-period'?sourcePeriod:null;
  const fingerprints=new Map<string,number>();
  document.lines.forEach(line=>{
    if(!reviewable(document,line))return;
    const key=rowFingerprint(line);
    if(key)fingerprints.set(key,(fingerprints.get(key)??0)+1);
  });
  const findings:DocumentReconciliationFinding[]=document.lines.map((line,index)=>{
    const alreadyApproved=applied.has(index);
    const canReview=reviewable(document,line)&&!alreadyApproved;
    const prepared=canReview?preparedDocumentReview(document,index,region):null;
    const key=canReview?rowFingerprint(line):null;
    const matchesApproved=canReview&&matchingApprovedEntriesForDocumentLine(
      line,saved,currency).length>0;
    const repeatedInFile=canReview&&key!==null&&(fingerprints.get(key)??0)>1;
    const outsideReportingPeriod=Boolean(canReview&&validDay(line.date)&&
      explicitPeriod?.from&&explicitPeriod.to&&
      (line.date<explicitPeriod.from||line.date>explicitPeriod.to));
    const futureDated=Boolean(canReview&&validDay(line.date)&&line.date>today);
    const categoryConflict=canReview&&prepared?
      conflictingApprovedCategory(saved,line.label,prepared.kind,currency,prepared.category):null;
    return {
      index,alreadyApproved,reviewable:canReview,matchesApproved,
      repeatedInFile,outsideReportingPeriod,futureDated,
      categoryConflict,
      bulkSafe:Boolean(prepared&&!matchesApproved&&!repeatedInFile&&
        !outsideReportingPeriod&&!futureDated&&!categoryConflict)
    };
  });
  const pending=findings.filter(f=>f.reviewable);
  return {
    findings,pendingReviewable:pending.length,
    matchesApproved:pending.filter(f=>f.matchesApproved).length,
    repeatedInFile:pending.filter(f=>f.repeatedInFile).length,
    outsideReportingPeriod:pending.filter(f=>f.outsideReportingPeriod).length,
    futureDated:pending.filter(f=>f.futureDated).length,
    categoryConflicts:pending.filter(f=>!!f.categoryConflict).length,
    bulkSafeCount:pending.filter(f=>f.bulkSafe).length
  };
}
