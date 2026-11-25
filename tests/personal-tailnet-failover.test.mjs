import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedPersonalHosts,acquireAvailablePersonalNode}
  from '../artifacts/market-compass/src/lib/personalTailnetFailover.ts';

const PRIMARY='https://hyprbox.example-tailnet.ts.net';
const BACKUP='https://hyprslap.example-tailnet.ts.net';
const TOKEN='x'.repeat(64);
const ready={ok:true,authorized:true,modelAvailable:true,edition:'personal',
  readOnly:true,agentMode:'always-on',expiresInSeconds:900,token:TOKEN};
const response=(data=ready)=>({ok:true,json:async()=>data});
test('primary host stays first when both nodes are approved',()=>{
  assert.deepEqual(approvedPersonalHosts(PRIMARY,BACKUP,''),[PRIMARY,BACKUP]);
});
test('one valid host works without fallback',()=>{
  assert.deepEqual(approvedPersonalHosts(PRIMARY,'',null),[PRIMARY]);
});
test('duplicate hosts never create extra attempted nodes',()=>{
  assert.deepEqual(approvedPersonalHosts(PRIMARY,PRIMARY,''),[PRIMARY]);
});
test('invalid primary falls back to explicitly saved private legacy host',()=>{
  assert.deepEqual(approvedPersonalHosts('https://example.com',BACKUP,PRIMARY),[PRIMARY,BACKUP]);
});
test('public or phishing host cannot become a fallback',()=>{
  assert.deepEqual(approvedPersonalHosts(PRIMARY,'https://hyprslap.example-tailnet.ts.net.evil.com',''),[PRIMARY]);
});
test('no approved primary never invents a network endpoint',()=>{
  assert.deepEqual(approvedPersonalHosts('',BACKUP,''),[]);
});
test('healthy primary is selected without contacting standby',async()=>{
  const calls=[];
  const session=await acquireAvailablePersonalNode([PRIMARY,BACKUP],async uri=>{
    calls.push(uri);return response();
  });
  assert.equal(session.origin,PRIMARY);
  assert.deepEqual(calls,[PRIMARY+'/api/personal/session']);
});
test('offline primary fails over to healthy standby',async()=>{
  const calls=[];
  const session=await acquireAvailablePersonalNode([PRIMARY,BACKUP],async uri=>{
    calls.push(uri);
    return uri.startsWith(PRIMARY)?{ok:false}:response();
  });
  assert.equal(session.origin,BACKUP);
  assert.deepEqual(calls,[PRIMARY+'/api/personal/session',BACKUP+'/api/personal/session']);
});
test('network exception on primary does not prevent standby health check',async()=>{
  const session=await acquireAvailablePersonalNode([PRIMARY,BACKUP],async uri=>{
    if(uri.startsWith(PRIMARY))throw Error('offline');
    return response();
  });
  assert.equal(session.origin,BACKUP);
});
test('untrusted finance-only node is skipped in favor of Personal standby',async()=>{
  const session=await acquireAvailablePersonalNode([PRIMARY,BACKUP],async uri=>
    response(uri.startsWith(PRIMARY)?{...ready,edition:'finance'}:ready));
  assert.equal(session.origin,BACKUP);
});
test('a reachable standby without model availability is not a valid fallback',async()=>{
  await assert.rejects(acquireAvailablePersonalNode([PRIMARY,BACKUP],async uri=>
    response(uri.startsWith(PRIMARY)?{...ready,modelAvailable:false}:{...ready,authorized:false})),/unavailable/);
});
test('no server reachable produces an explicit offline outcome',async()=>{
  await assert.rejects(acquireAvailablePersonalNode([PRIMARY,BACKUP],async()=>{throw Error('network unreachable');}),/unavailable/);
});
test('arbitrary third host or extra failover address is rejected',async()=>{
  await assert.rejects(acquireAvailablePersonalNode([PRIMARY,BACKUP,'https://third.example.ts.net']),/Only one primary/);
});
test('duplicate or malformed candidate fails before any unwanted request',async()=>{
  let calls=0;
  await assert.rejects(acquireAvailablePersonalNode([PRIMARY,PRIMARY],async()=>{
    calls++;return {ok:false};
  }),/Unapproved/);
  assert.equal(calls,1);
});
