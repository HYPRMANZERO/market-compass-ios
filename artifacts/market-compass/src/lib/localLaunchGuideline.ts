/**
 * Read-only, local-first launch-day planning guide. No model or network calls.
 * Plan values are owner-reported and NEVER interpreted as bank verified or
 * safe to spend. Only a user-triggered copy may disclose this limited brief.
 */
import {evaluateFinancialReadiness,type FinancialReadinessInputs} from './financialReadiness.ts';

export type LaunchGuideline={
  readyForIllustration:boolean;
  coverage:string;
  steps:{period:string;title:string;detail:string}[];
  preliminaryHeadroom:number|null;
  reserveGap:number|null;
  /** Bounded, owner-reviewable brief; never includes raw file text or account names. */
  reviewBrief:string;
  /** Fits the authenticated HYPRBOX Agent's 500-character query limit. */
  agentBrief:string;
};
const money=(v:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',minimumFractionDigits:2,maximumFractionDigits:2
}).format(v);
const cents=(n:number)=>Math.round(n*100);
const validated=(s:unknown):number|null=>{
  if(typeof s!=='string'||!/^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(s.trim()))return null;
  const n=Number(s);return Number.isFinite(n)&&n>=0&&n<=100_000_000?n:null;
};
const debtComplete=(x:unknown):x is {name:string;balance:string;apr:string;minimumPayment:string}=>{
  if(!x||typeof x!=='object')return false;
  const a=x as Record<string,unknown>;
  return typeof a.name==='string'&&a.name.trim().length>0&&
    validated(a.balance)!==null&&validated(a.minimumPayment)!==null&&
    validated(a.apr)!==null&&Number(a.apr)<=200;
};

