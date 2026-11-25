import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanSavedCategories,applySavedCategoryChanges,categoryReviewPage} from '../artifacts/market-compass/src/lib/savedCategoryReview.ts';

const synthetic=(id,description,category='other',kind='expense')=>({
  id,description,category,kind,amount:0.09,currency:'ZAR',
  date:'2026-05-25',recordedAt:'2026-05-26T08:00:00.000Z',
  paidVia:'Owner reviewed statement',note:'Synthetic line'
});

test('Expense screen exposes visible Scan / Rescan and manual paginated review',()=>{
  const view=readFileSync(new URL('../artifacts/market-compass/src/components/SavedCategoryReview.tsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(view,/Rescan saved payments/);
  assert.match(view,/onClick=\{startScan\}/);
  assert.match(view,/flex flex-col gap-3 sm:flex-row/);
  assert.match(view,/Needs your decision/);
  assert.match(view,/categoryReviewPage\(items,page,PAGE_SIZE\)/);
  assert.match(view,/onManualCategorize\(entry.id,category\)/);
  assert.match(app,/<SavedCategoryReview entries=\{ledger\} currency=\{data.currency\} region=\{selectedRegion\(data.region\)\}/);
  assert.match(app,/onManualCategorize=/);
});
test('EXCESS INTEREST expense is only a proposed fee and needs explicit approval',()=>{
  const old=synthetic('interest','EXCESS INTEREST EXCESS INTEREST');
  const rows=[old,synthetic('generic','Card payment')];
  const result=scanSavedCategories(rows,'ZA');
  assert.equal(result.checked,2);
  assert.equal(result.proposals.length,1);
  assert.equal(result.proposals[0].id,'interest');
  assert.equal(result.proposals[0].category,'fees');
  assert.equal(result.unresolved,1);
  assert.equal(old.category,'other');
  const approved=applySavedCategoryChanges(rows,result.proposals,'ZA');
  assert.equal(approved[0].category,'fees');
  assert.equal(approved[0].amount,old.amount);
  assert.equal(approved[0].date,old.date);
  assert.equal(approved[0].note,old.note);
  assert.equal(approved[1].category,'other');
  assert.equal(scanSavedCategories(approved,'ZA').proposals.length,0);
});
test('pagination and rescan are read-only snapshots until approval',()=>{
  const rows=Array.from({length:36},(_,i)=>synthetic('x'+i,'Card payment'));
  const scan=scanSavedCategories(rows,'ZA');
  assert.equal(scan.unresolved,36);
  assert.deepEqual(categoryReviewPage(rows,4,8).items.map(x=>x.id),rows.slice(32).map(x=>x.id));
  assert.equal(rows.every(x=>x.category==='other'),true);
  assert.equal(scanSavedCategories(rows,'ZA').proposals.length,0);
});
