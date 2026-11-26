import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {financialPulse,shiftSalaryCycle,salaryCycle} from '../artifacts/market-compass/src/lib/financialPulse.ts';

const entry=(id,date,kind,category,amount,currency='ZAR')=>({
  id,date,kind,category,amount,currency,
  recordedAt:date+'T15:00:00Z',
  description:'SYNTHETIC '+category,paymentProof:false,paidVia:'Owner entry'
});
const doc=(id,importedAt)=>({
  id,label:'Synthetic evidence',importedAt,format:'pdf',
  source:'owner-selected-iphone-file',bankVerified:false,complete:false,
  lines:[{label:'Payslip total R10000',amount:10000,date:'2026-11-01',direction:'incoming'}],truncated:false
});

test('salary-cycle selectors use 26th boundaries, never calendar month assumptions',()=>{
  const current=salaryCycle('2026-11-23');
  assert.equal(current.start,'2026-10-26');
  assert.equal(current.lastDay,'2026-11-25');
  assert.equal(shiftSalaryCycle(current.start,-1).start,'2026-09-26');
  assert.equal(shiftSalaryCycle(current.start,-2).start,'2026-08-26');
});
test('only owner-approved same-currency ledger rows count toward Money in/out',()=>{
  const pulse=financialPulse([
    entry('a','2026-11-02','income','salary',10000),
    entry('b','2026-11-03','expense','groceries',350),
    entry('c','2026-11-05','debt-payment','credit-card',1000),
    entry('d','2026-11-06','transfer','savings',500),
    entry('e','2026-11-08','expense','transport',70,'USD'),
    entry('old','2026-10-25','expense','fees',20),
    entry('next','2026-11-26','expense','fees',30)
  ],[doc('p','2026-11-17T09:00:00Z')],'2026-10-26','ZAR');
  assert.equal(pulse.totalEntries,4);
  assert.equal(pulse.income,10000);
  assert.equal(pulse.outflows,1350);
  assert.equal(pulse.expenses,350);
  assert.equal(pulse.debtPayments,1000);
  assert.equal(pulse.transfers,500);
  assert.equal(pulse.difference,8650);
  assert.equal(pulse.omittedOtherCurrency,1);
  assert.equal(pulse.documentCount,1);
  assert.equal(pulse.lastDocumentImport,'2026-11-17T09:00:00Z');
  assert.equal(pulse.categories.reduce((a,x)=>a+x.amount,0),1350);
  assert.ok(pulse.categories.every(x=>x.percent>=0&&x.percent<=100));
  assert.equal(pulse.recent[0].id,'d');
});
test('a payslip does not fabricate approved income and missing income is not zero',()=>{
  const pulse=financialPulse([entry('e','2026-11-02','expense','groceries',100)],
    [doc('p','2026-11-10T08:15:00Z')],'2026-10-26','ZAR');
  assert.equal(pulse.hasIncome,false);
  assert.equal(pulse.hasOutflows,true);
  assert.equal(pulse.income,0);
  assert.equal(pulse.difference,null);
  assert.equal(pulse.documentCount,1);
  assert.equal(pulse.totalEntries,1);
});
test('no ledger entries produces unknown missing totals, not a zero-bank-balance',()=>{
  const pulse=financialPulse([],[],'2026-10-26','ZAR');
  assert.equal(pulse.totalEntries,0);
  assert.equal(pulse.hasIncome,false);
  assert.equal(pulse.hasOutflows,false);
  assert.equal(pulse.difference,null);
  assert.equal(pulse.lastDocumentImport,null);
  assert.equal(pulse.spendingLimit,null);
});
test('invalid entries and invalid spending limit are ignored, not rounded or auto-approved',()=>{
  const invalid={...entry('bad','2026-11-01','expense','fees',3),date:'2026-02-30'};
  const pulse=financialPulse([invalid,entry('v','2026-11-01','expense','groceries',100)],
    [],'2026-10-26','ZAR',{cycleBudget:'not a number'});
  assert.equal(pulse.totalEntries,1);
  assert.equal(pulse.outflows,100);
  assert.equal(pulse.spendingLimit,null);
});
test('manual spending limit drives progress without assuming all expenses were captured',()=>{
  const pulse=financialPulse([
    entry('x','2026-11-05','expense','housing',1000),
    entry('y','2026-11-06','expense','transport',500)
  ],[],'2026-10-26','ZAR',{cycleBudget:'1200.00'});
  assert.equal(pulse.spendingLimit,1200);
  assert.equal(pulse.limitUsedPercent,125);
});
test('mobile UI shows review selectors, provenance, links and no imaginary bank balance',async()=>{
  const root=new URL('../artifacts/market-compass/src/',import.meta.url);
  const ui=await readFile(new URL('components/FinancialPulse.tsx',root),'utf8');
  const home=await readFile(new URL('components/MobileOverview.tsx',root),'utf8');
  const app=await readFile(new URL('App.tsx',root),'utf8');
  for(const check of [
    /Monthly review/,/Choose salary cycle/,/Current/,/Previous/,/Earlier/,
    /Money in/,/Money out/,/Spending by category/,/Financial sources/,
    /Not connected · No automatic sync/,/Missing entries do not mean zero/,
    /maskDocumentPII\(entry.description\)/,/aria-label="Monthly financial review"/
  ])assert.match(ui,check);
  assert.match(home,/<FinancialPulse entries=\{entries\} documents=\{documents\}/);
  assert.match(app,/entries=\{entries\} documents=\{docs\} expenseSettings=/);
  assert.match(app,/hidden lg:block"><FinancialPulse/);
});

test('identical import retries appear once in the Monthly Review and do not inflate cash flow',()=>{
  const salary=entry('pay-1','2026-11-01','income','salary',10000);
  const food=entry('food-1','2026-11-05','expense','groceries',300);
  const input=[salary,food,{...food}];
  const original=JSON.stringify(input);
  const pulse=financialPulse(input,[],'2026-10-26','ZAR');
  assert.equal(pulse.totalEntries,2);
  assert.equal(pulse.income,10000);
  assert.equal(pulse.outflows,300);
  assert.equal(pulse.difference,9700);
  assert.equal(pulse.excludedInvalidOrDuplicate,1);
  assert.equal(JSON.stringify(input),original);
});
test('conflicting source ID edits are omitted entirely, not arbitrarily selected',()=>{
  const changed=entry('duplicate','2026-11-03','expense','fees',200);
  const pulse=financialPulse([
    entry('income','2026-11-01','income','salary',1000),
    entry('duplicate','2026-11-03','expense','fees',100),
    changed
  ],[],'2026-10-26','ZAR');
  assert.equal(pulse.totalEntries,1);
  assert.equal(pulse.outflows,0);
  assert.equal(pulse.difference,null);
  assert.equal(pulse.excludedInvalidOrDuplicate,2);
});
test('blank IDs and subcent amounts cannot be reported as approved monthly income',()=>{
  const pulse=financialPulse([
    entry('','2026-11-02','income','salary',500),
    entry('tiny','2026-11-03','expense','fees',0.001),
    entry('valid','2026-11-04','expense','groceries',10)
  ],[],'2026-10-26','ZAR');
  assert.equal(pulse.totalEntries,1);
  assert.equal(pulse.income,0);
  assert.equal(pulse.outflows,10);
  assert.equal(pulse.excludedInvalidOrDuplicate,2);
});
