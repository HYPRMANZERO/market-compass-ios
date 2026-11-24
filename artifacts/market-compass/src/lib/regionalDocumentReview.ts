/**
 * Region-aware suggestions for OWNER review only.
 * This overlay preserves protected document parsing and source-direction
 * checks. Only explicitly posted investment income/transfers extend the
 * approval taxonomy; documents never post without owner approval.
 */
import type {LocalFinanceLine} from './localFinanceDocs.ts';
import {allowedDocumentCategories,suggestDocumentClassification} from './reviewedDocumentLedger.ts';
import {suggestKnownSpendCategory,type ExpenseCategory,type ExpenseKind} from './monthlyExpenses.ts';

export function suggestRegionalDocumentClassification(line:LocalFinanceLine,region='ZA'):
  {kind:ExpenseKind;category:ExpenseCategory}|null{
 const original=suggestDocumentClassification(line);
 if(!original)return null; // Preserve source direction, reversal and ambiguous-line blocks.
 const candidate=suggestKnownSpendCategory(original.kind,line.label,region);
 if(candidate==='unsorted')return {...original,category:'unsorted'};
 // The protected document-approval allowlist is narrower than the saved-ledger
 // reviewer. A new category must first be approved as Unsorted, then reviewed
 // through the separate Spend categorizer. Never propose an invalid import.
 return {...original,
  category:allowedDocumentCategories(original.kind).includes(candidate)?candidate:'unsorted'};
}
