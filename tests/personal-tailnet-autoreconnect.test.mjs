import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personalTailnetOrigin,personalSessionActive,acquirePersonalTailnetSession,
  sendPersonalTailnetAgent} from '../artifacts/market-compass/src/lib/personalTailnetAuto.ts';

const HOST='https://hyprbox.example-tailnet.ts.net',TOKEN='T'.repeat(64);
const valid={ok:true,authorized:true,modelAvailable:true,edition:'personal',readOnly:true,
  agentMode:'always-on',expiresInSeconds:900,token:TOKEN};
const reply={ok:true,readOnly:true,workspaceWritten:false,approvalExecutionEnabled:false,
  answerSource:'private-desktop-model',answer:'Private model',steps:0,maxSteps:3,trace:[]};
test('only private HTTPS tailnet names are accepted',()=>{
  assert.equal(personalTailnetOrigin(HOST),HOST);
  assert.equal(personalTailnetOrigin('hyprbox.example-tailnet.ts.net'),HOST);
});
test('HTTP, phishing hosts and user credentials are rejected',()=>{
  for(const url of ['http://hyprbox.example-tailnet.ts.net',
    'https://hyprbox.example-tailnet.ts.net.evil.test',
    'https://attacker@hyprbox.example-tailnet.ts.net'])
      assert.equal(personalTailnetOrigin(url),null);
});
test('non-default port, path, query and fragment are rejected',()=>{
  for(const url of ['https://hyprbox.example-tailnet.ts.net:1234',
    HOST+'/api/agent',HOST+'/?x=1',HOST+'/#code'])
    assert.equal(personalTailnetOrigin(url),null);
});
test('empty and non-string origins are rejected',()=>{
  for(const input of ['',null,undefined,100,{},'x'.repeat(500)])
    assert.equal(personalTailnetOrigin(input),null);
});
test('session expires at its precise expiry time and remains host-bound',()=>{
  const s={origin:HOST,token:TOKEN,expiresAt:10000};
  assert.equal(personalSessionActive(s,HOST,9999),true);
  assert.equal(personalSessionActive(s,HOST,10000),false);
  assert.equal(personalSessionActive(s,'https://other.ts.net',9999),false);
});
test('session bootstrap does not send a browser-side operator key or cookies',async()=>{
  let intercepted;
  const s=await acquirePersonalTailnetSession(HOST,async(url,options)=>{
    intercepted={url,options};return {ok:true,json:async()=>valid};
  });
  assert.equal(intercepted.url,HOST+'/api/personal/session');
  assert.equal(intercepted.options.credentials,'omit');
  assert.equal(intercepted.options.redirect,'error');
  assert.equal(intercepted.options.cache,'no-store');
  assert.equal(intercepted.options.headers,undefined);
  assert.equal(s.token,TOKEN);
});
test('offline nodes never become connected',async()=>{
  await assert.rejects(acquirePersonalTailnetSession(HOST,async()=>({ok:false})),/offline/);
});
test('a Finance identity must not be accepted as a Personal session',async()=>{
  await assert.rejects(acquirePersonalTailnetSession(HOST,async()=>({
    ok:true,json:async()=>({...valid,edition:'finance'})
  })),/Untrusted/);
});
test('missing model, unauthorized user and forged expiry are denied',async()=>{
  for(const patch of [{modelAvailable:false},{authorized:false},{expiresInSeconds:86400},
    {readOnly:false},{agentMode:'optional'},{token:'x'}]){
    await assert.rejects(acquirePersonalTailnetSession(HOST,async()=>({
      ok:true,json:async()=>({...valid,...patch})
    })),/Untrusted/);
  }
});
test('agent uses only short-lived Personal bearer, never operator token',async()=>{
  const s={origin:HOST,token:TOKEN,expiresAt:Date.now()+60000};
  let sent;
  const value=await sendPersonalTailnetAgent(s,'Help plan my day',undefined,async(url,options)=>{
    sent={url,options};return {ok:true,json:async()=>reply};
  });
  assert.equal(sent.url,HOST+'/api/personal/agent/run');
  assert.equal(sent.options.headers.Authorization,'Bearer '+TOKEN);
  assert.equal(sent.options.credentials,'omit');
  assert.deepEqual(JSON.parse(sent.options.body),{query:'Help plan my day'});
  assert.equal(value.answer,'Private model');
});
test('approved financial context is omitted unless explicitly passed',async()=>{
  const s={origin:HOST,token:TOKEN,expiresAt:Date.now()+60000};
  let data;
  await sendPersonalTailnetAgent(s,'Review budget',{currency:'ZAR'},async(url,options)=>{
    data=JSON.parse(options.body);return {ok:true,json:async()=>reply};
  });
  assert.deepEqual(data,{query:'Review budget',financialContext:{currency:'ZAR'}});
});
test('expired tokens and empty questions cannot trigger remote calls',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>reply}};
  const s={origin:HOST,token:TOKEN,expiresAt:Date.now()-1};
  await assert.rejects(sendPersonalTailnetAgent(s,'Hello',undefined,fetchImpl),/expired/);
  s.expiresAt=Date.now()+100000;
  await assert.rejects(sendPersonalTailnetAgent(s,'',undefined,fetchImpl),/Invalid/);
  await assert.rejects(sendPersonalTailnetAgent(s,'x'.repeat(2001),undefined,fetchImpl),/Invalid/);
  assert.equal(calls,0);
});
test('agent refuses a backend that claims to have written user data',async()=>{
  const s={origin:HOST,token:TOKEN,expiresAt:Date.now()+60000};
  await assert.rejects(sendPersonalTailnetAgent(s,'Hello',undefined,async()=>({
    ok:true,json:async()=>({...reply,workspaceWritten:true})
  })),/read-only/);
});
test('always-on agent is not controlled by a checkbox in the Personal UI',()=>{
  const src=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(src,/const agentMode = true/);
  assert.doesNotMatch(src,/setAgentMode\(/);
  assert.match(src,/acquireAvailablePersonalNode/);
  assert.match(src,/read-only agent/i);
});
test('the browser will not silently replay a failed remote agent POST to another node',()=>{
  const src=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(src,/setTailnetRetryNonce\(n=>n\+1\)/);
  const client=readFileSync(new URL('../artifacts/market-compass/src/lib/personalTailnetFailover.ts',import.meta.url),'utf8');
  assert.doesNotMatch(client,/\/api\/personal\/agent\/run/);
});

test('selected tailnet health cannot be masked by legacy readiness and POST is not replayed',()=>{
 const src=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
 assert.ok(src.includes('const connected=useConfiguredTailnet?tailnetConnected'));
 assert.ok(src.includes('const replyVerified=connected&&!agentRequestFailed'));
 assert.ok(src.includes('setAgentRequestFailed(true);setVerifiedReplyOrigin(null)'));
 const send=src.slice(src.indexOf('async function askDesktop'),src.indexOf('function submit('));
 assert.ok(send.indexOf('await acquireAvailablePersonalNode')<send.indexOf('await fetch(url +'));
 assert.equal(send.split('await fetch(url +').length-1,1);
});
