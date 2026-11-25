import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {documentReconciliation,assertDocumentApprovalDates} from '../artifacts/market-compass/src/lib/documentReconciliation.ts';
import {preparedDocumentReview} from '../artifacts/market-compass/src/lib/reviewSuggestions.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

const when=new Date('2026-11-25T12:00:00.000Z');
let serial=0;
const doc=(rows)=>{
  const id='f4b94a34-cc81-4aa2-a5da-'+String(++serial).padStart(12,'0');
  return extractLocalFinanceDocument('statement.csv',
    'Date,Description,Debit,Credit\n'+rows.join('\n'),
    'Synthetic statement for reconciliation',{id,now:when});
};
const saved=(id,date,description,amount,category='groceries',account)=>({
  id,date,description,amount,category,debtAccountId:account,
  kind:'expense',currency:'ZAR',paidVia:'Owner-reviewed document',
  recordedAt:when.toISOString()
});
const review=(source,entries=[],today='2026-11-25')=>
  documentReconciliation(source,entries,'ZAR','ZA',today);

test('clean historical rows can be prepared, but the source remains unchanged',()=>{
  const source=doc(['20/11/2026,Synthetic groceries,225.00,',
                    '21/11/2026,Synthetic fuel,80.00,']);
  const before=JSON.stringify(source);
  const status=review(source);
  assert.equal(status.pendingReviewable,2);
  assert.equal(status.bulkSafeCount,2);
  assert.ok(status.findings.every(x=>x.bulkSafe));
  assert.equal(JSON.stringify(source),before);
});
test('identical movement repeated inside a single file requires individual review',()=>{
  const source=doc(['20/11/2026,Synthetic fuel,80.00,',
                    '20/11/2026,Synthetic fuel,80.00,']);
  const report=review(source);
  assert.equal(report.repeatedInFile,2);
  assert.equal(report.bulkSafeCount,0);
  assert.deepEqual(report.findings.map(x=>x.repeatedInFile),[true,true]);
});
test('matching approved entries from other files are warnings, not deletions',()=>{
  const source=doc(['20/11/2026,Synthetic groceries,225.00,']);
  const records=Object.freeze([Object.freeze(saved('prior','2026-11-20','SYNTHETIC GROCERIES',225))]);
  const report=review(source,records);
  assert.equal(report.matchesApproved,1);
  assert.equal(report.bulkSafeCount,0);
  assert.equal(records.length,1);
  assert.equal(source.lines.length,1);
});
test('dated rows outside explicit source period cannot enter bulk selection',()=>{
  const source={...doc(['02/11/2026,Synthetic groceries,225.00,']),
    timeContext:{from:'2026-10-01',to:'2026-10-31',asOf:null,basis:'explicit-period'}};
  const report=review(source);
  assert.equal(report.outsideReportingPeriod,1);
  assert.equal(report.bulkSafeCount,0);
  assert.equal(source.lines[0].date,'2026-11-02');
  // The source period dates the document, never its individual payment rows.
});
test('future-dated source movements cannot be bulk-selected or posted as historical',()=>{
  const source=doc(['02/12/2026,Synthetic groceries,225.00,']);
  const report=review(source);
  assert.equal(report.futureDated,1);
  assert.equal(report.bulkSafeCount,0);
  const choice={lineIndex:0,...preparedDocumentReview(source,0)};
  assert.throws(()=>assertDocumentApprovalDates(source,[choice],when),
    /Future-dated transactions/);
});
test('consistent older category that conflicts with new suggestion needs approval',()=>{
  const source=doc(['20/11/2026,Synthetic rent payment,225.00,']);
  const records=[
    saved('prior-1','2026-10-20','Synthetic rent payment',225,'transport'),
    saved('prior-2','2026-09-20','Synthetic rent payment',225,'transport')
  ];
  const report=review(source,records);
  assert.equal(report.categoryConflicts,1);
  assert.equal(report.bulkSafeCount,0);
  assert.equal(report.findings[0].categoryConflict?.category,'transport');
  assert.equal(records[0].category,'transport');
});
test('one-off merchant category is not learned as a permanent rule',()=>{
  const source=doc(['20/11/2026,Synthetic rent payment,225.00,']);
  const prior=[saved('single','2026-10-20','Synthetic rent payment',225,'transport')];
  assert.equal(review(source,prior).categoryConflicts,0);
  assert.equal(review(source,prior).bulkSafeCount,1);
});
test('approval preserves source date and does not alter the original evidence',()=>{
  const source=doc(['20/11/2026,Synthetic groceries,225.00,']);
  const good={lineIndex:0,...preparedDocumentReview(source,0)};
  assert.throws(()=>assertDocumentApprovalDates(source,[
    {...good,date:'2026-10-20'}],when),/source transaction date must be preserved/);
  assert.doesNotThrow(()=>assertDocumentApprovalDates(source,[good],when));
  const result=applyReviewedDocumentToLedger(source,[],[good],'ZAR',when);
  assert.equal(result[0].date,'2026-11-20');
  assert.equal(source.lines[0].date,'2026-11-20');
});
test('reviewer excludes flagged rows from BOTH bulk shortcuts and confirms overrides',()=>{
  const code=readFileSync(new URL('../artifacts/market-compass/src/components/ReviewedDocumentLedger.tsx',import.meta.url),'utf8');
  assert.match(code,/risks\[item\.index\]\?\.bulkSafe===true/);
  assert.match(code,/risks\[index\]\?\.bulkSafe===true/);
  assert.match(code,/clearFlaggedSelections/);
  assert.match(code,/!manualRisks\.length|manualRisks\.length>0/);
  assert.match(code,/ADDITIONAL RECONCILIATION REVIEW/);
  assert.match(code,/assertDocumentApprovalDates\(document,decisions\)/);
  assert.match(code,/window\.confirm/);
  assert.doesNotMatch(code,/fetch\(|sendBeacon\(/);
});
