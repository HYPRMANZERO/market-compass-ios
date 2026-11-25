import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isChatKeyboardVisible} from '../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../artifacts/market-compass/src/App.tsx');
const css=read('../artifacts/market-compass/src/ionic-shell.css');
test('keyboard detection uses visual height only when composer is focused',()=>{
  assert.equal(isChatKeyboardVisible(false,844,480),false);
  assert.equal(isChatKeyboardVisible(true,844,843),false);
  assert.equal(isChatKeyboardVisible(true,844,740),false);
  assert.equal(isChatKeyboardVisible(true,844,703),true);
  assert.equal(isChatKeyboardVisible(true,844,480),true);
  assert.equal(isChatKeyboardVisible(true,844,0),false);
  assert.equal(isChatKeyboardVisible(true,NaN,500),false);
  assert.equal(isChatKeyboardVisible(true,844,NaN),false);
});
test('only the assistant route installs viewport monitoring; cleanup is mandatory',()=>{
  assert.match(app,/if\(path!=='\/assistant'\)return;/);
  assert.match(app,/return installAssistantKeyboardViewport\(\);/);
  const module=read('../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts');
  assert.match(module,/window\.visualViewport/);
  assert.match(module,/document\.addEventListener\('focusin',onFocus\)/);
  assert.match(module,/visual\?\.addEventListener\('resize',schedule\)/);
  assert.match(module,/visual\?\.addEventListener\('scroll',schedule\)/);
  assert.match(module,/window\.addEventListener\('pageshow',schedule\)/);
  assert.match(module,/root\.classList\.remove\('mc-chat-input-focused','mc-chat-keyboard-open'\)/);
  assert.match(module,/window\.scrollTo\(0,0\)/);
});
test('composer owns the visible viewport while typing, and bottom tabs return on blur',()=>{
  assert.match(css,/html\.mc-chat-input-focused \.mc-ionic-footer/);
  assert.match(css,/html\.mc-chat-input-focused \.mc-mobile-tabbar/);
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-mobile-content\.mc-assistant-page/);
  assert.match(css,/top:var\(--mc-chat-visible-top,0px\) !important/);
  assert.match(css,/height:var\(--mc-chat-visible-height,100dvh\) !important/);
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-chat-log/);
  assert.doesNotMatch(css,/\.mc-chat-composer-wrap\s*\{[^}]*position:fixed/);
});
