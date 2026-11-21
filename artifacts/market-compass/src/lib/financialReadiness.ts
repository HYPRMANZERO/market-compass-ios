/**
 * Local-only evidence coverage for launch-day financial review.
 *
 * This checklist never infers zero income, zero spending, zero debt or
 * spendable cash from missing records. It reads only metadata and field
 * presence from the unlocked device workspace. No network/AI calls.
 */
export type ReadinessStatus='missing'|'review'|'recorded';
export type ReadinessRoute='/debt'|'/expenses';
export type ReadinessItem={
  id:'income'|'essentials'|'cash_reserve'|'debt_accounts'|'expense_ledger'|'documents'|'owner_budget';
  title:string;
  status:ReadinessStatus;
  requiredForDebtEstimate:boolean;
  detail:string;
  nextStep:string;
  route:ReadinessRoute;
};
export type FinancialReadinessInputs={
  currency:string;
  currencyReviewRequired?:boolean;
  privateBudget?:{
    monthlyIncome?:string;monthlyEssentials?:string;
    liquidFunds?:string;reserveTarget?:string;
  }|null;
  accounts?:{name:string;balance:string;apr:string;minimumPayment:string}[]|null;
  expenseEntries?:{date:string;kind:string;amount:number}[]|null;
  localFinanceDocuments?:{
    label:string;importedAt:string;truncated:boolean;
    lines:{label:string;amount:number|null;date:string|null;direction:string}[];
  }[]|null;
  ownerBudgetDraft?:{recordedAt:string;salary:number}|null;
};
export type FinancialReadinessReport={
  items:ReadinessItem[];
  missingCount:number;
  reviewCount:number;
  recordedCount:number;
  requiredInputsRecorded:boolean;
  bankVerifiedCurrentBalance:false;
  uploadedToDesktop:false;
  warning:string;
};
const amountState=(value:unknown):'missing'|'invalid'|'entered'=>{
  if(typeof value!=='string'||value.trim()==='')return 'missing';
  return /^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(value.trim())&&
    Number.isFinite(Number(value))&&Number(value)<=1e11?'entered':'invalid';
};
const dateValid=(value:unknown):value is string=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const t=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value;
};
const daysSince=(value:unknown,now:Date):number|null=>{
  if(!dateValid(value))return null;
  const n=Date.parse(value+'T00:00:00Z');
  const d=Math.floor((now.getTime()-n)/86_400_000);
  return d<0?null:d;
};
const entry=(id:ReadinessItem['id'],title:string,status:ReadinessStatus,
  requiredForDebtEstimate:boolean,detail:string,nextStep:string,route:ReadinessRoute):ReadinessItem=>({
  id,title,status,requiredForDebtEstimate,detail,nextStep,route
});

/** Presence and coverage only. Explicit numeric zero is a *supplied* value,
 * not interchangeable with missing. All supplied amounts remain unverified.
 */
