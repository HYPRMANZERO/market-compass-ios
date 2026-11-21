import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('historical source evidence is distinct from transactions and current balances',async()=>{
  const s=await read('lib/historicalRecurring.ts');
  assert.match(s,/unapprovedDatedLines/);
  assert.match(s,/approvedHistoricalEntries/);
  assert.match(s,/ids\.has\('doc-'\+doc\.id\+'-'\+i\)/);
  assert.match(s,/salaryCycle\(item\.date\)\.start/);
  assert.doesNotMatch(s,/fetch\(|sendBeacon\(|setData\(/);
});
test('recurrence requires approved comparable entries in multiple salary cycles',async()=>{
  const s=await read('lib/historicalRecurring.ts');
  assert.match(s,/if\(byCycle\.size<2\)continue/);
  assert.match(s,/salaryCycle\(e\.date\)\.start/);
  assert.match(s,/if\(amounts\[0\]<median\*0\.5/);
  assert.match(s,/byCycle\.size>=3\?'strong':'repeated'/);
  assert.doesNotMatch(s,/futureEntry|automaticPayment|scheduleTransfer/);
});
test('owner sees historical coverage and recurring signals in Home and Spend Plan',async()=>{
  const app=await read('App.tsx');
  assert.match(app,/import HistoricalRecurringInsights from/);
  assert.match(app,/<HistoricalRecurringInsights documents=\{data\.localFinanceDocuments/);
  assert.match(app,/<HistoricalRecurringInsights documents=\{docs\} entries=\{ledger\}/);
  const ui=await read('components/HistoricalRecurringInsights.tsx');
  assert.match(ui,/Possible recurring transactions/);
  assert.match(ui,/Outstanding balances, interest rates and quoted instalments/);
  assert.match(ui,/at least two separate 26th/);
  assert.match(ui,/not automatically update the ledger/);
  assert.doesNotMatch(ui,/onApply\(|fetch\(|setData\(/);
});
