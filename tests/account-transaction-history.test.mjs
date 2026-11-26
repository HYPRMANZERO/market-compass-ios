import test from 'node:test';
import assert from 'node:assert/strict';
import {accountTransactionHistory} from '../artifacts/market-compass/src/lib/accountTransactionHistory.ts';
const accounts=[{id:'a',name:'Credit'},{id:'b',name:'Loan'}];
const entry=(id,accountId,kind='expense',date='2026-10-30',amount=100)=>({
  id,debtAccountId:accountId,kind,date,amount,currency:'ZAR',recordedAt:'2026-11-01T00:00:00Z',
  category:'other',description:'Synthetic sample',paidVia:'test'
});
test('Only explicit matching account links count, with same currency and valid date',()=>{
  const rows=[entry('a1','a'),entry('b1','b','income','2026-11-02',300),
    entry('stranger','missing'),entry('unlinked',undefined),
    {...entry('foreign','a'),currency:'USD'},
    {...entry('invalid','a'),date:'2026-02-30'}];
  const result=accountTransactionHistory(accounts,rows,'ZAR');
  assert.equal(result.groups[0].entries.length,1);
  assert.equal(result.groups[1].inflow,300);
  assert.equal(result.unlinked.length,2);
});
test('Linking does not mutate or post entries, and transfers are not spending',()=>{
  const rows=[entry('x','a','transfer'),entry('y','a','debt-payment')];
  const prior=JSON.stringify(rows);
  const result=accountTransactionHistory(accounts,rows,'ZAR');
  assert.equal(result.groups[0].outflow,100);
  assert.equal(result.groups[0].entries.length,2);
  assert.equal(JSON.stringify(rows),prior);
});
