import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cycleAnalysis,validateExpenseEntry} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
const source=readFileSync(new URL('../artifacts/market-compass/src/components/MonthlyExpenses.tsx',import.meta.url),'utf8');
const synthetic={id:'synthetic',recordedAt:'2026-11-20T09:00:00Z',date:'2026-11-20',kind:'expense',category:'unsorted',description:'Unknown merchant',paidVia:'Local review',amount:47,currency:'ZAR'};
test('Finance manual entry starts and resets Unsorted, never silently Groceries',()=>{
  assert.match(source,/const suggestCategory=\(_kind:ExpenseKind\):ExpenseCategory=>'unsorted'/);
  assert.match(source,/useState<ExpenseCategory>\('unsorted'\)/);
  assert.match(source,/setEditingId\(''\);setDate\(today\);setKind\('expense'\);setCategory\('unsorted'\)/);
  assert.doesNotMatch(source,/setCategory\('groceries'\)/);
});
test('Unsorted expense remains accounted for without mutating amount or date',()=>{
  const validated=validateExpenseEntry(synthetic);
  assert.equal(validated.category,'unsorted');
  const result=cycleAnalysis([validated],'2026-10-26','ZAR');
  assert.equal(result.expenses,47);
  assert.equal(result.count,1);
  assert.equal(validated.category,'unsorted');
  assert.equal(validated.amount,47);
  assert.equal(validated.date,'2026-11-20');
});
