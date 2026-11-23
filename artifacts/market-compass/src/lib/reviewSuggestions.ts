/** Deterministic, auditable review suggestions; not an AI inference or bank verification. */
import {isReviewableLine} from './reviewInbox.ts';
import type {LocalFinanceDocument} from './localFinanceDocs.ts';
import type {ExpenseKind,ExpenseCategory} from './monthlyExpenses.ts';

export type PreparedReview={
 date:string;kind:ExpenseKind;category:ExpenseCategory;
 explanation:string;
};
export function preparedDocumentReview(
 document:LocalFinanceDocument,index:number
):PreparedReview|null{
 const line=document.lines[index];
 if(!line||!isReviewableLine(document,line)||!line.date)return null;
 const label=line.label.toLowerCase();
 let kind:ExpenseKind;
 let category:ExpenseCategory;
 let explanation:string;
 if(line.direction==='outgoing'){
   if(/\b(?:internal transfer|own account transfer|transfer to savings|savings transfer)\b/i.test(label)){
     kind='transfer';category='savings';explanation='Source debit with explicit internal transfer wording';
   }else if(/\b(?:loan repayment|credit card repayment|vehicle loan payment|finance instalment paid)\b/i.test(label)){
     kind='debt-payment';
     category=/\b(?:vehicle|car)\b/i.test(label)?'car':
       /\b(?:credit card)\b/i.test(label)?'credit-card':'other';
     explanation='Source debit with explicit completed repayment wording';
   }else{
     kind='expense';
     category=/\b(?:rent|housing|landlord)\b/.test(label)?'housing':
       /\b(?:grocery|groceries|supermarket|food store)\b/.test(label)?'groceries':
       /\b(?:petrol|diesel|fuel|transport|uber)\b/.test(label)?'transport':
       /\b(?:insurance|premium)\b/.test(label)?'insurance':
       /\b(?:subscription|netflix|spotify|gym)\b/.test(label)?'subscriptions':
       /\b(?:electricity|water|utilities|municipal)\b/.test(label)?'utilities':
       /\b(?:bank fee|service fee|transaction fee|account fee|debit[ -]?order fee|fee[ -]+debit[ -]?order|commission|charges)\b/.test(label)?'fees':
       /\b(?:pharmacy|medical|hospital|clinic)\b/.test(label)?'health':'other';
     explanation=category==='other'?'Source debit; category needs owner confirmation':
       'Source debit with matching description';
   }
 }else if(line.direction==='incoming'){
   if(/\b(?:salary|payroll|wages|payday|net pay)\b/i.test(label)){
     kind='income';category='salary';
     explanation='Source credit with explicit salary wording';
   }else if(/\b(?:interest received|dividend received|commission earned)\b/i.test(label)){
     kind='income';category='side-income';
     explanation='Source credit with explicit income wording';
   }else if(/\b(?:internal transfer|own account transfer|transfer from savings)\b/i.test(label)){
     kind='transfer';category='savings';
     explanation='Source credit with explicit internal transfer wording';
   }else return null; // A refund, reversal or unknown deposit is not necessarily income.
 }else return null; // Generic signed amounts do not prove direction.
 return {date:line.date,kind,category,explanation};
}
