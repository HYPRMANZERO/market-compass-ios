import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Home dashboard reads the same encrypted workspace data used by Spend and Debt',async()=>{
  const app=await read('App.tsx');
  assert.match(app,/import HomeFinancialEvidence from/);
  assert.match(app,/<HomeFinancialEvidence documents=\{data\.localFinanceDocuments/);
  assert.match(app,/entries=\{data\.expenseEntries/);
  assert.match(app,/accounts=\{data\.accounts/);
  assert.match(app,/budget=\{data\.privateBudget/);
});

test('financial evidence shows saved documents and approved salary-cycle entries separately',async()=>{
  const s=await read('components/HomeFinancialEvidence.tsx');
  assert.match(s,/Saved document evidence/);
  assert.match(s,/Approved transactions/);
  assert.match(s,/cycleAnalysis\(safeEntries,cycle\.start/);
  assert.match(s,/Imported \{d\.importedAt/);
  assert.match(s,/line\.date\?\?'Undated'/);
  assert.match(s,/nothing here is a live bank balance/i);
  assert.match(s,/NOT a verified current debt balance/);
  assert.match(s,/Documents only affect the transaction totals after you approve/);
  assert.doesNotMatch(s,/fetch\(|sendBeacon\(|onApply\(|setData\(/);
});

test('Home avoids interpreting unknown transaction or budget entries as actual zero',async()=>{
  const s=await read('components/HomeFinancialEvidence.tsx');
  assert.match(s,/hasRecordedIncome\?money\(stats\.income,currency\):'Not recorded'/);
  assert.match(s,/hasRecordedOutflow\?money\(stats\.expenses\+stats\.debtPayments,currency\):'Not recorded'/);
  assert.match(s,/Missing entries are not assumed to be zero/);
  assert.match(s,/hasAmount\(f\.value\)/);
});
