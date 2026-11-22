import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSolana,validatedSolBars,paperRiskSizing,replaySolanaPaper} from '../artifacts/market-compass/src/lib/solanaPaper.ts';
const day=86400000;
const dataset=()=>{
 const t=Date.parse('2026-10-01T00:00:00Z');
 const a=Array.from({length:35},(_,i)=>{
  const mid=100+i*.45;
  return {date:new Date(t+i*day).toISOString(),open:mid-.1,high:mid+1,
   low:mid-1,close:mid,volume:5000+i};
 });
 a[23].high=160;
 a.push({date:new Date(t+35*day).toISOString(),open:112,high:115,
  low:105,close:114,volume:5500});
 return a;
};
test('completed SOL pattern requires trend, key level, reward/risk, fresh source',()=>{
 const a=dataset(),asOf=Date.parse(a.at(-1).date)+day;
 const signal=analyzeSolana(a,asOf);
 assert.equal(signal.trend,'up');
 assert.equal(signal.pattern,'Bullish pin bar');
 assert.equal(signal.status,'paper-entry-candidate');
 assert.ok(signal.rewardRisk>=2);
 assert.equal(signal.riskFraction,.005);
 assert.equal(signal.allocationFraction,.10);
 assert.equal(analyzeSolana(a,asOf+10*day).status,'watch');
 assert.match(analyzeSolana(a,asOf+10*day).warnings.join(' '),/stale/);
});
test('capital-efficient sizing cannot exceed 10 percent deployment or 0.5 percent modeled risk',()=>{
 const a=dataset(),signal=analyzeSolana(a,Date.parse(a.at(-1).date)+day);
 const r=paperRiskSizing(signal,100);
 assert.ok(r.quantity>0);
 assert.ok(r.allocationUsd<=10+1e-8);
 assert.ok(r.riskUsd<=.5+1e-8);
 assert.deepEqual(paperRiskSizing({...signal,status:'watch'},100),{quantity:0,allocationUsd:0,riskUsd:0});
 assert.throws(()=>paperRiskSizing(signal,-1),/Paper capital/);
});
test('replay remains paper-only, uses subsequent candle, retains conservative assumptions',()=>{
 const a=dataset(),last=a.at(-1);
 a.push({date:new Date(Date.parse(last.date)+day).toISOString(),
  open:114,high:125,low:112,close:124,volume:5000});
 const r=replaySolanaPaper(a,100);
 assert.equal(r.startUsd,100);
 assert.ok(r.endUsd>0);
 assert.equal(r.feesBps,10);
 assert.equal(r.slippageBps,10);
 assert.match(r.notes.join(' '),/no exchange account/);
 assert.ok(r.trades.every(x=>Date.parse(x.closedAt)>Date.parse(x.openedAt)));
});
test('rejects malformed, nonchronological and insufficient candle data',()=>{
 const a=dataset();
 assert.equal(validatedSolBars(a).length,a.length);
 assert.throws(()=>validatedSolBars(a.slice(0,5)),/31/);
 assert.throws(()=>validatedSolBars([...a.slice(0,-1),{...a.at(-1),low:-2}]),/invalid/);
 assert.throws(()=>validatedSolBars([...a.slice(0,-1),{...a.at(-1),date:a.at(-2).date}]),/invalid/);
});
