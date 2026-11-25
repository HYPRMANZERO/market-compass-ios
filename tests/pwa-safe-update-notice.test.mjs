import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../artifacts/market-compass/src/main.tsx',import.meta.url),'utf8');
const notice=readFileSync(new URL('../artifacts/market-compass/src/components/PwaUpdateNotice.tsx',import.meta.url),'utf8');
const assistant=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
test('update banner is mounted inside the shared PWA ErrorBoundary',()=>{
  assert.match(main,/import PwaUpdateNotice from '\.\/components\/PwaUpdateNotice'/);
  assert.match(main,/<PwaUpdateNotice\s*\/>/);
  assert.match(notice,/controllerchange/);
  assert.match(notice,/hadController\s*=\s*Boolean\(navigator\.serviceWorker\.controller\)/);
});
test('first offline install cannot cause an unnecessary refresh prompt',()=>{
  assert.match(notice,/if\s*\(hadController\)\s*setUpdateAvailable\(true\)/);
  assert.match(notice,/hadController\s*=\s*true/);
  assert.match(notice,/removeEventListener\('controllerchange',controllerChanged\)/);
});
test('refresh is user controlled, preserves vault, and can be deferred',()=>{
  assert.match(notice,/Save your current work before refreshing/);
  assert.match(notice,/onClick=\{\(\)\s*=>\s*window\.location\.reload\(\)\}/);
  assert.match(notice,/onClick=\{\(\)\s*=>\s*setUpdateAvailable\(false\)\}/);
  assert.doesNotMatch(notice,/indexedDB\.|localStorage\.|sessionStorage\.|caches\.delete|\.clear\(/);
  assert.doesNotMatch(main,/window\.location\.reload\(\)/);
});
test('installed PWA checks for a newer shell on foreground resume without background polling',()=>{
  assert.match(notice,/shouldCheckPwaOnResume/);
  assert.match(notice,/getRegistration\(import\.meta\.env\.BASE_URL\)/);
  assert.match(notice,/registration\?\.update\(\)/);
  assert.match(notice,/addEventListener\('pageshow',checkOnResume\)/);
  assert.match(notice,/addEventListener\('visibilitychange',checkOnResume\)/);
  assert.match(notice,/addEventListener\('online',checkOnResume\)/);
  assert.match(notice,/removeEventListener\('pageshow',checkOnResume\)/);
  assert.match(notice,/removeEventListener\('visibilitychange',checkOnResume\)/);
  assert.match(notice,/removeEventListener\('online',checkOnResume\)/);
  assert.doesNotMatch(notice,/setInterval\(|setTimeout\(|fetch\(|caches\.delete|localStorage\.|indexedDB\./);
});
test('browser release gate verifies decrypted backup contents instead of comparing randomized ciphertext',()=>{
  const gate=readFileSync(new URL('../scripts/browser-release-gate.mjs',import.meta.url),'utf8');
  assert.match(gate,/await crypto\.subtle\.decrypt/);
  assert.match(gate,/assert\.deepEqual\(verified\.after,verified\.before/);
  assert.doesNotMatch(gate,/assert\.equal\(restored\.ciphertext,backup\.ciphertext/);
});
test('query placeholder respects Personal and Finance use cases',()=>{
  assert.match(assistant,/placeholder=\{financeEdition\s*\?/);
  assert.match(assistant,/Ask Compass about finances/);
  assert.match(assistant,/Message Compass/);
});
