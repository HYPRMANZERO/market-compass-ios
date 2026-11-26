/**
 * Explicit owner-approval bridge between bounded imported document excerpts
 * and the ordinary local Spend ledger.
 *
 * NO automatic posting, bank validation, balance reconciliation, provider
 * execution, or HYPRBOX transmission. Document lines are incomplete evidence.
 * Entry IDs are stable for retries and edits, preventing accidental reimport.
 */
import {validateLocalFinanceDocument,type LocalFinanceDocument,type LocalFinanceLine} from './localFinanceDocs.ts';
import {isFinanceReferenceLabel} from './vehicleFinance.ts';
import {maskDocumentPII} from './documentIntelligence.ts';
import {
  validateExpenseEntry,EXPENSE_CATEGORIES,suggestKnownSpendCategory,
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
  income:['salary','side-income','unsorted'],
  expense:['housing','groceries','transport','utilities','insurance','fees','subscriptions','health','car','credit-card','other','unsorted'],
  'debt-payment':['car','credit-card','housing','other','unsorted'],
  transfer:['savings','other','unsorted']
};
export function allowedDocumentCategories(kind:ExpenseKind):ExpenseCategory[]{
  return validCategories[kind]??[];
}
export function documentRowBlockReason(doc:LocalFinanceDocument,line:LocalFinanceLine):string|null{
  if(doc.accountProfile?.category==='payslip'||line.payrollField)
    return 'A payslip records payroll evidence, not a confirmed bank deposit or separate expense. Review matching bank transactions before posting.';
  const legacyBalance=/^(?:transaction details\s+)?(?:available|opening|closing|current|running|statement) balance\b/i;
  if(line.semanticRole==='contract-term'||line.semanticRole==='balance-reference'||
     line.semanticRole==='rate-reference'||isFinanceReferenceLabel(line.label)||legacyBalance.test(line.label))
    return 'Reference figure only. It is not proof of a transaction.';
  if(doc.documentKind&&doc.documentKind!=='unclassified'&&line.semanticRole!=='transaction')
    return 'This document line does not confirm a completed transaction.';
  if(doc.format==='pdf'&&doc.accountProfile?.category==='bank-statement'&&
     (line.semanticRole!=='transaction'||line.date===null))
    return 'Re-import the original PDF to recover the transaction date and columns.';
  return null;
}

/** Source direction and ledger treatment are separate. Transfers and reversals
 * need their own evidence before they can affect income or expense totals. */
export function suggestDocumentClassification(line:LocalFinanceLine):
  Pick<ReviewedLedgerDecision,'kind'|'category'>|null{
  if(line.direction==='unclassified')return null;
  const description=line.label.toLowerCase();
  if(/\b(?:own account|between my accounts|internal transfer|transfer to savings)\b/.test(description))
    return {kind:'transfer',category:suggestKnownSpendCategory('transfer',description)};
  if(/\b(?:refund|reversal|reversed|chargeback|transfer|payment from|payshap|eft)\b/.test(description)&&
     !/\b(?:fee|fees|salary|payroll|wages)\b/.test(description))return null;
  if(line.direction==='incoming')return {kind:'income',
    category:suggestKnownSpendCategory('income',description)};
  // A source debit can be contractual debt repayment, not living expenses.
  // Confirm the suggested type before posting; no lender balance is changed.
  if(/\b(?:car (?:loan|instalment|installment|repayment)|vehicle finance|credit card (?:repayment|payment)|card repayment)\b/.test(description))
    return {kind:'debt-payment',category:suggestKnownSpendCategory('debt-payment',description)};
  return {kind:'expense',category:suggestKnownSpendCategory('expense',description)};
}
export function documentAppliedIndices(doc:LocalFinanceDocument,existing:ExpenseEntry[]):Set<number>{
  const ids=new Set(existing.map(e=>e.id));
  return new Set(doc.lines.map((_,i)=>i).filter(i=>ids.has(documentLedgerEntryId(doc.id,i))));
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
  // Defence in depth: enforce source-date integrity at the mutation boundary,
  // not only in the Review UI. This function is used by imported-file workflows.
  const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
    String(now.getDate()).padStart(2,'0')].join('-');
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
    if(line.date!==null&&choice.date!==line.date)
      throw Error('Source payment date must be preserved. Re-import corrected evidence.');
    if(typeof choice.date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(choice.date)||
      !Number.isFinite(Date.parse(choice.date+'T00:00:00Z'))||
      new Date(choice.date+'T00:00:00Z').toISOString().slice(0,10)!==choice.date)
      throw Error('Provide a valid source-confirmed payment date before recording.');
    if(choice.date>today)
      throw Error('Future-dated transactions cannot be recorded as completed historical Spend.');
    const blocked=documentRowBlockReason(doc,line);
    if(blocked)throw Error(blocked);
    if(line.amount===null || !Number.isFinite(line.amount) || line.amount===0)
      throw Error('A selected row has no usable nonzero amount.');
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
