import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {documentTimeContext} from '../artifacts/market-compass/src/lib/documentTimeContext.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {preparedDocumentReview} from '../artifacts/market-compass/src/lib/reviewSuggestions.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';
const now=new Date('2026-11-23T09:45:00Z');
const id='b94a4432-5512-4404-aaf1-887746123b11';
test('explicit statement period and as-of date are separate from line transaction dates',()=>{
 const context=documentTimeContext('ABSA BANK STATEMENT\nStatement period: 01 Oct 2026 to 31 Oct 2026\nStatement date: 02 Nov 2026',[
   {date:'2026-10-12'},{date:'2026-10-24'}]);
 assert.deepEqual(context,{from:'2026-10-01',to:'2026-10-31',asOf:'2026-11-02',basis:'explicit-period'});
});
test('reporting month does not date a transaction that has no stated payment day',()=>{
 const context=documentTimeContext('Statement period 01 Oct 2026 to 31 Oct 2026',[{date:null}]);
 assert.equal(context?.basis,'explicit-period');
 const doc=extractLocalFinanceDocument('statement.csv','Date,Description,Debit,Credit\n,Local synthetic fuel,225.50,','Synthetic dated-source test',{id,now});
 assert.equal(doc.lines[0].date,null);
 assert.equal(preparedDocumentReview(doc,0),null);
});
test('bank-export DD MMM YY dates are recognized and debit/credit approvals prepared',()=>{
 const csv='Date,Description,Debit,Credit\n27 Mar 26,Synthetic groceries,345.60,\n27 Mar 26,Synthetic salary,,7125.10\n27 Mar 26,Synthetic refund,,50.00';
 const doc=extractLocalFinanceDocument('export.csv',csv,'Synthetic bank export',{id,now});
 assert.deepEqual(doc.lines.map(x=>x.date),['2026-03-27','2026-03-27','2026-03-27']);
 assert.deepEqual(preparedDocumentReview(doc,0),{
   date:'2026-03-27',kind:'expense',category:'groceries',
   explanation:'Source debit with matching description'
 });
 assert.equal(preparedDocumentReview(doc,1)?.kind,'income');
 assert.equal(preparedDocumentReview(doc,1)?.category,'salary');
 assert.equal(preparedDocumentReview(doc,2),null,'a refund must not become auto-suggested income');
 assert.deepEqual(doc.timeContext,{from:'2026-03-27',to:'2026-03-27',asOf:null,basis:'dated-rows'});
 assert.deepEqual(validateLocalFinanceDocument(doc),doc);
});
test('one owner-approved batch posts source dates and amounts, but source dates cannot be rewritten',()=>{
 const doc=extractLocalFinanceDocument('export.csv','Date,Description,Debit,Credit\n27 Mar 26,Synthetic groceries,345.60,\n27 Mar 26,Synthetic salary,,7125.10','Synthetic source',{id,now});
 const prepared=[0,1].map(i=>({lineIndex:i,...preparedDocumentReview(doc,i)}));
 const entries=applyReviewedDocumentToLedger(doc,[],prepared,'ZAR',now);
 assert.equal(entries.length,2);
 assert.deepEqual(entries.map(x=>[x.date,x.amount,x.kind]),[
   ['2026-03-27',345.6,'expense'],['2026-03-27',7125.1,'income']]);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[{...prepared[0],date:'2026-04-01'}],'ZAR',now),/payment date must match/i);
});
test('historical balance references are excluded from prepared review even if dated',()=>{
 const doc=extractLocalFinanceDocument('statement.pdf',
  'ABSA Bank Statement\nTransaction Date Description Debit Credit Balance\n27 Mar 26 Synthetic payment -7.00 2,622.72\n27 Mar 26 Closing balance R2615.72',
  'Synthetic statement',{id,now});
 assert.equal(preparedDocumentReview(doc,0)?.kind,'expense');
 assert.equal(preparedDocumentReview(doc,1),null);
});
test('prepared review UX does not demand date input for source-dated rows',async()=>{
 const source=await readFile(new URL('../artifacts/market-compass/src/components/ReviewedDocumentLedger.tsx',import.meta.url),'utf8');
 assert.match(source,/Prepare \{prepared\.length\} dated, source-labelled transaction/);
 assert.match(source,/Transaction date extracted from file/);
 assert.match(source,/Source payment date/);
 assert.match(source,/No individual transaction date extracted/);
 assert.match(source,/Review and approve \{prepared.length\} extracted transaction/);
 assert.doesNotMatch(source,/type="date"/);
 assert.match(source,/window\.confirm/);
 assert.doesNotMatch(source,/fetch\(|sendBeacon\(/);
});
