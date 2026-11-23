import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spendingCycleSummaries} from '../artifacts/market-compass/src/lib/spendingCycleSummaries.ts';

const row=(id,date,kind,amount,currency='ZAR')=>({
  id,date,kind,amount,currency,category:'other',description:'Synthetic transaction',
  paidVia:'synthetic',recordedAt:'2026-11-23T08:00:00.000Z'
});
test('historical approved entries appear in distinct 26th–25th cycles',()=>{
 const entries=[
  row('a','2026-05-27','expense',100),
  row('b','2026-06-24','debt-payment',50),
  row('c','2026-06-26','expense',200),
  row('d','2026-07-01','income',1200),
  row('e','2026-06-26','transfer',400)
 ];
 const history=spendingCycleSummaries(entries);
 assert.deepEqual(history.map(h=>[h.start,h.spending,h.income,h.expenseCount]),[
  ['2026-06-26',200,1200,1],
  ['2026-05-26',150,0,2]
 ]);
 assert.equal(history[1].debtRepayments,50);
});
test('foreign currency, invalid dates and undated evidence cannot inflate timeline',()=>{
 const history=spendingCycleSummaries([
  row('bad','2026-05-33','expense',500),row('usd','2026-06-30','expense',500,'USD'),
  row('zero','2026-06-27','expense',0),row('valid','2026-06-27','expense',12.35)
 ]);
 assert.equal(history.length,1);
 assert.equal(history[0].spending,12.35);
});
test('timeline source filters are honored upstream and panel enables cycle navigation',async()=>{
 const all=[row('a','2026-05-27','expense',100),row('b','2026-05-27','expense',200)];
 assert.equal(spendingCycleSummaries(all.filter(e=>e.id==='a'))[0].spending,100);
 const source=await readFile(new URL('../artifacts/market-compass/src/components/SpendingPortfolio.tsx',import.meta.url),'utf8');
 assert.match(source,/spendingCycleSummaries\(entries\.filter/);
 assert.match(source,/Historical spending by salary cycle/);
 assert.match(source,/aria-pressed=\{period===point\.start\}/);
 assert.match(source,/onClick=\{\(\)=>setPeriod\(point\.start\)\}/);
});
