import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOwnerBudgetDraft,summarizeOwnerBudgetDraft}
  from '../artifacts/market-compass/src/lib/ownerBudgetDraft.ts';
import {answerFromOfflineOwnerBudget}
  from '../artifacts/market-compass/src/lib/offlineOwnerBudget.ts';
import {interpretCompassCommand}
  from '../artifacts/market-compass/src/lib/compassCommands.ts';

/* Entirely synthetic amounts, labels and scenarios.
 * No owner financial information or personal details in repository tests. */
const digits=value=>String(value).replace(/[\s\u00a0\u202f]/g,'');
const NOW=new Date('2026-11-21T20:00:00Z');
const profile={
 schema:'market-compass-owner-budget-v1',recordedAt:'2026-11-21',currency:'ZAR',
 salary:7300,incentive:180,incentiveGuaranteed:false,hourlyRate:80,
 hourlyAlreadyIncluded:'unknown',
 recurring:[
  {label:'Example housing',min:2400,max:2400,category:'expense'},
  {label:'Example utility',min:510,max:510,category:'expense'},
  {label:'Example transport',min:180,max:180,category:'expense'},
  {label:'Example loan payment',min:165.25,max:165.25,category:'debt_payment'},
  {label:'Example food',min:220,max:350,category:'expense'},
 ],
 scheduledOverrides:[{month:'2026-12',label:'Example housing',amount:2500}],
 historicalCycles:[{date:'2026-10-26',reportedIncome:7400,entries:[
  {label:'Sample housing',min:2400,max:2400,category:'expense'},
  {label:'Sample groceries',min:440,max:440,category:'expense'},
  {label:'Sample train',min:180,max:180,category:'expense'},
  {label:'Sample haircut',min:110,max:110,category:'expense'}
 ]}],
 creditCardFigure:{amount:6400,meaning:'owner_reported_outstanding_balance'}
};
const budget=summarizeOwnerBudgetDraft(validateOwnerBudgetDraft(profile,NOW),NOW);
const answer=q=>answerFromOfflineOwnerBudget(q,budget);

test('synthetic pay rate handles fractional work hours without assuming wages are additional salary',()=>{
 for(const [h,amount] of [[0.5,40],[1,80],[1.5,120],[2,160]]){
  const result=answer('How much would I earn for '+h+' hours worked?');
  assert.ok(result);
  assert.match(digits(result),new RegExp(String(amount)));
  assert.match(result,/may already be included in salary or incentive/i);
 }
 assert.match(answer('What is my hourly pay rate?'),/80/);
 assert.match(answer('What is my incentive?'),/conditional incentive/i);
 assert.equal(answer('Where are my keys?'),null);
});
test('synthetic normal monthly totals are not confused with a one-off exception',()=>{
 const normal=answer('What is my monthly budget?');
 assert.match(digits(normal),/3475[,.]25/);
 assert.match(digits(normal),/3605[,.]25/);
 assert.match(normal,/not spendable cash/i);
 const december=answer('What is the December housing cost?');
 assert.match(digits(december),/2500/);
 assert.match(digits(december),/3575[,.]25/);
 assert.match(digits(december),/3705[,.]25/);
 assert.match(december,/planning estimate/i);
});
test('synthetic October historical snapshot does not imply current spending',()=>{
 const historical=answer('What did I spend in October 2026?');
 assert.match(historical,/2026-10-26/);
 assert.match(digits(historical),/3130/);
 assert.match(historical,/not confirmed available money/i);
 const line=answer('How much was my October 2026 Sample housing?');
 assert.match(digits(line),/2400/);
 assert.match(line,/incomplete/i);
});
test('synthetic outstanding credit-card figure remains owner-reported, not lender-verified or spendable',()=>{
 const result=answer('What is the credit card outstanding balance?');
 assert.match(digits(result),/6400/);
 assert.match(result,/owner-reported outstanding credit-card debt/i);
 assert.match(result,/not lender-verified/i);
 assert.match(result,/not represent available cash/i);
 assert.equal(budget.recurringMin,3475.25,
   'Principal must never be added to normal monthly loan payments');
});
test('empty current transaction ledger is not asserted to equal actual zero spending',()=>{
 const ctx={
  currency:'ZAR',accounts:[],monthlyExtra:'',draftCount:0,
  ownerBudgetDraft:budget,expenseSummary:{
    cycleStart:'2026-11-01',cycleEnd:'2026-11-30',
    income:0,expenses:0,debtPayments:0,transfers:0,
    recordedDifference:0,entryCount:0,cycleLimit:null,flags:[]
  }
 };
 const answerFromOwner=interpretCompassCommand('What were my expenses in October 2026?',ctx);
 assert.match(digits(answerFromOwner.reply),/3130/);
 assert.doesNotMatch(answerFromOwner.reply,/0\.00 income, R0\.00 expenses/);
 const withoutOwner=interpretCompassCommand('What were my expenses this month?',
   {...ctx,ownerBudgetDraft:null});
 assert.match(withoutOwner.reply,/does not mean zero spending/i);
});
