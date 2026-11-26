/**
 * Explicit owner-approval bridge between bounded imported document excerpts
 * and the ordinary local Spend ledger.
 *
 * NO automatic posting, bank validation, balance reconciliation, provider
 * execution, or HYPRBOX transmission. Document lines are incomplete evidence.
 * Entry IDs are stable for retries and edits, preventing accidental reimport.
 */
import {validateLocalFinanceDocument,type LocalFinanceDocument} from './localFinanceDocs.ts';
import {isFinanceReferenceLabel} from './vehicleFinance.ts';
import {maskDocumentPII} from './documentIntelligence.ts';
import {
  validateExpenseEntry,EXPENSE_CATEGORIES,
  type ExpenseEntry,type ExpenseKind,type ExpenseCategory
} from './monthlyExpenses.ts';

export type ReviewedLedgerDecision={
  lineIndex:number;
  date:string;
  kind:ExpenseKind;
  category:ExpenseCategory;
};
export const documentLedgerEntryId=(documentId:string,lineIndex:number)=>
  'doc-'+documentId+'-'+lineIndex;
const allowedKinds=new Set<ExpenseKind>(['income','expense','debt-payment','transfer']);
const categoryValues=new Set<ExpenseCategory>(EXPENSE_CATEGORIES.map(c=>c.value));
const validCategories:Record<ExpenseKind,ExpenseCategory[]>={
  income:['salary','side-income'],
  expense:['housing','groceries','transport','utilities','insurance','fees','subscriptions','health','car','credit-card','other'],
  'debt-payment':['car','credit-card','other'],
  transfer:['savings','other']
};
export function allowedDocumentCategories(kind:ExpenseKind):ExpenseCategory[]{
  return validCategories[kind]??[];
}
export function documentAppliedIndices(doc:LocalFinanceDocument,existing:ExpenseEntry[]):Set<number>{
  const ids=new Set(existing.map(e=>e.id));
  return new Set(doc.lines.map((_,i)=>i).filter(i=>ids.has(documentLedgerEntryId(doc.id,i))));
}

/** Merge a reviewed ledger snapshot without replacing concurrent vault changes.
 * Only new document-sourced entries are accepted; existing IDs are preserved. */
export function mergeReviewedDocumentEntries(current:ExpenseEntry[],reviewed:ExpenseEntry[]):ExpenseEntry[]{
  if(!Array.isArray(current)||!Array.isArray(reviewed))throw Error('Invalid Spend ledger update.');
  const existingIds=new Set(current.map(entry=>entry.id));
  const additions:ExpenseEntry[]=[];
  const pendingIds=new Set<string>();
  for(const entry of reviewed){
    if(existingIds.has(entry.id))continue;
    if(!/^doc-[0-9a-f-]{20,64}-\d+$/i.test(entry.id)||pendingIds.has(entry.id))
      throw Error('An imported record has an invalid or repeated ID. No records were changed.');
    pendingIds.add(entry.id);
    additions.push(validateExpenseEntry(entry));
  }
  return additions.length?[...current,...additions]:current;
}
/** Conservative cross-source duplicate check for ONE-TAP prepared approvals.
 * Suspicious rows stay in the saved evidence for explicit individual review.
 * Never discard a row or infer a match from amount alone. */
