import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringSpendCandidates} from '../artifacts/market-compass/src/lib/recurringSpendInsights.ts';

const make=(date,id,amount=350,description='Monthly gym')=>({
  id,date,recordedAt:date+'T12:00:00Z',kind:'expense',
  category:'health',description,paidVia:'Manual',amount,currency:'ZAR'
});
test('three consecutive salary cycles, one approved observation each',()=>{
  const entries=[make('2026-09-28','gym-sept'),make('2026-10-28','gym-oct'),make('2026-11-28','gym-nov')];
  const rows=recurringSpendCandidates(entries,'2026-12-03');
  assert.equal(rows.length,1);assert.equal(rows[0].confidence,'observed-pattern');
  assert.equal(rows[0].lastDate,'2026-11-28');
  assert.deepEqual(rows[0].sourceIds,['gym-nov','gym-oct','gym-sept']);
});
test('never guess recurring payments with two cycles, duplicates or nonconsecutive cycles',()=>{
  assert.equal(recurringSpendCandidates([make('2026-10-28','a'),make('2026-11-28','b')],'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates([make('2026-08-28','a'),make('2026-10-28','b'),make('2026-11-28','c')],'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates([make('2026-09-28','a'),make('2026-10-28','b'),make('2026-10-29','dup'),make('2026-11-28','c')],'2026-12-01').length,0);
});
test('never infer from income, transfer, future dates, other currency, amount or date drift',()=>{
  const src=[make('2026-09-28','a'),make('2026-10-28','b'),make('2026-11-28','c')];
  assert.equal(recurringSpendCandidates(src.map(x=>({...x,kind:'income'})),'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates(src.map(x=>({...x,kind:'transfer'})),'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates(src.map(x=>({...x,currency:'USD'})),'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates(src.map((x,i)=>({...x,amount:i===2?900:350})),'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates(src.map((x,i)=>({...x,date:i===2?'2026-11-08':x.date})),'2026-12-01').length,0);
  assert.equal(recurringSpendCandidates(src,'2026-11-20').length,0);
});
test('sensitive numeric references do not become public recurring labels',()=>{
  const entries=['2026-09-28','2026-10-28','2026-11-28'].map((date,i)=>make(date,'ref-'+i,350,'Gym 1234567890123'));
  const rows=recurringSpendCandidates(entries,'2026-12-01');
  assert.equal(rows.length,1);
  assert.ok(!rows[0].label.includes('1234567890123'));
});