export function evaluateFinancialReadiness(
  input:FinancialReadinessInputs,now=new Date()
):FinancialReadinessReport {
  const budget=input.privateBudget;
  const documents=Array.isArray(input.localFinanceDocuments)?input.localFinanceDocuments:[];
  const accounts=Array.isArray(input.accounts)?input.accounts:[];
  const ledger=Array.isArray(input.expenseEntries)?input.expenseEntries:[];
  const ownerBudget=input.ownerBudgetDraft;
  const income=amountState(budget?.monthlyIncome);
  const essentials=amountState(budget?.monthlyEssentials);
  const cash=amountState(budget?.liquidFunds);
  const reserve=amountState(budget?.reserveTarget);
  const requiredCurrency=input.currency==='ZAR' && input.currencyReviewRequired!==true;

  const items:ReadinessItem[]=[];
  items.push(entry('income','Current monthly income',income==='entered'?'recorded':income==='missing'?'missing':'review',
    true,
    income==='entered'?'Entered in Debt Plan; owner-reported, not payroll-verified.':
      income==='invalid'?'Income is entered but not a valid non-negative amount.':
      ownerBudget?'A dated owner-budget reference exists, but current monthly income is not entered in Debt Plan.':
      'No current monthly income entered. This does not mean zero income.',
    'Review current salary or payslip and enter a monthly figure in Debt Plan.','/debt'));

  items.push(entry('essentials','Essential monthly costs',essentials==='entered'?'recorded':essentials==='missing'?'missing':'review',
    true,
    essentials==='entered'?'Entered for planning; confirm that essential bills and variable costs are covered.':
      essentials==='invalid'?'Essential costs need a valid non-negative amount.':
      'Monthly essential costs are missing, not known to be R0.',
    'Enter rent, food, transport, insurance and other essentials in Debt Plan.','/debt'));

  const cashFields=[cash,reserve];
  const cashStatus:ReadinessStatus=cashFields.every(x=>x==='entered')?'recorded':
    cashFields.every(x=>x==='missing')?'missing':'review';
  items.push(entry('cash_reserve','Cash available and emergency reserve',cashStatus,true,
    cashStatus==='recorded'?'Both figures entered by the owner; not verified as spendable bank funds.':
      cashStatus==='missing'?'Neither available funds nor the reserve target is entered; neither is assumed zero.':
      'One or both cash/reserve fields are incomplete or invalid.',
    'Enter current liquid cash and the minimum reserve to protect in Debt Plan.','/debt'));

  const accountComplete=(a:FinancialReadinessInputs['accounts'] extends (infer U)[]?U:never)=>{
    return !!a && typeof a.name==='string' && a.name.trim().length>0 &&
      amountState(a.balance)==='entered'&&amountState(a.minimumPayment)==='entered'&&
      amountState(a.apr)==='entered'&&Number(a.apr)<=200;
  };
  const debtStatus:ReadinessStatus=accounts.length===0?'missing':
    accounts.length>50||!accounts.every(a=>accountComplete(a))?'review':'recorded';
  items.push(entry('debt_accounts','Debt balances, rates and minimums',debtStatus,true,
    debtStatus==='missing'?'No current device debt accounts recorded. Older historical plans cannot establish today’s debt.':
      debtStatus==='review'?'One or more debt entries need a name, current balance, APR or minimum payment.':
      `${accounts.length} owner-entered debt account${accounts.length===1?'':'s'}; creditor balances and terms are not independently verified.`,
    'Check current lender statements and complete all debt fields in Debt Plan.','/debt'));

  const validLedger=ledger.filter(e=>dateValid(e?.date)&&
    typeof e.amount==='number'&&Number.isFinite(e.amount)&&e.amount>=0&&
    ['income','expense','debt-payment','transfer'].includes(e.kind));
  const recentLedger=validLedger.filter(e=>{
    const age=daysSince(e.date,now);
    return age!==null&&age<=40;
  });
  const ledgerStatus:ReadinessStatus=ledger.length===0?'missing':
    validLedger.length!==ledger.length||recentLedger.length===0?'review':'recorded';
  items.push(entry('expense_ledger','Current spending and income entries',ledgerStatus,false,
    ledgerStatus==='missing'?'No transactions entered on this device; this does not mean no spending or income.':
      ledgerStatus==='review'?'Saved entries may be dated, invalid or outside the recent 40-day window.':
      `${recentLedger.length} recent owner-entered record${recentLedger.length===1?'':'s'}; this is not a complete bank reconciliation.`,
    'Review the current salary cycle, record missing transactions and avoid double-counting transfers.','/expenses'));

  const validDocs=documents.filter(d=>d&&Array.isArray(d.lines)&&d.lines.length>0);
  const datedDocs=validDocs.some(d=>d.lines.some(line=>daysSince(line.date,now)!==null &&
      (daysSince(line.date,now)??999)<=40));
  const docsStatus:ReadinessStatus=documents.length===0?'missing':
    validDocs.length!==documents.length||documents.some(d=>d.truncated)||!datedDocs?'review':'recorded';
  items.push(entry('documents','Reviewed financial documents',docsStatus,false,
    docsStatus==='missing'?'No locally reviewed statement or payslip excerpts are saved; no provider balance is established.':
      docsStatus==='review'?'Imported excerpts are partial, truncated, old or lack recent dated records.':
      `${validDocs.length} reviewed local document${validDocs.length===1?'':'s'}; excerpts are not a complete statement or live bank feed.`,
    'Import current statement or payslip exports, inspect dates and amounts, then approve only needed excerpts.','/expenses'));

  const ownerDate=ownerBudget?daysSince(ownerBudget.recordedAt,now):null;
  const budgetStatus:ReadinessStatus=!ownerBudget?'missing':
    ownerDate===null||ownerDate>40?'review':'recorded';
  items.push(entry('owner_budget','Owner budget reference',budgetStatus,false,
    budgetStatus==='missing'?'No owner budget draft is saved; other inputs can still be entered manually.':
      budgetStatus==='review'?'Owner budget is historical or undated for current planning.':
      'Dated owner-reported budget saved locally; not an employer-verified statement.',
    'Import or refresh the local owner budget and reconcile with current bills.','/expenses'));

  if(!requiredCurrency){
    // A currency mismatch or unreviewed conversion must never be silently
    // accepted as a ZAR-denominated debt estimate.
    const debt=items.find(x=>x.id==='debt_accounts')!;
    debt.status='review';
    debt.detail=input.currencyReviewRequired?
      'Currency changed; review every previously entered amount before planning.':
      'Debt estimate requires all figures to be reviewed in ZAR. No conversion is assumed.';
  }
  const missingCount=items.filter(x=>x.status==='missing').length;
  const reviewCount=items.filter(x=>x.status==='review').length;
  return {
    items,missingCount,reviewCount,recordedCount:items.length-missingCount-reviewCount,
    requiredInputsRecorded:requiredCurrency && items.filter(x=>x.requiredForDebtEstimate)
      .every(x=>x.status==='recorded'),
    bankVerifiedCurrentBalance:false,
    uploadedToDesktop:false,
    warning:'Missing records never mean R0. Entered figures and reviewed excerpts are not bank-verified, and the Agent does not automatically receive files in the iPhone vault.'
  };
}
