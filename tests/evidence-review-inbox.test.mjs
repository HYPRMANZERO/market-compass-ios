import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reviewInbox,isReviewableLine} from '../artifacts/market-compass/src/lib/reviewInbox.ts';

const doc=(id,lines,other={})=>({
 id,label:'TEST STATEMENT '+id,importedAt:'2026-11-22T10:00:00Z',
 source:'owner-selected-iphone-file',format:'csv',bankVerified:false,
 complete:false,truncated:false,lines,...other
});
const line=(label,amount,date,semanticRole='transaction')=>({
 label,amount,date,direction:'unclassified',semanticRole
});
const posted=(id)=>({
 id,date:'2026-11-21',recordedAt:'2026-11-22T12:00:00Z',
 kind:'expense',category:'groceries',description:'Synthetic expense',
 paidVia:'Owner-reviewed document',amount:55,currency:'ZAR'
});

test('review inbox counts only owner-reviewed document rows without ledger mutation',()=>{
 const documents=[doc('abc',[
  line('GROCERY PURCHASE',-55,'2026-11-21'),
  line('FUEL PURCHASE',-20,'2026-11-20'),
  line('PAYMENT DATE UNKNOWN',-10,null),
  line('AVAILABLE BALANCE',1234,'2026-11-21','balance-reference'),
  line('INTEREST RATE',12,null,'rate-reference'),
 ])];
 const approved=[posted('doc-abc-0')];
 const snapshot=JSON.stringify({documents,approved});
 const queue=reviewInbox(documents,approved);
 assert.deepEqual([queue.documents,queue.reviewable,queue.approved,queue.needsReview,queue.undated,queue.referenceOnly],
  [1,3,1,2,1,2]);
 assert.equal(queue.items[0].needsReview,2);
 assert.equal(JSON.stringify({documents,approved}),snapshot,'read-only selectors cannot mutate the encrypted ledger');
});

test('review inbox distinguishes reference and legacy bank PDF rows from dated payments',()=>{
 const pdf=doc('old',[
  line('FEE MAYBE',-12,null,'transaction'),
  line('FEE DATED',-12,'2026-11-21','transaction'),
  line('LOAN SETTLEMENT QUOTE',500,'2026-11-21','contract-term')
 ],{format:'pdf',accountProfile:{category:'bank-statement'}});
 const q=reviewInbox([pdf],[]);
 assert.equal(q.reviewable,1);
 assert.equal(q.referenceOnly,2);
 assert.equal(q.items[0].needsReview,1);
 assert.equal(isReviewableLine(pdf,pdf.lines[0]),false);
});

test('amounts and malformed dates are never silently upgraded into approved payments',()=>{
 const document=doc('missing',[
  line('UNKNOWN AMOUNT',null,'2026-11-21'),
  line('ZERO AMOUNT',0,'2026-11-21'),
  line('INVALID DATE',15,'2026-02-30'),
  line('DEBIT TO CHECK',25,'2026-11-22','transaction')
 ]);
 const q=reviewInbox([document],[]);
 assert.equal(q.referenceOnly,2);
 assert.equal(q.needsReview,2);
 assert.equal(q.undated,1);
 assert.equal(q.approved,0);
});

test('queue preserves legitimate identical transactions in different source rows',()=>{
 const q=reviewInbox([doc('repeated',[
  line('CARD FEE',-7,'2026-11-21'),
  line('CARD FEE',-7,'2026-11-21')
 ])],[posted('doc-repeated-0')]);
 assert.equal(q.reviewable,2);
 assert.equal(q.approved,1);
 assert.equal(q.needsReview,1,'a matchHint is not a unique transaction identity');
});

test('review by document is sorted safely; no fake current balance or direct bank feed',async()=>{
 const q=reviewInbox([
  doc('a',[line('FIRST',-2,'2026-11-21')],{importedAt:'2026-11-01T08:00:00Z'}),
  doc('b',[line('SECOND',-3,'2026-11-21'),line('THIRD',-4,'2026-11-22')])
 ],[]);
 assert.deepEqual(q.items.map(x=>x.id),['b','a']);
 const ui=await readFile(new URL('../artifacts/market-compass/src/components/EvidenceReviewInbox.tsx',import.meta.url),'utf8');
 assert.match(ui,/Needs review/);
 assert.match(ui,/Review by document/);
 assert.match(ui,/maskDocumentPII\(doc\.label\)/);
 assert.match(ui,/Only the Spend reviewer can add transactions/);
 assert.match(ui,/href="\/expenses"/);
 assert.doesNotMatch(ui,/fetch\(|localStorage|setData\(/);
 const home=await readFile(new URL('../artifacts/market-compass/src/components/MobileOverview.tsx',import.meta.url),'utf8');
 assert.match(home,/<EvidenceReviewInbox documents=\{documents\} entries=\{entries\}/);
});
