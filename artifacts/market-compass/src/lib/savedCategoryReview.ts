/**
 * Owner-triggered, region-aware scan of existing encrypted entries only.
 * Terms do not verify a bank transaction and never authorize a change.
 */
import {validateExpenseEntry,expenseCategoryNeedsSorting,
  type ExpenseCategory,type ExpenseEntry,type ExpenseKind} from './monthlyExpenses.ts';
import {matchRegionalCategory,normalizeFinancialNarration,regionalSalaryNarration} from './regionalSpendRules.ts';

export type SavedCategorySuggestion={
 id:string;date:string;amount:number;currency:string;description:string;
 previousKind:ExpenseKind;previousCategory:ExpenseCategory;
 kind:ExpenseKind;category:ExpenseCategory;reason:string;
};
export type SavedCategoryScan={
 checked:number;uncategorized:number;unresolved:number;
 alreadyCategorized:number;region:string;proposals:SavedCategorySuggestion[];
};
const result=(kind:ExpenseKind,category:ExpenseCategory,reason:string)=>({kind,category,reason});
type Proposal=ReturnType<typeof result>;
const status=/\b(?:refund(?:ed)?|revers(?:al|ed)|chargeback|disput(?:e|ed)|failed|declined|pending|cancelled|quotation|request to pay|mandate approved|mandate request|unpaid|unsuccessful)\b/;
// A posted *fee for* a failed POS transaction is still a bank fee. Do not
// mistake the declined purchase for a completed charge, or classify reversals.
const explicitBankFee=/\b(?:fee (?:electronic|pos|debit|atm|account|service|transaction)|pos (?:declined|failed) (?:insuff|insufficient) funds fee|insuff(?:icient)? funds fee|electronic account (?:payment )?fee)\b/;
const feeStatusReversal=/\b(?:refund(?:ed)?|revers(?:al|ed)|chargeback|disput(?:e|ed)|pending|cancelled|quotation|mandate approved|mandate request)\b/;
const postedFailedPosFee=/\bfee\b.*\b(?:pos|card)\b.*\b(?:declined|failed)\b.*\b(?:insuff|insufficient)\b/;
const virtualCardLoad=/\b(?:value loaded to virtual card|load(?:ed|ing)? (?:to |onto )?(?:my |own )?(?:virtual|prepaid) card|top up (?:my |own )?(?:virtual|prepaid) card|prepaid card top up)\b/;
const absaVehicleFinance=/\babsa vf\b/;
const rentReference=/\brent\s+(?:ib |eft |bank )?(?:payment|transfer|paid|ib)\b|\brent\b.*\b(?:payment to|rent due)\b/;
const ownTransfer=/\b(?:own account transfer|transfer (?:to|from) (?:my |own )?savings|internal transfer|savings (?:pocket|transfer)|move to savings|transfer to investment account|transfer to brokerage account)\b/;
const investmentTransfer=/\b(?:transfer to investment account|transfer to brokerage account|transfer to trading account|investments savings transfer)\b/;
const cashWithdrawal=/\b(?:atm cash withdrawal|cash withdrawal from atm|atm withdrawal|cash withdrawn from atm)\b/;
const creditCard=/\b(?:credit card|card account|credit facility)\s*(?:repayment|payment|instalment|installment|debit)\b|\bcard repayment\b|\bpayment (?:to|of) credit card\b/;
const carFinance=/\b(?:vehicle finance|vehicle loan|car loan|car instalment|car installment|car repayment|motor finance|auto loan|auto finance|vehicle financing)\b/;
const debtWord=/\b(?:repayment|debit(?: order)?|instalment|installment|payment|monthly)\b/;
const personalLoan=/\b(?:personal loan|loan account|unsecured loan|personal credit loan)\b/;
const personalLoanDebit=/\b(?:repayment|instalment|installment|payment|debit order|debit check)\b/;
const mortgage=/\b(?:mortgage repayment|mortgage payment|home loan repayment|home loan payment|housing loan repayment)\b/;
const studentLoan=/\b(?:student loan repayment|education loan repayment|tuition loan repayment)\b/;
const salary=/\b(?:salary|payroll|wages|net pay|pay cheque|paycheck|direct deposit payroll)\b/;
const sideIncome=/\b(?:dividend received|interest received|interest earned|commission earned|freelance income|consulting income|side income|income received|pension paid|pension credit)\b/;
const loanProvidersByRegion:Partial<Record<string,RegExp>>={
  ZA:/\b(?:capfin|finbond|wesbank|mfc vehicle)\b/,
  GB:/\b(?:zopa personal loan|lending stream loan)\b/,
  US:/\b(?:sofi personal loan|upstart loan)\b/,
  IN:/\b(?:bajaj finance loan|personal loan emi)\b/
};
const genericMethod=/^(?:(?:pos|card|debit card|contactless|merchant|point of sale) (?:purchase|payment)|purchase|payment|pos)(?: \d+)?$/;

