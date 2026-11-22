import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {salaryCycle,shiftSalaryCycle,cycleAnalysis,cycleEntries,parseMoneyAmount,validateExpenseEntry,cycleSpendingTrends,suggestKnownSpendCategory,cycleCashflowCutIdeas,expenseCategoryNeedsSorting} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
const make=(date,kind,amount,category='other',extras={})=>({
  id:date+kind+amount,recordedAt:'2026-11-20T12:00:00Z',date,kind,amount,
  category,description:'Sample payment',paidVia:'Local bank app',currency:'ZAR',...extras,
});
test('salary cycles use the inclusive 26th to 25th and year transitions',()=>{
  assert.deepEqual(salaryCycle('2026-11-20'),{
    start:'2026-10-26',endExclusive:'2026-11-26',lastDay:'2026-11-25',
  });
  assert.equal(salaryCycle('2026-11-26').start,'2026-11-26');
  assert.equal(salaryCycle('2027-01-25').start,'2026-12-26');
  assert.equal(salaryCycle('2028-02-29').lastDay,'2028-03-25');
  assert.equal(shiftSalaryCycle('2026-10-26',1).start,'2026-11-26');
  assert.equal(shiftSalaryCycle('2026-10-26',-1).start,'2026-09-26');
  assert.throws(()=>salaryCycle('2026-02-30'),/valid/);
});
test('manual ledger distinguishes debt repayment, spending, income and internal transfers',()=>{
  const entries=[
    make('2026-10-26','income',9000,'salary'),
    make('2026-10-26','debt-payment',3552,'car',{accountLabel:'Car finance',remainingBalance:182000}),
    make('2026-11-19','debt-payment',600,'credit-card',{accountLabel:'Credit card',remainingBalance:19790}),
    make('2026-11-20','expense',350,'groceries'),
    make('2026-11-21','transfer',4000,'savings'),
    make('2026-11-25','expense',200,'fees'),
    make('2026-11-26','expense',9999,'transport'),
  ];
  const analysis=cycleAnalysis(entries,'2026-11-20','ZAR','10000');
  assert.equal(analysis.income,9000);
  assert.equal(analysis.debtPayments,4152);
  assert.equal(analysis.expenses,550);
  assert.equal(analysis.transfers,4000);
  assert.equal(analysis.outflow,4702);
  assert.equal(analysis.count,6);
  assert.equal(analysis.recordedDifference,4298);
  assert.equal(analysis.latestBalances[0].balance,19790);
  assert.equal(analysis.latestBalances[1].balance,182000);
  assert.equal(cycleEntries(entries,'2026-11-26','ZAR').length,1);
  assert.equal(cycleEntries(entries,'2026-10-26','USD').length,0);
  assert.ok(analysis.flags.some(f=>/fees/.test(f)));
});
test('payment entries validate debt balance without inventing repayment effect',()=>{
  assert.equal(validateExpenseEntry(make('2026-11-20','debt-payment',100,'credit-card',{remainingBalance:18000})).remainingBalance,18000);
  assert.throws(()=>validateExpenseEntry(make('2026-11-20','expense',100,'groceries',{remainingBalance:18000})),/debt repayment/);
  assert.throws(()=>validateExpenseEntry(make('2026-11-20','expense',-100)),/amount/);
  assert.throws(()=>validateExpenseEntry(make('2026-11-20','expense',100,'groceries',{paidVia:''})),/payment app/);
  assert.equal(parseMoneyAmount('0',{zeroAllowed:true}),0);
  assert.throws(()=>parseMoneyAmount('1.999'),/two decimal/);
});

test('completed-cycle insights avoid over-interpreting partial salary cycles',()=>{
  const entries=[
    make('2026-08-28','income',9000,'salary'),
    make('2026-09-10','expense',200,'subscriptions',{paidVia:'Card app'}),
    make('2026-09-15','expense',600,'groceries',{paidVia:'Bank app'}),
    make('2026-09-28','income',9000,'salary'),
    make('2026-10-10','expense',400,'subscriptions',{paidVia:'Card app'}),
    make('2026-10-12','expense',700,'groceries',{paidVia:'Bank app'}),
    make('2026-10-28','income',9000,'salary'),
    make('2026-11-20','expense',150,'subscriptions',{paidVia:'Card app'}),
  ];
  const previous=cycleAnalysis(entries,'2026-09-26','ZAR');
  assert.equal(previous.byPaymentMethod.find(x=>x.app==='Card app').amount,400);
  assert.equal(previous.byPaymentMethod.find(x=>x.app==='Bank app').amount,700);
  const insights=cycleSpendingTrends(entries,'2026-10-26','2026-11-20','ZAR');
  assert.equal(insights.available,true);
  assert.equal(insights.first,'2026-09-26'); // not the incomplete Oct 26 cycle
  assert.ok(insights.highlights.some(x=>/Subscriptions/.test(x)));
});

