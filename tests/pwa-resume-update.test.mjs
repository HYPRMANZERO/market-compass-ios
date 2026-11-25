import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldCheckPwaOnResume,PWA_RESUME_CHECK_INTERVAL_MS
} from '../artifacts/market-compass/src/lib/pwaResumeUpdate.ts';

test('PWA checks for a new version only while online and foregrounded',()=>{
  const now=Date.UTC(2026,10,25,17);
  assert.equal(shouldCheckPwaOnResume(0,now,true,true),true);
  assert.equal(shouldCheckPwaOnResume(0,now,false,true),false);
  assert.equal(shouldCheckPwaOnResume(0,now,true,false),false);
  assert.equal(shouldCheckPwaOnResume(now-1000,now,false,false),false);
});
test('resume update checks are throttled to one every 15 minutes',()=>{
  const now=Date.UTC(2026,10,25,17);
  assert.equal(PWA_RESUME_CHECK_INTERVAL_MS,900000);
  assert.equal(shouldCheckPwaOnResume(now-1000,now,true,true),false);
  assert.equal(shouldCheckPwaOnResume(now-899999,now,true,true),false);
  assert.equal(shouldCheckPwaOnResume(now-900000,now,true,true),true);
  assert.equal(shouldCheckPwaOnResume(now-900001,now,true,true),true);
});
test('device clock correction or transient update failure can recheck safely',()=>{
  const now=Date.UTC(2026,10,25,17);
  assert.equal(shouldCheckPwaOnResume(now+1000,now,true,true),true);
  assert.equal(shouldCheckPwaOnResume(0,now,true,true),true);
  assert.equal(shouldCheckPwaOnResume(NaN,now,true,true),true);
  assert.equal(shouldCheckPwaOnResume(now,NaN,true,true),false);
});