function classify(entry:ExpenseEntry,region:string):Proposal|null{
 const basic=normalizeFinancialNarration(entry.description);
 if(!basic||(status.test(basic)&&!(postedFailedPosFee.test(basic)&&!feeStatusReversal.test(basic))))return null;
 const match=(pattern:RegExp)=>pattern.test(basic);
 const own=match(ownTransfer);
 if(entry.kind==='income'){
   if(regionalSalaryNarration(basic,region)||match(salary))
     return result('income','salary','Explicit salary/payroll text for the selected region');
   if(match(sideIncome))return result('income','side-income','Explicit other-income narration');
   if(own)return result('transfer',match(investmentTransfer)?'investments':'savings',
     'Explicit own-account transfer; verify before excluding it from income');
   return null;
 }
 if(entry.kind==='transfer'){
   if(own)return result('transfer',match(investmentTransfer)?'investments':'savings','Own-account transfer wording');
   if(match(cashWithdrawal))return result('transfer','cash','ATM cash withdrawal is not automatically retail spending');
   return null;
 }
 // Posted charges/refunds must be distinguished from a provider rail.
 if(entry.kind==='debt-payment'){
   if(match(creditCard))return result('debt-payment','credit-card','Explicit credit-card repayment');
   if(match(mortgage))return result('debt-payment','housing','Explicit home-loan/mortgage repayment');
   if(match(studentLoan))return result('debt-payment','education','Explicit education-loan repayment');
   if((match(carFinance)||(region==='ZA'&&match(absaVehicleFinance)))&&match(debtWord))return result('debt-payment','car','Explicit vehicle-finance instalment');
   if(match(personalLoan)&&match(personalLoanDebit))
     return result('debt-payment','personal-loan','Explicit personal loan repayment');
   if(region==='ZA'&&match(/\bcapfin\b/)&&match(/\b(?:debi check|debit check|debit order|repayment|instalment|installment|payment)\b/))
     return result('debt-payment','personal-loan','Capfin loan debit: confirm posted debit rather than DebiCheck mandate');
   return null;
 }
 if(own)return result('transfer',match(investmentTransfer)?'investments':'savings',
   'Explicit own-account transfer; verify before excluding from spending');
 if(match(mortgage))return result('debt-payment','housing','Explicit mortgage repayment');
 if(match(studentLoan))return result('debt-payment','education','Explicit education-loan repayment');
 if(match(creditCard))return result('debt-payment','credit-card','Explicit credit-card repayment');
 if((match(carFinance)||(region==='ZA'&&match(absaVehicleFinance)))&&match(debtWord))return result('debt-payment','car','Explicit vehicle-finance repayment; check the bank debit cleared');
 if(match(personalLoan)&&match(personalLoanDebit))
   return result('debt-payment','personal-loan','Explicit personal loan repayment');
 if(region==='ZA'&&match(/\bcapfin\b/)&&match(/\b(?:debi check|debit check|debit order|repayment|instalment|installment|payment)\b/))
   return result('debt-payment','personal-loan','Capfin loan debit: confirm posted debit rather than DebiCheck mandate');
 if(loanProvidersByRegion[region]?.test(basic)&&match(/\b(?:repayment|installment|instalment|debit order|payment)\b/)){
   // Provider branding alone does not prove which debt type was settled.
   // Ambiguous providers are deliberately left for manual review.
   return null;
 }
 if(match(explicitBankFee))return result('expense','fees','Explicit bank account or unsuccessful POS fee; this does not imply the declined purchase succeeded');
 if(match(rentReference))return result('expense','housing','Rent specified in bank payment narration');
 if(match(virtualCardLoad))return result('transfer','card-load','Funds loaded to a virtual/prepaid card; verify ownership before excluding from spending');
 // A fee on an ATM withdrawal is an expense; an actual cash withdrawal is
 // a transfer to physical cash. Do not bundle either with unspecified ATM text.
 const category=matchRegionalCategory(basic,region);
 if(category?.category==='fees')return result('expense','fees',category.reason);
 if(match(cashWithdrawal))return result('transfer','cash','Explicit ATM cash withdrawal; check before excluding from expenses');
 if(category)return result('expense',category.category,
   (category.origin==='region'?'Region-specific term: ':'Global financial term: ')+category.reason);
 // A bank/card payment line sometimes has a generic description and a
 // merchant name separately in "paid via". Never treat generic banks and
 // payment rails as merchants.
 if(genericMethod.test(basic)){
   const payVia=matchRegionalCategory(normalizeFinancialNarration(entry.paidVia||''),region);
   if(payVia?.origin==='region'){
     return result('expense',payVia.category,'Selected-region merchant named in payment-method field: '+payVia.reason);
   }
 }
 return null;
}

