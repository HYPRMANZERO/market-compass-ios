import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountLinkedEvidence} from '../artifacts/market-compass/src/lib/accountLinkedEvidence.ts';

const entry=(id,date,account='account-a',currency='ZAR',amount=150)=>({
  id,date,debtAccountId:account,currency,amount,
  recordedAt:'2026-11-25T12:00:00Z',
  description:'Synthetic repayment',kind:'debt-payment',
  category:'car',paidVia:'Owner-reviewed document'
});

test('latest historical transaction is not a live or reconciled balance date',()=>{
  const rows=Object.freeze([
    Object.freeze(entry('older','2026-10-25')),
    Object.freeze(entry('newer','2026-11-22')),
    Object.freeze(entry('future','2026-12-01'))
  ]);
  const result=accountLinkedEvidence(rows,'account-a','ZAR','2026-11-25');
  assert.equal(result.latestTransactionDay,'2026-11-22');
  assert.equal(result.approvedLinkedCount,2);
  assert.equal(result.futureDatedCount,1);
  assert.deepEqual(result.recentEntries.map(x=>x.id),['newer','older']);
  assert.equal(rows.length,3,'source entries remain immutable');
});

test('valid dates are calendar-real, future entries do not appear as latest',()=>{
  const result=accountLinkedEvidence([
    entry('invalid-day','2026-02-30'),
    entry('no-day',''),
    entry('bad-amount','2026-11-20','account-a','ZAR',NaN),
    entry('ok','2026-09-19')
  ],'account-a','ZAR','2026-11-25');
  assert.equal(result.invalidDatedCount,3);
  assert.equal(result.latestTransactionDay,'2026-09-19');
  assert.deepEqual(result.recentEntries.map(x=>x.id),['ok']);
});

test('account and currency isolation excludes unrelated evidence',()=>{
  const result=accountLinkedEvidence([
    entry('other-account','2026-11-24','account-b'),
    entry('other-currency','2026-11-24','account-a','USD'),
    entry('same-account','2026-11-20')
  ],'account-a','ZAR','2026-11-25');
  assert.equal(result.approvedLinkedCount,1);
  assert.equal(result.otherCurrencyCount,1);
  assert.equal(result.latestTransactionDay,'2026-11-20');
  assert.equal(accountLinkedEvidence([], 'account-a','ZAR','2026-11-25').latestTransactionDay,null);
});

test('history shows five latest eligible rows without de-duplicating legitimate payments',()=>{
  const rows=Array.from({length:8},(_,i)=>entry('payment-'+i,'2026-11-'+String(i+10).padStart(2,'0')));
  const result=accountLinkedEvidence(rows,'account-a','ZAR','2026-11-25');
  assert.equal(result.approvedLinkedCount,8);
  assert.equal(result.recentEntries.length,5);
  assert.equal(result.recentEntries[0].id,'payment-7');
});

test('account cards label balance provenance and warnings; helper has no writes or fetches',()=>{
  const source=readFileSync(new URL('../artifacts/market-compass/src/components/MobileOverview.tsx',import.meta.url),'utf8');
  const helper=readFileSync(new URL('../artifacts/market-compass/src/lib/accountLinkedEvidence.ts',import.meta.url),'utf8');
  assert.match(source,/accountLinkedEvidence\(entries,account.id,currency,localDate\(\)\)/);
  assert.match(source,/owner-entered planning figure/);
  assert.match(source,/Latest linked transaction/);
  assert.match(source,/future-dated/);
  assert.match(source,/not a live bank feed/i);
  assert.doesNotMatch(helper, /fetch\(|setItem\(|writeVault\(|setData\(/);
});
