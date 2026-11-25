/**
 * Conservative read-only reminder of previously approved categories.
 * A single transaction, ambiguous name or conflicting history is never a
 * training rule. No category, transaction, or personal preference is modified.
 */
import type {ExpenseCategory,ExpenseEntry,ExpenseKind} from './monthlyExpenses.ts';
import {maskDocumentPII} from './documentIntelligence.ts';

export type ApprovedPayeeCategory={category:ExpenseCategory;count:number};
const GENERIC=/^(?:pos|debit|credit|bank|payment|online|atm|cash|transfer|purchase|card|unknown|unspecified)$/;

export function stablePayeeKey(value:unknown):string|null{
  if(typeof value!=='string'||value.length>350)return null;
  const key=maskDocumentPII(value).normalize('NFKC').toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  if(key.length<7||GENERIC.test(key)||!/[a-z]/i.test(key))return null;
  return key;
}

/** Only consistent, owner-approved saved outflow history counts. */
export function consistentApprovedPayeeCategory(
 entries:readonly ExpenseEntry[],label:unknown,kind:ExpenseKind,currency:string
):ApprovedPayeeCategory|null{
  if(!Array.isArray(entries)||!(kind==='expense'||kind==='debt-payment')||
     typeof currency!=='string'||!currency)return null;
  const key=stablePayeeKey(label);
  if(!key)return null;
  const categories=new Map<ExpenseCategory,number>();
  for(const e of entries){
    if(!e||e.currency!==currency||e.kind!==kind||typeof e.description!=='string'||
       e.category==='other'||e.category==='unsorted'||stablePayeeKey(e.description)!==key)
      continue;
    categories.set(e.category,(categories.get(e.category)||0)+1);
  }
  // Mixed historical categories mean the owner may intentionally split a
  // merchant's purchases, e.g. supermarket groceries vs petrol.
  if(categories.size!==1)return null;
  const [category,count]=Array.from(categories.entries())[0];
  return count>=2?{category,count}:null;
}
export function conflictingApprovedCategory(
 entries:readonly ExpenseEntry[],label:unknown,kind:ExpenseKind,currency:string,
 suggested:ExpenseCategory
):ApprovedPayeeCategory|null{
  const history=consistentApprovedPayeeCategory(entries,label,kind,currency);
  return history&&history.category!==suggested?history:null;
}
