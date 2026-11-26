import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

const now=new Date('2026-11-21T12:00:00Z');
const document=extractLocalFinanceDocument(
  'review.csv','Date,Description,Debit,Credit\n20/11/2026,Synthetic groceries,225.00,\n02/12/2026,Synthetic fuel,90.00,',
  'Synthetic dated review',{now,id:'cfe86439-af29-4e2d-9e22-5ce5908f248a'}
);
const choice=(index,date)=>({lineIndex:index,date,kind:'expense',category:'groceries'});
const valid=choice(0,'2026-11-20');

test('source-derived dates cannot be overwritten at ledger boundary',()=>{
  assert.equal(document.lines[0].date,'2026-11-20');
  assert.throws(()=>applyReviewedDocumentToLedger(document,[],[choice(0,'2026-11-19')],'ZAR',now),/source payment date must be preserved/i);
  assert.throws(()=>applyReviewedDocumentToLedger(document,[],[choice(0,'')],'ZAR',now),/source payment date must be preserved/i);
});

test('future source-dated transactions cannot be marked completed by calling ledger directly',()=>{
  assert.equal(document.lines[1].date,'2026-12-02');
  assert.throws(()=>applyReviewedDocumentToLedger(document,[],[choice(1,'2026-12-02')],'ZAR',now),/Future-dated transactions/i);
  assert.throws(()=>applyReviewedDocumentToLedger(document,[],[choice(1,'2026-11-20')],'ZAR',now),/source payment date must be preserved/i);
});

test('all-or-nothing review retains existing financial entries on any invalid selection',()=>{
  const before=Object.freeze([Object.freeze({
    id:'prior-1',date:'2026-10-28',recordedAt:'2026-11-01T12:00:00.000Z',
    kind:'expense',category:'groceries',description:'Saved owner entry',
    paidVia:'Manual',amount:50,currency:'ZAR'
  })]);
  const snapshot=JSON.stringify(before);
  assert.throws(()=>applyReviewedDocumentToLedger(document,before,[valid,choice(1,'2026-12-02')],'ZAR',now),/Future-dated transactions/i);
  assert.equal(JSON.stringify(before),snapshot);
  assert.equal(before.length,1);
  const approved=applyReviewedDocumentToLedger(document,before,[valid],'ZAR',now);
  assert.equal(approved.length,2);
  assert.equal(before.length,1);
  assert.equal(document.lines[0].date,'2026-11-20');
  assert.equal(approved[1].date,'2026-11-20');
});
