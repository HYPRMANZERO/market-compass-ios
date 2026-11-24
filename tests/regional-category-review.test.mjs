import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  scanSavedCategories,applySavedCategoryChanges,categoryReviewPage
} from '../artifacts/market-compass/src/lib/savedCategoryReview.ts';
import {matchRegionalCategory,regionalPackInfo,regionalSalaryNarration}
  from '../artifacts/market-compass/src/lib/regionalSpendRules.ts';
import {cycleAnalysis,EXPENSE_CATEGORIES}
  from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
import {REGIONS} from '../artifacts/market-compass/src/lib/regions.ts';

const row=(id,description,kind='expense',category='other',currency='ZAR')=>({
  id,description,kind,category,amount:119.75,date:'2026-11-25',
  recordedAt:'2026-11-25T10:00:00Z',paidVia:'Owner-reviewed bank statement',
  currency,note:'Original source evidence must not be overwritten'
});
const first=(description,region='ZA',kind='expense')=>scanSavedCategories([row('one',description,kind)],region).proposals[0];

test('global financial terms classify across countries and produce source explanations',()=>{
  for(const [description,category] of [
    ['MONTHLY ACCOUNT SERVICE FEE','fees'],
    ['Insurer premium policy','insurance'],
    ['Water bill November','utilities'],
    ['Tuition fee University','education'],
    ['Income tax remittance','taxes'],
    ['Vet bill pet food','pets'],
    ['Coffee shop breakfast meal','dining'],
    ['Paycheck payroll credit','salary'],
    ['Charitable donation to ngo','donations'],
    ['ATM cash withdrawal','cash']
  ]){
    const kind=category==='salary'?'income':'expense';
    const proposed=first(description,'CA',kind);
    assert.equal(proposed?.category,category,description);
    assert.match(proposed.reason,/\w/);
  }
});
test('regional merchant terms are switched by explicit country, never currency',()=>{
  assert.equal(first('POS CHECKERS PURCHASE','ZA')?.category,'groceries');
  assert.equal(first('POS CHECKERS PURCHASE','US'),undefined);
  assert.equal(first('POS TESCO STORE','GB')?.category,'groceries');
  assert.equal(first('POS TESCO STORE','ZA'),undefined);
  assert.equal(first('POS KROGER PURCHASE','US')?.category,'groceries');
  assert.equal(first('POS KROGER PURCHASE','GB'),undefined);
  assert.equal(first('POS WOOLWORTHS FOOD','ZA')?.category,'groceries');
  assert.equal(first('POS MERCADONA','ES')?.category,'groceries');
  assert.equal(first('POS MIGROS SUPERMARKT','CH')?.category,'groceries');
  assert.equal(first('POS NTUC FAIRPRICE','SG')?.category,'groceries');
  assert.equal(first('POS Naivas','KE')?.category,'groceries');
  assert.equal(first('POS DMART','IN')?.category,'groceries');
  assert.equal(regionalPackInfo('IN').country,'India');
  assert.equal(regionalPackInfo('unrecognized').country,'Global terminology only');
  assert.equal(regionalSalaryNarration('NOMINA NOVIEMBRE','ES'),true);
  assert.equal(regionalSalaryNarration('NOMINA NOVIEMBRE','US'),false);
});
test('payment networks and ambiguous reversals never become spend categories',()=>{
  const railOnly=['ACH transfer','BACS payment','SEPA transfer','SWIFT transfer',
    'UPI payment','PIX transfer','PayNow transfer','PayShap transfer','generic debit order',
    'card POS purchase','ATM','Credit card refund','Capfin mandate approved',
    'unknown merchant 357491'];
  for(const name of railOnly){
    assert.equal(first(name,'ZA'),undefined,name);
  }
});
test('risk-sensitive movement-kind changes require owner approval and preserve exact evidence',()=>{
  const rows=[
    row('capfin','Capfin Debit Check'),
    row('card','Credit card repayment November'),
    row('savings','Transfer to my savings'),
    row('cash','ATM cash withdrawal'),
    row('taxes','Income tax payment'),
    row('already','Checkers grocery purchase','expense','health')
  ];
  const scan=scanSavedCategories(rows,'ZA');
  assert.equal(scan.checked,6);
  assert.equal(scan.alreadyCategorized,1);
  assert.equal(scan.proposals.length,5);
  assert.equal(scan.proposals.find(p=>p.id==='capfin')?.kind,'debt-payment');
  assert.equal(scan.proposals.find(p=>p.id==='capfin')?.category,'personal-loan');
  assert.equal(scan.proposals.find(p=>p.id==='cash')?.kind,'transfer');
  assert.equal(scan.proposals.find(p=>p.id==='savings')?.kind,'transfer');
  const updated=applySavedCategoryChanges(rows,scan.proposals,'ZA');
  for(let i=0;i<rows.length;i++){
    assert.equal(updated[i].id,rows[i].id);
    assert.equal(updated[i].date,rows[i].date);
    assert.equal(updated[i].amount,rows[i].amount);
    assert.equal(updated[i].recordedAt,rows[i].recordedAt);
    assert.equal(updated[i].note,rows[i].note);
  }
  assert.equal(updated.at(-1).category,'health');
  assert.equal(rows[0].kind,'expense');
  assert.equal(cycleAnalysis(rows,'2026-10-26','ZAR').debtPayments,0);
  assert.equal(cycleAnalysis(updated,'2026-10-26','ZAR').debtPayments,239.5);
  assert.throws(()=>applySavedCategoryChanges(rows,scan.proposals,'GB'),/region changed/);
  assert.deepEqual(scanSavedCategories(updated,'ZA').proposals,[]);
});
test('region-specific approval cannot be replayed after merchant classification changes',()=>{
  const entries=[row('one','POS CHECKERS PURCHASE')];
  const suggestions=scanSavedCategories(entries,'ZA').proposals;
  assert.equal(suggestions.length,1);
  assert.throws(()=>applySavedCategoryChanges(entries,suggestions,'US'),/changed/);
});
test('pagination yields every item once and safely clamps next or previous page',()=>{
  const entries=Array.from({length:23},(_,i)=>row('entry-'+i,'Bank monthly service fee'));
  const all=scanSavedCategories(entries,'GB').proposals;
  assert.equal(all.length,23);
  const visited=[];
  for(let page=0;page<3;page++){
    const result=categoryReviewPage(all,page,8);
    assert.equal(result.pages,3);
    assert.equal(result.page,page);
    visited.push(...result.items.map(x=>x.id));
  }
  assert.equal(visited.length,23);
  assert.equal(new Set(visited).size,23);
  assert.equal(categoryReviewPage(all,99,8).page,2);
  assert.equal(categoryReviewPage(all,-5,8).page,0);
  assert.equal(categoryReviewPage([],7,8).pages,1);
});
test('each offered country has an explicit terminology pack and global fallback',()=>{
  assert.ok(REGIONS.length>=25);
  for(const region of REGIONS){
    const info=regionalPackInfo(region.code);
    assert.equal(info.country,region.country);
    assert.ok(info.countryRules>0,region.country);
  }
  assert.equal(matchRegionalCategory('Account service fee','XX')?.category,'fees');
});

test('review UI exposes manual unresolved entries and Next, Previous and page-scoped approval',()=>{
  const ui=readFileSync(new URL('../artifacts/market-compass/src/components/SavedCategoryReview.tsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(ui,/Scan saved payments/);
  assert.match(ui,/Needs your decision/);
  assert.match(ui,/Next<ChevronRight/);
  assert.match(ui,/Previous/);
  assert.match(ui,/onManualCategorize/);
  assert.match(ui,/Approve \{currentSuggestions\.length\} selected on this page/);
  assert.match(app,/region=\{selectedRegion\(data\.region\)\}/);
  assert.match(app,/onManualCategorize/);
  assert.ok(EXPENSE_CATEGORIES.some(x=>x.value==='taxes'));
});
