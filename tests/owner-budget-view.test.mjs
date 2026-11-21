import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOwnerBudgetView} from '../artifacts/market-compass/src/lib/ownerBudgetView.ts';

const sample={
  schema:'market-compass-owner-budget-view-v1',readOnly:true,
  sourceType:'desktop-owner-reported',recordedAt:'2026-11-20',
  bankVerified:false,employerVerified:false,currentBalance:null,spendableCash:null,
  currency:'ZAR',salary:7100,incentive:320,incentiveGuaranteed:false,
  hourlyRate:77,hourlyAlreadyIncluded:'unknown',
  recurring:[{label:'Synthetic rent',category:'expense',min:2400,max:2400}],
  scheduledOverrides:[{month:'2026-12',label:'Synthetic rent',amount:2500}],
  recurringExpenseMin:2400,recurringExpenseMax:2400,
  salaryOnlyUnallocatedMin:4700,salaryOnlyUnallocatedMax:4700,
  conditionalIncentiveUnallocatedMin:5020,conditionalIncentiveUnallocatedMax:5020,
  historicalCycles:[{date:'2026-10-26',reportedIncome:7100,listedExpenseTotal:2300,
    listedDifference:4800,complete:false,entries:[{label:'Synthetic rent',category:'expense',min:2300,max:2300}]}],
  scheduledMonths:[{month:'2026-12',listedExpenseMin:2500,listedExpenseMax:2500,
    salaryOnlyUnallocatedMin:4600,salaryOnlyUnallocatedMax:4600,complete:false}],
  creditCardFigureStatus:'unknown_balance_or_limit',
  creditCardFigure:5900,coverage:'owner_reported_partial',
  note:'Unverified and incomplete planning reference; no bank feeds.'
};

test('accepts a dated, read-only owner reported budget and does not infer available funds',()=>{
  const result=parseOwnerBudgetView(sample);
  assert.ok(result);
  assert.equal(result.salary,7100);
  assert.equal(result.hourlyRate,77);
  assert.equal(result.spendableCash,null);
  assert.equal(result.currentBalance,null);
  assert.equal(result.bankVerified,false);
  assert.equal(result.recurring[0].label,'Synthetic rent');
  assert.equal(result.historicalCycles[0].entries[0].label,'Synthetic rent');
});
test('rejects forged live verification and returned vault data',()=>{
  for(const changed of [
    {bankVerified:true},{employerVerified:true},{spendableCash:9999},
    {currentBalance:9999},{sourceType:'live_bank'},{readOnly:false},
    {hourlyAlreadyIncluded:'extra'},{creditCardFigureStatus:'verified_balance'}
  ]) assert.equal(parseOwnerBudgetView({...sample,...changed}),null);
});
test('missing data is not a zero-income snapshot; untrusted fields are filtered',()=>{
  assert.equal(parseOwnerBudgetView(null),null);
  assert.equal(parseOwnerBudgetView(undefined),null);
  assert.equal(parseOwnerBudgetView({...sample,recurring:[{...sample.recurring[0],min:-10}]}),null);
  const valid=parseOwnerBudgetView({...sample,bankPassword:'SECRET',
    recurring:[{...sample.recurring[0],bankAccountNumber:'PRIVATE'}]});
  assert.ok(valid);
  assert.doesNotMatch(JSON.stringify(valid),/SECRET|PRIVATE|bankPassword|bankAccountNumber/);
});
test('invalid date, unsupported month and unsupported schema fail closed',()=>{
  assert.equal(parseOwnerBudgetView({...sample,recordedAt:'2026-02-31'}),null);
  assert.equal(parseOwnerBudgetView({...sample,scheduledOverrides:[{month:'2026-13',label:'Synthetic rent',amount:5}]}),null);
  assert.equal(parseOwnerBudgetView({...sample,schema:'market-compass-owner-budget-v0'}),null);
});
