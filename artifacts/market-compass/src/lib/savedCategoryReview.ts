/** Re-review existing encrypted-vault entries without re-importing documents.
 * Only unambiguous narration matches become proposals. No model calls, bank
 * writes, invented dates, changes to approved amounts or silent updates. */
import {validateExpenseEntry,type ExpenseCategory,type ExpenseEntry,type ExpenseKind} from './monthlyExpenses.ts';

export type SavedCategorySuggestion={
 id:string; date:string; amount:number; description:string;
 previousKind:ExpenseKind; previousCategory:ExpenseCategory;
 kind:ExpenseKind; category:ExpenseCategory; reason:string;
};

function classify(entry:ExpenseEntry):{kind:ExpenseKind;category:ExpenseCategory;reason:string}|null{
 const s=entry.description.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(!s)return null;
 const matches=(pattern:RegExp)=>pattern.test(s);
 const result=(kind:ExpenseKind,category:ExpenseCategory,reason:string)=>({kind,category,reason});
 // An incoming credit is not automatically a salary: only explicit wording.
 if(entry.kind==='income'){
   if(matches(/\b(?:salary|payroll|wages|net pay)\b/))return result('income','salary','Explicit salary narration');
   if(matches(/\b(?:dividend received|interest received|commission earned|income received)\b/))return result('income','side-income','Explicit other-income narration');
   if(matches(/\b(?:own account transfer|transfer from savings|internal transfer)\b/))return result('transfer','savings','Explicit transfer between own accounts');
   return null;
 }
 if(entry.kind==='transfer')return null;
 if(entry.kind==='debt-payment') {
   if(matches(/\b(?:vehicle finance|car loan|vehicle loan|motor finance|auto loan)\b/))return result('debt-payment','car','Explicit vehicle debt narration');
   if(matches(/\b(?:credit card repayment|credit card payment|card repayment|credit facility payment)\b/))return result('debt-payment','credit-card','Explicit credit card repayment');
   return null;
 }
 // Expense-only rules: generic debit orders and EFTs are NOT debt repayments.
 if(matches(/\b(?:own account transfer|transfer to savings|savings transfer|internal transfer)\b/))
   return result('transfer','savings','Explicit own-account transfer');
 if(matches(/\b(?:loan repayment|credit card repayment|vehicle loan payment|finance instalment paid|vehicle finance payment|mortgage repayment|home loan repayment)\b/))
   return result('debt-payment',
     matches(/\b(?:vehicle|car)\b/)?'car':matches(/\bcredit card\b/)?'credit-card':'other',
     'Explicit completed debt repayment wording');
 if(matches(/\b(?:bank fee|bank charges|service fee|transaction fee|debit order fee|debit fee|account fee|monthly fee|commission charge|interest charge|overdraft fee)\b/))
   return result('expense','fees','Explicit fee or bank charge');
 if(matches(/\b(?:insurance|premium|outsurance|discovery insure|miway)\b/))
   return result('expense','insurance','Insurance or premium narration');
 if(matches(/\b(?:netflix|spotify|showmax|dstv|subscription|gym|virgin active|planet fitness)\b/))
   return result('expense','subscriptions','Subscription or gym narration');
 if(matches(/\b(?:rent|rental payment|landlord|housing levy|body corporate)\b/))
   return result('expense','housing','Housing payment narration');
 if(matches(/\b(?:checkers|pick n pay|shoprite|superspar|supermarket|groceries|grocery|food store|woolworths food)\b/))
   return result('expense','groceries','Groceries or food retailer narration');
 if(matches(/\b(?:fuel|petrol|diesel|engen|shell garage|caltex|totalenergies|uber|bolt ride|transport fare)\b/))
   return result('expense','transport','Fuel or transport narration');
 if(matches(/\b(?:electricity|prepaid power|eskom|water utility|municipal utilities|rates and taxes)\b/))
   return result('expense','utilities','Utilities narration');
 if(matches(/\b(?:pharmacy|hospital|clinic|medical aid|doctor consultation|healthcare|dis chem|clicks pharmacy)\b/))
   return result('expense','health','Healthcare narration');
 return null;
}

export function suggestSavedCategoryChanges(entries:ExpenseEntry[]):SavedCategorySuggestion[]{
 return entries.flatMap(entry=>{
   if(!entry||!Number.isFinite(entry.amount)||entry.amount<=0 || !entry.date)return [];
   const next=classify(entry);
   if(!next||(next.kind===entry.kind&&next.category===entry.category))return [];
   // Do not change a bank-linked debt repayment into a different kind.
   if(next.kind!=='debt-payment' && (entry.remainingBalance!==undefined&&entry.remainingBalance!==null || entry.debtAccountId))return [];
   return [{
     id:entry.id,date:entry.date,amount:entry.amount,description:entry.description,
     previousKind:entry.kind,previousCategory:entry.category,
     kind:next.kind,category:next.category,reason:next.reason
   }];
 });
}

/** Owner-accepted proposals only. Reject stale/different saved categories. */
export function applySavedCategoryChanges(entries:ExpenseEntry[],approved:SavedCategorySuggestion[]):ExpenseEntry[]{
 if(!approved.length)return entries;
 const offered=new Map(suggestSavedCategoryChanges(entries).map(p=>[p.id,p]));
 const seen=new Set<string>();
 for(const p of approved){
   if(seen.has(p.id))throw Error('Repeated category review selection.');
   seen.add(p.id);
   const current=offered.get(p.id);
   if(!current || JSON.stringify(current)!==JSON.stringify(p))
     throw Error('Saved records changed while you were reviewing. Refresh the category preview.');
 }
 return entries.map(entry=>{
   const chosen=approved.find(p=>p.id===entry.id);
   return chosen?validateExpenseEntry({...entry,kind:chosen.kind,category:chosen.category}):entry;
 });
}
