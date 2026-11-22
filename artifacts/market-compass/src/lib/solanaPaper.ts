/** SOL spot educational paper engine, Candlestick Trading Bible pp.51-99,133-136,162-166. */
export type PriceBar={date:string;open:number;high:number;low:number;close:number;volume?:number};
export type SolSignal={status:'watch'|'paper-entry-candidate';pattern:string;trend:'up'|'down'|'mixed';asOf:string;close:number;support:number;resistance:number;stop:number|null;target:number|null;rewardRisk:number|null;allocationFraction:number;riskFraction:number;reasons:string[];warnings:string[]};
export type PaperTrade={openedAt:string;closedAt:string;entry:number;exit:number;quantity:number;netPnl:number;reason:string};
const MIN_BARS=31,MAX_BARS=400;
const n=(x:number)=>Number.isFinite(x)&&x>0;
const sma=(vals:number[],period:number)=>vals.slice(-period).reduce((a,b)=>a+b,0)/period;
export function validatedSolBars(raw:PriceBar[]):PriceBar[]{
 if(!Array.isArray(raw)||raw.length<MIN_BARS||raw.length>MAX_BARS)throw Error('SOL requires 31 to 400 completed candles.');
 const bars=raw.map(x=>({...x}));let last=-Infinity;
 for(const b of bars){
  const time=Date.parse(b.date);
  if(!Number.isFinite(time)||time<=last||![b.open,b.high,b.low,b.close].every(n)||
   b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.high<b.low||b.high/b.low>3||
   (b.volume!==undefined&&(!Number.isFinite(b.volume)||b.volume<0)))
   throw Error('SOL candles invalid or out of order.');
  last=time;
 }
 return bars;
}
export function analyzeSolana(candles:PriceBar[],now=Date.now()):SolSignal{
 const bars=validatedSolBars(candles),current=bars.at(-1)!,previous=bars.at(-2)!;
 const history=bars.slice(0,-1),closes=history.map(x=>x.close);
 const ma8=sma(closes,8),ma21=sma(closes,21);
 const trend:SolSignal['trend']=ma8>ma21*1.002?'up':ma8<ma21*.998?'down':'mixed';
 const support=Math.min(...history.slice(-20).map(x=>x.low));
 const resistance=Math.max(...history.slice(-20).map(x=>x.high));
 const body=Math.max(Math.abs(current.close-current.open),current.close*.0001);
 const lowerWick=Math.min(current.open,current.close)-current.low;
 const upperWick=current.high-Math.max(current.open,current.close);
 const bullishPin=lowerWick>=2*body&&lowerWick>upperWick*1.5&&current.close>=current.open;
 const engulfing=previous.close<previous.open&&current.close>current.open&&
   current.open<=previous.close&&current.close>=previous.open;
 const inside=current.high<previous.high&&current.low>previous.low;
 const bearishPin=upperWick>=2*body&&upperWick>lowerWick*1.5;
 const pattern=bullishPin?'Bullish pin bar':engulfing?'Bullish engulfing':
   bearishPin?'Bearish pin bar':inside?'Inside bar':'No confluence pattern';
 const nearSupport=current.low<=support*1.025,stop=Math.min(current.low,support)*.995;
 const target=resistance,risk=current.close-stop,reward=target-current.close;
 const rr=risk>0&&reward>0?reward/risk:null;
 const fresh=now-Date.parse(current.date)<96*3600_000&&Date.parse(current.date)<=now;
 const reasons=[
  'Completed daily SOL/USD candles (not an intraday executable quote)',
  '8/21 SMA context: '+trend+'; current pattern: '+pattern,
  'Prior 20-bar support/resistance: '+support.toFixed(4)+' / '+resistance.toFixed(4)+' USD'
 ];
 const warnings=[
  'The book is educational FX-oriented material; pattern success on SOL is unverified.',
  'Technical patterns do not predict returns. Fees, fills and slippage can differ.',
  ...(!fresh?['Completed candle data is stale; skip new trades.']:[])
 ];
 const qualified=trend==='up'&&(bullishPin||engulfing)&&nearSupport&&rr!==null&&rr>=2&&fresh;
 if(!qualified)reasons.push('NO PAPER ENTRY: requires bullish support rejection, rising trend, reward/risk >=2 and recent data.');
 return {status:qualified?'paper-entry-candidate':'watch',pattern,trend,asOf:current.date,
  close:current.close,support,resistance,stop:qualified?stop:null,target:qualified?target:null,
  rewardRisk:qualified?rr:null,allocationFraction:.10,riskFraction:.005,reasons,warnings};
}
export function paperRiskSizing(signal:SolSignal,capitalUsd:number){
 if(!Number.isFinite(capitalUsd)||capitalUsd<20||capitalUsd>1_000_000)
  throw Error('Paper capital must be a simulated USD amount between 20 and 1,000,000.');
 if(signal.status!=='paper-entry-candidate'||signal.stop===null||signal.stop>=signal.close)
  return {quantity:0,allocationUsd:0,riskUsd:0};
 const maxSpend=capitalUsd*.10,maxRisk=capitalUsd*.005;
 const unitRisk=signal.close*1.001-signal.stop+signal.close*.003;
 const quantity=Math.max(0,Math.min(maxSpend/(signal.close*1.001),maxRisk/unitRisk));
 return {quantity,allocationUsd:quantity*signal.close*1.001,riskUsd:quantity*unitRisk};
}
/** Closed-candle historical replay only. Next-bar fill, stop-first if ambiguous. */
export function replaySolanaPaper(input:PriceBar[],simulatedUsd=100,now=Date.now()){
 const candles=validatedSolBars(input);
 if(!Number.isFinite(simulatedUsd)||simulatedUsd<20||simulatedUsd>1_000_000)
  throw Error('Simulated capital must be between 20 and 1,000,000 USD.');
 let cash=simulatedUsd,units=0,entry=0,stop=0,target=0,openedAt='';
 const trades:PaperTrade[]=[],fee=.001,slip=.001;
 for(let i=MIN_BARS;i<candles.length;i++){
  const bar=candles[i];
  if(units>0){
   const exit=bar.low<=stop?stop*(1-slip):bar.high>=target?target*(1-slip):null;
   if(exit!==null){
    const proceeds=units*exit*(1-fee);
    cash+=proceeds;trades.push({openedAt,closedAt:bar.date,entry,exit,
     quantity:units,netPnl:proceeds-units*entry*(1+fee),
     reason:bar.low<=stop?'Protective paper stop':'Historical paper target'});
    units=0;
   }
  }
  if(units!==0)continue;
  // Evaluate the previous bar only; never access the next bar before deciding.
  const signal=analyzeSolana(candles.slice(i-MIN_BARS,i),Date.parse(candles[i-1].date)+24*3600_000);
  if(signal.status!=='paper-entry-candidate'||!signal.stop||!signal.target)continue;
  const assumedEntry=bar.open*(1+slip);
  if(assumedEntry>=signal.target||assumedEntry<=signal.stop)continue;
  const unitRisk=assumedEntry-signal.stop+assumedEntry*fee*2;
  const qty=Math.min(cash*.1/(assumedEntry*(1+fee)),cash*.005/unitRisk);
  if(qty<=0||qty*assumedEntry*(1+fee)>cash)continue;
  cash-=qty*assumedEntry*(1+fee);
  units=qty;entry=assumedEntry;stop=signal.stop;target=signal.target;openedAt=bar.date;
 }
 const endUsd=cash+units*candles.at(-1)!.close*(1-fee);
 return {startUsd:simulatedUsd,endUsd,trades,feesBps:10,slippageBps:10,
  openPosition:units>0,
  notes:['Historical paper simulation only; no exchange account or actual funds.',
   'Only previously closed candles generate signals; fills estimated at next candle open.',
   'Stop assumed first when both stop and target hit within a candle.',
   'Fees and slippage of 10 bps per side are illustrative, not a live exchange quote.',
   'Spot long only. At most 10% of simulated cash deployed and 0.5% modeled equity risk.',
   'No leverage, borrowed funds, guaranteed execution or future-price forecast.']};
}
