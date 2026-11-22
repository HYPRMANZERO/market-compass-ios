import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'wouter';
import type {MarketSeries} from '@workspace/api-client-react';
import {fetchPublicCandles} from '@/lib/publicMarkets';
import {analyzeSolana,paperRiskSizing,replaySolanaPaper} from '@/lib/solanaPaper';
import {fetchSolQuote,type SolQuote} from '@/lib/solanaQuote';

/** Shared across both PWAs, desktop browsers and laptop browsers. No live order API. */
type Props={
  cachedSeries:MarketSeries|null;
  onCache:(series:MarketSeries)=>void;
  onSaveDraft:(info:{limitPrice:number;quantity:number;rationale:string})=>void;
  privateEnabled?:boolean;privateUrl?:string;privateToken?:string;preferZar?:boolean;
};
const usd=(amount:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'USD',maximumFractionDigits:2
}).format(amount);
const stamp=(date:string)=>new Date(date).toLocaleString('en-ZA',{
  day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'
})+' UTC';
export default function SolanaTrackingBar({cachedSeries,onCache,onSaveDraft,privateEnabled,privateUrl,privateToken,preferZar}:Props){
 const [series,setSeries]=useState<MarketSeries|null>(
   cachedSeries?.symbol==='SOLUSD'?cachedSeries:null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [spotQuote,setSpotQuote]=useState<SolQuote|null>(null);
 const [quoteError,setQuoteError]=useState('');
 const [capital,setCapital]=useState('100');
 const cacheRef=useRef(onCache);cacheRef.current=onCache;
 const [view,setView]=useState<'analysis'|'paper'>('analysis');
 const lastQuote=useRef(0);
 const lastRefresh=useRef(0),request=useRef(0);
 const active=series??(cachedSeries?.symbol==='SOLUSD'?cachedSeries:null);
 useEffect(()=>{
  let alive=true;
  let controller:AbortController|null=null;
  const check=()=>{
   if(!navigator.onLine||document.visibilityState!=='visible'||Date.now()-lastQuote.current<60000)return;
   lastQuote.current=Date.now();
   controller?.abort();controller=new AbortController();
   void fetchSolQuote({privateEnabled,privateUrl,privateToken,preferZar,signal:controller.signal})
    .then(q=>{if(alive){setSpotQuote(q);setQuoteError('');}})
    .catch(e=>{if(alive&&!controller?.signal.aborted)
      setQuoteError(e instanceof Error?e.message:'SOL spot quote unavailable.');});
  };
  check();const timer=window.setInterval(check,60000);
  window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
  return ()=>{alive=false;controller?.abort();window.clearInterval(timer);
    window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};
 },[privateEnabled,privateUrl,privateToken,preferZar]);
 const analysis=useMemo(()=>{
   if(!active||active.symbol!=='SOLUSD'||active.candles.length<31)return null;
   try{return analyzeSolana(active.candles);}catch{return null;}
 },[active]);
 const simulation=useMemo(()=>{
   if(!active||active.symbol!=='SOLUSD'||active.candles.length<31)return null;
   try{return replaySolanaPaper(active.candles,Number(capital));}catch{return null;}
 },[active,capital]);
 const sizing=useMemo(()=>{
   if(!analysis)return null;
   try{return paperRiskSizing(analysis,Number(capital));}catch{return null;}
 },[analysis,capital]);
 const refresh=useCallback(async(force=false)=>{
   if(!navigator.onLine){setError('Offline: showing only saved, dated SOL candles from this encrypted workspace.');return;}
   if(!force && Date.now()-lastRefresh.current<15*60_000)return;
   const token=++request.current;
   lastRefresh.current=Date.now();
   setBusy(true);setError('');
   try{
     const next=await fetchPublicCandles('SOL','3m','auto');
     if(token!==request.current)return;
     if(next.symbol!=='SOLUSD'||next.candles.length<31)throw Error('Exchange returned insufficient completed SOL candles.');
     setSeries(next);cacheRef.current(next);
   }catch(e){
     if(token!==request.current)return;
     setError(e instanceof Error?e.message:'Unable to update SOL candles.');
   }finally{if(token===request.current)setBusy(false);}
 },[]);
 useEffect(()=>{
   let running=true;
   const start=()=>{if(running&&document.visibilityState==='visible'&&navigator.onLine)void refresh();};
   start();const interval=window.setInterval(start,15*60_000);
   document.addEventListener('visibilitychange',start);window.addEventListener('online',start);
   return ()=>{running=false;++request.current;window.clearInterval(interval);
     document.removeEventListener('visibilitychange',start);window.removeEventListener('online',start);};
 },[refresh]);
 const refreshQuote=useCallback(async()=>{
   if(!navigator.onLine)return;
   if(Date.now()-lastQuote.current<90_000)return;
   lastQuote.current=Date.now();setQuoteError('');
   try{
     const next=await fetchSolQuote({privateEnabled,privateUrl,privateToken,preferZar});
     setSpotQuote(next);
   }catch(e){setQuoteError(e instanceof Error?e.message:'SOL spot quote unavailable.');}
 },[privateEnabled,privateUrl,privateToken,preferZar]);
 useEffect(()=>{
   void refreshQuote();
   const check=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void refreshQuote();};
   const ticker=window.setInterval(check,90_000);
   document.addEventListener('visibilitychange',check);
   return ()=>{window.clearInterval(ticker);document.removeEventListener('visibilitychange',check);};
 },[refreshQuote]);
 const save=()=>{
   if(!analysis||!sizing||sizing.quantity<=0||analysis.status!=='paper-entry-candidate')return;
   onSaveDraft({
     limitPrice:analysis.close,quantity:Number(sizing.quantity.toFixed(8)),
     rationale:'UNEXECUTED SOL/USD paper-informed draft. '+analysis.pattern+
       '; trend '+analysis.trend+'; reward/risk '+analysis.rewardRisk?.toFixed(2)+
       '; closed candle '+analysis.asOf+'; stop '+analysis.stop+
       '; target '+analysis.target+
       '; 10% max simulated allocation, 0.5% modeled risk. Manual review only; no live execution.'
   });
 };
 return <section aria-label="Solana tracking" data-testid="solana-tracking-bar"
   className="mb-5 overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
     <div>
       <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Dedicated Markets tracking</div>
       <h2 className="mt-1 text-[17px] font-bold">Solana <span className="text-muted-foreground">SOL / USD</span></h2>
       <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
         Candlestick Bible study rules · completed spot candles · capital-limited paper simulation
       </p>
     </div>
     <div className="flex flex-wrap items-center gap-2">
       <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold">
         NO LIVE ORDERS
       </span>
       <button type="button" onClick={()=>void refresh(true)} disabled={busy}
         className="min-h-10 rounded-lg border border-border px-3 text-[11px] font-semibold disabled:opacity-40">
         {busy?'Loading SOL…':'Refresh SOL'}
       </button>
     </div>
   </div>
   <nav aria-label="Solana tracking sections" className="flex gap-2 px-4 pt-3 sm:px-5">
     {(['analysis','paper'] as const).map(id=><button key={id} type="button" aria-pressed={view===id}
       onClick={()=>setView(id)} className={'min-h-10 rounded-lg px-4 text-[12px] font-semibold '+(view===id?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground')}>
       {id==='analysis'?'Signals & context':'Paper execution'}
     </button>)}
   </nav>
   {spotQuote&&<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/25 px-4 py-3 text-[11px] sm:px-5">
     <div><span className="font-bold">Recent exchange quote {spotQuote.pair}: </span>
       <span className="font-bold tabular-nums">{new Intl.NumberFormat('en-ZA',{style:'currency',currency:spotQuote.currency}).format(spotQuote.last)}</span>
       <span className="ml-2 text-muted-foreground">Bid {spotQuote.bid.toFixed(2)} · Ask {spotQuote.ask.toFixed(2)}</span></div>
     <div className="text-[10px] text-muted-foreground">{spotQuote.source} · fetched {stamp(spotQuote.retrievedAt)}
       {Date.now()-Date.parse(spotQuote.retrievedAt)>180000?' · STALE':''} · not executable</div>
   </div>}
   {quoteError&&<p role="status" className="mx-4 mt-2 text-[10px] text-muted-foreground sm:mx-5">{quoteError}</p>}
   <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-[11px] sm:px-5">
     {spotQuote?<>
       <span className="font-bold tabular-nums">SOL spot {spotQuote.pair}: {new Intl.NumberFormat('en-ZA',{style:'currency',currency:spotQuote.currency,maximumFractionDigits:2}).format(spotQuote.last)}</span>
       <span className="text-muted-foreground">Bid {spotQuote.bid.toFixed(2)} / ask {spotQuote.ask.toFixed(2)} · {spotQuote.source} · retrieved {new Date(spotQuote.retrievedAt).toLocaleTimeString('en-ZA')}</span>
       <span className="font-semibold">Read-only, not executable</span>
     </>:<span className="text-muted-foreground">No verified recent SOL spot observation yet.</span>}
     <button type="button" onClick={()=>{lastQuote.current=0;void refreshQuote();}}
       className="min-h-9 rounded-lg border border-border px-3 font-semibold">Refresh spot</button>
     {quoteError&&<span role="status" className="text-muted-foreground">{quoteError}</span>}
   </div>
   {error&&<p role="status" className="mx-4 mt-3 rounded-lg border border-border bg-muted/50 p-3 text-[11px] leading-5 sm:mx-5">{error}</p>}
   {!active?<p className="p-5 text-[12px] leading-5 text-muted-foreground">
     {busy?'Fetching completed SOL candles…':'No SOL candles saved yet. Refresh when online to create a dated, offline-readable encrypted cache.'}
   </p>:<>
     <div className="grid grid-cols-2 gap-3 px-4 py-4 text-[11px] sm:grid-cols-4 sm:px-5">
       <div><div className="text-muted-foreground">Last completed candle</div><div className="mt-1 font-bold tabular-nums">{usd(active.candles.at(-1)!.close)}</div></div>
       <div><div className="text-muted-foreground">Candle as of</div><div className="mt-1 font-semibold">{stamp(active.asOf)}</div></div>
       <div><div className="text-muted-foreground">Source</div><div className="mt-1 font-semibold">{active.source}</div></div>
       <div><div className="text-muted-foreground">Candles</div><div className="mt-1 font-bold">{active.candles.length} daily</div></div>
     </div>
     {view==='analysis'&&<div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">
       {analysis?<>
         <div className="flex flex-wrap items-center gap-2">
           <span className="rounded-lg bg-muted px-3 py-2 text-[12px] font-bold">
             {analysis.status==='watch'?'WATCH / NO ENTRY':'PAPER CANDIDATE'}
           </span>
           <span className="text-[12px] font-semibold">{analysis.pattern}</span>
           <span className="text-[11px] text-muted-foreground">Higher-level trend: {analysis.trend}</span>
         </div>
         <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{analysis.reasons.join(' · ')}</p>
         <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
           Prior support {usd(analysis.support)} · resistance {usd(analysis.resistance)} ·
           source is historical, not an executable quote.
         </p>
         <div className="mt-4 flex flex-wrap gap-2">
           <button type="button" onClick={save}
             disabled={analysis.status!=='paper-entry-candidate'||!sizing||sizing.quantity<=0}
             className="min-h-10 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
             Save review-only SOL draft
           </button>
           <Link href="/orders" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[12px] font-semibold">Go to Orders</Link>
         </div>
       </>:<p className="text-[11px] text-muted-foreground">Need at least 31 valid completed SOL daily candles before the deterministic signals run.</p>}
     </div>}
     {view==='paper'&&<div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">
       <label className="block max-w-[270px] text-[11px] font-semibold">Fictitious starting capital (USD)
         <input type="number" min="20" max="1000000" step="10" value={capital}
           onChange={e=>setCapital(e.target.value)}
           className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px]" />
       </label>
       <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
         Max allocation 10% of simulated cash · modeled risk 0.5% per paper entry · spot long only · no leverage
       </p>
       {simulation?<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
         <div className="rounded-lg bg-muted p-3"><div className="text-[10px] text-muted-foreground">Starting simulation</div><div className="mt-1 text-[14px] font-bold">{usd(simulation.startUsd)}</div></div>
         <div className="rounded-lg bg-muted p-3"><div className="text-[10px] text-muted-foreground">Modelled closing equity</div><div className="mt-1 text-[14px] font-bold">{usd(simulation.endUsd)}</div></div>
         <div className="rounded-lg bg-muted p-3"><div className="text-[10px] text-muted-foreground">Simulated exits</div><div className="mt-1 text-[14px] font-bold">{simulation.trades.length}</div></div>
         <div className="col-span-2 text-[10px] leading-5 text-muted-foreground sm:col-span-3">
           {simulation.trades.slice(-3).map((t,i)=><p key={i}>{stamp(t.openedAt)} → {stamp(t.closedAt)}: {usd(t.netPnl)} simulated P/L ({t.reason})</p>)}
           <p className="mt-2">{simulation.notes.join(' ')}</p>
         </div>
       </div>:<p className="mt-3 text-[11px] text-muted-foreground">Enter $20 or more of simulated capital to run a historical, no-lookahead paper replay.</p>}
     </div>}
     <p className="border-t border-border bg-muted/25 px-4 py-3 text-[10px] leading-5 text-muted-foreground sm:px-5">
       Educational price-action rules from The Candlestick Trading Bible, pp. 51–99 and 133–166. No proven SOL win rate, guaranteed return, actual balance, model training or exchange connection.
     </p>
   </>}
 </section>;
}
