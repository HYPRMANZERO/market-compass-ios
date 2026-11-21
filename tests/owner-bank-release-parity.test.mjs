import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeReadOnlyBankRows,normalizeStatementCandidates}
  from '../artifacts/market-compass/src/lib/financialSourceNormalizer.ts';
const read=p=>readFile(new URL('../artifacts/market-compass/src/'+p,import.meta.url),'utf8');

test('original owner Home retains prior mobile dashboard and exposes private file import + account evidence',async()=>{
  const s=await read('App.tsx');
  const home=s.slice(s.indexOf('function Overview('),s.indexOf('function Metric('));
  assert.match(home,/Upload financial documents/);
  assert.match(home,/<LocalFinanceFiles documents=\{docs\}/);
  assert.match(home,/<MobileOverview/);
  assert.match(home,/<HomeFinancialEvidence/);
  assert.match(home,/<AccountEvidenceReview/);
  assert.match(home,/<HistoricalRecurringInsights/);
  assert.match(s,/<Route path="\/"><Overview data=\{data\} setData=\{setData\}/);
});

test('original PWA and private edition use one standard record shape for old statements and future bank feeds',()=>{
  const pdf=normalizeStatementCandidates('02 Sep 26 SERVICE FEE -12.00 100.00',
    'bank-statement-pdf','ABSA','ABSA Current');
  const api=normalizeReadOnlyBankRows([{date:'2026-09-02',
    description:'SERVICE FEE',amount:-12,runningBalance:100,currency:'ZAR',
    status:'posted'}],'ABSA','ABSA Current');
  assert.deepEqual(pdf.candidates.map(x=>[x.date,x.amount,x.runningBalance,x.approval]),
    api.candidates.map(x=>[x.date,x.amount,x.runningBalance,x.approval]));
});

test('owner version never posts unverified statement balances automatically or calls the bank in input layer',async()=>{
  const source=await read('lib/financialSourceNormalizer.ts');
  const doc=await read('lib/localFinanceDocs.ts');
  const ui=await read('components/AccountEvidenceReview.tsx');
  assert.match(source,/pending-owner-review/);
  assert.match(doc,/runningBalance/);
  assert.match(ui,/Review fields for Debt Plan/);
  assert.match(ui,/owner-confirmed|confirm|checked against an appropriate recent source/i);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|localStorage/);
  assert.doesNotMatch(ui,/fetch\(|XMLHttpRequest|sendBeacon|localStorage/);
});
