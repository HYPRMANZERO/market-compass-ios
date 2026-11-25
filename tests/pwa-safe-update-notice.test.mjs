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
test('query placeholder respects Personal and Finance use cases',()=>{
  assert.match(assistant,/placeholder=\{publicPagesEdition\s*\?/);
  assert.match(assistant,/Ask about debt or your budget/);
  assert.match(assistant,/Ask Compass about anything/);
});
