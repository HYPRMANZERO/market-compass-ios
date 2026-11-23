import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {
  applyReviewedDocumentToLedger,mergeReviewedDocumentEntries,
  separateRepeatedDocumentChoices
} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

const now=new Date('2026-11-23T08:00:00.000Z');
const first=extractLocalFinanceDocument(
  'synthetic.csv',
  'Date;Description;Debit;Credit\n20/06/2026;Synthetic supermarket;123,45;',
  'Synthetic statement',
  {now,id:'f4b94a34-cc81-4aa2-a5da-b8fb1f0da391'}
);
const second=extractLocalFinanceDocument(
  'synthetic.csv',
  'Date;Description;Debit;Credit\n20/06/2026;Synthetic supermarket;123,45;\n20/06/2026;Synthetic bookshop;123,45;',
  'Another synthetic statement',
  {now,id:'f4b94a34-cc81-4aa2-a5da-b8fb1f0da392'}
);
const one={lineIndex:0,date:'2026-06-20',kind:'expense',category:'groceries'};
const two={lineIndex:1,date:'2026-06-20',kind:'expense',category:'other'};

test('overlapping documents keep suspected duplicate excerpts without auto-posting them',()=>{
  const previous=applyReviewedDocumentToLedger(first,[],[one],'ZAR',now);
  const split=separateRepeatedDocumentChoices(second,previous,[one,two]);
  assert.deepEqual(split.needsReview,[one]);
  assert.deepEqual(split.accepted,[two]);
  const ledger=applyReviewedDocumentToLedger(second,previous,split.accepted,'ZAR',now);
  assert.equal(ledger.length,2);
  assert.equal(ledger[1].description,'Synthetic bookshop');
});
test('same amount and date with a distinct merchant is NOT automatically treated as duplicate',()=>{
  const previous=applyReviewedDocumentToLedger(first,[],[one],'ZAR',now);
  const checked=separateRepeatedDocumentChoices(second,previous,[two]);
  assert.deepEqual(checked.needsReview,[]);
  assert.equal(checked.accepted.length,1);
});
test('recording an approved snapshot never overwrites an intervening manual entry',()=>{
  const snapshot=applyReviewedDocumentToLedger(first,[],[one],'ZAR',now);
  const recent={...snapshot[0],id:'manual-synthetic',description:'Different manual payment'};
  const merged=mergeReviewedDocumentEntries([recent],snapshot);
  assert.equal(merged.length,2);
  assert.equal(merged[0].id,recent.id);
  assert.equal(merged[1].id,snapshot[0].id);
  assert.deepEqual(mergeReviewedDocumentEntries(merged,snapshot),merged);
  assert.throws(()=>mergeReviewedDocumentEntries([], [recent]),/invalid or repeated ID/);
});
test('both Home importer and Spend Activity use the same safe merge and expose portfolio navigation',async()=>{
 const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
 const importer=await readFile(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
 const reviewer=await readFile(new URL('../artifacts/market-compass/src/components/ReviewedDocumentLedger.tsx',import.meta.url),'utf8');
 assert.equal((app.match(/expenseEntries:mergeReviewedDocumentEntries\(/g)||[]).length,3);
 assert.match(app,/ready in your spending portfolio/);
 assert.match(importer,/potentially repeated transaction/);
 assert.match(importer,/separateRepeatedDocumentChoices/);
 assert.match(reviewer,/checkedDuplicates\.needsReview/);
});
