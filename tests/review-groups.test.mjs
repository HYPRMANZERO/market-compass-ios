import test from 'node:test';
import assert from 'node:assert/strict';
import {groupedDocumentReview} from '../artifacts/market-compass/src/lib/reviewGroups.ts';
const doc=(id,importedAt,needsReview,approved=0)=>({id,label:id,format:'pdf',importedAt,needsReview,approved,reviewable:needsReview+approved,undated:0,referenceOnly:0,otherCurrencyUnverified:true});
test('Documents group by import month only, with exact review totals',()=>{
  const source=[doc('a','2026-11-01T11:00:00Z',3,1),doc('b','2026-10-30T11:00:00Z',0,1),doc('c','2026-11-09T11:00:00Z',4,0)];
  const previous=JSON.stringify(source);
  const groups=groupedDocumentReview(source);
  assert.deepEqual(groups.map(x=>[x.month,x.needsReview,x.approved]),[['2026-11',7,1],['2026-10',0,1]]);
  assert.equal(JSON.stringify(source),previous);
});
