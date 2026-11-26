import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestSavedCategoryChanges,applySavedCategoryChanges}
  from '../artifacts/market-compass/src/lib/savedCategoryReview.ts';
import {cycleAnalysis} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';

const make=(id,description,kind='expense',category='other')=>({
 id,description,kind,category,amount:149.75,date:'2026-11-08',recordedAt:'2026-11-23T09:00:00Z',
 paidVia:'Owner-reviewed document',currency:'ZAR',note:'Original source line 3'
});

test('existing document-sourced rows can be reclassified without re-upload',()=>{
 const old=[make('doc-00000000-0000-4000-8000-000000000000-3','Monthly debit order fee')];
 const proposals=suggestSavedCategoryChanges(old);
 assert.equal(proposals.length,1);
 assert.equal(proposals[0].category,'fees');
 assert.equal(proposals[0].kind,'expense');
 const updated=applySavedCategoryChanges(old,proposals);
 assert.equal(updated.length,1);
 assert.equal(updated[0].id,old[0].id);
 assert.equal(updated[0].amount,old[0].amount);
 assert.equal(updated[0].date,old[0].date);
 assert.equal(updated[0].recordedAt,old[0].recordedAt);
 assert.equal(updated[0].note,old[0].note);
 assert.equal(old[0].category,'other');
 assert.deepEqual(suggestSavedCategoryChanges(updated),[]);
});

test('explicit debt repayment changes kind only after owner approval',()=>{
 const records=[make('manual-x','Vehicle loan repayment 8 Nov 2026'),make('manual-y','General debit order')];
 const choices=suggestSavedCategoryChanges(records);
 assert.equal(choices.length,1);
 assert.equal(choices[0].kind,'debt-payment');
 assert.equal(choices[0].category,'car');
 const updated=applySavedCategoryChanges(records,choices);
 assert.equal(updated[0].kind,'debt-payment');
 assert.equal(updated[1].kind,'expense');
 assert.equal(cycleAnalysis(updated,'2026-10-26','ZAR').debtPayments,149.75);
});

test('explicit own-account transfer is excluded from spending after review',()=>{
 const entries=[make('local-a','Transfer to savings account')];
 const changes=suggestSavedCategoryChanges(entries);
 assert.equal(changes.length,1);
 assert.equal(changes[0].kind,'transfer');
 assert.equal(cycleAnalysis(entries,'2026-10-26','ZAR').outflow,149.75);
 assert.equal(cycleAnalysis(applySavedCategoryChanges(entries,changes),'2026-10-26','ZAR').outflow,0);
});

test('unclear transactions remain unchanged, including generic debit order or refund',()=>{
 const existing=[make('z','Debit order'),make('a','Refund from retailer','income','side-income')];
 assert.deepEqual(suggestSavedCategoryChanges(existing),[]);
 assert.strictEqual(applySavedCategoryChanges(existing,[]),existing);
});

test('stale approvals and repeated choices fail without touching records',()=>{
 const current=[make('one','Bank account service fee')];
 const choices=suggestSavedCategoryChanges(current);
 assert.throws(()=>applySavedCategoryChanges(current,[choices[0],choices[0]]),/Repeated/);
 const modified=[{...current[0],category:'groceries'}];
 assert.throws(()=>applySavedCategoryChanges(modified,choices),/changed while/);
 assert.equal(modified[0].category,'groceries');
});

test('saved debt linked entries do not lose outstanding balance evidence',()=>{
 const entry={...make('debt-a','Internal transfer from savings','debt-payment','credit-card'),remainingBalance:26000,debtAccountId:'account'};
 assert.deepEqual(suggestSavedCategoryChanges([entry]),[]);
});


test('Capfin DebiCheck suggests a personal loan, but does not silently change history',()=>{
 const old=[make('capfin-one','Capfin Debit Check'),make('other-one','Generic debit order')];
 const proposals=suggestSavedCategoryChanges(old);
 assert.equal(proposals.length,1);
 assert.equal(proposals[0].category,'personal-loan');
 assert.equal(proposals[0].kind,'debt-payment');
 assert.match(proposals[0].reason,/posted|mandate/);
 assert.equal(old[0].kind,'expense');
 assert.equal(old[0].category,'other');
 const updated=applySavedCategoryChanges(old,proposals);
 assert.equal(updated[0].kind,'debt-payment');
 assert.equal(updated[0].category,'personal-loan');
 assert.equal(updated[0].date,old[0].date);
 assert.equal(updated[0].amount,old[0].amount);
 assert.equal(updated[1].category,'other');
 assert.deepEqual(suggestSavedCategoryChanges(updated),[]);
});

test('Capfin mandate with no posted debit keyword is not a confirmed repayment',()=>{
 assert.deepEqual(suggestSavedCategoryChanges([make('capfin-mandate','Capfin mandate approved')]),[]);
});
