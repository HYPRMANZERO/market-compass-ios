import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  CASHFLOW_REVIEW_HREF,CASHFLOW_REVIEW_QUESTION,
  isCashflowReviewHandoff,describeLocalCashflowReview
} from '../artifacts/market-compass/src/lib/cashflowReviewHandoff.ts';

const sample={
  currency:'ZAR',
  expenseSummary:{
    cycleStart:'2026-11-26',cycleEnd:'2026-12-25',
    income:10400,expenses:3552.50,debtPayments:600.20,
    transfers:500,recordedDifference:6247.30,entryCount:4,
    cycleLimit:null,flags:[],unsortedCount:1
  }
};
test('handoff link contains ONLY a constant, not amounts, ids or bank data',()=>{
  assert.equal(CASHFLOW_REVIEW_HREF,'/assistant?review=cashflow');
  assert.equal(isCashflowReviewHandoff('?review=cashflow'),true);
  assert.equal(isCashflowReviewHandoff('?review=other'),false);
  assert.equal(isCashflowReviewHandoff('?review=cashflow-extra'),false);
  assert.equal(isCashflowReviewHandoff('?review=cashflow'.padEnd(180,'x')),false);
  assert.ok(CASHFLOW_REVIEW_QUESTION.length<=500);
  assert.match(CASHFLOW_REVIEW_QUESTION,/recorded.*cash flow/i);
  assert.doesNotMatch(CASHFLOW_REVIEW_HREF,/ZAR|salary|expense|amount|token|bank|10400/i);
});
test('approved cycle aggregates are described without claiming bank verification',()=>{
  const before=JSON.stringify(sample);
  const text=describeLocalCashflowReview(sample);
  assert.match(text,/2026-11-26 to 2026-12-25/);
  assert.match(text,/4 approved entries/);
  assert.match(text,/10.400|10,400|10 400/);
  assert.match(text,/600.20|600,20|600\.20/);
  assert.match(text,/category review/);
  assert.match(text,/NOT a bank-verified balance or spendable cash/);
  assert.equal(JSON.stringify(sample),before);
});
test('empty cycle never suggests no spending or lost prior records',()=>{
  const text=describeLocalCashflowReview({
    ...sample,expenseSummary:{...sample.expenseSummary,entryCount:0}
  });
  assert.match(text,/No approved transactions/);
  assert.match(text,/older records are missing/);
});
test('unavailable or invalid evidence fails closed rather than fabricating figures',()=>{
  assert.match(describeLocalCashflowReview({currency:'ZAR'}),/not available/);
  const invalid=describeLocalCashflowReview({
    ...sample,expenseSummary:{...sample.expenseSummary,income:NaN}
  });
  assert.match(invalid,/need review/);
  assert.doesNotMatch(invalid,/spendable amount is/);
});
test('Spend button passes route intent and warns before abandoning an unsaved expense form',async()=>{
  const comp=await readFile(new URL('../artifacts/market-compass/src/components/MonthlyExpenses.tsx',import.meta.url),'utf8');
  assert.match(comp,/href=\{CASHFLOW_REVIEW_HREF\}/);
  assert.match(comp,/if\(unsavedEntry&&!window\.confirm\(/);
  assert.match(comp,/event\.preventDefault\(\)/);
  assert.doesNotMatch(comp,/href=\{[^}]*JSON\.stringify/);
});
test('AI page displays local evidence and draft without auto-sending to gateway',async()=>{
  const comp=await readFile(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(comp,/isCashflowReviewHandoff\(window\.location\.search\)/);
  assert.match(comp,/describeLocalCashflowReview\(context\)/);
  assert.match(comp,/cashflowReview\?CASHFLOW_REVIEW_QUESTION:''/);
  assert.match(comp,/aria-label="Cash-flow review from Spend"/);
  assert.match(comp,/Private AI is not connected on this iPhone/);
  assert.match(comp,/Back to Spend/);
  assert.doesNotMatch(comp,/useEffect\(\(\)=>\{[^}]{0,400}submit\(CASHFLOW_REVIEW_QUESTION\)/s);
});
