import {useCallback,useEffect,useRef,useState} from 'react';
import {
  CRYPTO_REFRESH_MS,fetchLiveCryptoQuotes,type CryptoMarketSnapshot
} from '@/lib/liveCryptoQuotes';

type Props={currency:string;privateToken?:string;privateEnabled?:boolean;dataSaver?:boolean};
const amount=(n:number,currency:'ZAR'|'USD')=>{
  const digits=n<0.0001?10:n<0.01?8:n<1?6:2;
  return new Intl.NumberFormat('en-ZA',{style:'currency',currency,
    minimumFractionDigits:2,maximumFractionDigits:digits}).format(n);
};
const compact=(n:number,currency:'ZAR'|'USD')=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency,notation:'compact',maximumFractionDigits:2
}).format(n);
const utc=(s:string)=>new Date(s).toLocaleString('en-ZA',{
  day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'
})+' UTC';

/** Public read-only market quotes are independent of debt figures and
 * never claim to be a live bank, wallet or trade execution quote. */
export default function LiveCryptoQuotes({currency,privateToken='',privateEnabled=false,dataSaver=false}:Props){
  const selected:'ZAR'|'USD'=currency==='USD'?'USD':'ZAR';
  const [snapshot,setSnapshot]=useState<CryptoMarketSnapshot|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const lastRequest=useRef(0);
  const pending=useRef<AbortController|null>(null);
  const refresh=useCallback(async(force=false)=>{
    const time=Date.now();
    if(time-lastRequest.current<90_000){
      if(force)setError('Market refresh is limited to one request every 90 seconds to protect free provider limits.');
      return;
    }
    lastRequest.current=time;
    pending.current?.abort();
    const controller=new AbortController();
    pending.current=controller;
    setBusy(true);setError('');
    try{
      const next=await fetchLiveCryptoQuotes({
        currency:selected,privateToken,privateEnabled,signal:controller.signal
      });
      if(controller.signal.aborted)return;
      setSnapshot(next);
    }catch(err){
      if(controller.signal.aborted)return;
      setError(err instanceof Error?err.message:'No current provider quotes are available.');
    }finally{
      if(pending.current===controller){pending.current=null;setBusy(false);}
    }
  },[selected,privateToken,privateEnabled]);
  useEffect(()=>{
    if(dataSaver){pending.current?.abort();setBusy(false);return;}
    lastRequest.current=0;
    setSnapshot(null);
    void refresh();
    const tick=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void refresh();};
    const id=window.setInterval(tick,CRYPTO_REFRESH_MS);
    document.addEventListener('visibilitychange',tick);
    window.addEventListener('online',tick);
    return ()=>{
      window.clearInterval(id);
      document.removeEventListener('visibilitychange',tick);
      window.removeEventListener('online',tick);
      pending.current?.abort();
    };
  },[refresh,dataSaver]);

  const stale=snapshot && Date.now()-Date.parse(snapshot.providerAsOf)>15*60_000;
  return <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    aria-label="Live crypto market provider quotes" data-testid="live-crypto-quotes">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
      <div>
        <h2 className="text-[16px] font-bold">Latest cryptocurrency prices</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Provider-sourced prices and 24-hour movement, separate from completed historical candles.
        </p>
      </div>
      <button type="button" onClick={()=>void refresh(true)} disabled={busy}
        className="min-h-10 rounded-xl border border-border bg-background px-4 text-[12px] font-semibold disabled:opacity-40"
        aria-label="Refresh live cryptocurrency quotes">
        {busy?'Fetching…':'Refresh quotes'}
      </button>
    </div>
    {error&&<p role="status" className="mx-4 mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[12px] leading-5">
      {error} {snapshot?'Previously retrieved quotes remain visible below with their original timestamps.':'No sample, guessed or cached-as-live prices will be shown.'}
    </p>}
    {snapshot?<>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-[11px] sm:px-5">
        <div><strong>{snapshot.source}</strong> · Latest quote {utc(snapshot.providerAsOf)}</div>
        <div className="font-semibold">{selected} · {dataSaver?'Data Saver: previously retrieved, not refreshed':stale?'Stale, refresh required':'Recent provider snapshot'}</div>
      </div>
      <div className="divide-y divide-border">
        {snapshot.quotes.map(coin=><div key={coin.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-[12px] sm:grid-cols-[minmax(0,1.3fr)_minmax(100px,.7fr)_minmax(100px,.7fr)_minmax(100px,.7fr)] sm:px-5">
          <div className="min-w-0">
            <p className="truncate font-semibold">{coin.rank}. {coin.name} <span className="text-muted-foreground">{coin.symbol}</span></p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Updated {utc(coin.asOf)}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{amount(coin.price,selected)}</p>
            <p className={'text-[11px] tabular-nums '+(coin.change24h>=0?'text-emerald-700':'text-rose-700')}>
              {coin.change24h>=0?'+':''}{coin.change24h.toFixed(2)}% / 24h
            </p>
          </div>
          <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground sm:hidden">
            <span>Market cap <strong className="text-foreground">{compact(coin.marketCap,selected)}</strong></span>
            <span>24h volume <strong className="text-foreground">{compact(coin.volume24h,selected)}</strong></span>
          </div>
          <p className="hidden text-right text-[11px] tabular-nums text-muted-foreground sm:block">
            Market cap<br/><strong className="text-foreground">{compact(coin.marketCap,selected)}</strong>
          </p>
          <p className="hidden text-right text-[11px] tabular-nums text-muted-foreground sm:block">
            24h volume<br/><strong className="text-foreground">{compact(coin.volume24h,selected)}</strong>
          </p>
        </div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-[10px] leading-5 text-muted-foreground sm:px-5">
        <span>Market data retrieved {utc(snapshot.retrievedAt)} · Not wallet holdings, verified balances, executable prices or investment advice.</span>
        <a href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Provider</a>
      </div>
    </>:<div className="p-4 text-[12px] leading-5 text-muted-foreground sm:p-5">
      {busy?'Retrieving current public market data…':'No verified current cryptocurrency quotes are available. Historical candles remain accessible below.'}
    </div>}
    {currency!=='ZAR'&&currency!=='USD'&&<p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
      The live crypto card currently supports ZAR and USD; showing ZAR. Existing market-candle currency settings are unchanged.
    </p>}
  </section>;
}
