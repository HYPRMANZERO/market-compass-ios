import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOwnerBudgetDraft,validateOwnerBudgetDraft,summarizeOwnerBudgetDraft
} from '../artifacts/market-compass/src/lib/ownerBudgetDraft.ts';
import {interpretCompassCommand} from '../artifacts/market-compass/src/lib/compassCommands.ts';

const now=new Date('2026-11-21T12:00:00.000Z');
const example={
  schema:'market-compass-owner-budget-v1',recordedAt:'2026-11-20',currency:'ZAR',
  salary:7100,incentive:320,incentiveGuaranteed:false,hourlyRate:77,
  hourlyAlreadyIncluded:'unknown',
  recurring:[
    {label:'Synthetic housing',min:2300,max:2300,category:'expense'},
    {label:'Synthetic groceries',min:200,max:350,category:'expense'},
    {label:'Synthetic repayment',min:100,max:100,category:'debt_payment'},
  ],
  scheduledOverrides:[{month:'2026-12',label:'Synthetic housing',amount:2700}],
  historicalCycles:[{date:'2026-10-26',reportedIncome:7050,entries:[
    {label:'Earlier payment',min:1800,max:1800,category:'expense'}
  ]}],
  creditCardFigure:{amount:5900,meaning:'unknown_balance_or_limit'}
};
const parse=v=>validateOwnerBudgetDraft(v,now);

test('user-selected budget stays source-labelled, with conditional income and incomplete monthly figures',()=>{
  const p=parse(example);
  const s=summarizeOwnerBudgetDraft(p,now);
  assert.equal(s.sourceType,'encrypted-device-draft');
  assert.equal(s.bankVerified,false);
  assert.equal(s.pendingDesktopMirror,true);
  assert.equal(s.salary,7100);
  assert.equal(s.hourlyRate,77);
  assert.equal(s.conditionalIncentive,320);
  assert.equal(s.recurringMin,2600);
  assert.equal(s.recurringMax,2750);
  assert.equal(s.salaryOnlyDifferenceMin,4350);
  assert.equal(s.salaryOnlyDifferenceMax,4500);
  assert.equal(s.scheduledMonths[0].listedMin,3000);
  assert.equal(s.scheduledMonths[0].listedMax,3150);
  assert.equal(s.historicalCycles[0].listedExpenses,1800);
  assert.equal(s.historicalCycles[0].incomplete,true);
  assert.equal(s.currentBalance,null);
  assert.equal(s.spendableCash,null);
});
test('parser supports copy/paste with no network and scrubs unknown fields',()=>{
  const full={...example,bankPassword:'DONT_SAVE',accounts:[{accountNumber:'SENSITIVE'}]};
  const p=parseOwnerBudgetDraft(JSON.stringify(full),now);
  const serialized=JSON.stringify(p);
  assert.doesNotMatch(serialized,/DONT_SAVE|SENSITIVE|bankPassword/);
  assert.equal(p.hourlyAlreadyIncluded,'unknown');
  assert.equal(p.creditCardFigure?.meaning,'unknown_balance_or_limit');
});
test('strict validation rejects fake verified salary or credit-card limit/balance assertion',()=>{
  for(const x of [
    {...example,recordedAt:'2026-12-01'},
    {...example,recordedAt:'2026-02-31'},
    {...example,hourlyAlreadyIncluded:'additional'},
    {...example,incentiveGuaranteed:true},
    {...example,hourlyRate:0},
    {...example,creditCardFigure:{amount:5900,meaning:'verified_debt_balance'}},
    {...example,recurring:[example.recurring[0],example.recurring[0]]},
    {...example,recurring:[{...example.recurring[0],min:-5}]},
    {...example,recurring:[{...example.recurring[0],min:0.011}]},
    {...example,scheduledOverrides:[{month:'2026-13',label:'Synthetic housing',amount:2000}]},
    {...example,scheduledOverrides:[{month:'2026-12',label:'Unknown',amount:2000}]},
    {...example,historicalCycles:[{date:'2026-10-26',reportedIncome:7000,entries:[
      {label:'Bad historical',min:10,max:20,category:'expense'}]}]},
  ]) assert.throws(()=>parse(x));
  assert.throws(()=>parseOwnerBudgetDraft('{"invalid":',now),/JSON/);
  assert.throws(()=>parseOwnerBudgetDraft('x'.repeat(20_010),now),/20 KB/);
});
test('owner-confirmed card outstanding debt stays unverified and distinct from expenses',()=>{
  const profile=parse({...example,creditCardFigure:{amount:7300.25,meaning:'owner_reported_outstanding_balance'}});
  const summary=summarizeOwnerBudgetDraft(profile,now);
  assert.equal(summary.creditCardFigureStatus,'owner_reported_outstanding_balance');
  assert.equal(summary.creditCardFigure,7300.25);
  assert.equal(summary.bankVerified,false);
  assert.equal(summary.spendableCash,null);
  assert.equal(summary.recurringMin,2600);
  assert.equal(summary.recurringMax,2750);
});

test('missing financial profile is distinct from a zero balance',()=>{
  assert.throws(()=>parse(null));
  const s=summarizeOwnerBudgetDraft(parse({...example,creditCardFigure:null}),now);
  assert.equal(s.creditCardFigureStatus,'not_provided');
  assert.equal(s.currentBalance,null);
});
test('offline voice assistant answers only from explicit saved private draft',()=>{
  const s=summarizeOwnerBudgetDraft(parse(example),now);
  const context={
    currency:'ZAR',accounts:[],monthlyExtra:'',draftCount:0,
    ownerBudgetDraft:s,
    expenseSummary:{cycleStart:'2026-10-26',cycleEnd:'2026-11-25',
      income:0,expenses:0,debtPayments:0,transfers:0,recordedDifference:0,
      entryCount:0,cycleLimit:null,flags:[]}
  };
  const actual=interpretCompassCommand('What is my hourly rate?',context);
  assert.equal(actual.type,'answer');
  assert.match(actual.reply,/77/);
  assert.match(actual.reply,/private budget dated/i);
  assert.match(actual.reply,/not bank or employer verified/i);
  assert.match(actual.reply,/not mirrored to HYPRBOX/i);
  assert.doesNotMatch(actual.reply,/verified salary/i);
  assert.match(interpretCompassCommand('What is my incentive?',context).reply,/conditional incentive/i);
  const absent=interpretCompassCommand('What is my hourly rate?',{...context,ownerBudgetDraft:null});
  assert.notEqual(absent.reply,actual.reply);
});
test('saved offline profile never allows financial transfers or trades',()=>{
  const s=summarizeOwnerBudgetDraft(parse(example),now);
  const context={currency:'ZAR',accounts:[],monthlyExtra:'',draftCount:0,ownerBudgetDraft:s};
  const cmd=interpretCompassCommand('Transfer my salary to my account',context);
  assert.match(cmd.reply,/cannot transfer money/i);
});
