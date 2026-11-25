import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePublicKrakenSol,parsePrivateSol,fetchSolQuote} from '../artifacts/market-compass/src/lib/solanaQuote.ts';
const sample={error:[],result:{SOLUSD:{c:['70.25'],a:['70.28'],b:['70.23']}}};
test('SOL quote parser keeps exchange/retrieval timestamps and distinguishes tradability',()=>{
 const iso='2026-11-22T15:30:00Z';
 const result=parsePublicKrakenSol(sample,iso);
 assert.equal(result.pair,'SOL/USD');
 assert.equal(result.last,70.25);
 assert.equal(result.exchangeAsOf,null);
 assert.equal(result.isExecutable,false);
 const privateQuote=parsePrivateSol({
  ok:true,kind:'spot',readOnly:true,executable:false,currency:'ZAR',
  retrievedAt:new Date().toISOString(),
  quotes:[{symbol:'SOL',pair:'SOL/ZAR',last:1240,bid:1235,ask:1245,asOf:new Date().toISOString()}]
 },'ZAR');
 assert.equal(privateQuote.source,'Luno via private hub');
 assert.equal(privateQuote.last,1240);
});
test('faked or stale data never appears as valid live exchange quote',()=>{
 assert.throws(()=>parsePublicKrakenSol({...sample,error:['err']},new Date().toISOString()),/unavailable/);
 assert.throws(()=>parsePublicKrakenSol({error:[],result:{SOLUSD:{c:['NaN'],a:['4'],b:['3']}}},new Date().toISOString()),/Invalid/);
 assert.throws(()=>parsePrivateSol({
  ok:true,kind:'spot',readOnly:true,executable:false,currency:'ZAR',
  retrievedAt:'2026-01-01T00:00:00Z',
  quotes:[{symbol:'SOL',pair:'SOL/ZAR',last:50,bid:49,ask:51}]
 },'ZAR'),/stale/);
});
test('public Kraken fallback never receives saved private Ollama token',async()=>{
 const previous=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async(url,opts)=>{
   calls.push({url,opts});return Response.json(sample);
  };
  const quote=await fetchSolQuote({privateEnabled:true,privateUrl:'https://untrusted.invalid',
   privateToken:'SECRET'.repeat(15),preferZar:true});
  assert.equal(quote.pair,'SOL/USD');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://api.kraken.com/0/public/Ticker?pair=SOLUSD');
  assert.equal(calls[0].opts.headers.Authorization,undefined);
  assert.equal(calls[0].opts.credentials,'omit');
 }finally{globalThis.fetch=previous;}
});
test('both views use one shared Solana bar, encrypted cached candles and local Orders drafts',async()=>{
 const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
 const bar=await readFile(new URL('../artifacts/market-compass/src/components/SolanaTrackingBar.tsx',import.meta.url),'utf8');
 assert.ok(app.includes("const SolanaTrackingBar=lazy(()=>import('@/components/SolanaTrackingBar'));"));
 assert.match(app,/solanaSeries: MarketSeries \| null/);
 assert.match(app,/solanaSeries: null/);
 assert.match(app,/<SolanaTrackingBar cachedSeries=/);
 assert.match(app,/setData\(old=>\(\{\.\.\.old,drafts:\[draft,\.\.\.old.drafts\]\}\)\)/);
 assert.match(bar,/NO LIVE ORDERS/);
 assert.match(bar,/Paper execution/);
 assert.match(bar,/fetchPublicCandles\('SOL','3m','auto'\)/);
 assert.match(bar,/privateToken,preferZar/);
});
