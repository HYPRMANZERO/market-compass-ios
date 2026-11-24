import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanSavedCategories,applySavedCategoryChanges} from '../artifacts/market-compass/src/lib/savedCategoryReview.ts';
import {buildLocalLaunchGuideline} from '../artifacts/market-compass/src/lib/localLaunchGuideline.ts';

const entry=(id,description)=>({
  id,description,kind:'expense',category:'other',amount:150,date:'2026-11-12',
  recordedAt:'2026-11-12T12:00:00Z',currency:'ZAR',paidVia:'EFT'
});

test('a new scan examines the remaining unknown entries after owner approval',()=>{
  const rows=[entry('fee','MONTHLY ACCOUNT SERVICE FEE'),entry('unknown','UNIDENTIFIED BANK TRANSFER')];
  const initial=scanSavedCategories(rows,'ZA');
  assert.equal(initial.checked,2);
  assert.equal(initial.proposals.length,1);
  const approved=applySavedCategoryChanges(rows,initial.proposals,'ZA');
  const newRows=[...approved,entry('groceries','POS CHECKERS STORE')];
  const again=scanSavedCategories(newRows,'ZA');
  assert.equal(again.checked,3);
  assert.equal(again.alreadyCategorized,1);
  assert.deepEqual(again.proposals.map(p=>p.id),['groceries']);
  assert.equal(again.unresolved,1);
  assert.equal(approved[0].amount,rows[0].amount);
});

test('financial plan shows approved category changes but preserves owner-entered debt budget',()=>{
  const now=new Date('2026-11-21T12:00:00Z');
  const settings={currency:'ZAR',privateBudget:{monthlyIncome:'12000',monthlyEssentials:'6000',liquidFunds:'2000',reserveTarget:'3500'},
    accounts:[{name:'Car',balance:'10000',minimumPayment:'1000',apr:'12'}]};
  const old=[entry('fee','MONTHLY ACCOUNT SERVICE FEE'),entry('unknown','UNIDENTIFIED BANK TRANSFER')];
  const before=buildLocalLaunchGuideline({...settings,expenseEntries:old},now);
  const afterRows=applySavedCategoryChanges(old,scanSavedCategories(old,'ZA').proposals,'ZA');
  const after=buildLocalLaunchGuideline({...settings,expenseEntries:afterRows},now);
  assert.deepEqual(before.ledgerCoverage,{count:2,categorized:0,unresolved:2});
  assert.deepEqual(after.ledgerCoverage,{count:2,categorized:1,unresolved:1});
  assert.equal(after.ledgerSnapshot?.categorized,1);
  assert.equal(after.ledgerSnapshot?.spending,300);
  assert.equal(after.preliminaryHeadroom,before.preliminaryHeadroom);
  assert.equal(after.reserveGap,before.reserveGap);
});

test('mobile review heading stays full-width and planning feedback is reactive',()=>{
  const root=new URL('../artifacts/market-compass/src/components/',import.meta.url);
  const review=readFileSync(new URL('SavedCategoryReview.tsx',root),'utf8');
  const planning=readFileSync(new URL('FinancialReadinessChecklist.tsx',root),'utf8');
  assert.match(review,/className="space-y-3"/);
  assert.match(review,/w-full justify-center bg-primary/);
  assert.match(review,/all unresolved items remain available for manual review/);
  assert.match(planning,/Saved-category progress/);
  assert.match(planning,/Approving a category updates this snapshot automatically/);
});
test('Accounts is a provider hub, not an account-by-account spending categorizer',()=>{
  const root=new URL('../artifacts/market-compass/src/',import.meta.url);
  const app=readFileSync(new URL('App.tsx',root),'utf8');
  const hub=readFileSync(new URL('components/AccountsPlatformHub.tsx',root),'utf8');
  assert.doesNotMatch(app,/<AccountTransactionHistory/);
  assert.match(app,/<Route path="\/banks">/);
  assert.match(app,/<AccountsPlatformHub debtAccounts=\{data.accounts\} currency=\{data.currency\}/);
  assert.match(hub,/0 live connections/);
  assert.match(hub,/manual records/);
  assert.match(hub,/Review payment categories in Spend/);
  assert.match(hub,/No bank or exchange is connected/);
  assert.match(hub,/Net worth history unavailable/);
  assert.match(hub,/owner-reported in the selected planning currency, not lender-verified/);
  for(const platform of ['Luno','EasyEquities','Old Mutual','Standard Bank investments','Coinbase','Kraken'])assert.match(hub,new RegExp(platform));
  assert.match(hub,/Manual import/);
  assert.match(hub,/Read-only API candidate/);
  assert.doesNotMatch(hub,/type="password"|API secret.*input|Withdraw funds|Place an order/);
});