import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {
  loadMarketDataSaver,persistMarketDataSaver,MARKET_DATA_SAVER_KEY
} from '../artifacts/market-compass/src/lib/marketDataSaver.ts';

const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const app=read('../artifacts/market-compass/src/App.tsx');
const cryptoQuotes=read('../artifacts/market-compass/src/components/LiveCryptoQuotes.tsx');
const solanaFile=new URL('../artifacts/market-compass/src/components/SolanaTrackingBar.tsx',import.meta.url);

test('Market Data Saver is opt-in, per-browser and stores only a non-sensitive flag',()=>{
  const entries=new Map();
  const store={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
  assert.equal(loadMarketDataSaver(store),false);
  assert.equal(persistMarketDataSaver(true,store),true);
  assert.equal(entries.get(MARKET_DATA_SAVER_KEY),'on');
  assert.equal(loadMarketDataSaver(store),true);
  assert.equal(persistMarketDataSaver(false,store),true);
  assert.equal(loadMarketDataSaver(store),false);
  assert.deepEqual([...entries.keys()],[MARKET_DATA_SAVER_KEY]);
  assert.equal(loadMarketDataSaver({getItem:()=>{throw Error('blocked')}}),false);
  assert.equal(persistMarketDataSaver(true,{setItem:()=>{throw Error('blocked')}}),false);
});

test('Data Saver has a visible manual control, retains historical dates and does not claim free mobile internet',()=>{
  assert.match(app,/aria-label="Market Data Saver"/);
  assert.match(app,/aria-label="Data Saver for market refreshes"/);
  assert.match(app,/checked=\{dataSaver\}/);
  assert.match(app,/persistMarketDataSaver\(enabled\)/);
  assert.match(app,/Cached historical candles keep their original dates/);
  assert.match(app,/It does not make online AI, market prices or mobile connectivity carrier-data-free/);
  assert.match(app,/if \(!base \|\| base === local \|\| !navigator.onLine \|\| dataSaver\) return;/);
});

test('Data Saver prevents automatic lookback, FX and live crypto refresh without removing manual refresh',()=>{
  assert.match(app,/if \(!dataSaver && symbol\.trim\(\)/);
  assert.match(app,/void loadMarket\(symbol\.trim\(\)\.toUpperCase\(\), range, venue\)/);
  assert.match(app,/dataSaver=\{dataSaver\} currency=\{data.currency\}/);
  assert.match(cryptoQuotes,/if\(dataSaver\)\{pending.current\?\.abort\(\)/);
  assert.match(cryptoQuotes,/\[refresh,dataSaver\]/);
  assert.match(cryptoQuotes,/aria-label="Refresh live cryptocurrency quotes"/);
  assert.match(cryptoQuotes,/Data Saver: previously retrieved, not refreshed/);
  assert.doesNotMatch(cryptoQuotes,/localStorage|saveCredentials|placeOrder|executeTrade/);
});

test('Personal-only SOL data saver stops automatic market requests but still permits explicit refresh',()=>{
  if(!existsSync(solanaFile))return; // Finance edition does not include Personal SOL paper module.
  const sol=read('../artifacts/market-compass/src/components/SolanaTrackingBar.tsx');
  assert.match(app,/<SolanaTrackingBar dataSaver=\{dataSaver\}/);
  assert.match(sol,/if\(dataSaver\)return;/);
  assert.match(sol,/if\(dataSaver&&!force\)return;/);
  assert.match(sol,/\[refresh,dataSaver\]/);
  assert.match(sol,/\[refreshQuote,dataSaver\]/);
  assert.match(sol,/onClick=\{\(\)=>void refresh\(true\)\}/);
  assert.match(sol,/aria-label="Solana tracking"/);
});
