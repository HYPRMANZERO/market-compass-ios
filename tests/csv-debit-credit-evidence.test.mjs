import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';
const now=new Date('2026-11-20T08:00:00Z');
const id='77777777-8888-4999-8888-999999999999';
test('Explicit debit and credit columns are not reversed by generic signed Amount',()=>{
 const text='Date,Description,Amount,Debit,Credit\n2026-10-12,Synthetic fuel,500.00,500.00,\n2026-10-14,Synthetic refund,-100.00,,100.00\n2026-10-15,Conflicting row,40.00,40.00,40.00';
 const document=extractLocalFinanceDocument('statement.csv',text,'Synthetic export',{id,now});
 assert.equal(document.lines.length,2);
 assert.deepEqual(document.lines.map(l=>[l.date,Math.abs(l.amount),l.direction]),[
 ['2026-10-12',500,'outgoing'],['2026-10-14',100,'incoming']]);
 assert.throws(()=>applyReviewedDocumentToLedger(document,[],[{lineIndex:1,date:'2026-10-14',kind:'expense',category:'other'}],'ZAR',now),/source-labelled credit/);
});
test('Generic signed amounts in the public parser retain explicit sign direction',()=>{
 const text='Date,Description,Amount\n2026-11-01,Synthetic fee,-30.00';
 const doc=extractLocalFinanceDocument('export.csv',text,'Synthetic generic',{id,now});
 assert.equal(doc.lines.length,1);
 assert.equal(doc.lines[0].direction,'outgoing');
});
