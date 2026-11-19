import type { Candle, MarketSeries } from '@workspace/api-client-react';

export type PublicVenue = 'auto' | 'kraken' | 'coinbase';
export type CandleRange = '1m' | '3m' | '6m' | '1y';

/** Calendar lookbacks use midnight UTC as an exclusive end. Today's incomplete candle is not included. */
export function historicalWindow(range: CandleRange, now = new Date()): { start: Date; end: Date } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const months = range === '1m' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth() - months;
  const day = end.getUTCDate();
  const lastOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, month, Math.min(day, lastOfTargetMonth)));
  return { start, end };
}
const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LTC', 'DOT', 'LINK', 'AVAX'];

function normalize(input: string): { base: string; currency: string } {
  const raw = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleaned = raw.startsWith('XBT') ? `BTC${raw.slice(3)}` : raw;
  const base = ASSETS.find(asset => cleaned === asset || cleaned === `${asset}USD` || cleaned === `${asset}USDT`);
  if (!base) throw new Error('Direct market import currently supports BTC, ETH, SOL, XRP, ADA, DOGE, LTC, DOT, LINK or AVAX against USD. For JSE shares and other assets, import an authorized CSV.');
  return { base, currency: 'USD' };
}
function validCandle(c: Candle) {
  return Number.isFinite(Date.parse(c.date)) && [c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) && c.low > 0 && c.high >= c.low && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close);
}
function normalizeCandles(candles: Candle[], max: number): Candle[] {
  const byTime = new Map<string, Candle>();
  candles.filter(validCandle).forEach(c => byTime.set(c.date, c));
  return [...byTime.values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-max);
}
async function jsonFrom(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Provider returned HTTP ${r.status}${r.status === 429 ? ' (rate limit)' : ''}`);
    return await r.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Market provider timed out. Try again or import CSV.');
    throw e;
  } finally { clearTimeout(timeout); }
}
function makeSeries(base: string, range: CandleRange, candles: Candle[], source: string, notice: string): MarketSeries {
  const { start, end } = historicalWindow(range);
  const selected = normalizeCandles(candles.filter(c => Date.parse(c.date) >= start.getTime() && Date.parse(c.date) < end.getTime()), 400);
  if (selected.length < 5) throw new Error(`Only ${selected.length} valid provider candles available in the selected historical period.`);
  const first = selected[0], last = selected[selected.length - 1];
  return {
    symbol: `${base}USD`, source, currency: 'USD', delayed: true,
    asOf: last.date, candles: selected,
    notice: `${notice} Calendar lookback: ${range}, requested from ${start.toISOString().slice(0, 10)} through ${new Date(end.getTime() - 86400000).toISOString().slice(0, 10)} UTC. Received ${selected.length} completed daily candles (${first.date.slice(0, 10)}–${last.date.slice(0, 10)} UTC). Today is excluded. Historical data is not a live executable quote. Rate limits and temporary outages may apply.`
  };
}
async function kraken(base: string, range: CandleRange): Promise<MarketSeries> {
  const pair = `${base === 'BTC' ? 'XBT' : base}USD`;
  const response = await jsonFrom(`https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=1440`);
  if (!response || !Array.isArray(response.error) || response.error.length) throw new Error(`Kraken: ${response?.error?.join(', ') || 'unexpected response'}`);
  const bucket = Object.entries(response.result ?? {}).find(([key]) => key !== 'last')?.[1];
  if (!Array.isArray(bucket) || bucket.length < 6) throw new Error('Kraken returned no usable candle series for this pair.');
  // Kraken's last row is still forming. Exclude it to avoid implying that it is a completed daily candle.
  const rows = bucket.slice(0, -1);
  const candles: Candle[] = rows.map((r: any) => ({
    date: new Date(Number(r[0]) * 1000).toISOString(),
    open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[6]),
  }));
  return makeSeries(base, range, candles, 'Kraken Spot REST · public OHLC', 'Source: Kraken public daily spot candles. Most recent unfinished candle excluded.');
}
async function coinbase(base: string, range: CandleRange): Promise<MarketSeries> {
  const { start, end: endDate } = historicalWindow(range);
  const days = Math.ceil((endDate.getTime() - start.getTime()) / 86400000);
  const product = `${base}-USD`;
  const end = endDate.getTime();
  const candles: Candle[] = [];
  // Coinbase Exchange returns a maximum of 300 candles per request.
  for (let back = 0; back < days; back += 200) {
    const until = new Date(end - back * 86400000).toISOString();
    const since = new Date(end - Math.min(days + 2, back + 200) * 86400000).toISOString();
    const rows = await jsonFrom(`https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles?granularity=86400&start=${encodeURIComponent(since)}&end=${encodeURIComponent(until)}`);
    if (!Array.isArray(rows)) throw new Error('Coinbase returned an unexpected candle format.');
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 6) continue;
      candles.push({ date: new Date(Number(r[0]) * 1000).toISOString(), low: Number(r[1]), high: Number(r[2]), open: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) });
    }
  }
  // Drop the current in-progress UTC day (not a completed historical candle).
  const completed = candles.filter(c => Date.parse(c.date) < end);
  return makeSeries(base, range, completed, 'Coinbase Exchange · public REST candles', 'Source: Coinbase Exchange public daily spot candles. Current UTC day excluded.');
}
export async function fetchPublicCandles(symbol: string, range: CandleRange, venue: PublicVenue): Promise<MarketSeries> {
  const { base } = normalize(symbol);
  if (venue === 'kraken') return kraken(base, range);
  if (venue === 'coinbase') return coinbase(base, range);
  try { return await kraken(base, range); }
  catch (first) {
    try { return await coinbase(base, range); }
    catch (second) {
      const a = first instanceof Error ? first.message : 'unavailable';
      const b = second instanceof Error ? second.message : 'unavailable';
      throw new Error(`No direct public exchange feed is reachable from this browser. Kraken: ${a}. Coinbase: ${b}. You can still import an authorized candle CSV.`);
    }
  }
}
