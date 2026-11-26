import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFinancialPulse} from '../artifacts/market-compass/src/lib/financialPulseForecast.ts';
import {nextFinancialPulseReview} from '../artifacts/market-compass/src/lib/financialPulseGuidance.ts';

const entry=(id,kind,amount)=>({
  id,date:'2026-11-26',recordedAt:'2026-11-26T10:00:00Z',
  kind,category:kind==='income'?'salary':'groceries',
  description:id,paidVia:'Manual',amount,currency:'ZAR'
});
const pulse=(entries)=>calculateFinancialPulse({asOf:'2026-11-26',approvedEntries:entries});

test('empty salary cycle recommends record review, never zero available cash',()=>{
  const p=pulse([]);
  assert.equal(p.safeToSpend,null);
  const action=nextFinancialPulseReview(p);
  assert.equal(action.id,'record-cycle');
  assert.equal(action.destination,'/expenses');
});
test('missing recorded income or outflows prompts evidence review',()=>{
  assert.equal(nextFinancialPulseReview(pulse([entry('food','expense',200)])).id,'confirm-income');
  assert.equal(nextFinancialPulseReview(pulse([entry('salary','income',10800)])).id,'confirm-outflow');
});
test('valid ledger never claims a safe amount and asks for balance verification',()=>{
  const p=pulse([entry('salary','income',10800),entry('food','expense',300)]);
  assert.equal(p.recorded.difference,10500);
  assert.equal(p.safeToSpend,null);
  const action=nextFinancialPulseReview(p);
  assert.equal(action.id,'verify-balance');
  assert.match(action.description,/not money available to spend/);
  assert.equal(action.destination,'/banks');
});
test('observed recurring spending is a review candidate, not a new commitment',()=>{
  const p=pulse([entry('salary','income',10800),entry('food','expense',300)]);
  const action=nextFinancialPulseReview(p,3);
  assert.equal(action.id,'review-recurring');
  assert.match(action.description,/not confirmed future bills/);
  assert.equal(p.obligations.coverage,'incomplete');
  assert.equal(p.safeToSpend,null);
});
