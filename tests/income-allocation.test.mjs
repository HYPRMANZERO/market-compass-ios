import test from 'node:test';
import assert from 'node:assert/strict';
import {incomeAllocation} from '../artifacts/market-compass/src/lib/incomeAllocation.ts';
const entry=(id,kind,category,amount,date='2026-11-04',currency='ZAR')=>({id,kind,category,amount,date,currency,recordedAt:'2026-11-04T09:00:00Z',description:'Synthetic category',paidVia:'test'});
test('Allocation uses owner-approved, same-currency records within the salary cycle',()=>{
 const rows=[entry('income','income','salary',10000),entry('food','expense','groceries',2500),
 entry('rent','expense','housing',4000),entry('loan','debt-payment','car',1000),
 entry('foreign','expense','fees',500,'2026-11-04','USD'),entry('old','expense','fees',800,'2026-10-23')];
 const results=incomeAllocation(rows,'ZAR','2026-11-08');
 assert.equal(results.income,10000);
 assert.equal(results.spent,7500);
 assert.equal(results.remaining,2500);
 assert.deepEqual(results.categories.map(x=>[x.category,x.incomePercent]),[['Housing',40],['Groceries',25],['Vehicle',10]]);
 assert.ok(Math.abs(results.categories.reduce((n,x)=>n+x.spendPercent,0)-100)<0.000001);
});
test('Missing income stays unknown, never treated as R0 salary or fabricated percentage',()=>{
 const results=incomeAllocation([entry('food','expense','groceries',300)],'ZAR','2026-11-10');
 assert.equal(results.income,null); assert.equal(results.remaining,null);
 assert.equal(results.categories[0].incomePercent,null);
});
test('Outflows exceeding entered income can exceed 100% of income, ring still partitions outflows',()=>{
 const result=incomeAllocation([entry('income','income','salary',1000),entry('rent','expense','housing',1200)],'ZAR','2026-11-10');
 assert.equal(result.categories[0].incomePercent,120);
 assert.equal(result.categories[0].spendPercent,100);
});
