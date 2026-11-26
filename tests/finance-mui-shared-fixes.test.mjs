import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recurringDisplayLabel} from '../artifacts/market-compass/src/lib/historicalRecurring.ts';
test('recurring labels collapse only exact repeated multiword descriptions',()=>{
  assert.equal(recurringDisplayLabel('Debit Order Debit Order'),'Debit Order');
  assert.equal(recurringDisplayLabel('Bank Fee bank fee'),'Bank Fee');
  assert.equal(recurringDisplayLabel('Bank Fee Monthly'),'Bank Fee Monthly');
  assert.equal(recurringDisplayLabel('Fee Fee'),'Fee Fee');
});
test('vault owns locked safe-area backing and recurring rows use display cleanup',()=>{
  const css=readFileSync(new URL('../artifacts/market-compass/src/finance-v2.css',import.meta.url),'utf8');
  const view=readFileSync(new URL('../artifacts/market-compass/src/components/HistoricalRecurringInsights.tsx',import.meta.url),'utf8');
  assert.ok(css.includes('html:has(.mc-vault-entry) #root'));
  assert.ok(view.includes('recurringDisplayLabel(p.description)'));
  assert.ok(view.includes('Historical observation'));
});
