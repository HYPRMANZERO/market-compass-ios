import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  approvedPersonalDevices,selectedPersonalHosts,probeApprovedPersonalDevices,
  interpretPersonalDeviceCommand
} from '../artifacts/market-compass/src/lib/personalDeviceRoster.ts';
const A='https://hyprbox.privatenet.ts.net',B='https://hyprslap.privatenet.ts.net';
const TOKEN='Z'.repeat(64);
const authorized={authorized:true,modelAvailable:true,edition:'personal',readOnly:true,
  agentMode:'always-on',expiresInSeconds:900,token:TOKEN};
test('two pinned, verified Personal peers appear under their true device labels',()=>{
  assert.deepEqual(approvedPersonalDevices([A,B]).map(x=>[x.id,x.name,x.role]),[
    ['primary','HYPRBOX','Primary'],['standby','HYPRSLAP','Standby']]);
});
test('explicit device choice never falls back to another host without permission',()=>{
  assert.deepEqual(selectedPersonalHosts([A,B],'auto'),[A,B]);
  assert.deepEqual(selectedPersonalHosts([A,B],'primary'),[A]);
  assert.deepEqual(selectedPersonalHosts([A,B],'standby'),[B]);
  assert.deepEqual(selectedPersonalHosts([A],'standby'),[]);
});
test('unknown, duplicate and phishing endpoints are never added to approved roster',()=>{
  for(const hosts of [[A,A],[A,'http://hyprslap.privatenet.ts.net'],
    [A,'https://hyprslap.privatenet.ts.net.evil.com'],[A,B,'https://other.privatenet.ts.net']]){
    assert.deepEqual(approvedPersonalDevices(hosts),[]);
    assert.deepEqual(selectedPersonalHosts(hosts,'auto'),[]);
  }
});
test('health checks contact only the approved session endpoints, without secrets',async()=>{
  const calls=[];
  const result=await probeApprovedPersonalDevices([A,B],async(uri,options)=>{
    calls.push({uri,options});
    return {ok:!uri.startsWith(B),json:async()=>authorized};
  });
  assert.deepEqual(result,{[A]:'ready',[B]:'unreachable'});
  assert.deepEqual(calls.map(x=>x.uri),[
    A+'/api/personal/session',B+'/api/personal/session']);
  for(const {options} of calls){
    assert.equal(options.method,'GET');
    assert.equal(options.credentials,'omit');
    assert.equal(options.cache,'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers,undefined);
  }
  assert.doesNotMatch(JSON.stringify(result),/ZZZZ|token|bearer/i);
});
test('unauthorized or Finance-only peers cannot report ready',async()=>{
  const result=await probeApprovedPersonalDevices([A],async()=>({
    ok:true,json:async()=>({...authorized,edition:'finance'})
  }));
  assert.deepEqual(result,{[A]:'unreachable'});
});
test('device requests are exact and cannot connect to arbitrary network hosts',()=>{
  assert.deepEqual(interpretPersonalDeviceCommand('List devices'),{kind:'list'});
  assert.deepEqual(interpretPersonalDeviceCommand('Connect to HYPRSLAP'),{kind:'select',choice:'standby'});
  assert.deepEqual(interpretPersonalDeviceCommand('Switch to HYPRBOX'),{kind:'select',choice:'primary'});
  assert.deepEqual(interpretPersonalDeviceCommand('Use automatic failover'),{kind:'select',choice:'auto'});
  assert.deepEqual(interpretPersonalDeviceCommand('connect to 192.168.1.10'),{kind:'reject'});
  assert.deepEqual(interpretPersonalDeviceCommand('scan network'),{kind:'reject'});
  assert.equal(interpretPersonalDeviceCommand('Explain my budget'),null);
});
test('Personal UI provides explicit, user-triggered device connections with no LAN scan',()=>{
  const src=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(src,/approvedPersonalDevices/);
  assert.match(src,/probeApprovedPersonalDevices/);
  assert.match(src,/selectedPersonalHosts/);
  assert.match(src,/interpretPersonalDeviceCommand/);
  assert.match(src,/Approved Compass Core devices/);
  assert.match(src,/Only preapproved private AI nodes/);
  assert.match(src,/setPersonalTailnetSession\(null\)/);
  assert.match(src,/acquireAvailablePersonalNode\(tailnetConnectHosts\)/);
});

test('a manually selected device cannot fall through to legacy connection if unavailable',()=>{
  const code=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(code,/const connected = tailnetConnected \|\| \(deviceChoice==='auto' && settings.enabled/);
  assert.match(code,/const tailnetConnected=tailnetConnectHosts.includes/);
});

test('only the approved selection enum is session-persisted, never bearer or hostnames',()=>{
  const code=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(code,/sessionStorage\.setItem\('mc-personal-device-choice-v1',choice\)/);
  assert.match(code,/saved==='primary'\|\|saved==='standby'/);
  assert.doesNotMatch(code,/sessionStorage\.setItem\([^,]+,\s*personalTailnetSession/);
});
