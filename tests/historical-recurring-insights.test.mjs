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

test('two dated approved cycles identify recurrence, but source-only quotes do not',async()=>{
  const {recurringPatterns,historicalEvidence}=await import('../artifacts/market-compass/src/lib/historicalRecurring.ts');
  const make=(id,date,amount)=>({
    id,date,recordedAt:date+'T12:00:00Z',kind:'debt-payment',category:'car',
    description:'Vehicle loan monthly instalment',paidVia:'Bank transfer',
    amount,currency:'ZAR',note:'Owner approved'
  });
  const entries=[make('one','2026-08-27',3516.20),make('two','2026-09-28',3543.36)];
  const patterns=recurringPatterns(entries,'ZAR','2026-11-21');
  assert.equal(patterns.length,1);
  assert.equal(patterns[0].observedCycles,2);
  assert.equal(patterns[0].confidence,'repeated');
  assert.equal(patterns[0].typicalAmount,3516.20);
  assert.equal(recurringPatterns(entries.slice(0,1),'ZAR','2026-11-21').length,0);
  assert.equal(recurringPatterns([entries[0],{...entries[1],date:'2026-09-18'}],'ZAR','2026-11-21').length,0);
  const doc={id:'00000000-0000-4000-8000-000000000001',label:'Old contract',
    importedAt:'2026-11-21T00:00:00Z',
    lines:[{date:'2026-06-26',label:'Scheduled installment 3543.36',
      amount:3543.36,direction:'unclassified'}]};
  const coverage=historicalEvidence([doc],[], '2026-11-21');
  assert.equal(coverage.datedLines,1);
  assert.equal(coverage.unapprovedDatedLines,1);
  assert.equal(coverage.approvedHistoricalEntries,0);
  assert.equal(recurringPatterns([], 'ZAR','2026-11-21').length,0);
});
