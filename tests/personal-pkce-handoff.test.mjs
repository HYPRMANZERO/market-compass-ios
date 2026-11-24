import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {verifyPersonalOrigin,isValidPersonalSession,
  beginPersonalOauth,consumePersonalOauth,askPersonalCompass} from
  '../artifacts/market-compass/src/lib/personalHandoff.ts';

const GOOD='https://owner-staging.ngrok-free.dev';
const TOKEN='A'.repeat(64), STATE='S'.repeat(32), CODE='C'.repeat(44);
const storage=new Map();
const install=(location={origin:'https://hyprmanzero.github.io',hostname:'hyprmanzero.github.io',
  pathname:'/market-compass-ios/',search:'',hash:''})=>{
  const assigned=[];
  globalThis.sessionStorage={
    setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null,
    removeItem:k=>storage.delete(k)
  };
  globalThis.window={location:{...location,assign:url=>assigned.push(url)},
    history:{state:null,replaceState:(_s,_t,url)=>assigned.push('clear:'+url)}};
  return assigned;
};
test('only exact HTTPS ngrok free domain is accepted',()=>{
  assert.equal(verifyPersonalOrigin(GOOD),GOOD);
  assert.equal(verifyPersonalOrigin('https://owned.ngrok-free.app/'),'https://owned.ngrok-free.app');
});
test('rejects HTTP, lookalikes and attacker-controlled redirect destinations',()=>{
  for(const url of ['http://owner.ngrok-free.dev','https://ngrok-free.dev.evil.example',
    'https://evil.com','javascript:alert(1)','https://owner.ngrok-free.dev.evil.com'])
    assert.throws(()=>verifyPersonalOrigin(url));
});
test('rejects URL credentials, ports, extra paths, queries and fragments',()=>{
  for(const url of ['https://user:password@owner.ngrok-free.dev',
    'https://owner.ngrok-free.dev:8443','https://owner.ngrok-free.dev/private',
    'https://owner.ngrok-free.dev/?proof=abc','https://owner.ngrok-free.dev/#code'])
    assert.throws(()=>verifyPersonalOrigin(url));
});
test('rejects malformed Personal session bearer and expired sessions',()=>{
  assert.equal(isValidPersonalSession(null),false);
  assert.equal(isValidPersonalSession({origin:GOOD,token:'weak',expiresAt:Date.now()+10000}),false);
  assert.equal(isValidPersonalSession({origin:GOOD,token:TOKEN,expiresAt:Date.now()-1}),false);
  assert.equal(isValidPersonalSession({origin:'https://evil.example',token:TOKEN,expiresAt:Date.now()+10000}),false);
  assert.equal(isValidPersonalSession({origin:GOOD,token:TOKEN,expiresAt:Date.now()+10000}),true);
});
test('only original GitHub Pages PWA may initiate protected Personal login',async()=>{
  install({origin:'https://evil.example',pathname:'/',hash:'',search:''});
  await assert.rejects(beginPersonalOauth(GOOD,GOOD),/original Compass Personal/);
});
test('PKCE begin uses a fresh challenge and no bearer in the URL',async()=>{
  storage.clear();const assigned=install();
  void beginPersonalOauth(GOOD,GOOD);
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(assigned.length,1);
  const url=new URL(assigned[0]);
  assert.equal(url.origin,GOOD);
  assert.equal(url.pathname,'/personal/connect');
  assert.equal(url.searchParams.get('challenge')?.length,43);
  assert.equal(url.searchParams.get('state')?.length>=32,true);
  assert.equal(url.search.includes('verifier'),false);
  assert.equal(url.search.includes('token'),false);
  const payload=JSON.parse(storage.get('mc-personal-pkce-pending-v1'));
  assert.equal(typeof payload.verifier,'string');
  assert.equal(payload.verifier.length>=43,true);
  assert.equal(payload.origin,GOOD);
});
test('subsequent PKCE begins cannot reuse state or verifier',async()=>{
  storage.clear();const assigned=install();
  void beginPersonalOauth(GOOD,GOOD);
  await new Promise(resolve=>setTimeout(resolve,100));
  const first=JSON.parse(storage.get('mc-personal-pkce-pending-v1'));
  void beginPersonalOauth(GOOD,GOOD);
  await new Promise(resolve=>setTimeout(resolve,100));
  const second=JSON.parse(storage.get('mc-personal-pkce-pending-v1'));
  assert.notEqual(first.state,second.state);assert.notEqual(first.verifier,second.verifier);
  assert.equal(assigned.length,2);
});
test('an OAuth callback with missing pending state fails closed and clears URL fragment',async()=>{
  storage.clear();const assigned=install({origin:'https://hyprmanzero.github.io',pathname:'/market-compass-ios/',search:'',hash:'#mc-personal-code='+CODE+'&state='+STATE});
  await assert.rejects(consumePersonalOauth(GOOD),/expired/);
  assert.equal(assigned[0],'clear:/market-compass-ios/');
});
test('an OAuth callback with mismatched state cannot exchange a code',async()=>{
  storage.clear();const assigned=install({origin:'https://hyprmanzero.github.io',pathname:'/market-compass-ios/',search:'',hash:'#mc-personal-code='+CODE+'&state='+STATE});
  storage.set('mc-personal-pkce-pending-v1',JSON.stringify({origin:GOOD,state:'X'.repeat(32),verifier:'v'.repeat(64),issuedAt:Date.now()}));
  await assert.rejects(consumePersonalOauth(GOOD),/expired or changed/);
  assert.equal(storage.size,0);assert.equal(assigned[0].startsWith('clear:'),true);
});
test('a callback after ten minutes is refused',async()=>{
  storage.clear();install({origin:'https://hyprmanzero.github.io',pathname:'/market-compass-ios/',search:'',hash:'#mc-personal-code='+CODE+'&state='+STATE});
  storage.set('mc-personal-pkce-pending-v1',JSON.stringify({origin:GOOD,state:STATE,verifier:'v'.repeat(64),issuedAt:Date.now()-610000}));
  await assert.rejects(consumePersonalOauth(GOOD),/expired or changed/);
});
test('successful exchange omits cookies, verifies source and leaves bearer only in memory',async()=>{
  storage.clear();const assigned=install({origin:'https://hyprmanzero.github.io',pathname:'/market-compass-ios/',search:'',hash:'#mc-personal-code='+CODE+'&state='+STATE});
  storage.set('mc-personal-pkce-pending-v1',JSON.stringify({origin:GOOD,state:STATE,verifier:'v'.repeat(64),issuedAt:Date.now()}));
  let call=null;globalThis.fetch=async(uri,init)=>{
    call={uri,init};
    return {ok:true,json:async()=>({edition:'personal',accessToken:TOKEN,expiresInSeconds:900})};
  };
  const session=await consumePersonalOauth(GOOD);
  assert.equal(session.origin,GOOD);assert.equal(session.token,TOKEN);
  assert.equal(session.expiresAt>Date.now(),true);
  assert.equal(call.uri,GOOD+'/api/personal/exchange');
  assert.equal(call.init.credentials,'omit');
  assert.equal(call.init.redirect,'error');
  assert.equal(call.init.referrerPolicy,'no-referrer');
  assert.equal(storage.size,0);
  assert.equal(assigned[0],'clear:/market-compass-ios/');
  assert.equal(JSON.stringify(globalThis.window).includes(TOKEN),false);
});
test('untrusted exchange response is rejected',async()=>{
  storage.clear();install({origin:'https://hyprmanzero.github.io',pathname:'/market-compass-ios/',search:'',hash:'#mc-personal-code='+CODE+'&state='+STATE});
  storage.set('mc-personal-pkce-pending-v1',JSON.stringify({origin:GOOD,state:STATE,verifier:'v'.repeat(64),issuedAt:Date.now()}));
  globalThis.fetch=async()=>({ok:true,json:async()=>({edition:'finance',accessToken:TOKEN,expiresInSeconds:900})});
  await assert.rejects(consumePersonalOauth(GOOD),/Unexpected private Personal/);
});
test('Personal chat sends only user-selected question and optional consented context',async()=>{
  const session={origin:GOOD,token:TOKEN,expiresAt:Date.now()+60000};
  let body=null,headers=null;
  globalThis.fetch=async(uri,init)=>{assert.equal(uri,GOOD+'/api/personal/chat');
    assert.equal(init.credentials,'omit');body=JSON.parse(init.body);headers=init.headers;
    return {ok:true,json:async()=>({reply:'Compass response'})};};
  assert.equal((await askPersonalCompass(session,'Plan my day')).reply,'Compass response');
  assert.deepEqual(body,{query:'Plan my day'});
  assert.equal(headers.Authorization,'Bearer '+TOKEN);
  await askPersonalCompass(session,'Review my expense categories',{currency:'ZAR'});
  assert.deepEqual(body,{query:'Review my expense categories',financialContext:{currency:'ZAR'}});
});
test('Personal chat cannot use expired tokens or send invalid questions',async()=>{
  const expired={origin:GOOD,token:TOKEN,expiresAt:Date.now()-1};
  await assert.rejects(askPersonalCompass(expired,'Hello'),/expired/);
  const valid={...expired,expiresAt:Date.now()+60000};
  await assert.rejects(askPersonalCompass(valid,''),/Invalid question/);
  await assert.rejects(askPersonalCompass(valid,'x'.repeat(2001)),/Invalid question/);
});
