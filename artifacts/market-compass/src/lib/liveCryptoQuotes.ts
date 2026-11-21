/**
 * Verified, read-only market snapshots. Never treat provider prices as wallet
 * holdings, cash available, investment recommendations or executable quotes.
 */
export type CryptoQuote={
  id:string;name:string;symbol:string;rank:number;price:number;
  change24h:number;marketCap:number;volume24h:number;asOf:string
};
export type CryptoMarketSnapshot={
  currency:'ZAR'|'USD';source:string;sourceUrl:string;retrievedAt:string;
  providerAsOf:string;quotes:CryptoQuote[];readOnly:true
};
export const CRYPTO_REFRESH_MS=5*60_000;
const MAX_QUOTE_AGE_MS=15*60_000;

function finite(value:unknown):value is number{
  return typeof value==='number'&&Number.isFinite(value);
}
function safeString(value:unknown,max:number){
  return typeof value==='string'?value.replace(/[\u0000-\u001f<>]/g,'').slice(0,max):'';
}
function validTime(value:unknown,now:number){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value))return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&ms<=now+120_000&&now-ms<=MAX_QUOTE_AGE_MS
    ?new Date(ms).toISOString():null;
}
function readCoin(row:any,now:number):CryptoQuote|null{
  const name=safeString(row?.name,55), symbol=safeString(row?.symbol,12).toUpperCase();
  const rank=row?.rank, price=row?.price;
  const change=row?.change24h, cap=row?.marketCap,volume=row?.volume24h;
  const asOf=validTime(row?.asOf,now);
  if(!name||!/^[A-Z0-9]{2,12}$/.test(symbol)||
     !Number.isInteger(rank)||rank<1||rank>100000||
     !finite(price)||price<=0||price>1e15||
     !finite(change)||Math.abs(change)>100000||
     !finite(cap)||cap<0||!finite(volume)||volume<0||!asOf)return null;
  return {id:String(row.id).slice(0,35),name,symbol,rank,price,
    change24h:change,marketCap:cap,volume24h:volume,asOf};
}
function finalize(rows:unknown[],meta:{
  currency:'ZAR'|'USD';source:string;sourceUrl:string;
  providerAsOf:unknown;retrievedAt:unknown},now:number):CryptoMarketSnapshot {
  const providerAsOf=validTime(meta.providerAsOf,now);
  const retrievedAt=validTime(meta.retrievedAt,now);
  if(!providerAsOf||!retrievedAt)throw Error('Provider quote timestamps are unavailable or stale.');
  const quotes=rows.map(row=>readCoin(row,now)).filter((x):x is CryptoQuote=>x!==null).slice(0,12);
  if(!quotes.length)throw Error('The provider supplied no verified current quotes.');
  return {readOnly:true,source:meta.source,sourceUrl:meta.sourceUrl,
    currency:meta.currency,providerAsOf,retrievedAt,quotes};
}
export function parsePrivateCmcQuotes(raw:any, currency:'ZAR'|'USD',now=Date.now()):CryptoMarketSnapshot {
  if(raw?.ok!==true||raw.readOnly!==true||
     raw.source!=='CoinMarketCap Keyless Public API'||
     raw.currency!==currency||raw.bankVerified!==false||
     raw.notWalletBalances!==true||
     !Array.isArray(raw.quotes))
    throw Error('Protected market response was not authenticated provider data.');
  return finalize(raw.quotes,{
    currency,source:'CoinMarketCap',sourceUrl:'https://coinmarketcap.com/',
    providerAsOf:raw.providerAsOf,retrievedAt:raw.retrievedAt
  },now);
}
/** Public GitHub Pages edition can use a keyless browser-accessible provider.
 * This NEVER forwards a token or owner financial data to CoinGecko.
 */
export function parseCoinGeckoQuotes(raw:any,currency:'ZAR'|'USD',
    now=Date.now()):CryptoMarketSnapshot {
  if(!Array.isArray(raw)||raw.length>30)throw Error('Public crypto response was invalid.');
  const rows=raw.map(x=>({
    id:x?.id,name:x?.name,symbol:x?.symbol,
    rank:x?.market_cap_rank,price:x?.current_price,
    change24h:x?.price_change_percentage_24h,
    marketCap:x?.market_cap,volume24h:x?.total_volume,asOf:x?.last_updated
  }));
  const valid=rows.map(r=>readCoin(r,now)).filter((r):r is CryptoQuote=>r!==null);
  if(!valid.length)throw Error('Public market provider returned no current quotes.');
  const latest=valid.map(x=>Date.parse(x.asOf)).sort((a,b)=>b-a)[0];
  return finalize(valid,{
    currency,source:'CoinGecko Public API',sourceUrl:'https://www.coingecko.com/',
    providerAsOf:new Date(latest).toISOString(),retrievedAt:new Date(now).toISOString()
  },now);
}
export type CryptoQuoteOptions={
  currency:string;privateToken?:string;privateEnabled?:boolean;
  host?:string;signal?:AbortSignal;fetchImpl?:typeof fetch;now?:()=>number
};
/** Private site tries CoinMarketCap through the authenticated same-origin
 * HYPRBOX gateway first; keyless CoinGecko can supplement when unavailable.
 * The separate Pages PWA never sends or requests HYPRBOX tokens.
 */
export async function fetchLiveCryptoQuotes({
  currency,privateToken='',privateEnabled=false,
  host=typeof location==='undefined'?'':location.hostname,
  signal,fetchImpl=fetch,now=Date.now
}:CryptoQuoteOptions):Promise<CryptoMarketSnapshot>{
  const iso=currency==='USD'?'USD':'ZAR';
  const ngrok=/^[a-z0-9-]+\.ngrok-free\.(?:app|dev)$/.test(host);
  if(ngrok&&privateEnabled&&privateToken.length>=48){
    try{
      const result=await fetchImpl('/api/market/crypto?currency='+iso,{
        method:'GET',cache:'no-store',credentials:'same-origin',
        headers:{Accept:'application/json',Authorization:'Bearer '+privateToken},
        signal
      });
      if(!result.ok)throw Error('CoinMarketCap protected route unavailable.');
      return parsePrivateCmcQuotes(await result.json(),iso,now());
    }catch(error){
      if(signal?.aborted)throw error;
      // Do not claim CoinMarketCap prices were received if the backend is old,
      // offline, rate limited or returned an untrusted/invalid response.
    }
  }
  const url='https://api.coingecko.com/api/v3/coins/markets?vs_currency='+
    iso.toLowerCase()+'&order=market_cap_desc&per_page=12&page=1'+
    '&sparkline=false&price_change_percentage=24h';
  const response=await fetchImpl(url,{
    method:'GET',mode:'cors',credentials:'omit',redirect:'error',
    cache:'no-store',headers:{Accept:'application/json'},signal
  });
  if(!response.ok)throw Error(response.status===429
    ?'Public market provider rate limit reached. Retry later.'
    :'Public live crypto provider is unavailable.');
  return parseCoinGeckoQuotes(await response.json(),iso,now());
}
