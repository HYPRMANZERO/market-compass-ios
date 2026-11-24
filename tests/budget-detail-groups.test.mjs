import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUDGET_DETAIL_GROUPS,budgetDetailOptions,budgetDetailSummary,budgetDetailValid} from '../artifacts/market-compass/src/lib/budgetDetailGroups.ts';
import {validateExpenseEntry} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
const row=(id,kind,category,subcategory,amount,date='2026-11-20')=>({
 id,kind,category,subcategory,amount,date,currency:'ZAR',description:'Owner reviewed transaction',
 recordedAt:date+'T12:00:00Z',paidVia:'Bank statement'
});
test('all Vault22 reference subcategory labels are present with compatible movement types',()=>{
 const names=BUDGET_DETAIL_GROUPS.map(g=>g.title);
 assert.deepEqual(names,['Bank Fees','Utilities','Debt','Communications']);
 const debt=BUDGET_DETAIL_GROUPS.find(g=>g.id==='debt').items;
 assert.ok(debt.some(x=>x.label==='Vehicle Loan / Car Loan'));
 assert.ok(debt.some(x=>x.label==='Interest Paid'&&x.kind==='expense'&&x.category==='fees'));
 assert.ok(budgetDetailOptions('expense','utilities').some(x=>x.label==='Internet & Fibre'));
 assert.equal(budgetDetailValid('interest-paid','income','interest'),false);
 assert.equal(budgetDetailValid('interest-paid','expense','fees'),true);
});
test('legacy untagged entries stay in group total without being guessed into details',()=>{
 const rows=[row('fee','expense','fees',undefined,140),row('card','debt-payment','credit-card',undefined,600),
 row('internet','expense','utilities','internet-fibre',399),row('interest','income','interest',undefined,15)];
 const result=budgetDetailSummary(rows,'2026-10-26','ZAR',{},'2026-11-24');
 const fees=result.find(g=>g.id==='bank-fees');
 const debt=result.find(g=>g.id==='debt');
 const communication=result.find(g=>g.id==='communications');
 assert.equal(fees.spent,140);
 assert.equal(fees.unassigned,140);
 assert.equal(fees.rows.find(r=>r.id==='bank-charges').spent,0);
 assert.equal(debt.spent,600);
 assert.equal(debt.unassigned,600);
 assert.equal(communication.spent,399);
 assert.equal(result.reduce((s,g)=>s+g.spent,0),1139);
 assert.equal(fees.budget,null);
 assert.equal(communication.rows.find(r=>r.id==='internet-fibre').historicalAverage,null);
});
test('budget field can be zero explicitly, but missing budgets are not zero',()=>{
 const out=budgetDetailSummary([], '2026-10-26','ZAR',{'account-fees':'0','atm-fees':'0'},'2026-11-24');
 const fee=out.find(g=>g.id==='bank-fees');
 assert.equal(fee.rows[0].budget,0);
 assert.equal(fee.rows[1].budget,0);
 assert.equal(fee.budget,null);
});
test('invalid subcategory is rejected without rewriting original amounts or category',()=>{
 const good=row('one','expense','fees','interest-paid',50);
 assert.equal(validateExpenseEntry(good).subcategory,'interest-paid');
 assert.throws(()=>validateExpenseEntry({...good,kind:'income',category:'interest'}),/detailed category/);
});
test('screens have detailed budgets and no simulated net worth',()=>{
 const path=new URL('../artifacts/market-compass/src/',import.meta.url);
 const ui=readFileSync(new URL('components/BudgetDetailReview.tsx',path),'utf8');
 const app=readFileSync(new URL('App.tsx',path),'utf8');
 assert.match(ui,/Spent \/ Budget \/ Recorded average/);
 assert.match(ui,/not guessed into a subcategory/);
 assert.match(ui,/Save detailed budgets/);
 assert.match(app,/<BudgetDetailReview entries=\{ledger\}/);
});