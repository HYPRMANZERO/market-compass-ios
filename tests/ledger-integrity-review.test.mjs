import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvedLedgerIntegrity,matchingApprovedEntriesForDocumentLine}
  from '../artifacts/market-compass/src/lib/ledgerIntegrity.ts';

const entry=(id,date,amount,description,kind='expense',extras={})=>({
  id,date,amount,description,kind,currency:'ZAR',category:'groceries',
  paidVia:'Manual entry',recordedAt:'2026-11-25T08:00:00Z',...extras
});
test('identical records from separate documents are flagged but never modified',()=>{
  const a=entry('doc-one-1','2026-11-03',275.20,'Checkers Hyper','expense',{paidVia:'Owner-reviewed document'});
  const b=entry('doc-two-5','2026-11-03',275.20,'CHECKERS-HYPER','expense',{paidVia:'Owner-reviewed document'});
  const saved=Object.freeze([Object.freeze(a),Object.freeze(b)]);
  const audit=approvedLedgerIntegrity(saved,'ZAR');
  assert.equal(audit.possibleDuplicates.length,1);
  assert.equal(audit.possibleDuplicates[0].count,2);
  assert.equal(audit.approvedCount,2);
  assert.equal(audit.importedCount,2);
  assert.equal(saved.length,2);
});
test('different dates, amounts or bank accounts are not silently conflated',()=>{
  const rows=[
    entry('1','2026-11-02',80,'Same merchant','expense',{debtAccountId:'a'}),
    entry('2','2026-11-02',80,'Same merchant','expense',{debtAccountId:'b'}),
    entry('3','2026-11-03',80,'Same merchant'),
    entry('4','2026-11-02',80.01,'Same merchant'),
    entry('5','2026-11-02',80,'Same merchant','income')
  ];
  assert.equal(approvedLedgerIntegrity(rows,'ZAR').possibleDuplicates.length,0);
});
test('a matching second account cannot conceal a repeated entry within the first account',()=>{
  const rows=[
    entry('a1','2026-11-02',80,'Same merchant','expense',{debtAccountId:'account-a'}),
    entry('a2','2026-11-02',80,'Same merchant','expense',{debtAccountId:'account-a'}),
    entry('b1','2026-11-02',80,'Same merchant','expense',{debtAccountId:'account-b'})
  ];
  const report=approvedLedgerIntegrity(rows,'ZAR');
  assert.equal(report.approvedCount,3);
  assert.deepEqual(report.possibleDuplicates.map(g=>g.count),[2]);
  assert.doesNotMatch(JSON.stringify(report),/account-[ab]/);
});
test('two independent within-account repeat groups stay separate',()=>{
  const rows=['a','b'].flatMap(account=>[1,2].map(i=>
    entry(account+i,'2026-11-02',80,'Same merchant','expense',{debtAccountId:account})));
  assert.deepEqual(approvedLedgerIntegrity(rows,'ZAR').possibleDuplicates.map(g=>g.count),[2,2]);
});
test('unknown account provenance is warning-only, not an automatic merge',()=>{
  const rows=[entry('a','2026-11-02',80,'Petrol station'),
    entry('b','2026-11-02',80,'PETROL STATION','expense',{debtAccountId:'linked'})];
  assert.equal(approvedLedgerIntegrity(rows,'ZAR').possibleDuplicates.length,1);
});
test('invalid and foreign-currency records cannot pollute saved ZAR totals',()=>{
  const rows=[
    entry('a','2026-02-30',10,'Fake date'),
    entry('b','2026-11-01',20,'USD record','expense',{currency:'USD'}),
    entry('c','2026-11-04',40,'Fuel debit','expense',{category:'unsorted'})
  ];
  const result=approvedLedgerIntegrity(rows,'ZAR');
  assert.equal(result.invalidRecordCount,1);
  assert.equal(result.otherCurrencyCount,1);
  assert.equal(result.unsortedCount,1);
  assert.equal(result.latestRecordDate,'2026-11-04');
});
test('a new statement excerpt warns when an approved row with the same source fact exists',()=>{
  const line={label:'CHECKERS HYPER',date:'2026-11-03',amount:275.2,direction:'outgoing'};
  const existing=[entry('doc-one-1','2026-11-03',275.20,'Checkers Hyper')];
  assert.equal(matchingApprovedEntriesForDocumentLine(line,existing,'ZAR').length,1);
  assert.equal(matchingApprovedEntriesForDocumentLine({...line,direction:'incoming'},existing,'ZAR').length,0);
  assert.equal(matchingApprovedEntriesForDocumentLine({...line,date:null},existing,'ZAR').length,0);
});
test('integrity hints stay visible but do not trigger automatic posting or deletion',()=>{
  const review=readFileSync(new URL('../artifacts/market-compass/src/components/ReviewedDocumentLedger.tsx',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../artifacts/market-compass/src/components/LedgerIntegrityPanel.tsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(review,/matchingApprovedEntriesForDocumentLine/);
  assert.match(review,/possible duplicate/i);
  assert.match(panel,/Nothing is merged, hidden or removed automatically/);
  assert.match(app,/<LedgerIntegrityPanel entries={ledger}/);
  assert.ok(!['onApply','onDelete','localStorage','fetch('].some(term=>panel.includes(term)));
});
