/**
 * Deterministic next-review prompt from owner-approved ledger evidence.
 * A review instruction is not a bank balance, prediction or payment action.
 */
import type {PulseSummary} from './financialPulseForecast.ts';

export type PulseReviewAction={id:string;description:string;destination:'/expenses'|'/banks'};
export function nextFinancialPulseReview(
  pulse:PulseSummary,observedRecurringCount=0
):PulseReviewAction{
  const recorded=pulse.recorded;
  if(recorded.excludedInvalidOrDuplicate>0)
    return {id:'review-invalid',description:'Review invalid or repeated ledger records before trusting this salary-cycle comparison.',destination:'/expenses'};
  if(recorded.count===0)
    return {id:'record-cycle',description:'Add or approve dated income and spending records for this salary cycle.',destination:'/expenses'};
  if(recorded.income===0)
    return {id:'confirm-income',description:'No salary or income is recorded for this cycle. Review dated income entries before drawing conclusions.',destination:'/expenses'};
  if(recorded.expenses+recorded.debtPayments===0)
    return {id:'confirm-outflow',description:'No expenses or debt payments are recorded for this cycle. Review outstanding transactions.',destination:'/expenses'};
  if(observedRecurringCount>0)
    return {id:'review-recurring',description:'Review observed recurring spending against the source documents; these patterns are not confirmed future bills.',destination:'/expenses'};
  if(pulse.balance.quality!=='confirmed')
    return {id:'verify-balance',description:'A recent bank-verified balance is missing. The recorded cash-flow difference is not money available to spend.',destination:'/banks'};
  if(pulse.obligations.coverage!=='complete')
    return {id:'review-bills',description:'Confirm all upcoming unpaid commitments before calculating money available after bills.',destination:'/expenses'};
  if(pulse.safetyBuffer===null)
    return {id:'set-buffer',description:'Set and approve a realistic safety buffer before relying on any safe-to-spend estimate.',destination:'/expenses'};
  return {id:'review-ledger',description:'Review recent approved entries and dated sources before making a financial decision.',destination:'/expenses'};
}
