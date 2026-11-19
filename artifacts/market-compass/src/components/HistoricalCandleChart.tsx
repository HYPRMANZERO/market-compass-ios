import { useEffect, useState } from 'react';
import type { Candle } from '@workspace/api-client-react';

export function utcCandleDate(value?: string | null): string {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
  });
}
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

/** Displays every candle in the loaded lookback; the date inspector works on touch devices. */
export default function HistoricalCandleChart({ candles, currency }: { candles: Candle[]; currency: string }) {
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  useEffect(() => setManualIndex(null), [candles]);
  if (!candles.length) return null;
  const selectedIndex = Math.max(0, Math.min(manualIndex ?? candles.length - 1, candles.length - 1));
  const selected = candles[selectedIndex];
  const all = candles.flatMap(c => [c.high, c.low]);
  const low = Math.min(...all), high = Math.max(...all), span = high - low || 1;
  const width = 900, height = 245, step = width / candles.length;
  const bodyWidth = Math.max(1, Math.min(8, step * 0.56));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => candles[Math.round((candles.length - 1) * f)]);
  const move = (delta: number) => setManualIndex(Math.max(0, Math.min(selectedIndex + delta, candles.length - 1)));
  return <div className="overflow-hidden px-3 pb-4 pt-4">
    <div className="mb-3 flex flex-wrap justify-between gap-2 text-[10px] text-muted-foreground">
      <span>Actual history: <strong className="text-foreground">{utcCandleDate(candles[0].date)} – {utcCandleDate(candles.at(-1)!.date)}</strong> (UTC)</span>
      <span>{candles.length} completed daily candles</span>
    </div>
    <div className="mb-2 flex justify-between text-[9px] text-muted-foreground">
      <span>{money(high, currency)}</span><span>{money(low, currency)}</span>
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] w-full" role="img"
      aria-label={`Historical daily candles from ${utcCandleDate(candles[0].date)} to ${utcCandleDate(candles.at(-1)!.date)}; inspect a specific day below`}>
      {[0, .25, .5, .75, 1].map(p => <line key={p} x1={0} x2={width} y1={height * p} y2={height * p} stroke="hsl(var(--border))" strokeDasharray="3 6" />)}
      {candles.map((c, i) => {
        const x = i * step + step / 2;
        const yHigh = height - (c.high - low) / span * height;
        const yLow = height - (c.low - low) / span * height;
        const yOpen = height - (c.open - low) / span * height;
        const yClose = height - (c.close - low) / span * height;
        const color = c.close >= c.open ? 'hsl(158 31% 40%)' : 'hsl(5 52% 53%)';
        return <g key={`${c.date}-${i}`}>
          <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.2} />
          <rect x={x - bodyWidth / 2} y={Math.min(yOpen, yClose)} width={bodyWidth}
            height={Math.max(Math.abs(yClose - yOpen), 1.5)} fill={color} rx={0.6} />
        </g>;
      })}
      <line x1={selectedIndex * step + step / 2} x2={selectedIndex * step + step / 2}
        y1={0} y2={height} stroke="hsl(var(--foreground))" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.8} />
    </svg>
    <div className="mt-2 grid grid-cols-5 gap-1 text-[9px] text-muted-foreground">
      {ticks.map((c, i) => <span key={i} className={i === 0 ? 'text-left' : i === 4 ? 'text-right' : 'text-center'}>{utcCandleDate(c.date)}</span>)}
    </div>
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold">Selected candle: {utcCandleDate(selected.date)} (UTC)</div>
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          Jump to date
          <input type="date" aria-label="Jump to historical candle date"
            min={candles[0].date.slice(0, 10)} max={candles.at(-1)!.date.slice(0, 10)}
            value={selected.date.slice(0, 10)}
            onChange={event => {
              if (!event.target.value) return;
              const index = candles.findIndex(c => c.date.slice(0, 10) >= event.target.value);
              setManualIndex(index < 0 ? candles.length - 1 : index);
            }}
            className="max-w-[155px] rounded border border-input bg-background px-2 py-1.5 text-[11px] text-foreground" />
        </label>
      </div>
      <input type="range" aria-label="Scrub through historical daily candles" className="mt-3 w-full accent-primary"
        min={0} max={candles.length - 1} step={1} value={selectedIndex}
        onChange={event => setManualIndex(Number(event.target.value))} />
      <div className="mt-1 flex items-center justify-between gap-3">
        <button type="button" onClick={() => move(-1)} disabled={selectedIndex === 0}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] disabled:opacity-40">Previous day</button>
        <span className="text-[10px] text-muted-foreground">{selectedIndex + 1} of {candles.length}</span>
        <button type="button" onClick={() => move(1)} disabled={selectedIndex === candles.length - 1}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] disabled:opacity-40">Next day</button>
      </div>
      <div role="status" className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-[11px] sm:grid-cols-4">
        <div><span className="text-muted-foreground">Open</span><div className="mono font-semibold">{money(selected.open, currency)}</div></div>
        <div><span className="text-muted-foreground">High</span><div className="mono font-semibold">{money(selected.high, currency)}</div></div>
        <div><span className="text-muted-foreground">Low</span><div className="mono font-semibold">{money(selected.low, currency)}</div></div>
        <div><span className="text-muted-foreground">Close</span><div className="mono font-semibold">{money(selected.close, currency)}</div></div>
      </div>
    </div>
  </div>;
}
