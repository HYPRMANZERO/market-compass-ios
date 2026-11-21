import test from 'node:test';
const displayDigits=value=>value.replace(/[\s\u00a0\u202f]/g,'');
import assert from 'node:assert/strict';
import {validateOwnerBudgetDraft,summarizeOwnerBudgetDraft}
  from '../artifacts/market-compass/src/lib/ownerBudgetDraft.ts';
import {answerFromOfflineOwnerBudget}
  from '../artifacts/market-compass/src/lib/offlineOwnerBudget.ts';
import {interpretCompassCommand}
  from '../artifacts/market-compass/src/lib/compassCommands.ts';
const profile={
 schema:'market-compass-owner-budget-v1',recordedAt:'2026-11-21',currency:'ZAR',
 salary:10400,incentive:1400,incentiveGuaranteed:false,hourlyRate:60,hourlyAlreadyIncluded:'unknown',
 recurring:[
  {label:'Car payment',min:3552,max:3552,category:'debt_payment'},
  {label:'Insurance',min:727,max:727,category:'expense'},
  {label:'Gym',min:350,max:350,category:'expense'},
  {label:'Credit card payment',min:600.20,max:600.20,category:'debt_payment'},
  {label:'Credit card service fees',min:520,max:520,category:'fee'},
  {label:'Fuel',min:1200,max:1200,category:'expense'},
  {label:'Monthly train ticket',min:220,max:220,category:'expense'},
  {label:'Dog food',min:350,max:580,category:'expense'},
  {label:'Board',min:2000,max:2000,category:'expense'},
  {label:'Dad',min:500,max:500,category:'expense'},
 ],
 scheduledOverrides:[{month:'2026-12',label:'Gym',amount:874}],
 historicalCycles:[{date:'2026-10-26',reportedIncome:10800,entries:[
  {label:'Car payment',min:3569,max:3569,category:'debt_payment'},
  {label:'Gym',min:873,max:873,category:'expense'},
  {label:'Mom and dad',min:2500,max:2500,category:'expense'},
  {label:'Fuel',min:600,max:600,category:'expense'},
  {label:'Coffee',min:20,max:20,category:'expense'},
  {label:'Dog food',min:300,max:300,category:'expense'},
  {label:'NexGard',min:150,max:150,category:'expense'},
  {label:'Haircut',min:110,max:110,category:'expense'},
  {label:'Bud',min:150,max:150,category:'expense'},
  {label:'Dessert',min:52,max:52,category:'expense'},
  {label:'Train ticket',min:220,max:220,category:'expense'}
 ]}],
 creditCardFigure:{amount:20000,meaning:'unknown_balance_or_limit'}
};
const budget=summarizeOwnerBudgetDraft(validateOwnerBudgetDraft(profile,new Date('2026-11-21T20:00:00Z')),new Date('2026-11-21T20:00:00Z'));
const answer=q=>answerFromOfflineOwnerBudget(q,budget);
test('pay rate supports exact 0.5, 1.0, 1.5, 2.0 hours without double-counting salary',()=>{
 for(const [h,amount] of [[0.5,30],[1,60],[1.5,90],[2,120]]){
  const r=answer('How much would I earn for '+h+' hours worked?');
  assert.ok(r);
  assert.match(r,new RegExp(String(amount)));
  assert.match(r,/may already be included in salary or incentive/i);
 }
 assert.match(answer('What is my hourly pay rate?'),/60/);
 assert.match(answer('What is my incentive?'),/conditional incentive/i);
 assert.equal(answer('Where are my keys?'),null);
});
test('recurring monthly expenses and December exception remain separate',()=>{
 const r=answer('What is my monthly budget?');
 assert.match(displayDigits(r),/10019/);
 assert.match(displayDigits(r),/10249/);
 assert.match(r,/not spendable cash/i);
 const g=answer('What is the December gym cost?');
 assert.match(g,/874/);
 assert.match(displayDigits(g),/10543/);
 assert.match(displayDigits(g),/10773/);
 assert.match(g,/planning estimate/i);
});
test('October history is a dated incomplete snapshot, not current spending',()=>{
 const r=answer('What did I spend in October 2026?');
 assert.match(r,/2026-10-26/);
 assert.match(displayDigits(r),/8544/);
 assert.match(r,/not confirmed available money/i);
 const specific=answer('How much was my October 2026 Gym?');
 assert.match(specific,/873/);
 assert.match(specific,/incomplete/i);
});
test('owner-reported outstanding credit card amount is not lender-verified or spendable cash',()=>{
 const draft={...profile,creditCardFigure:{amount:5000,meaning:'owner_reported_outstanding_balance'}};
 const budget2=summarizeOwnerBudgetDraft(validateOwnerBudgetDraft(draft,new Date('2026-11-21T20:00:00Z')),new Date('2026-11-21T20:00:00Z'));
 const reply=answerFromOfflineOwnerBudget('What is the credit card outstanding balance?',budget2);
 assert.match(displayDigits(reply),/5000/);
 assert.match(reply,/owner-reported outstanding credit-card debt/i);
 assert.match(reply,/not lender-verified/i);
 assert.match(reply,/not represent available cash/i);
 assert.equal(budget2.recurringMin,budget.recurringMin,'Do not add balance to monthly costs');
});

test('unconfirmed card figure is not a confirmed balance',()=>{
 const r=answer('How much is the credit card balance?');
 assert.match(displayDigits(r),/20000/);
 assert.match(r,/not confirmed as an outstanding balance/i);
 assert.doesNotMatch(r,/verified debt balance/i);
});
test('empty current ledger uses owner-reported budget rather than pretending zero spending',()=>{
 const ctx={
  currency:'ZAR',accounts:[],monthlyExtra:'',draftCount:0,
  ownerBudgetDraft:budget,expenseSummary:{
   cycleStart:'2026-11-01',cycleEnd:'2026-11-30',income:0,
   expenses:0,debtPayments:0,transfers:0,recordedDifference:0,
   entryCount:0,cycleLimit:null,flags:[]
  }
 };
 const response=interpretCompassCommand('What were my expenses in October 2026?',ctx);
 assert.match(displayDigits(response.reply),/8544/);
 assert.doesNotMatch(response.reply,/0\.00 income, R0\.00 expenses/);
 const noOwner=interpretCompassCommand('What were my expenses this month?',{...ctx,ownerBudgetDraft:null});
 assert.match(noOwner.reply,/does not mean zero spending/i);
});
