import test from 'node:test';
import assert from 'node:assert/strict';
import {groupedDocumentReview} from '../artifacts/market-compass/src/lib/reviewGroups.ts';
import {reviewInbox} from '../artifacts/market-compass/src/lib/reviewInbox.ts';
const doc=(id,importedAt,needsReview,approved=0)=>({id,label:id,format:'pdf',importedAt,
  needsReview,approved,reviewable:needsReview+approved,undated:0,referenceOnly:0,
  otherCurrencyUnverified:true});

test('Undated legacy documents retain a visibly labelled import-month fallback',()=>{
  const source=[doc('a','2026-11-01T11:00:00Z',3,1),doc('b','2026-10-30T11:00:00Z',0,1),
    doc('c','2026-11-09T11:00:00Z',4,0)];
  const previous=JSON.stringify(source);
  const groups=groupedDocumentReview(source);
  assert.deepEqual(groups.map(x=>[x.month,x.needsReview,x.approved]),
    [['Imported 2026-11',7,1],['Imported 2026-10',0,1]]);
  assert.equal(JSON.stringify(source),previous);
});

test('Source-dated statements group by reporting period rather than upload date',()=>{
  const statements=[
    {...doc('statement-a','2026-11-23T10:00:00Z',6,2),
      timeContext:{from:'2026-09-26',to:'2026-10-25',asOf:null,basis:'explicit-period'}},
    {...doc('statement-b','2026-11-22T10:00:00Z',4,1),
      timeContext:{from:'2026-09-26',to:'2026-10-25',asOf:null,basis:'dated-rows'}},
    {...doc('balance','2026-11-23T10:00:00Z',0,0),
      timeContext:{from:null,to:null,asOf:'2026-11-20',basis:'explicit-as-of'}},
    doc('undated','2026-11-21T10:00:00Z',1,0)
  ];
  const groups=groupedDocumentReview(statements);
  assert.equal(groups[0].month,'2026-09 to 2026-10');
  assert.equal(groups[0].basis,'source-period');
  assert.equal(groups[0].needsReview,10);
  assert.equal(groups[0].approved,3);
  assert.equal(groups[0].documents.length,2);
  assert.equal(groups[1].month,'As of 2026-11');
  assert.equal(groups[2].month,'Imported 2026-11');
});

test('unmodified document parser can group real extracted dated rows without new schema',()=>{
 const document={id:'dated-source',label:'Synthetic statement',format:'csv',
   importedAt:'2026-11-23T10:00:00Z',lines:[
     {label:'Groceries',amount:95.12,date:'2026-09-26',semanticRole:'transaction',direction:'outgoing'},
     {label:'Utility',amount:51.04,date:'2026-10-25',semanticRole:'transaction',direction:'outgoing'}
   ]};
 const inbox=reviewInbox([document],[]);
 const groups=groupedDocumentReview(inbox.items);
 assert.equal(groups.length,1);
 assert.equal(groups[0].month,'2026-09 to 2026-10');
 assert.equal(groups[0].basis,'source-period');
 assert.equal(groups[0].needsReview,2);
});
test('Invalid source date evidence is not trusted as a reporting period',()=>{
  const groups=groupedDocumentReview([
    {...doc('invalid','2026-11-04T00:00:00Z',2),
      timeContext:{from:'2026-02-30',to:'2026-03-15',asOf:null,basis:'explicit-period'}}
  ]);
  assert.equal(groups[0].basis,'imported');
});
