import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('../artifacts/market-compass/src/index.css',import.meta.url),'utf8');
const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');

test('iPhone shell paints opaque mobile header and tabs without iOS blur artifacts',()=>{
  assert.match(css,/\.mc-mobile-header\s*\{[\s\S]*?background-color:\s*hsl\(165 24% 19%\);[\s\S]*?-webkit-backdrop-filter:\s*none;[\s\S]*?backdrop-filter:\s*none;/);
  assert.match(css,/\.mc-mobile-tabbar\s*\{[\s\S]*?background-color:\s*hsl\(44 33% 99%\);[\s\S]*?-webkit-backdrop-filter:\s*none;[\s\S]*?backdrop-filter:\s*none;/);
  assert.doesNotMatch(app,/mc-mobile-tabbar[^"]*backdrop-blur/);
});

test('iPhone standalone mode uses top and bottom safe areas, without page content under tabs',()=>{
  assert.match(css,/@media \(display-mode: standalone\) and \(max-width: 1023px\)/);
  assert.match(css,/\.mc-mobile-header\s*\{\s*padding-top:\s*calc\(12px \+ env\(safe-area-inset-top\)\);/);
  assert.match(css,/\.mc-mobile-content\s*\{\s*padding-bottom:\s*calc\(84px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(css,/\.mc-mobile-tabbar\s*\{\s*padding-bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\);/);
  assert.match(css,/scroll-padding-top: calc\(82px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css,/scroll-padding-bottom: calc\(78px \+ env\(safe-area-inset-bottom\)\)/);
});

test('navigation and Safari route-change scroll placement remain deterministic',()=>{
  assert.match(app,/mc-mobile-header sticky top-0 z-30/);
  assert.match(app,/mc-mobile-tabbar fixed inset-x-0 bottom-0 z-40/);
  assert.match(app,/window\.requestAnimationFrame\(reset\)/);
  assert.match(app,/window\.cancelAnimationFrame\(frame\)/);
  assert.match(app,/mc-mobile-content/);
});

test('header reports phone connectivity, not a potentially unverified desktop AI connection',()=>{
  assert.match(app,/iPhone online/);
  assert.match(app,/iPhone offline/);
  assert.doesNotMatch(app,/\{online \? 'Connected' : 'Offline'\} · \{active\.label\}/);
});
