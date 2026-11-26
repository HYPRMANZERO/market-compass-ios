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

test('old recurring observations are historical, not present-day bills',()=>{
  const old=[make('2025-09-28','gym-2025-sep'),make('2025-10-28','gym-2025-oct'),
    make('2025-11-28','gym-2025-nov')];
  assert.equal(recurringSpendCandidates(old,'2026-11-26').length,0);
  // An observation in the immediately preceding salary cycle may still
  // warrant owner review, including when the new cycle starts today.
  const recent=[make('2026-08-28','gym-aug'),make('2026-09-28','gym-sep'),
    make('2026-10-28','gym-oct')];
  assert.equal(recurringSpendCandidates(recent,'2026-11-26').length,1);
  assert.equal(recurringSpendCandidates(recent,'2026-12-26').length,0);
});
test('re-importing a record does not create an extra independent observation',()=>{
  const original=[make('2026-09-28','gym-09'),make('2026-10-28','gym-10'),
    make('2026-11-28','gym-11')];
  assert.equal(recurringSpendCandidates([...original,original[1]],'2026-12-01').length,1);
  // Repeated source IDs across different months must not become three
  // independent observed payments.
  assert.equal(recurringSpendCandidates(original.map(x=>({...x,id:'reused-id'})),
    '2026-12-01').length,0);
});
test('large synthetic ledger grouping is deterministic and capped',()=>{
  const huge=Array.from({length:6000},(_,i)=>make('2026-11-28','bulk-'+i,350,
    'Synthetic unique transaction '+i));
  const entries=[make('2026-09-28','gym-sep'),make('2026-10-28','gym-oct'),
    make('2026-11-28','gym-nov'),...huge];
  const result=recurringSpendCandidates(entries,'2026-12-02');
  assert.equal(result.length,1);
  assert.deepEqual(result[0].sourceIds,['gym-nov','gym-oct','gym-sep']);
});