/** Saved, already-approved transactions may use a wider category taxonomy
 * than a new financial-document approval. The parser's protected category
 * allowlist remains unchanged; this review only relabels stored ledger items.
 */
export function allowedSavedCategory(kind:ExpenseKind,category:ExpenseCategory):boolean{
 if(category==='other'||category==='unsorted')return false;
 if(kind==='income')return ['salary','side-income'].includes(category);
 if(kind==='debt-payment')
   return ['car','credit-card','personal-loan','housing','education'].includes(category);
 if(kind==='transfer')return ['savings','cash','investments','card-load'].includes(category);
 if(kind==='expense')
   return !['salary','side-income','personal-loan','savings','cash','investments'].includes(category);
 return false;
}

/** Paginate a deterministic snapshot, including the final partial page. */
export function categoryReviewPage<T>(items:readonly T[],requestedPage:number,pageSize=8){
 const safeSize=Number.isInteger(pageSize)&&pageSize>0&&pageSize<=100?pageSize:8;
 const pages=Math.max(1,Math.ceil(items.length/safeSize));
 const page=Number.isFinite(requestedPage)
   ?Math.min(pages-1,Math.max(0,Math.floor(requestedPage))):0;
 const start=page*safeSize;
 return {items:items.slice(start,start+safeSize),page,pages,start,
   end:Math.min(items.length,start+safeSize)};
}

/** Called only from the user's Scan button. Rows with user-assigned
 * categories remain untouched. Unknown or mixed evidence stays unresolved.
 */
export function scanSavedCategories(entries:ExpenseEntry[],region='ZA'):SavedCategoryScan{
 const safe=Array.isArray(entries)?entries:[];
 const proposals:SavedCategorySuggestion[]=[];
 let uncategorized=0;
 for(const entry of safe){
   if(!entry||!expenseCategoryNeedsSorting(entry.category))continue;
   uncategorized++;
   if(!Number.isFinite(entry.amount)||entry.amount<=0||!entry.date||!entry.id)continue;
   const next=classify(entry,region);
   if(!next||(next.kind===entry.kind&&next.category===entry.category))continue;
   const linked=!!entry.debtAccountId||entry.remainingBalance!==undefined&&entry.remainingBalance!==null;
   if(linked&&next.kind!==entry.kind)continue;
   proposals.push({
     id:entry.id,date:entry.date,amount:entry.amount,currency:entry.currency,description:entry.description,
     previousKind:entry.kind,previousCategory:entry.category,
     kind:next.kind,category:next.category,reason:next.reason
   });
 }
 return {checked:safe.length,uncategorized,unresolved:uncategorized-proposals.length,
   alreadyCategorized:safe.length-uncategorized,region,proposals};
}
export const suggestSavedCategoryChanges=(entries:ExpenseEntry[],region='ZA')=>
 scanSavedCategories(entries,region).proposals;

/** Apply only still-current proposals from the exact selected region. */
export function applySavedCategoryChanges(entries:ExpenseEntry[],approved:SavedCategorySuggestion[],region='ZA'):ExpenseEntry[]{
 if(!approved.length)return entries;
 const offered=new Map(suggestSavedCategoryChanges(entries,region).map(p=>[p.id,p]));
 const seen=new Set<string>();
 for(const p of approved){
   if(seen.has(p.id))throw Error('Repeated category review selection.');
   seen.add(p.id);
   const current=offered.get(p.id);
   if(!current||JSON.stringify(current)!==JSON.stringify(p))
     throw Error('Saved records or region changed while you were reviewing. Refresh the category preview.');
 }
 const choices=new Map(approved.map(p=>[p.id,p]));
 return entries.map(entry=>{
   const chosen=choices.get(entry.id);
   return chosen?validateExpenseEntry({...entry,kind:chosen.kind,category:chosen.category}):entry;
 });
}
