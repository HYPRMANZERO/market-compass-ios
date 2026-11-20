/**
 * Public daily currency reference rates for optional approximate display ONLY.
 * Market candle prices stay in their exchange-native quote currency, and
 * personal debt balances are NEVER automatically converted.
 */
export type FxReference = {
  base: string;
  quote: string;
  rate: number;
  rateDate: string;
  fetchedAt: string;
  source: 'Frankfurter';
};
const CODE = /^[A-Z]{3}$/;
export function fxKey(base: string, quote: string) { return `${base}_${quote}`; }
export async function fetchFxReference(base: string, quote: string, signal?: AbortSignal): Promise<FxReference> {
  if (!CODE.test(base) || !CODE.test(quote) || base === quote) throw Error('Choose distinct three-letter ISO currencies.');
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`, {
    signal, cache:'no-store', headers: { Accept:'application/json' },
  });
  if (!response.ok) throw Error(`Currency reference rate not available (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw Error('Currency service returned invalid data.');
  const raw=payload as Record<string,unknown>;
  const rate=raw.rate;
  const date=raw.date;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1e8 ||
    typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw Error('Currency service returned an invalid reference rate.');
  return { base, quote, rate, rateDate:date, fetchedAt:new Date().toISOString(), source:'Frankfurter' };
}
export function approximateLocalValue(amount: number, native: string, local: string, quote?: FxReference | null): number | null {
  if (!Number.isFinite(amount) || !native || !local) return null;
  if (native === local) return amount;
  if (!quote || quote.base !== native || quote.quote !== local || !Number.isFinite(quote.rate) || quote.rate <= 0) return null;
  return amount * quote.rate;
}
