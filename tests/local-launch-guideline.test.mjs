import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildLocalLaunchGuideline} from '../artifacts/market-compass/src/lib/localLaunchGuideline.ts';

const now=new Date('2026-11-21T13:00:00Z');
const privateInput={
 currency:'ZAR',currencyReviewRequired:false,
 privateBudget:{monthlyIncome:'12000.00',monthlyEssentials:'5500.00',
  liquidFunds:'2500.00',reserveTarget:'4000.00'},
 accounts:[
  {name:'SECRET_LENDER_ALPHA',balance:'9000.00',apr:'25.30',minimumPayment:'1200.00'},
  {name:'SECRET_LENDER_BETA',balance:'4000.00',apr:'12.40',minimumPayment:'300.00'},
 ],
 expenseEntries:[{date:'2026-11-19',kind:'expense',amount:145.50}],
 localFinanceDocuments:[{label:'PRIVATE_DOC_LABEL',importedAt:'2026-11-19T13:00:00Z',
  truncated:false,lines:[{label:'PRIVATE_TRANSACTION_LABEL',amount:145.50,
   date:'2026-11-19',direction:'outgoing'}]}],
 ownerBudgetDraft:{recordedAt:'2026-11-19',salary:12000}
};

test('complete but unverified figures yield a cautious 30/60/90-day guideline',()=>{
 const plan=buildLocalLaunchGuideline(privateInput,now);
 assert.equal(plan.readyForIllustration,true);
 assert.equal(plan.preliminaryHeadroom,5000);
 assert.equal(plan.reserveGap,1500);
 assert.equal(plan.steps.length,4);
 assert.match(plan.steps[1].detail,/NOT verified spendable money/);
 assert.match(plan.steps[2].detail,/No payments will be made or scheduled/);
 assert.match(plan.reviewBrief,/owner review required/i);
 assert.match(plan.reviewBrief,/NOT spendable bank funds/);
 assert.match(plan.reviewBrief,/not independently verified/i);
 assert.ok(plan.reviewBrief.length<=2400);
 assert.doesNotMatch(plan.reviewBrief,/SECRET_LENDER|PRIVATE_DOC_LABEL|PRIVATE_TRANSACTION_LABEL/);
});

test('missing fields never become zero income, zero debt or invented surplus',()=>{
 const input={...privateInput,privateBudget:{...privateInput.privateBudget,monthlyIncome:''}};
 const plan=buildLocalLaunchGuideline(input,now);
 assert.equal(plan.readyForIllustration,false);
 assert.equal(plan.preliminaryHeadroom,null);
 assert.equal(plan.reserveGap,null);
 assert.match(plan.reviewBrief,/do not calculate a financial surplus/);
 assert.match(plan.steps[1].detail,/before calculating repayment capacity/);
 assert.doesNotMatch(plan.reviewBrief,/Entered monthly income:.*0/);
});

test('uncertain currency and incomplete debt prevent a ZAR payoff illustration',()=>{
 const a=buildLocalLaunchGuideline({...privateInput,currency:'USD'},now);
 assert.equal(a.preliminaryHeadroom,null);
 const b=buildLocalLaunchGuideline({...privateInput,
  accounts:[{name:'UNKNOWN',balance:'',apr:'12',minimumPayment:'500'}]},now);
 assert.equal(b.readyForIllustration,false);
 assert.equal(b.preliminaryHeadroom,null);
 assert.match(b.steps[2].detail,/no reliable repayment order/i);
});

test('optional HYPRBOX brief requires explicit copy, no automatic transmission',async()=>{
 const ui=await readFile(new URL('../artifacts/market-compass/src/components/FinancialReadinessChecklist.tsx',import.meta.url),'utf8');
 assert.match(ui,/window\.confirm\(/);
 assert.match(ui,/navigator\.clipboard\.writeText\(plan\.reviewBrief\)/);
 assert.match(ui,/nothing has been sent automatically/i);
 assert.doesNotMatch(ui,/(?:fetch\(|XMLHttpRequest|localStorage\.setItem|navigator\.sendBeacon)/i);
});
