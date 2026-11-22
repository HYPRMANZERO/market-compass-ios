import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSpendCoachingRequest} from '../artifacts/market-compass/src/lib/spendAiGuidance.ts';

const row=(category,amount,description,id)=>({
  id,recordedAt:'2026-11-20T08:00:00.000Z',date:'2026-11-20',
  kind:'expense',category,description,paidVia:'Private account 1234567890123',
  amount,currency:'ZAR'
});
test('coaching is generated automatically from approved category totals, not raw bank data',()=>{
  const entries=[
    row('subscriptions',150,'SECRET-NETFLIX-ACCOUNT 1234567890123','item-1'),
    row('fees',20,'SECRET-DEBIT-BANK 987654321012','item-2'),
    row('unsorted',80,'PRIVATE-UNKNOWN-MERCHANT','item-3')
  ];
  const output=buildSpendCoachingRequest(entries,'2026-10-26','ZAR','');
  assert.ok(output);
  assert.equal(output.financialContext.expenseSummary.entryCount,3);
  assert.equal(output.financialContext.expenseSummary.unsortedCount,1);
  assert.equal(output.financialContext.expenseSummary.unsortedOutflow,80);
  assert.equal(output.financialContext.expenseSummary.expenses,250);
  assert.equal(output.financialContext.expenseSummary.cycleEnd,'2026-11-25');
  assert.deepEqual(output.financialContext.accounts,[]);
  assert.deepEqual(output.financialContext.expenseSummary.paymentMethods,[]);
  const text=JSON.stringify(output);
  for(const secret of ['1234567890123','987654321012','SECRET-','PRIVATE-UNKNOWN-MERCHANT'])
    assert.equal(text.includes(secret),false,secret+' leaked into AI context');
  assert.ok(output.financialContext.expenseSummary.cutIdeas.some(c=>c.category==='subscriptions'));
});
test('empty Spend cycle does not trigger a background private-AI request',()=>{
 assert.equal(buildSpendCoachingRequest([],'2026-10-26','ZAR',''),null);
});
test('Spend UI invokes only the authenticated Ollama chat after financial-sharing opt-in',async()=>{
 const file=await readFile(new URL('../artifacts/market-compass/src/components/MonthlyExpenses.tsx',import.meta.url),'utf8');
 assert.match(file,/desktopAi\.shareFinancialContext/);
 assert.match(file,/desktopAi\.enabled/);
 assert.match(file,/privateTailnetOrigin\(desktopAi\.url\)/);
 assert.match(file,/Authorization:'Bearer '\+desktopAi\.token/);
 assert.match(file,/answerSource!=='private-desktop-model'/);
 assert.match(file,/origin\+'\/api\/chat'/);
 assert.match(file,/controller\.abort\(\)/);
 assert.match(file,/automaticTipStatus/);
 assert.match(file,/No raw transactions|never raw transaction descriptions/i);
 assert.doesNotMatch(file,/localStorage\.setItem|sessionStorage\.setItem|\.sendBeacon\(/);
});
