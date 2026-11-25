import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stablePayeeKey,consistentApprovedPayeeCategory,conflictingApprovedCategory}
  from '../artifacts/market-compass/src/lib/approvedPayeeCategory.ts';

const saved=(id,label,category='groceries',other={})=>({
 id,description:label,category,kind:'expense',currency:'ZAR',
 date:'2026-11-05',amount:75,paidVia:'Manual entry',recordedAt:'2026-11-05T15:30:00Z',...other
});
const examples=[
 saved('a','CHECKERS HYPER','groceries'),saved('b','Checkers-Hyper','groceries')
];
test('two consistent owner-approved categories produce a read-only warning',()=>{
 assert.deepEqual(consistentApprovedPayeeCategory(examples,'Checkers Hyper','expense','ZAR'),
   {category:'groceries',count:2});
 assert.deepEqual(conflictingApprovedCategory(examples,'checkers hyper','expense','ZAR','transport'),
   {category:'groceries',count:2});
 assert.equal(conflictingApprovedCategory(examples,'Checkers Hyper','expense','ZAR','groceries'),null);
});
test('one-off merchant purchase cannot create a learned category rule',()=>{
 assert.equal(consistentApprovedPayeeCategory(examples.slice(0,1),'Checkers Hyper','expense','ZAR'),null);
});
test("mixed approved categories never override the owner selected history",()=>{
 const rows=[...examples,saved('c','CHECKERS HYPER','transport')];
 assert.equal(consistentApprovedPayeeCategory(rows,'CHECKERS HYPER','expense','ZAR'),null);
 assert.equal(conflictingApprovedCategory(rows,'CHECKERS HYPER','expense','ZAR','other'),null);
});
test('currency, transaction type and vague merchant descriptions stay separated',()=>{
 assert.equal(consistentApprovedPayeeCategory(examples,'Checkers Hyper','expense','USD'),null);
 assert.equal(consistentApprovedPayeeCategory(examples,'Checkers Hyper','income','ZAR'),null);
 assert.equal(stablePayeeKey('POS'),null);
 assert.equal(consistentApprovedPayeeCategory([
   saved('a','POS','groceries'),saved('b','POS','groceries')
 ],'POS','expense','ZAR'),null);
});
test('unclassified and other categories do not establish a history preference',()=>{
 const rows=[saved('a','Checkers Hyper','unsorted'),saved('b','Checkers Hyper','other')];
 assert.equal(consistentApprovedPayeeCategory(rows,'Checkers Hyper','expense','ZAR'),null);
});
test('view warns and blocks bulk Prepare instead of silently rewriting old transactions',()=>{
 const src=readFileSync(new URL('../artifacts/market-compass/src/components/ReviewedDocumentLedger.tsx',import.meta.url),'utf8');
 const reconciliation=readFileSync(new URL('../artifacts/market-compass/src/lib/documentReconciliation.ts',import.meta.url),'utf8');
 assert.match(reconciliation,/conflictingApprovedCategory/);
 assert.match(src,/risks\[item\.index\]\?\.bulkSafe===true/);
 assert.match(src,/risks\[index\]\?\.bulkSafe===true/);
 assert.match(src,/category:categoryConflicts\.has\(index\)\?'':/);
 assert.match(src,/Excluded from bulk Prepare; choose the category yourself before recording/);
 const helper=readFileSync(new URL('../artifacts/market-compass/src/lib/approvedPayeeCategory.ts',import.meta.url),'utf8');
 assert.doesNotMatch(helper,/\.push\(|\.splice\(|localStorage|indexedDB|fetch\(/);
});
