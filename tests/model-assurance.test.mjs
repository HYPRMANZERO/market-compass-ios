import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDebtDecision } from '../artifacts/market-compass/src/lib/debtAudit.ts';
import { localMarketResearch, causalKalmanCloses } from '../artifacts/market-compass/src/lib/marketResearch.ts';

const debts = [{ name: 'Example A', balance: 5000, apr: 20, minimumPayment: 1000 }, { name: 'Example B', balance: 9000, apr: 11, minimumPayment: 1000 }];
const cash = { accounts: debts, monthlyIncome: 12000, monthlyEssentials: 6000,
  liquidFunds: 5000, reserveTarget: 3000, proposedExtra: 1000 };
test('two independent affordability checks must pass', () => {
  const a = auditDebtDecision(cash);
  assert.equal(a.baselineHeadroom, 4000);
  assert.equal(a.adverseHeadroom, 1300);
  assert.equal(a.verdict, 'within_constraints');
  assert.equal(a.liquidAboveReserve, 2000);
});
test('adversarial income shock triggers review rather than automatic approval', () => {
  const a = auditDebtDecision({ ...cash, proposedExtra: 2500 });
  assert.equal(a.budgetPass, true);
  assert.equal(a.stressPass, false);
  assert.equal(a.verdict, 'review_required');
  assert.ok(a.reasons.some(x => x.includes('fails the stated adverse cashflow check')));
});
test('a cash shortfall, missing reserve or corrupt number fails safely', () => {
  assert.equal(auditDebtDecision({...cash, monthlyIncome: 6500}).verdict, 'unaffordable');
  assert.equal(auditDebtDecision({...cash, reserveTarget: 9000}).verdict, 'unaffordable');
  assert.throws(() => auditDebtDecision({...cash, monthlyIncome: NaN}), /Invalid/);
  assert.throws(() => auditDebtDecision({...cash, accounts: [{...debts[0], apr: 201}]}), /APR/);
});
const candles = Array.from({ length: 105 }, (_,i) => {
  const close = 100 + i*.15 + Math.sin(i/4) * 8;
  return { date: new Date(Date.UTC(2026,0,1+i)).toISOString(),
    close, open: close-.35, high: close+1.5, low: close-1.5, volume: 500 };
});
test('Kalman filter is causal and has no future-price leakage', () => {
  const full = causalKalmanCloses(candles);
  const prefix = causalKalmanCloses(candles.slice(0,40));
  assert.equal(full.length, 105);
  assert.deepEqual(full.slice(0,40), prefix);
  assert.notEqual(full.at(-1), candles.at(-1).close);
});
test('Markov evaluation has a chronologically separated holdout', () => {
  const report = localMarketResearch(candles);
  assert.equal(report.markov.status, 'tested');
  assert.ok(report.markov.observations > 15);
  assert.ok(report.markov.trainingPeriod < report.markov.testPeriod);
  assert.ok(report.markov.accuracy >= 0 && report.markov.accuracy <= 1);
  assert.ok(report.markov.majorityBaselineAccuracy >= 0 && report.markov.majorityBaselineAccuracy <= 1);
});
test('extrema are labeled only after their 3-candle confirmation delay', () => {
  const report = localMarketResearch(candles);
  assert.ok(report.extrema.pivots > 0);
  const last = report.extrema.latest;
  assert.ok(last);
  assert.ok(last.confirmedAt > last.date);
  assert.equal(report.extrema.delayCandles, 3);
});
test('short histories do not manufacture Markov accuracy', () => {
  const report = localMarketResearch(candles.slice(0,20));
  assert.equal(report.markov.status, 'insufficient_history');
  assert.equal(report.markov.accuracy, null);
});