export function buildLocalLaunchGuideline(input:FinancialReadinessInputs,now=new Date()):LaunchGuideline{
  const report=evaluateFinancialReadiness(input,now);
  const accounts=Array.isArray(input.accounts)?input.accounts:[];
  const budget=input.privateBudget;
  const income=validated(budget?.monthlyIncome);
  const essentials=validated(budget?.monthlyEssentials);
  const funds=validated(budget?.liquidFunds);
  const reserve=validated(budget?.reserveTarget);
  const canCalculate=report.requiredInputsRecorded&&input.currency==='ZAR'&&
    income!==null&&essentials!==null&&funds!==null&&reserve!==null&&
    accounts.length>0&&accounts.every(debtComplete);
  let preliminaryHeadroom:number|null=null;
  let reserveGap:number|null=null;
  let minimums:number|null=null;
  let debts:number|null=null;
  if(canCalculate){
    minimums=accounts.reduce((n,a)=>n+cents(Number(a.minimumPayment)),0)/100;
    debts=accounts.reduce((n,a)=>n+cents(Number(a.balance)),0)/100;
    preliminaryHeadroom=(cents(income!)-cents(essentials!)-cents(minimums))/100;
    reserveGap=Math.max(0,cents(reserve!)-cents(funds!))/100;
  }
  const issues=report.items.filter(x=>x.status!=='recorded');
  const needs=issues.slice(0,5).map(x=>x.title+' ('+x.status+')');
  const coverage=report.recordedCount+' of '+report.items.length+
    ' evidence categories recorded; '+report.missingCount+' missing and '+
    report.reviewCount+' need review.';
  const steps=[
    {period:'Now · launch day',title:'Confirm what the app actually knows',
      detail:'Import statements and payslips, review every extracted date and amount, and approve only relevant excerpts. Cross-check the current Debt Plan and budget against lender and employer documents. Missing entries are unknown, not zero.'+
        (needs.length?' Still needed: '+needs.join('; ')+'.':' All checklist fields are entered but remain owner-reported.')},
    {period:'First 30 days',title:'Stabilize essentials and cash reserve',
      detail:preliminaryHeadroom===null?
        'Complete income, essential costs, debt minimums and cash-reserve fields before calculating repayment capacity. Do not increase debt payments from a historical plan.':
        preliminaryHeadroom<0?
        'Based solely on entered figures, monthly essentials and minimum debt payments exceed reported income by '+money(-preliminaryHeadroom)+'. Prioritize necessities, verify missing costs, and discuss hardship options with lenders rather than adding extra repayments.':
        'Entered income minus listed essentials and debt minimums is '+money(preliminaryHeadroom)+
        ' per month before missing or irregular costs; this is NOT verified spendable money. '+
        (reserveGap !== null && reserveGap > 0?'The entered reserve target exceeds reported liquid cash by '+money(reserveGap!)+'. Protect liquidity first.':'The entered reserve target appears met, but neither cash nor spending is bank verified.')},
    {period:'Days 31–60',title:'Review a non-executable debt strategy',
      detail:canCalculate?
        'Confirm each lender balance, APR, minimum and due date. Compare an interest-rate-first (avalanche) payoff scenario with cash-buffer needs. Total entered principal is '+money(debts!)+
        ' and minimums are '+money(minimums!)+' monthly. No payments will be made or scheduled.':
        'Once debt balances, APRs and minimums are complete, compare payoff options in Debt Plan. Until then no reliable repayment order, payoff date, or affordable extra amount can be established.'},
    {period:'Days 61–90',title:'Reconcile and adjust',
      detail:'Compare new salary-cycle entries against the imported dated evidence, investigate duplicates and uncategorized transactions, refresh account balances manually, and revise the provisional guideline with confirmed figures. Only the owner decides whether to act.'}
  ];
  const docs=Array.isArray(input.localFinanceDocuments)?input.localFinanceDocuments:[];
  const records=Array.isArray(input.expenseEntries)?input.expenseEntries:[];
  const brief=[
    'PRIVATE MARKET COMPASS PLANNING BRIEF (owner review required; read-only)',
    'Requested analysis: produce a cautious 30/60/90-day guideline, questions to verify, and prioritization alternatives. No payments, trades, scheduled actions or assumed live bank data.',
    'Currency: '+input.currency+(input.currencyReviewRequired?' (REVIEW REQUIRED)':''),
    'Evidence coverage: '+coverage,
    'Reviewed locally saved document excerpts: '+docs.length+' files (partial, NOT complete or bank verified).',
    'Device expense-ledger entries: '+records.length+' (not reconciled with a bank).',
    'Debt accounts: '+accounts.length+' owner-entered (not lender verified).',
    canCalculate?'Entered monthly income: '+money(income!)+
      '; listed essential costs: '+money(essentials!)+
      '; entered debt minimums: '+money(minimums!)+
      '; entered debt principal: '+money(debts!)+'.':
      'Required current budget/debt fields incomplete; do not calculate a financial surplus or assert zero debt.',
    preliminaryHeadroom===null?'Estimated headroom: unavailable.':
      'Illustrative listed monthly difference BEFORE unknown costs: '+money(preliminaryHeadroom)+
      '; entered reserve shortfall: '+money(reserveGap!)+'. NOT spendable bank funds.',
    needs.length?'Missing/review: '+needs.join('; ')+'.':'All presence fields recorded, but evidence is still unverified.',
    'No raw documents, passwords, names, account identifiers, or transaction-level entries included. All financial data is owner-reported, not independently verified.'
  ].join('\n');
  const agentBrief=[
    'Read-only 30/60/90-day finance guideline; owner-reported, NOT bank verified. No payments/trades.',
    'Currency '+input.currency+(input.currencyReviewRequired?' (needs review).':'.'),
    canCalculate
      ? 'Income '+money(income!)+'; essentials '+money(essentials!)+
        '; debt minimums '+money(minimums!)+'; debt total '+money(debts!)+
        '; provisional listed difference '+money(preliminaryHeadroom!)+
        '; reserve gap '+money(reserveGap!)+'.'
      : 'Current budget/debt fields incomplete; surplus and available bank funds UNKNOWN.',
    'Local reviewed files '+docs.length+', ledger entries '+records.length+
      ' (partial). Explain risks, missing evidence and next review steps; no execution.'
  ].join(' ');
  if(agentBrief.length>500) throw Error('Private Agent summary exceeds 500 characters.');
  return {readyForIllustration:canCalculate,coverage,steps,
    preliminaryHeadroom,reserveGap,reviewBrief:brief.slice(0,2400),agentBrief};
}
