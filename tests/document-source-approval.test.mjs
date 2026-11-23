import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {preparedDocumentReview} from '../artifacts/market-compass/src/lib/reviewSuggestions.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';
const now=new Date('2026-11-23T09:30:00Z');
const id='d11b1111-2222-4333-8444-555566667777';
test('CSV extracts dates after statement period preamble, preserving dates and debit direction',()=>{
 const source='Statement period,01 Oct 2026 to 31 Oct 2026\nAccount,masked source\nDate,Description,Debit,Credit\n27 Oct 26,Synthetic groceries,250.00,\n29 Oct 26,Synthetic salary,,9000.00';
 const doc=extractLocalFinanceDocument('export.csv',source,'Synthetic bank account',{now,id});
 assert.deepEqual(doc.lines.map(x=>[x.date,x.amount,x.direction]),[
 ['2026-10-27',250,'outgoing'],['2026-10-29',9000,'incoming']]);
 assert.equal(doc.timeContext.basis,'explicit-period');
 const prepared=doc.lines.map((_,i)=>({lineIndex:i,...preparedDocumentReview(doc,i)}));
 assert.equal(prepared[0].category,'groceries');
 assert.equal(applyReviewedDocumentToLedger(doc,[],prepared,'ZAR',now).length,2);
});
test('JSON posting date and debit/credit keys are extracted, without inventing transaction times',()=>{
 const json=JSON.stringify({transactions:[
 {description:'Synthetic fuel',postingDate:'2026-10-27',debit:'250.00'},
 {description:'Synthetic salary',valueDate:'2026-10-28',credit:'9000.00'},
 {description:'Unclear both',date:'2026-10-29',debit:'100.00',credit:'100.00'}
 ]});
 const doc=extractLocalFinanceDocument('records.json',json,'Synthetic JSON bank',{now,id});
 assert.equal(doc.lines.length,2);
 assert.deepEqual(doc.lines.map(x=>[x.direction,x.date]),[['outgoing','2026-10-27'],['incoming','2026-10-28']]);
});
test('Undated amounts are retained as document evidence but never posted to an invented day',()=>{
 const doc=extractLocalFinanceDocument('export.csv',
  'Date,Description,Debit,Credit\n,Synthetic groceries,250.00,','Synthetic undated',{now,id});
 assert.equal(doc.lines[0].date,null);
 assert.equal(preparedDocumentReview(doc,0),null);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[
 {lineIndex:0,date:'2026-10-30',kind:'expense',category:'groceries'}],'ZAR',now),/No source transaction date/);
});
