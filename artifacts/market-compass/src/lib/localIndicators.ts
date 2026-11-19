import type { BacktestResult, Candle, MarketAnalysis } from '@workspace/api-client-react';

function sma(values: number[], count: number): number | null {
  return values.length < count ? null : values.slice(-count).reduce((a,b) => a+b, 0) / count;
}
function rsi(values: number[], window = 14): number | null {
  if (values.length <= window) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - window; i < values.length; i++) {
    const diff = values[i] - values[i-1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  if (gains === 0 && losses === 0) return 50;
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}
function atrPercent(candles: Candle[]): number | null {
  if (candles.length < 15) return null;
  let sum = 0;
  for (let i = candles.length - 14; i < candles.length; i++) {
    const c = candles[i], prev = candles[i - 1];
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  }
  return (sum / 14) / candles[candles.length - 1].close * 100;
}
export function localTechnicalReading(symbol: string, candles: Candle[]): MarketAnalysis {
  if (candles.length < 5) throw new Error('At least five completed candles are needed.');
  const values = candles.map(c => c.close);
  const sma20 = sma(values, 20), sma50 = sma(values, 50);
  const lastPrice = values[values.length-1];
  const trend = sma20 !== null && sma50 !== null ? (sma20 > sma50 ? 'up' : sma20 < sma50 ? 'down' : 'mixed') : 'mixed';
  const window = candles.slice(-Math.min(90, candles.length));
  const top = Math.max(...window.map(c => c.high));
  const bottom = Math.min(...window.map(c => c.low));
  const fibonacci = [0, .236, .382, .5, .618, .786, 1].map(ratio => ({
    ratio, label: `${(ratio * 100).toFixed(1)}%`, price: top - (top - bottom) * ratio
  }));
  return {
    symbol, lastPrice, sma20, sma50, rsi14: rsi(values), atrPercent: atrPercent(candles),
    trend, fibonacci, asOf: candles[candles.length-1].date,
    model: {
      status: 'insufficient_data', observations: candles.length, folds: 0,
      balancedAccuracy: null, positiveProbability: null,
      target: 'No trained probability forecast',
      note: 'Local indicators only. No machine-learning prediction is computed in this offline PWA. The Python model requires a separate analysis runtime and proper historical evaluation.'
    },
    caveats: [
      'Indicators describe historical spot candle patterns, not expected returns or investment advice.',
      'RSI uses a simple trailing 14-period average rather than Wilder smoothing.',
      'The current daily candle is excluded; displayed values are not executable or streaming quotes.',
      'The remote Python model has not run and no predictive probability should be inferred.'
    ]
  };
}
export function localSmaBacktest(candles: Candle[], fast: number, slow: number, feeBps: number): BacktestResult {
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast < 2 || slow <= fast || slow > 400 || candles.length <= slow + 1 || !Number.isFinite(feeBps) || feeBps < 0 || feeBps > 500) {
    throw new Error('Enter valid fast/slow windows and fees (0–500 bps), with more candles than the slow window.');
  }
  let equity=1, peak=1, maxDrawdown=0, exposure=0, changes=0;
  for(let i=slow;i<candles.length;i++){
    const history=candles.slice(0,i).map(c=>c.close);
    const fastSma=sma(history,fast)!;
    const slowSma=sma(history,slow)!;
    const desired=fastSma>slowSma?1:0;
    if(desired!==exposure) { equity *= 1-feeBps/10000; changes++; exposure=desired; }
    if(exposure) equity *= candles[i].close / candles[i-1].close;
    peak=Math.max(peak,equity);
    maxDrawdown=Math.max(maxDrawdown,1-equity/peak);
  }
  const benchmarkReturn=candles.at(-1)!.close/candles[slow-1].close-1;
  return {
    strategy: 'Local daily SMA crossover (close-to-close approximation)',
    fastWindow: fast, slowWindow: slow, feeBps,
    strategyReturn: equity-1, benchmarkReturn, maxDrawdown,
    tradeCount: changes,
    notes:[
      'Simplified historical test. Signal determined from completed prior candles; no execution venue is connected.',
      'Fee is charged on position changes; slippage, spreads, funding costs and taxes are not modeled.',
      'Historical backtest returns are not predictions of future returns.'
    ]
  };
}
