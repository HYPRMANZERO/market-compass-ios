import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cycleAnalysis,cycleEntries} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
const source=readFileSync(new URL('../artifacts/market-compass/src/components/HomeFinancialEvidence.tsx',import.meta.url),'utf8');
const example=(kind,amount,category)=>({id:kind,date:'2026-11-20',recordedAt:'2026-11-20T10:00:00Z',kind,amount,category,currency:'ZAR',description:'Synthetic review',paidVia:'Test'});
test('Home discloses missing income separately from actual outflows',()=>{
  assert.match(source,/cycleEntries\(safeEntries,cycle\.start,currency\)/);
  assert.match(source,/hasRecordedIncome\?money\(stats\.income,currency\):'Not recorded'/);
  assert.match(source,/hasRecordedOutflow\?money\(stats\.expenses\+stats\.debtPayments,currency\):'Not recorded'/);
  assert.doesNotMatch(source,/stats\.count\?money/);
  const ledger=[example('expense',37,'groceries')];
  const rows=cycleEntries(ledger,'2026-10-26','ZAR');
  assert.equal(rows.some(e=>e.kind==='income'),false);
  assert.equal(rows.some(e=>e.kind==='expense'||e.kind==='debt-payment'),true);
  const totals=cycleAnalysis(ledger,'2026-10-26','ZAR');
  assert.equal(totals.income,0);
  assert.equal(totals.expenses,37);
});
test('income-only and transfer-only cycles must not invent spending',()=>{
  const ledger=[example('income',200,'salary'),example('transfer',100,'savings')];
  const rows=cycleEntries(ledger,'2026-10-26','ZAR');
  assert.equal(rows.some(e=>e.kind==='income'),true);
  assert.equal(rows.some(e=>e.kind==='expense'||e.kind==='debt-payment'),false);
  assert.equal(cycleAnalysis(ledger,'2026-10-26','ZAR').expenses,0);
});