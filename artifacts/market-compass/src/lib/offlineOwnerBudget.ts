/**
 * Deterministic offline answers from the validated owner budget in the
 * existing passphrase-encrypted iPhone workspace. No browser-local LLM,
 * no bank feed, provider connection, cloud export or financial execution.
 */
import type {summarizeOwnerBudgetDraft} from './ownerBudgetDraft';
export type OfflineOwnerBudgetSummary=ReturnType<typeof summarizeOwnerBudgetDraft>;
const money=(n:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',minimumFractionDigits:2,maximumFractionDigits:2
}).format(n);
const range=(lo:number,hi:number)=>lo===hi?money(lo):money(lo)+' to '+money(hi);
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
const marker='Owner-reported, saved only in this iPhone’s encrypted workspace; not bank or employer verified. This is not a live bank balance or confirmed spendable cash, and it is not mirrored to HYPRBOX.';
const monthName=(month:string)=>new Date(month+'-01T12:00:00Z')
  .toLocaleDateString('en-ZA',{month:'long',year:'numeric',timeZone:'UTC'});

/** No inferred source records; return null for questions outside the draft. */
export function answerFromOfflineOwnerBudget(
  question:string, budget:OfflineOwnerBudgetSummary|null|undefined
):string|null{
  if(!budget||typeof question!=='string'||!finite(budget.salary)||!finite(budget.hourlyRate)||
     !Array.isArray(budget.recurring)||!Array.isArray(budget.historicalCycles)||
     !Array.isArray(budget.scheduledMonths)||budget.sourceType!=='encrypted-device-draft'||
     budget.bankVerified!==false||budget.currentBalance!==null||
     budget.spendableCash!==null||budget.pendingDesktopMirror!==true)return null;
  const q=question.toLowerCase().trim().replace(/[?!.,]/g,'').replace(/\s+/g,' ');
  if(q.length<2||q.length>500)return null;
  const preface='From your private budget dated '+budget.recordedAt+': ';
  const cycle=budget.historicalCycles.find(item=>{
    const name=monthName(item.date.slice(0,7)).toLowerCase();
    return q.includes(item.date.slice(0,7))||q.includes(name)||
      (q.includes(name.split(' ')[0])&&q.includes(item.date.slice(0,4)))||
      q.includes(item.date);
  });
  if(cycle){
    const line=cycle.entries.find(e=>q.includes(e.label.toLowerCase()));
    if(line) return preface+cycle.date+' includes reported '+line.label+' of '+money(line.min)+
      '. This historical snapshot is incomplete and not verified by a bank. '+marker;
    return preface+'on '+cycle.date+', reported income was '+money(cycle.income)+
      ' and listed expenses and debt payments were '+money(cycle.listedExpenses)+
      '. Their listed difference was '+money(cycle.income-cycle.listedExpenses)+
      ' before missing costs; not confirmed available money. '+marker;
  }
  const schedule=budget.scheduledMonths.find(item=>
    q.includes(item.month)||q.includes(monthName(item.month).toLowerCase())||
    q.includes(monthName(item.month).toLowerCase().split(' ')[0]));
  if(schedule&&/\b(gym|month|cost|expense|spend|budget|december|increase|change)\b/.test(q)){
    return preface+'in '+monthName(schedule.month)+', '+schedule.label+
      ' is planned at '+money(schedule.cost)+'. All listed monthly costs become '+
      range(schedule.listedMin,schedule.listedMax)+
      '. This is a planning estimate, not settled spending. '+marker;
  }
  const match=budget.recurring
    .filter(e=>q.includes(e.label.toLowerCase())||
      (e.label.toLowerCase()==='fuel'&&/\b(petrol|tank|fuel)\b/.test(q))||
      (e.label.toLowerCase()==='car payment'&&/\b(car instalment|car installment)\b/.test(q)))
    .sort((a,b)=>b.label.length-a.label.length)[0];
  if(match&&/\b(how much|cost|expense|pay|payment|monthly|per month|amount|what|budget|spend)\b/.test(q)){
    const qualifier=match.category==='debt_payment'?'reported debt payment':
      match.category==='fee'?'reported service fee':'reported expense';
    return preface+match.label+' is a '+qualifier+' of '+range(match.min,match.max)+
      ' per month. This does not prove the current payment settled. '+marker;
  }
  if(/\b(credit card|creditcard)\b/.test(q)&&/\b(limit|balance|owe|debt|card|amount)\b/.test(q)){
    return preface+(budget.creditCardFigureStatus==='unknown_balance_or_limit'
      ?'the '+(finite(budget.creditCardFigure)?money(budget.creditCardFigure):'reported')+
        ' credit-card figure is not confirmed as an outstanding balance rather than a credit limit. Do not use it as verified debt.'
      :'there is no verified outstanding credit-card balance in this draft.')+
      ' Card payments and fees may appear in the recurring-cost breakdown. '+marker;
  }
  const hourlyHours=q.match(/\b(?:for|in)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/)||
      q.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of work|worked|pay|earnings?)\b/);
  if(hourlyHours&&/\b(hour|hours|earn|pay|work|rate|wage)\b/.test(q)){
    const h=Number(hourlyHours[1]);
    if(!Number.isFinite(h)||h<=0||h>24)
      return 'I can calculate reported hourly pay for between 0.5 and 24 hours, not verify payroll.';
    return preface+String(h)+' hours at '+money(budget.hourlyRate)+
      '/hour is '+money(Math.round(h*budget.hourlyRate*100)/100)+
      ' before possible deductions. Hourly earnings may already be included in salary or incentive. '+marker;
  }
  if(/\b(hourly|hours worked|pay rate|overtime|rate per hour|wage)\b/.test(q)){
    return preface+'your reported hourly rate is '+money(budget.hourlyRate)+
      '/hour; half an hour is '+money(budget.hourlyRate/2)+
      '. This rate may already be included in payroll; avoid double-counting. '+marker;
  }
  if(/\b(salary|incentive|income|earnings?|payday|wages?)\b/.test(q)){
    return preface+'your reported monthly salary is '+money(budget.salary)+
      ', with a conditional incentive of '+money(budget.conditionalIncentive)+
      '. With incentive only if received, the combined amount is '+
      money(budget.salary+budget.conditionalIncentive)+
      '. Hourly rate '+money(budget.hourlyRate)+
      '/hour may already be in payroll and is not added again. '+marker;
  }
  if(/\b(budget|expenses|expense|spending|spent|costs|bills|surplus|afford|available|cash flow|cashflow|remaining|left over)\b/.test(q)){
    const detail=/\b(list|breakdown|categories|items|each|what are)\b/.test(q)?
      ' Recurring items: '+budget.recurring.map(e=>e.label+' '+range(e.min,e.max)).join('; ')+'.':'';
    return preface+'listed monthly expenses, fees and debt payments total '+
      range(budget.recurringMin,budget.recurringMax)+
      '. Salary less only those listed costs is '+range(budget.salaryOnlyDifferenceMin,budget.salaryOnlyDifferenceMax)+
      '. It excludes unrecorded costs and deductions, so this is NOT spendable cash.'+detail+' '+marker;
  }
  return null;
}
