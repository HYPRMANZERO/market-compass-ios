import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {
  applyReviewedDocumentToLedger,documentLedgerEntryId,documentAppliedIndices,
  allowedDocumentCategories,suggestDocumentClassification
} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';
import {cycleAnalysis} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';

const now=new Date('2026-11-21T12:00:00Z');
const id='f4b94a34-cc81-4aa2-a5da-b8fb1f0da3f5';
const doc=extractLocalFinanceDocument(
  'synthetic.csv',
  'Date;Description;Debit;Credit\n12/09/2026;Synthetic groceries;345,60;\n12/09/2026;Synthetic salary;;7125,10',
  'Synthetic reviewed bank export',{now,id}
);
const decisions=[
  {lineIndex:0,date:'2026-09-12',kind:'expense',category:'groceries'},
  {lineIndex:1,date:'2026-09-12',kind:'income',category:'salary'}
];

test('saving a financial excerpt does NOT change the Spend ledger automatically',()=>{
 assert.equal(doc.lines.length,2);
 assert.equal(doc.bankVerified,false);
 assert.equal(doc.complete,false);
 assert.deepEqual(documentAppliedIndices(doc,[]),new Set());
});

test('only individually approved, reviewed choices update dated Spend totals',()=>{
 const records=applyReviewedDocumentToLedger(doc,[],decisions,'ZAR',now);
 assert.equal(records.length,2);
 assert.equal(records[0].amount,345.60);
 assert.equal(records[0].kind,'expense');
 assert.equal(records[1].amount,7125.10);
 assert.equal(records[1].kind,'income');
 assert.equal(records[0].paidVia,'Owner-reviewed document');
 assert.equal(records[0].id,documentLedgerEntryId(doc.id,0));
 assert.deepEqual([...documentAppliedIndices(doc,records)],[0,1]);
 const sep=cycleAnalysis(records,'2026-08-26','ZAR');
 assert.equal(sep.count,2);
 assert.equal(sep.income,7125.10);
 assert.equal(sep.expenses,345.60);
 assert.equal(sep.recordedDifference,6779.50);
 assert.doesNotMatch(JSON.stringify(records),/password|ciphertext|full.document/i);
});

test('retry, duplicate selection and unreviewed rows fail closed',()=>{
 const once=applyReviewedDocumentToLedger(doc,[],[decisions[0]],'ZAR',now);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,once,[decisions[0]],'ZAR',now),/already added/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[decisions[0],decisions[0]],'ZAR',now),/repeated/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[],'ZAR',now),/Select one or more/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[{
   ...decisions[0],date:''
 }],'ZAR',now),/payment date/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[{
   ...decisions[0],kind:'income',category:'salary'
 }],'ZAR',now),/source-labelled debit/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[{
   ...decisions[0],kind:'expense',category:'salary'
 }],'ZAR',now),/Classify each row/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],decisions,'USD',now),/owner-confirmed ZAR/);
});

test('PDF salary rows require a human date and type; no inferred document balance',()=>{
 const pdf=extractLocalFinanceDocument(
  'synthetic.pdf','Net pay R7,200.00\nInsurance R450.50',
  'Synthetic payslip',{now,id:'f4b94a34-cc81-4aa2-a5da-b8fb1f0da3f6'}
 );
 assert.equal(pdf.lines[0].date,null);
 assert.equal(pdf.lines[0].direction,'unclassified');
 assert.throws(()=>applyReviewedDocumentToLedger(pdf,[],[{
   lineIndex:0,date:'',kind:'income',category:'salary'
 }],'ZAR',now),/payment date/i);
 const entered=applyReviewedDocumentToLedger(pdf,[],[{
   lineIndex:0,date:'2026-11-20',kind:'income',category:'salary'
 }],'ZAR',now);
 assert.equal(entered.length,1);
 assert.equal(entered[0].amount,7200);
 assert.equal(entered[0].kind,'income');
 assert.equal(entered[0].note.includes('not a verified bank balance'),true);
});
test('the iPhone interface offers explicit consent, saved excerpt and Spend integration',async()=>{
 const root=new URL('../artifacts/market-compass/src/',import.meta.url);
 const component=await readFile(new URL('components/ReviewedDocumentLedger.tsx',root),'utf8');
 const imported=await readFile(new URL('components/LocalFinanceFiles.tsx',root),'utf8');
 const app=await readFile(new URL('App.tsx',root),'utf8');
 assert.match(component,/window\.confirm\(/);
 assert.match(component,/source.*direction|direction.*source/i);
 assert.match(component,/applyReviewedDocumentToLedger/);
 assert.match(imported,/<ReviewedDocumentLedger/);
 assert.match(app,/onApplyEntries=\{approved=>setData\(/);
 assert.doesNotMatch(component,/fetch\(|sendBeacon|postMessage\(/);
 assert.deepEqual(allowedDocumentCategories('income'),['salary','side-income','unsorted']);
});

test('unknown descriptions remain Unsorted with optional review and never auto-post',()=>{
 const source=extractLocalFinanceDocument('synthetic.csv',
  'Date;Description;Debit;Credit\n10/11/2026;Unknown merchant code;60,00;\n11/11/2026;MONTHLY BANK FEE;7,00;\n12/11/2026;Unclear deposit;;150,00\n13/11/2026;SALARY;;1000,00',
  'Synthetic four rows',{now,id:'1b2c3d4e-0000-4000-8000-000000000001'});
 assert.equal(source.lines.length,4);
 assert.deepEqual(source.lines.map(line=>suggestDocumentClassification(line)?.category),
  ['unsorted','fees','unsorted','salary']);
 assert.deepEqual(documentAppliedIndices(source,[]),new Set());
 const approved=applyReviewedDocumentToLedger(source,[],[
   {lineIndex:0,date:'2026-11-10',kind:'expense',category:'unsorted'},
   {lineIndex:1,date:'2026-11-11',kind:'expense',category:'fees'},
   {lineIndex:2,date:'2026-11-12',kind:'income',category:'unsorted'}
 ],'ZAR',now);
 const totals=cycleAnalysis(approved,'2026-10-26','ZAR');
 assert.equal(totals.expenses,67);
 assert.equal(totals.income,150);
 assert.equal(totals.unsortedOutflow,60);
 assert.equal(totals.unsortedIncome,150);
 assert.equal(approved.length,3);
 const changed=approved.map(e=>e.category==='unsorted'?{...e,category:'other'}:e);
 assert.equal(cycleAnalysis(changed,'2026-10-26','ZAR').recordedDifference,totals.recordedDifference);
});
