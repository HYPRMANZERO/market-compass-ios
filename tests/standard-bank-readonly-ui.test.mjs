import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  eligibleFinanceBankOrigin,validStandardBankRedirect,parseBankLinkStatus,standardBankApi,
} from '../artifacts/market-compass/src/lib/standardBankLink.ts';

const ORIGIN='https://concrete-sharper-depict.ngrok-free.dev';
const TOKEN='x'.repeat(64);
const SET={enabled:true,url:ORIGIN+'/',token:TOKEN,shareFinancialContext:false,speakReplies:false};
const STATUS={provider:'standard-bank',mode:'read-only',ready:false,linked:false,
  accounts:[],message:'Partner approval required',lastError:''};
const READY={...STATUS,ready:true};
const ACCOUNT={id:'acct-one',displayName:'Cheque account',last4:'4381',
  currency:'ZAR',balance:370.42,selected:false};
const PKCE='A'.repeat(43);
const AUTH='https://auth.standardbank.co.za/oauth/authorize?response_type=code&state=abc123&code_challenge='+PKCE+'&code_challenge_method=S256';

test('only the same protected finance origin with an enabled private client token may check bank status',()=>{
  assert.equal(eligibleFinanceBankOrigin(ORIGIN,SET,'finance'),true);
  assert.equal(eligibleFinanceBankOrigin(ORIGIN,SET,'personal'),false);
  assert.equal(eligibleFinanceBankOrigin('https://hyprmanzero.github.io',SET,'finance'),false);
  assert.equal(eligibleFinanceBankOrigin('https://evil.ngrok-free.dev',{...SET,url:ORIGIN+'/'},'finance'),false);
  assert.equal(eligibleFinanceBankOrigin(ORIGIN,{...SET,enabled:false},'finance'),false);
  assert.equal(eligibleFinanceBankOrigin(ORIGIN,{...SET,token:'short'},'finance'),false);
});
test('phishing, raw HTTP, decorated bank domains and credentials cannot become consent redirects',()=>{
  for(const value of [
    'http://auth.standardbank.co.za/oauth/authorize?'+new URL(AUTH).search.slice(1),
    'https://auth.standardbank.co.za.evil.test/oauth/authorize?'+new URL(AUTH).search.slice(1),
    'https://example.com/?state=abc&code_challenge='+PKCE+'&code_challenge_method=S256&response_type=code',
    'https://user:password@auth.standardbank.co.za/oauth/authorize?'+new URL(AUTH).search.slice(1),
    'https://auth.standardbank.co.za:8443/oauth/authorize?'+new URL(AUTH).search.slice(1),
    'https://auth.standardbank.co.za/oauth/authorize#frag',
    'javascript:alert(1)','',
  ])assert.equal(validStandardBankRedirect(value),null);
  assert.equal(validStandardBankRedirect(AUTH),AUTH);
});
test('consent URLs require state, code challenge and PKCE rather than arbitrary bank landing pages',()=>{
  assert.equal(validStandardBankRedirect('https://www.standardbank.co.za/'),null);
  assert.equal(validStandardBankRedirect('https://auth.standardbank.co.za/oauth/authorize?state=1'),null);
  assert.equal(validStandardBankRedirect(AUTH.replace('code_challenge_method=S256','code_challenge_method=plain')),null);
});
test('valid status confirms an offline partner connection without inventing accounts',()=>{
  const status=parseBankLinkStatus(STATUS);
  assert.equal(status.ready,false);assert.equal(status.linked,false);
  assert.deepEqual(status.accounts,[]);assert.equal(status.mode,'read-only');
});
test('approved account response accepts masked metadata only',()=>{
  const a=parseBankLinkStatus({...READY,linked:true,accounts:[{
    ...ACCOUNT,accountNumber:'123456789012',accessToken:'never-show-this',
  }]}).accounts[0];
  assert.deepEqual(Object.keys(a).sort(),['balance','currency','displayName','id','last4','selected']);
  assert.equal(JSON.stringify(a).includes('123456789012'),false);
});
test('bank status cannot invent amounts from strings, undefined history, missing mask or duplicate accounts',()=>{
  for(const bad of [
    {...READY,accounts:[ACCOUNT]}, // unlinked response must have zero accounts
    {...READY,linked:true,accounts:[{...ACCOUNT,balance:'1000'}]},
    {...READY,linked:true,accounts:[{...ACCOUNT,last4:'12345678'}]},
    {...READY,linked:true,accounts:[{...ACCOUNT,currency:'ZA'}]},
    {...READY,linked:true,accounts:[ACCOUNT,ACCOUNT]},
    {...READY,linked:true,accounts:[{...ACCOUNT,selected:true},{...ACCOUNT,id:'another',last4:'4431',selected:true}]},
    {...READY,accounts:Array(101).fill(ACCOUNT)},
    {provider:'other',mode:'read-only',ready:false,linked:false,accounts:[],message:'',lastError:''},
    {provider:'standard-bank',mode:'read-write',ready:true,linked:false,accounts:[],message:'',lastError:''}
  ])assert.throws(()=>parseBankLinkStatus(bad));
});
test('fetch keeps bank requests on exact same-origin API with private finance bearer',async()=>{
  const requests=[];
  const result=await standardBankApi(ORIGIN,SET,'finance','status',undefined,async(uri,init)=>{
    requests.push({uri,init});return Response.json(STATUS);
  });
  assert.equal(result.ready,false);
  assert.equal(requests.length,1);
  assert.equal(requests[0].uri,ORIGIN+'/api/banks/standard-bank/status');
  assert.equal(requests[0].init.credentials,'same-origin');
  assert.equal(requests[0].init.mode,'same-origin');
  assert.equal(requests[0].init.headers.Authorization,'Bearer '+TOKEN);
  assert.equal(requests[0].init.method,'GET');
});
test('unavailable partner returns an explicit error, never a fake linked account',async()=>{
  await assert.rejects(standardBankApi(ORIGIN,SET,'finance','connect',undefined,
    async()=>Response.json({error:'bank_not_configured'},{status:503})),/not approved/);
});
test('select request sends only the bank-approved account ID, no password or transfer fields',async()=>{
  let request;
  const result=await standardBankApi(ORIGIN,SET,'finance','select',{accountId:ACCOUNT.id},
    async(uri,init)=>{
      request={uri,init};return Response.json({...READY,linked:true,accounts:[{...ACCOUNT,selected:true}]});
    });
  assert.equal(result.accounts[0].selected,true);
  assert.equal(request.uri,ORIGIN+'/api/banks/standard-bank/select');
  assert.equal(request.init.method,'POST');
  assert.deepEqual(JSON.parse(request.init.body),{accountId:ACCOUNT.id});
  assert.equal(request.init.redirect,'error');
});
test('unknown or missing account is rejected before any backend request',async()=>{
  let calls=0;
  for(const accountId of ['', 'X'.repeat(129)]){
    await assert.rejects(standardBankApi(ORIGIN,SET,'finance','select',{accountId},
      async()=>{calls++;return Response.json(STATUS)}),/Select a verified bank account/);
  }
  assert.equal(calls,0);
});
test('official consent response must contain a validated bank authorization URL',async()=>{
  const auth=await standardBankApi(ORIGIN,SET,'finance','connect',undefined,
    async()=>Response.json({authorizationUrl:AUTH}));
  assert.equal(auth.authorizationUrl,AUTH);
  await assert.rejects(standardBankApi(ORIGIN,SET,'finance','connect',undefined,
    async()=>Response.json({authorizationUrl:'https://attacker.example/redirect'})),/verified/);
});
test('public Personal PWA cannot call bank APIs even if it knows the finance origin and bearer',async()=>{
  let called=false;
  await assert.rejects(standardBankApi(ORIGIN,SET,'personal','status',undefined,
    async()=>{called=true;return Response.json(READY)}),/only available/);
  assert.equal(called,false);
});
test('Finance UI only mounts the live connection panel for Standard Bank, never for unapproved banks',()=>{
  const carousel=readFileSync(new URL('../artifacts/market-compass/src/components/BankCarousel.tsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../artifacts/market-compass/src/components/StandardBankLinkPanel.tsx',import.meta.url),'utf8');
  assert.match(carousel,/chosen\.id==='standard-bank' && desktopAi && currentAssistantEdition\(\)==='finance'/);
  assert.match(app,/<BankCarousel desktopAi=\{data\.desktopAi\}/);
  assert.match(panel,/disabled=\{loading\}/);
  assert.match(panel,/Bank account linking is disabled/);
  assert.match(panel,/window\.location\.assign\(redirect\)/);
  assert.doesNotMatch(panel,/type="password"/);
  assert.doesNotMatch(panel,/type="tel"/);
  assert.doesNotMatch(panel,/payments\.write|transferFunds|placeTrade/);
});
