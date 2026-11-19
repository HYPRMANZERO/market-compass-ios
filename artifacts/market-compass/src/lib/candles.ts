import type { Candle } from '@workspace/api-client-react';

/**
 * Parse a candle CSV (date,open,high,low,close,volume) so the workspace still
 * works when a provider throttles or there is no connection. Rows that cannot
 * be read are counted and reported rather than silently dropped.
 */
export function parseCandleCsv(text: string): { candles: Candle[]; skipped: number } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('The file needs a header row and at least one candle row.');
  const header = lines[0].split(',').map((cell) => cell.trim().replace(/^"|"$/g, '').toLowerCase());
  const column = (name: string) => header.indexOf(name);
  const missing = ['date', 'open', 'high', 'low', 'close'].filter((name) => column(name) < 0);
  if (missing.length) throw new Error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);
  const volumeColumn = column('volume');
  const byTimestamp = new Map<number, Candle>();
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const date = new Date(cells[column('date')]);
    const [open, high, low, close] = ['open', 'high', 'low', 'close'].map((name) => Number(cells[column(name)]));
    const volume = volumeColumn >= 0 ? Number(cells[volumeColumn]) : 0;
    if (
      Number.isNaN(date.getTime()) ||
      ![open, high, low, close].every(Number.isFinite) ||
      high < low
    ) {
      continue;
    }
    byTimestamp.set(date.getTime(), {
      date: date.toISOString(),
      open, high, low, close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  const candles = [...byTimestamp.entries()].sort((a, b) => a[0] - b[0]).map(([, candle]) => candle);
  if (candles.length < 5) throw new Error(`Only ${candles.length} readable candles found; at least 5 are required.`);
  // Unreadable rows, malformed dates and duplicate timestamps are all reported.
  const skipped = lines.length - 1 - candles.length;
  return { candles, skipped };
}