test('unknown transactions stay unsorted while explicit known spending gets a category',()=>{
 assert.equal(suggestKnownSpendCategory('expense','Unknown QR PAYEE XYZ'),'unsorted');
 assert.equal(suggestKnownSpendCategory('expense','CHECKERS SUPERMARKET'),'groceries');
 assert.equal(suggestKnownSpendCategory('expense','MONTHLY BANK SERVICE FEE'),'fees');
 assert.equal(suggestKnownSpendCategory('expense','NETFLIX SUBSCRIPTION'),'subscriptions');
 assert.equal(suggestKnownSpendCategory('expense','ENGEN PETROL PURCHASE'),'transport');
 assert.equal(suggestKnownSpendCategory('income','TRANSFER RECEIVED'),'unsorted');
 assert.equal(suggestKnownSpendCategory('income','NET PAY SALARY'),'salary');
 assert.equal(suggestKnownSpendCategory('debt-payment','CAR LOAN REPAYMENT'),'car');
 assert.equal(suggestKnownSpendCategory('transfer','Transfer to savings pocket'),'savings');
 const sample=validateExpenseEntry(make('2026-11-20','expense',47,'unsorted'));
 assert.equal(sample.category,'unsorted');
});
test('unsorted movements remain in outflow and optional labeling does not change money totals',()=>{
 const entries=[
   make('2026-11-01','income',1500,'salary'),
   make('2026-11-02','expense',125,'unsorted'),
   make('2026-11-03','expense',200,'subscriptions'),
   make('2026-11-04','expense',20,'fees'),
   make('2026-11-05','expense',100,'transport'),
   make('2026-11-06','expense',100,'groceries'),
   make('2026-11-07','transfer',300,'unsorted'),
   make('2026-11-08','income',50,'unsorted')
 ];
 const analysis=cycleAnalysis(entries,'2026-10-26','ZAR');
 assert.equal(analysis.unsortedCount,3);
 assert.equal(analysis.unsortedOutflow,125);
 assert.equal(analysis.unsortedIncome,50);
 assert.equal(analysis.expenses,545);
 assert.equal(analysis.transfers,300);
 assert.equal(analysis.recordedDifference,1005);
 const relabelled=entries.map(e=>e.kind==='expense'&&e.category==='unsorted'?
   {...e,category:'other'}:e);
 const revised=cycleAnalysis(relabelled,'2026-10-26','ZAR');
 assert.equal(revised.expenses,analysis.expenses);
 assert.equal(revised.recordedDifference,analysis.recordedDifference);
 assert.equal(revised.unsortedOutflow,0);
 const cuts=cycleCashflowCutIdeas(entries,'2026-10-26','ZAR');
 assert.deepEqual(cuts.ideas.map(c=>c.category),
   ['subscriptions','fees','transport','groceries']);
 assert.equal(cuts.totalIllustrativeSavings,58);
 assert.equal(cycleCashflowCutIdeas(entries,'2026-11-26','ZAR').totalIllustrativeSavings,0);
});

test('Spend UI keeps Unsorted and money movements visible and links only to private Assistant',async()=>{
 const ui=await readFile(new URL('../artifacts/market-compass/src/components/MonthlyExpenses.tsx',import.meta.url),'utf8');
 const review=await readFile(new URL('../artifacts/market-compass/src/components/ReviewedDocumentLedger.tsx',import.meta.url),'utf8');
 assert.match(ui,/Filter money movements/);
 assert.match(ui,/Unsorted outflow \(included\)/);
 assert.match(ui,/Unsorted income \(included\)/);
 assert.match(ui,/Label this entry \(optional\)/);
 assert.match(ui,/cycleCashflowCutIdeas/);
 assert.match(ui,/Open Compass AI .* cash-flow review/);
 assert.match(review,/Unreviewed credits/);
 assert.match(review,/Unreviewed debits/);
 assert.match(review,/Unknown direction/);
 assert.match(review,/no unapproved row affects your budget/);
 assert.doesNotMatch(ui,/fetch\(|sendBeacon\(/);
});

test('legacy Other fallback is displayed as Unsorted without mutating saved entries',()=>{
 const old=make('2026-11-13','expense',88,'other',{description:'Unknown historical purchase'});
 const before=JSON.stringify(old);
 const a=cycleAnalysis([old],'2026-10-26','ZAR');
 assert.equal(a.expenses,88);
 assert.equal(a.unsortedOutflow,88);
 assert.equal(a.unsortedCount,1);
 assert.equal(a.byCategory.find(c=>c.category==='unsorted')?.amount,88);
 assert.equal(a.byCategory.find(c=>c.category==='other'),undefined);
 assert.equal(expenseCategoryNeedsSorting(old.category),true);
 assert.equal(expenseCategoryNeedsSorting('groceries'),false);
 assert.equal(JSON.stringify(old),before);
});
