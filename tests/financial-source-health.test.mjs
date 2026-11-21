import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFinancialSourceHealth, sourceLabels, statusLabels
} from '../artifacts/market-compass/src/lib/financialSourceHealth.ts';

const sample={
  schema:'market-compass-source-health-v1',
  checkedAt:'2026-11-21T07:30:00.000Z',
  readOnly:true,bankOAuthConnected:false,bankVerifiedCurrentBalance:false,liveBankFeeds:0,
  warningCount:1,
  sources:[
    {id:'historical_plan',kind:'planning_baseline',recordCount:1,status:'historical',
      lastRecordedAt:'2026-10-15',ageDays:37,bankVerified:false,liveProvider:false},
    {id:'owner_accounts',kind:'manual_accounts',recordCount:2,status:'recent_record',
      lastRecordedAt:'2026-11-20',ageDays:1,bankVerified:false,liveProvider:false},
    {id:'statement_exports',kind:'imported_statements',recordCount:1,status:'stale',
      lastRecordedAt:'2026-09-01',ageDays:81,bankVerified:false,liveProvider:false},
    {id:'email_exports',kind:'imported_emails',recordCount:0,status:'missing',
      lastRecordedAt:null,ageDays:null,bankVerified:false,liveProvider:false},
  ]
};

test('PWA parses dated metadata with explicit non-live descriptions',()=>{
  const result=parseFinancialSourceHealth(sample);
  assert.ok(result);
  assert.equal(result?.sources.length,4);
  assert.equal(result?.sources[0].status,'historical');
  assert.equal(result?.sources[2].status,'stale');
  assert.equal(result?.bankVerifiedCurrentBalance,false);
  assert.equal(sourceLabels.historical_plan,'Original financial plan');
  assert.match(statusLabels.recent_record,/not verified/);
});

test('PWA rejects a forged provider-live assertion and unsupported status',()=>{
  assert.equal(parseFinancialSourceHealth({...sample,liveBankFeeds:1}),null);
  assert.equal(parseFinancialSourceHealth({...sample,bankVerifiedCurrentBalance:true}),null);
  assert.equal(parseFinancialSourceHealth({...sample,sources:sample.sources.map((s,i)=>i===1?{...s,bankVerified:true}:s)}),null);
  assert.equal(parseFinancialSourceHealth({...sample,sources:sample.sources.map((s,i)=>i===2?{...s,status:'current'}:s)}),null);
});

test('PWA handles missing or older bridge response without inventing freshness',()=>{
  assert.equal(parseFinancialSourceHealth(undefined),null);
  assert.equal(parseFinancialSourceHealth(null),null);
  assert.equal(parseFinancialSourceHealth({schema:'market-compass-source-health-v0'}),null);
  assert.equal(parseFinancialSourceHealth({...sample,sources:sample.sources.slice(0,3)}),null);
  assert.equal(parseFinancialSourceHealth({...sample,sources:[...sample.sources.slice(0,3),sample.sources[0]]}),null);
});

test('PWA whitelists metadata and excludes raw amounts, account names or file paths',()=>{
  const payload={...sample,accountBalance:999999,
    sources:sample.sources.map(s=>({...s,accountNumber:'SECRET',amount:123456,filename:'bank-statement-secret.csv'}))};
  const parsed=parseFinancialSourceHealth(payload);
  assert.ok(parsed);
  const serialized=JSON.stringify(parsed);
  for(const forbidden of ['999999','123456','SECRET','bank-statement-secret.csv']){
    assert.equal(serialized.includes(forbidden),false);
  }
});

test('Missing data cannot be misrepresented as zero funds or a recent record',()=>{
  const invalid={...sample,sources:sample.sources.map((s,i)=>
    i===3?{...s,status:'recent_record'}:s)};
  assert.equal(parseFinancialSourceHealth(invalid),null);
  const empty={...sample,sources:sample.sources.map(s=>({...s,recordCount:0,status:'missing',ageDays:null,lastRecordedAt:null}))};
  assert.ok(parseFinancialSourceHealth(empty));
  assert.ok(parseFinancialSourceHealth(empty)?.sources.every(s=>s.status==='missing'));
});
