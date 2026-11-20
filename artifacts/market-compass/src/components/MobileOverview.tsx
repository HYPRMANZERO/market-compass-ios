import { Activity, ArrowRight, Compass, FileClock, Landmark, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'wouter';
import type { MarketSeries } from '@workspace/api-client-react';
import { approximateLocalValue, type FxReference } from '@/lib/fxRates';

type Props = {
  currency: string;
  totalDebt: number;
  accountsCount: number;
  pendingDrafts: number;
  market: MarketSeries | null;
  fxQuote?: FxReference | null;
};
const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
};
const latestDay = (market: MarketSeries) => {
  const last = market.candles?.at(-1)?.date;
  if (!last) return 'Unknown';
  const date = new Date(last);
  return Number.isNaN(date.getTime()) ? last : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export default function MobileOverview({ currency, totalDebt, accountsCount, pendingDrafts, market, fxQuote }: Props) {
  const nativeClose = market?.candles?.at(-1)?.close;
  const localClose = typeof nativeClose === 'number' && market ? approximateLocalValue(nativeClose, market.currency, currency, fxQuote) : null;
  return <div className="space-y-4 pb-3" data-testid="mobile-home">
    <section className="relative overflow-hidden rounded-[24px] bg-[hsl(165,24%,20%)] px-5 pb-6 pt-5 text-[hsl(43,35%,96%)]">
      <div className="pointer-events-none absolute -right-12 -top-8 h-52 w-52 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-2 top-7 h-36 w-36 rounded-full border border-white/10" />
      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(43,65%,76%)]">Your personal compass</span>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><Compass size={18} /></span>
        </div>
        <h1 className="max-w-[280px] font-serif text-[33px] leading-[1.05] tracking-[-.02em]">Your money.<br/>Your next move.</h1>
        <p className="mt-3 max-w-[280px] text-[13px] leading-[1.55] text-white/75">Understand your debts, check the markets and make informed decisions—without handing over bank access.</p>
        <Link href="/debt" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[hsl(43,65%,74%)] px-4 text-[13px] font-bold text-[hsl(165,26%,18%)] active:scale-[.98]">
          {accountsCount ? 'Open my debt plan' : 'Set up my debt plan'}<ArrowRight size={17} />
        </Link>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-3">
      <section className="min-w-0 rounded-[20px] border border-border bg-card p-4 shadow-sm">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(39,45%,91%)] text-[hsl(165,24%,26%)]"><WalletCards size={18} /></span>
        <div className="mt-3 text-[11px] text-muted-foreground">Entered debt balance</div>
        <div className="mt-1 break-words text-[21px] font-bold leading-tight tracking-tight">{accountsCount ? money(totalDebt,currency) : 'Not added'}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{accountsCount} {accountsCount === 1 ? 'account' : 'accounts'} · private</div>
      </section>
      <section className="min-w-0 rounded-[20px] border border-border bg-card p-4 shadow-sm">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(39,45%,91%)] text-[hsl(165,24%,26%)]"><FileClock size={18} /></span>
        <div className="mt-3 text-[11px] text-muted-foreground">Pending trade drafts</div>
        <div className="mt-1 text-[23px] font-bold tracking-tight">{pendingDrafts}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">For review only</div>
      </section>
    </div>

    <section className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold">Next step</h2>
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Debt first</span>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[hsl(165,21%,90%)] text-primary"><Landmark size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{accountsCount ? 'Review your repayment strategy' : 'Add your first debt account'}</div>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{accountsCount ? 'Review interest, minimum payments and what you can afford before deciding.' : 'Enter balances, annual interest rates and minimum monthly payments. Nothing is sent to a bank.'}</p>
        </div>
      </div>
      <Link href="/debt" className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-muted/70 px-4 text-[13px] font-semibold">
        Go to Debt Plan <ArrowRight size={16} />
      </Link>
    </section>

    <section className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-bold"><Activity size={17} className="text-primary"/> Market snapshot</h2>
        <span className="rounded-full bg-[hsl(42,56%,89%)] px-2.5 py-1 text-[10px] font-semibold text-[hsl(34,52%,34%)]">Historical</span>
      </div>
      {market ? <div className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-[22px] font-semibold">{market.symbol}</span>
          <span className="text-[11px] text-muted-foreground">{market.currency}</span>
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground">{market.candles?.length ?? 0} saved daily candles · last day {latestDay(market)} UTC</div>
        {localClose !== null && <div className="mt-3 rounded-xl bg-muted/65 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{market.currency===currency ? 'Last saved close' : 'Approximate local value'}</div>
          <div className="mt-1 text-[22px] font-bold tracking-tight">{money(localClose,currency)}</div>
          {market.currency !== currency && <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Converted from {money(nativeClose!,market.currency)} at the {fxQuote?.rateDate} daily reference rate; not live or executable.</p>}
        </div>}
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">This is an offline copy, not a live trading quote. Refresh under Markets when connected.</p>
      </div> : <p className="mt-3 text-[12px] leading-5 text-muted-foreground">No market data saved yet. Choose a symbol when you're connected; saved candles can be inspected offline.</p>}
      <Link href="/markets" className="mt-4 flex min-h-11 items-center justify-between rounded-xl border border-border px-4 text-[13px] font-semibold">
        {market ? 'Explore historical candles' : 'Explore markets'} <ArrowRight size={16} />
      </Link>
    </section>

    <div className="flex items-start gap-2 rounded-[18px] bg-muted/70 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary"/>
      <span>Private, offline-ready planning. Balances are your entries, not verified bank figures. No automatic trades or payments.</span>
    </div>
  </div>;
}
