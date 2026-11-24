import test from 'node:test';
import assert from 'node:assert/strict';
import {scanSavedCategories,applySavedCategoryChanges,allowedSavedCategory} from '../artifacts/market-compass/src/lib/savedCategoryReview.ts';
import {cycleAnalysis,EXPENSE_CATEGORIES} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';

const item=(id,description)=>({
  id,description,kind:'expense',category:'other',amount:75.25,
  date:'2026-05-26',recordedAt:'2026-11-24T14:00:00Z',
  currency:'ZAR',paidVia:'Bank statement',note:'Synthetic provenance'
});
const inspect=(description,region='ZA')=>{
  const entry=item('fixture',description);
  return scanSavedCategories([entry],region).proposals[0];
};

test('representative screenshot transactions are recognized only with explicit evidence',()=>{
  const samples=[
    ['ABSA VF [masked account] DEBICHECK DEBIT ORDER','car','debt-payment'],
    ['FEE-ELECTRONIC ACCOUNT PAYMENT','fees','expense'],
    ['FEE - DEBIT ORDER FEE - DEBIT ORDER','fees','expense'],
    ['APPLE.COM/CORK ZAF FEE-POS DECLINED INSUFF FUNDS','fees','expense'],
    ['COUNTERPARTY RENT IB PAYMENT TO','housing','expense'],
    ['COUNTERPARTY PETROL IB PAYMENT TO','transport','expense'],
    ['[redacted number] VALUE LOADED TO VIRTUAL CARD','card-load','transfer'],
    ['CAPFIN DEBIT CHECK','personal-loan','debt-payment']
  ];
  for (const [description,category,kind] of samples){
    const got=inspect(description);
    assert.ok(got,'No suggestion for synthetic example: '+description);
    assert.equal(got.category,category,description);
    assert.equal(got.kind,kind,description);
    assert.ok(got.reason.length>15,description);
  }
});
test('PayShap/ACH/SEPA rails, failed purchases and disputed fees do not invent a category',()=>{
  for(const description of [
    'TRANSFER PAYSHAP PAYMENT TO',
    'PAYSHAP PAYMENT',
    'SEPA TRANSFER',
    'ACH PAYMENT',
    'CARD POS DECLINED INSUFF FUNDS',
    'REFUND FEE-ELECTRONIC ACCOUNT PAYMENT',
    'REVERSAL FEE POS DECLINED INSUFF FUNDS',
    'PENDING FEE POS DECLINED INSUFF FUNDS',
    'ABSA VF MANDATE APPROVED',
    'UNKNOWN VIRTUAL CARD PURCHASE'
  ]) assert.equal(inspect(description),undefined,description);
});
test('region guard avoids assuming ABSA VF debt outside the ZA setting',()=>{
  assert.equal(inspect('ABSA VF [masked account] DEBICHECK DEBIT ORDER','ZA')?.category,'car');
  assert.equal(inspect('ABSA VF [masked account] DEBICHECK DEBIT ORDER','GB'),undefined);
  assert.equal(inspect('CAPFIN DEBIT CHECK','ZA')?.category,'personal-loan');
  assert.equal(inspect('CAPFIN DEBIT CHECK','US'),undefined);
});
test('approving screenshot corrections changes categories but never saved dates, amounts or provenance',()=>{
  const before=[
    item('car','ABSA VF [masked account] DEBICHECK DEBIT ORDER'),
    item('rent','COUNTERPARTY RENT IB PAYMENT TO'),
    item('fee','APPLE.COM/CORK ZAF FEE-POS DECLINED INSUFF FUNDS'),
    item('load','[redacted number] VALUE LOADED TO VIRTUAL CARD'),
    item('unknown','TRANSFER PAYSHAP PAYMENT TO')
  ];
  const proposed=scanSavedCategories(before,'ZA').proposals;
  assert.equal(proposed.length,4);
  assert.equal(scanSavedCategories(before,'ZA').unresolved,1);
  const oldCycle=cycleAnalysis(before,'2026-04-26','ZAR');
  const updated=applySavedCategoryChanges(before,proposed,'ZA');
  const newCycle=cycleAnalysis(updated,'2026-04-26','ZAR');
  for(let i=0;i<before.length;i++){
    assert.equal(updated[i].id,before[i].id);
    assert.equal(updated[i].amount,before[i].amount);
    assert.equal(updated[i].date,before[i].date);
    assert.equal(updated[i].recordedAt,before[i].recordedAt);
    assert.equal(updated[i].currency,before[i].currency);
    assert.equal(updated[i].paidVia,before[i].paidVia);
    assert.equal(updated[i].note,before[i].note);
  }
  assert.equal(updated.at(-1).category,'other');
  assert.equal(updated.at(-1).kind,'expense');
  assert.equal(oldCycle.count,newCycle.count);
  assert.equal(newCycle.income,oldCycle.income);
  assert.equal(newCycle.outflow+newCycle.transfers,
    oldCycle.outflow+oldCycle.transfers,'no amount disappears from all movements');
  assert.equal(scanSavedCategories(updated,'ZA').proposals.length,0);
  assert.equal(allowedSavedCategory('transfer','card-load'),true);
  assert.ok(EXPENSE_CATEGORIES.some(x=>x.value==='card-load'));
});
test('the financial ledger is immutable until explicit review approval',()=>{
  const row=item('loan','ABSA VF [masked account] DEBICHECK DEBIT ORDER');
  const original=JSON.stringify(row);
  const suggestion=scanSavedCategories([row],'ZA').proposals[0];
  assert.equal(row.kind,'expense');
  assert.equal(row.category,'other');
  assert.equal(JSON.stringify(row),original);
  const updated=applySavedCategoryChanges([row],[suggestion],'ZA');
  assert.equal(updated[0].kind,'debt-payment');
  assert.equal(row.kind,'expense');
  const tampered={...suggestion,amount:suggestion.amount+100};
  assert.throws(()=>applySavedCategoryChanges([row],[tampered],'ZA'),/changed/);
});
