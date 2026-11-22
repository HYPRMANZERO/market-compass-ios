import {privateTailnetOrigin} from './privateTailnetUrl.ts';
export type SolQuote={
 pair:'SOL/USD'|'SOL/ZAR';currency:'USD'|'ZAR';last:number;bid:number;ask:number;
 source:'Kraken public ticker'|'Luno via private hub';retrievedAt:string;
 exchangeAsOf:string|null;isExecutable:false;
};
const price=(x:unknown)=>{
 if((typeof x!=='string'&&typeof x!=='number')||!Number.isFinite(Number(x))||
    Number(x)<=0||Number(x)>10000000)throw Error('Invalid SOL quote');
 return Number(x);
};
export function parsePublicKrakenSol(input:any,retrievedAt:string):SolQuote{
 if(!input||!Array.isArray(input.error)||input.error.length||
    !input.result||!input.result.SOLUSD)throw Error('Kraken SOL/USD unavailable');
 const t=input.result.SOLUSD;
 const last=price(t.c?.[0]),bid=price(t.b?.[0]),ask=price(t.a?.[0]);
 if(bid>ask*1.1||ask<bid*.9)throw Error('Kraken SOL spread invalid');
 return {pair:'SOL/USD',currency:'USD',last,bid,ask,source:'Kraken public ticker',
   retrievedAt,exchangeAsOf:null,isExecutable:false};
}
export function parsePrivateSol(input:any,expectedCurrency:'USD'|'ZAR'):SolQuote{
 if(input?.ok!==true||input?.kind!=='spot'||input?.readOnly!==true||
    input?.executable!==false||input?.currency!==expectedCurrency||
    !Array.isArray(input?.quotes))throw Error('Private market observation invalid');
 const t=input.quotes.find((q:any)=>q.symbol==='SOL');
 if(!t||t.pair!=='SOL/'+expectedCurrency)throw Error('SOL not in hub results');
 const last=price(t.last),bid=price(t.bid),ask=price(t.ask);
 if(bid>ask*1.1||ask<bid*.9)throw Error('Private SOL spread invalid');
 const age=Date.now()-Date.parse(input.retrievedAt);
 if(!Number.isFinite(age)||age>15*60_000||age < -120000)
   throw Error('Private market quote is stale');
 return {pair:t.pair,currency:expectedCurrency,last,bid,ask,
   source:expectedCurrency==='ZAR'?'Luno via private hub':'Kraken public ticker',
   retrievedAt:input.retrievedAt,exchangeAsOf:t.asOf||null,isExecutable:false};
}
export async function fetchSolQuote({
 privateEnabled=false,privateUrl='',privateToken='',preferZar=false,signal
}:{
 privateEnabled?:boolean;privateUrl?:string;privateToken?:string;
 preferZar?:boolean;signal?:AbortSignal
}={}):Promise<SolQuote>{
 const base=privateEnabled&&privateToken.length>=48?privateTailnetOrigin(privateUrl):null;
 const requested: 'USD'|'ZAR'=preferZar?'ZAR':'USD';
 if(base){
  try{
   const res=await fetch(base+'/api/market/public?type=spot&currency='+requested,{
    method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+privateToken},
    cache:'no-store',credentials:'omit',signal});
   if(res.ok)return parsePrivateSol(await res.json(),requested);
  }catch(error){if(signal?.aborted)throw error;}
 }
 // This is the only cross-origin fallback. Never send private tokens to Kraken.
 const response=await fetch('https://api.kraken.com/0/public/Ticker?pair=SOLUSD',{
  method:'GET',credentials:'omit',cache:'no-store',
  headers:{Accept:'application/json'},signal});
 if(!response.ok)throw Error('Public Kraken SOL quote unavailable.');
 return parsePublicKrakenSol(await response.json(),new Date().toISOString());
}
