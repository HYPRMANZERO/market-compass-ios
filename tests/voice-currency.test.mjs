import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretCompassCommand } from '../artifacts/market-compass/src/lib/compassCommands.ts';
import { approximateLocalValue, fxKey } from '../artifacts/market-compass/src/lib/fxRates.ts';
import { privateTailnetOrigin } from '../artifacts/market-compass/src/lib/privateTailnetUrl.ts';

const data = {
  currency:'ZAR', monthlyExtra:'1000',
  accounts:[
    {name:'Credit card',balance:'12500',apr:'22',minimumPayment:'750'},
    {name:'Car finance',balance:'103000',apr:'11.5',minimumPayment:'3500'},
  ],
  privateBudget:{monthlyIncome:'16000',monthlyEssentials:'8500',liquidFunds:'8000',reserveTarget:'5000'},
  draftCount:2,
  marketCache:{symbol:'SOLUSD',currency:'USD',candles:[{date:'2026-11-18T00:00:00.000Z',close:75.5}]}
};
test('offline voice command returns real saved debt in local ZAR',()=>{
  const r=interpretCompassCommand('What is my total debt?',data);
  assert.equal(r.type,'answer');
  assert.match(r.reply,/115.?500/);
  assert.match(r.reply,/R|ZAR/);
  assert.match(r.reply,/not independently verified/i);
});
test('offline assistant reports minimums and highest APR accurately',()=>{
  assert.match(interpretCompassCommand('How much are my minimum payments?',data).reply,/4.?250/);
  assert.match(interpretCompassCommand('Which debt has highest interest?',data).reply,/Credit card/);
});
test('offline assistant computes non-authorized headroom',()=>{
  const r=interpretCompassCommand('How much extra can I afford?',data);
  assert.equal(r.type,'answer');
  assert.match(r.reply,/3.?250/);
  assert.match(r.reply,/not confirmed bank funds/i);
});
test('voice page navigation never initiates trades',()=>{
  const r=interpretCompassCommand('Open Debt Plan',data);
  assert.deepEqual({type:r.type,to:r.destination},{type:'navigate',to:'/debt'});
  const denied=interpretCompassCommand('Transfer my money to a bank account',data);
  assert.equal(denied.type,'answer');
  assert.match(denied.reply,/cannot transfer/i);
});
test('market assistant reports saved USD price and actual UTC date, not invented ZAR',()=>{
  const r=interpretCompassCommand('What is the crypto market price?',data);
  assert.match(r.reply,/USD|US\$/);
  assert.match(r.reply,/18 November 2026/);
  assert.match(r.reply,/not a live/);
});
test('incomplete user data does not fabricate a debt sum',()=>{
  const r=interpretCompassCommand('What is my debt balance?',{...data, accounts:[...data.accounts,{name:'Missing',balance:'',apr:'',minimumPayment:''}]});
  assert.match(r.reply,/missing values/i);
});
test('FX display uses a dated pair only, never relabels USD as ZAR',()=>{
  const fx={base:'USD',quote:'ZAR',rate:18.25,rateDate:'2026-11-19',fetchedAt:'2026-11-20T09:00:00.000Z',source:'Frankfurter'};
  assert.equal(fxKey('USD','ZAR'),'USD_ZAR');
  assert.equal(approximateLocalValue(10,'USD','ZAR',fx),182.5);
  assert.equal(approximateLocalValue(10,'USD','EUR',fx),null);
  assert.equal(approximateLocalValue(10,'USD','USD',fx),10);
  assert.equal(approximateLocalValue(NaN,'USD','ZAR',fx),null);
});

test('mobile AI accepts a private tailnet hostname without protocol', () => {
  assert.equal(privateTailnetOrigin('hyprbox.tail4c4b.ts.net'), 'https://hyprbox.tail4c4b.ts.net');
  assert.equal(privateTailnetOrigin('https://hyprbox.tail4c4b.ts.net/'), 'https://hyprbox.tail4c4b.ts.net');
  for (const invalid of ['http://hyprbox.tail4c4b.ts.net', 'https://somewhere.example', 'https://user:password@hyprbox.tail4c4b.ts.net/', 'https://hyprbox.tail4c4b.ts.net/path', 'https://hyprbox.tail4c4b.ts.net/?token=bad', 'https://hyprbox.tail4c4b.ts.net:444/']) {
    assert.equal(privateTailnetOrigin(invalid), null, `Rejected unsafe address: ${invalid}`);
  }
});
