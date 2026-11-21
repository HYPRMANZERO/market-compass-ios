import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  parsePrivateCmcQuotes,parseCoinGeckoQuotes,fetchLiveCryptoQuotes,CRYPTO_REFRESH_MS
} from '../artifacts/market-compass/src/lib/liveCryptoQuotes.ts';

const NOW=Date.parse('2026-11-21T12:30:00Z');
const cmc={
  ok:true,readOnly:true,source:'CoinMarketCap Keyless Public API',
  bankVerified:false,notWalletBalances:true,currency:'ZAR',
  providerAsOf:'2026-11-21T12:29:40Z',retrievedAt:'2026-11-21T12:30:00Z',
  quotes:[{id:1,name:'Bitcoin',symbol:'BTC',rank:1,price:1200000,change24h:-2.35,
    marketCap:500000000,volume24h:20000000,asOf:'2026-11-21T12:29:40Z'}]
};
const gecko=[{id:'bitcoin',name:'Bitcoin',symbol:'btc',market_cap_rank:1,current_price:1200000,
  market_cap:500000000,total_volume:20000000,price_change_percentage_24h:-2.35,
  last_updated:'2026-11-21T12:29:35Z'}];
test('CMC market snapshot has numeric provenance and cannot claim wallet balances',()=>{
  const got=parsePrivateCmcQuotes(cmc,'ZAR',NOW);
  assert.equal(got.source,'CoinMarketCap');
  assert.equal(got.readOnly,true);
  assert.equal(got.quotes.length,1);
  assert.equal(got.quotes[0].price,1200000);
  assert.equal(got.quotes[0].asOf,'2026-11-21T12:29:40.000Z');
  assert.equal(got.currency,'ZAR');
  assert.ok(CRYPTO_REFRESH_MS>=120000);
  assert.doesNotMatch(JSON.stringify(got),/walletBalance|apiKey|token|bankBalance/);
});
test('unsupported, stale and forged market responses fail closed',()=>{
  assert.throws(()=>parsePrivateCmcQuotes({...cmc,bankVerified:true},'ZAR',NOW),/authenticated/);
  assert.throws(()=>parsePrivateCmcQuotes({...cmc,quotes:[{...cmc.quotes[0],price:'9000'}]},'ZAR',NOW),/no verified/);
  assert.throws(()=>parsePrivateCmcQuotes({...cmc,providerAsOf:'2026-11-20T00:00:00Z'},'ZAR',NOW),/stale/);
  assert.throws(()=>parseCoinGeckoQuotes([{...gecko[0],current_price:NaN}],'ZAR',NOW),/no current/);
  assert.throws(()=>parseCoinGeckoQuotes([],'ZAR',NOW),/no current/);
});
test('Pages edition only requests public data; no private AI token is sent to public market provider',async()=>{
  let seen=[];
  const got=await fetchLiveCryptoQuotes({
    currency:'ZAR',host:'hyprmanzero.github.io',privateToken:'t'.repeat(64),
    privateEnabled:true,now:()=>NOW,
    fetchImpl:async(url,options)=>{
      seen.push({url,options});
      return Response.json(gecko);
    }
  });
  assert.equal(got.source,'CoinGecko Public API');
  assert.equal(got.quotes[0].symbol,'BTC');
  assert.equal(seen.length,1);
  assert.match(seen[0].url,/api\.coingecko\.com\/api\/v3\/coins\/markets/);
  assert.equal(seen[0].options.credentials,'omit');
  assert.doesNotMatch(JSON.stringify(seen),/tttttttt/);
});
test('protected ngrok edition sends saved token only to same-origin HYPRBOX quote route',async()=>{
  const token='secret'.repeat(10),calls=[];
  const got=await fetchLiveCryptoQuotes({
    currency:'ZAR',host:'assigned.ngrok-free.app',privateToken:token,
    privateEnabled:true,now:()=>NOW,
    fetchImpl:async(url,opts)=>{
      calls.push({url,opts});
      return Response.json(cmc);
    }
  });
  assert.equal(got.source,'CoinMarketCap');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/api/market/crypto?currency=ZAR');
  assert.equal(calls[0].opts.headers.Authorization,'Bearer '+token);
  assert.equal(calls[0].opts.credentials,'same-origin');
});
test('ngrok private quote outage falls back to keyless provider with no authorization header',async()=>{
  const calls=[];
  const got=await fetchLiveCryptoQuotes({
    currency:'ZAR',host:'assigned.ngrok-free.dev',privateToken:'s'.repeat(64),
    privateEnabled:true,now:()=>NOW,
    fetchImpl:async(url,opts)=>{
      calls.push({url,opts});
      return url.startsWith('/api/')?new Response('',{status:404}):Response.json(gecko);
    }
  });
  assert.equal(got.source,'CoinGecko Public API');
  assert.equal(calls.length,2);
  assert.equal(calls[1].opts.credentials,'omit');
  assert.deepEqual(Object.keys(calls[1].opts.headers),['Accept']);
  assert.doesNotMatch(JSON.stringify(calls[1]),/ssssssss/);
});
test('Markets page exposes provider quotes separately from daily candles',async()=>{
  const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  const component=await readFile(new URL('../artifacts/market-compass/src/components/LiveCryptoQuotes.tsx',import.meta.url),'utf8');
  assert.match(app,/<LiveCryptoQuotes currency=\{data.currency\}/);
  assert.match(component,/Latest cryptocurrency prices/);
  assert.match(component,/not wallet holdings/i);
  assert.match(component,/24h volume/i);
  assert.match(component,/Market cap/);
  assert.match(component,/sourceUrl/);
  assert.match(component,/col-span-2 flex flex-wrap[^\n]+sm:hidden/);
  assert.match(component,/sm:hidden[^\n]*>[\s\S]*?Market cap[\s\S]*?24h volume/);
});