const repeatDescription=(value:string)=>maskDocumentPII(value).toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const repeatKey=(date:string,amount:number,kind:ExpenseKind,description:string)=>{
  if(!date||!Number.isFinite(amount)||amount===0)return null;
  const text=repeatDescription(description);
  if(text.length<7||/^(?:payment|purchase|transfer|bank fee|pos purchase|debit order)$/.test(text))return null;
  const flow=kind==='expense'||kind==='debt-payment'?'outflow':kind;
  return date+'|'+Math.round(Math.abs(amount)*100)+'|'+flow+'|'+text;
};
export function separateRepeatedDocumentChoices(
  document:LocalFinanceDocument,existing:ExpenseEntry[],choices:ReviewedLedgerDecision[]
):{accepted:ReviewedLedgerDecision[];needsReview:ReviewedLedgerDecision[]}{
  const existingKeys=new Set(existing.flatMap(entry=>{
    const key=repeatKey(entry.date,entry.amount,entry.kind,entry.description);
    return entry.currency==='ZAR'&&key?[key]:[];
  }));
  const accepted:ReviewedLedgerDecision[]=[];
  const needsReview:ReviewedLedgerDecision[]=[];
  for(const choice of choices){
    const line=document.lines[choice.lineIndex];
    const key=line?.amount!==null&&line?.amount!==undefined?
      repeatKey(choice.date,line.amount,choice.kind,line.label):null;
    (key&&existingKeys.has(key)?needsReview:accepted).push(choice);
  }
  return {accepted,needsReview};
}
export function applyReviewedDocumentToLedger(
  source:LocalFinanceDocument,
  current:ExpenseEntry[],
  choices:ReviewedLedgerDecision[],
  currency:string,
  now=new Date()
):ExpenseEntry[]{
  const doc=validateLocalFinanceDocument(source);
  if(!doc)throw Error('The saved document is invalid. Export your encrypted backup and review it.');
  if(!Array.isArray(current) || !Array.isArray(choices) ||
    choices.length===0 || choices.length>doc.lines.length)
    throw Error('Select one or more specific document rows for review.');
  if(currency!=='ZAR')throw Error('Document amounts require owner-confirmed ZAR. Check your workspace currency first.');
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))
    throw Error('Invalid entry timestamp.');
  const existing=new Set(current.map(x=>x.id));
  const chosen=new Set<number>();
  const incoming:ExpenseEntry[]=[];
  for(const choice of choices){
    if(!choice || !Number.isInteger(choice.lineIndex) ||
      choice.lineIndex<0 || choice.lineIndex>=doc.lines.length ||
      chosen.has(choice.lineIndex))
      throw Error('Invalid or repeated document row. No entries were added.');
    chosen.add(choice.lineIndex);
    const line=doc.lines[choice.lineIndex];
    if(line.semanticRole==='contract-term'||line.semanticRole==='balance-reference'||
       line.semanticRole==='rate-reference'||isFinanceReferenceLabel(line.label))
      throw Error('A finance quote, instalment schedule, interest rate or reference balance is not proof of a payment. Record only an actual dated transaction.');
    if(doc.documentKind&&doc.documentKind!=='unclassified'&&line.semanticRole!=='transaction')
      throw Error('This finance contract row is not an explicit completed payment. Do not post it to Spend.');
    if(doc.format==='pdf'&&doc.accountProfile?.category==='bank-statement'&&
       (line.semanticRole!=='transaction'||line.date===null))
      throw Error('This older bank-statement excerpt lacks a verified parsed transaction date or amount. Re-import the original PDF with the updated statement parser before posting.');
    if(line.amount===null || !Number.isFinite(line.amount) || line.amount===0)
      throw Error('A selected row has no usable nonzero amount.');
    if(!line.date)throw Error('No source transaction date was extracted. This amount remains reporting-period evidence, not a dated payment. Re-import a clearer document; do not invent a date.');
    // Once a real transaction date was extracted, it must remain the source
    // date. A reporting-period or an import timestamp can never replace it.
    if(line.date && choice.date!==line.date)
      throw Error('The payment date must match the explicit transaction date in the imported document. Reimport or correct the source if it is wrong.');
    if(!allowedKinds.has(choice.kind)||!categoryValues.has(choice.category) ||
       !validCategories[choice.kind].includes(choice.category))
      throw Error('Classify each row with an appropriate entry type and category.');
    if(line.direction==='incoming' && !['income','transfer'].includes(choice.kind))
      throw Error('A source-labelled credit cannot be posted as spending without correcting the source first.');
    if(line.direction==='outgoing' && !['expense','debt-payment','transfer'].includes(choice.kind))
      throw Error('A source-labelled debit cannot be posted as income without correcting the source first.');
    const id=documentLedgerEntryId(doc.id,choice.lineIndex);
    if(existing.has(id))throw Error('One or more selected rows were already added to Spend. Nothing was added twice.');
    const entry:ExpenseEntry={
      id,
      date:choice.date,
      recordedAt:now.toISOString(),
      kind:choice.kind,
      category:choice.category,
      description:maskDocumentPII(line.label).slice(0,100),
      paidVia:'Owner-reviewed document',
      amount:Math.round(Math.abs(line.amount)*100)/100,
      currency:'ZAR',
      note:'Owner-approved partial file excerpt, not a verified bank balance. Source line '+(choice.lineIndex+1)+'.'
    };
    incoming.push(validateExpenseEntry(entry));
  }
  // The caller uses one React setData transaction so either all reviewed rows
  // are appended or none are. Never rewrite the saved source document.
  return [...current,...incoming];
}
