/**
 * An intent-only link from Spend to the Compass conversation.
 *
 * The URL contains ONLY the constant review flag, never transaction amounts,
 * account identifiers, document contents, balances, or private AI credentials.
 * The preview is computed from the already unlocked, approved device ledger.
 * It is NOT a model response, financial advice or a bank reconciliation.
 */
import type {CompassCommandContext} from './compassCommands.ts';

export const CASHFLOW_REVIEW_HREF='/assistant?review=cashflow';

export const CASHFLOW_REVIEW_QUESTION=
  'Review my recorded salary-cycle spending and cash flow. Using only approved '+
  'figures that I have explicitly allowed Compass to access, suggest two cautious '+
  'ways to review optional costs while protecting essentials, debt repayments and '+
  'an emergency buffer. Explain missing information; recorded cash flow is not '+
  'verified money available to spend.';

export function isCashflowReviewHandoff(search:string):boolean{
  if(typeof search!=='string'||search.length>150)return false;
  return new URLSearchParams(search).get('review')==='cashflow';
}

const amount=(value:number,code:string):string=>{
  try{return new Intl.NumberFormat('en-ZA',{
    style:'currency',currency:code,minimumFractionDigits:2,
    maximumFractionDigits:2
  }).format(value);}
  catch{return code+' '+value.toFixed(2);}
};

/** Read-only, current-cycle facts already stored in the unlocked local vault. */
export function describeLocalCashflowReview(context:Pick<CompassCommandContext,'currency'|'expenseSummary'>):string{
  const summary=context.expenseSummary;
  if(!summary||!Number.isInteger(summary.entryCount)||summary.entryCount<0||
    !/^\d{4}-\d{2}-26$/.test(summary.cycleStart)||
    !/^\d{4}-\d{2}-\d{2}$/.test(summary.cycleEnd)||
    !/^[A-Z]{3}$/.test(context.currency)){
    return 'The current salary-cycle review is not available. Your saved entries have not been changed. Return to Spend to check the selected cycle and your encrypted workspace.';
  }
  const period=summary.cycleStart+' to '+summary.cycleEnd;
  if(summary.entryCount===0){
    return 'No approved transactions are recorded for the current salary cycle ('+
      period+') in this unlocked workspace. That does not mean you have no expenses or that older records are missing. Review the selected cycle in Spend.';
  }
  const figures=[
    summary.income,summary.expenses,summary.debtPayments,
    summary.transfers,summary.recordedDifference
  ];
  if(figures.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e11)){
    return 'The saved salary-cycle figures need review. Your records are unchanged; open Spend to check them before requesting AI coaching.';
  }
  const unreviewed=typeof summary.unsortedCount==='number'&&Number.isInteger(summary.unsortedCount)&&summary.unsortedCount>0
    ?' '+summary.unsortedCount+' entries still need a category review.':'';
  return 'Your locally recorded salary cycle ('+period+') contains '+
    summary.entryCount+' approved entries: income '+amount(summary.income,context.currency)+
    ', expenses '+amount(summary.expenses,context.currency)+
    ', debt repayments '+amount(summary.debtPayments,context.currency)+
    ', and internal transfers '+amount(summary.transfers,context.currency)+
    ' (tracked separately). Recorded difference: '+
    amount(summary.recordedDifference,context.currency)+'.'+unreviewed+
    ' These are owner-entered records, NOT a bank-verified balance or spendable cash. No transactions were posted or sent by opening this review.';
}
