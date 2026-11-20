import type { Candle } from '@workspace/api-client-react';

/**
 * Causal, local-only historical research tools.
 * Does not predict executable prices or produce trading orders.
 *
 * Kalman: fixed-parameter 1D random-walk filter on log closing prices.
 * Markov: 3-state transitions, evaluated chronologically without using the
 * evaluation segment to fit transition probabilities.
 * Extrema: 3-bar pivot confirmed 3 completed candles AFTER its turning point.
 */
export type MarketResearchAudit = {
  count: number;
  firstDate: string;
  lastDate: string;
  noise: { lastRaw: number; lastFiltered: number; filteredDirection: 'rising' | 'falling' | 'flat'; method: string };
  markov: {
    status: 'tested' | 'insufficient_history';
    trainingPeriod: string;
    testPeriod: string;
    observations: number;
    accuracy: number | null;
    majorityBaselineAccuracy: number | null;
    lastState: 'up' | 'down' | 'flat';
    nextStateFrequencies: { up: number; down: number; flat: number } | null;
  };
  extrema: {
    pivots: number;
    latest: { kind: 'local_low' | 'local_high'; date: string; confirmedAt: string; close: number } | null;
    delayCandles: number;
  };
  warnings: string[];
};
type State = 0 | 1 | 2; // 0: down, 1: flat, 2: up
const names = ['down', 'flat', 'up'] as const;
const getState = (a: number, b: number): State => b > a * 1.0015 ? 2 : b < a * 0.9985 ? 0 : 1;
function normalize(candles: Candle[]): Candle[] {
  return [...candles].filter(c => Number.isFinite(c.close) && c.close > 0 && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(Date.parse(c.date)))
    .sort((a,b) => a.date.localeCompare(b.date));
}
/** 1D Kalman update using only the latest observation and previous state. */
export function causalKalmanCloses(candles: Candle[]): number[] {
  if (!candles.length) return [];
  const q = 0.00012; // Fixed log-price process variance, not fitted on future data
  const r = 0.0009; // Fixed log-price measurement variance
  let estimate = Math.log(candles[0].close), variance = r;
  const result: number[] = [];
  for (const candle of candles) {
    variance += q;
    const gain = variance / (variance + r);
    estimate += gain * (Math.log(candle.close) - estimate);
    variance *= 1 - gain;
    result.push(Math.exp(estimate));
  }
  return result;
}
function modeOf(rows: State[]): State {
  const counts = [0, 0, 0];
  for (const x of rows) counts[x]++;
  return counts.indexOf(Math.max(...counts)) as State;
}
function chronologicalMarkov(states: State[], dates: string[]) {
  const trainEnd = Math.floor(states.length * .7);
  if (trainEnd < 32 || states.length - trainEnd < 10) {
    return {
      status: 'insufficient_history' as const,
      trainingPeriod: '',
      testPeriod: '',
      observations: 0,
      accuracy: null,
      majorityBaselineAccuracy: null,
      lastState: names[states.at(-1) ?? 1],
      nextStateFrequencies: null,
    };
  }
  const transitions = [[0,0,0],[0,0,0],[0,0,0]];
  // Includes training-to-training transitions only.
  for (let i=1;i<trainEnd;i++) transitions[states[i-1]][states[i]]++;
  const fallback = modeOf(states.slice(0,trainEnd));
  const forecast = (prior: State): State => {
    const row = transitions[prior];
    return row.reduce((a,b)=>a+b,0) < 3 ? fallback : row.indexOf(Math.max(...row)) as State;
  };
  let correct = 0, baselineCorrect = 0;
  for (let i=trainEnd; i<states.length;i++) {
    if (forecast(states[i-1])===states[i]) correct++;
    if (fallback===states[i]) baselineCorrect++;
  }
  const sample = transitions[states.at(-1)!];
  const total = sample.reduce((a,b)=>a+b,0);
  return {
    status: 'tested' as const,
    trainingPeriod: `${dates[0].slice(0,10)} – ${dates[trainEnd-1].slice(0,10)}`,
    testPeriod: `${dates[trainEnd].slice(0,10)} – ${dates.at(-1)!.slice(0,10)}`,
    observations: states.length - trainEnd,
    accuracy: correct / (states.length - trainEnd),
    majorityBaselineAccuracy: baselineCorrect / (states.length - trainEnd),
    lastState: names[states.at(-1)!],
    nextStateFrequencies: total >= 3 ? { down: sample[0]/total, flat: sample[1]/total, up: sample[2]/total } : null,
  };
}
export function localMarketResearch(candles: Candle[]): MarketResearchAudit {
  const data = normalize(candles);
  if (data.length < 10) throw Error('At least 10 historical candles are needed for causal research checks.');
  const filtered = causalKalmanCloses(data);
  const states: State[] = [1];
  for (let i=1;i<filtered.length;i++) states.push(getState(filtered[i-1],filtered[i]));
  const markov = chronologicalMarkov(states, data.map(c=>c.date));
  const delayed: { kind: 'local_low' | 'local_high'; date: string; confirmedAt: string; close: number }[] = [];
  const lag = 3;
  for (let i=lag; i<data.length-lag;i++) {
    const around = data.slice(i-lag,i+lag+1);
    const low = data[i].low, high=data[i].high;
    if (around.every((c,j)=>j===lag || low < c.low))
      delayed.push({kind:'local_low',date:data[i].date,confirmedAt:data[i+lag].date,close:data[i].close});
    if (around.every((c,j)=>j===lag || high > c.high))
      delayed.push({kind:'local_high',date:data[i].date,confirmedAt:data[i+lag].date,close:data[i].close});
  }
  const current = filtered.at(-1)!, previous=filtered.at(-2)!;
  return {
    count: data.length, firstDate: data[0].date, lastDate: data.at(-1)!.date,
    noise: {
      lastRaw: data.at(-1)!.close,
      lastFiltered: current,
      filteredDirection: current > previous * 1.0015 ? 'rising' : current < previous * 0.9985 ? 'falling' : 'flat',
      method: 'Fixed-parameter 1D causal Kalman filter (log daily closes); not a trained forecast',
    },
    markov,
    extrema: {pivots:delayed.length,latest:delayed.at(-1) ?? null,delayCandles:lag},
    warnings: [
      'Market prices are noisy; Kalman filtering introduces lag and can obscure rapid moves.',
      'Markov transition percentages describe past observed states only. Compare test accuracy with the majority-class baseline; neither measures profitability.',
      'An extremum is identifiable here only after three later daily candles. No retrospective pivot is treated as a real-time trade signal.',
      'No transaction costs, slippage, data revisions, distribution shifts, or live execution are represented by this research panel.',
    ]
  };
}
