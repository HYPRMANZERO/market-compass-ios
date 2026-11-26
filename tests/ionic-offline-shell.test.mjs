import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('offline shell precaches the opt-in Ionic page without changing live vault data',async()=>{
  const source=await readFile(new URL('../scripts/prepare-offline-shell.mjs',import.meta.url),'utf8');
  assert.match(source,/rel === 'ionic-preview\.html'/);
  assert.match(source,/rel\.startsWith\('bank-logos\/'\)/,'bank icons should be precached for offline swipe browsing');
  assert.match(source,/protectDeployedPwaDist\(root\)/);
  assert.match(source,/__PRECACHE_JSON__/);
  assert.doesNotMatch(source,/localStorage|indexedDB|fetch\(|sendBeacon/);
});
