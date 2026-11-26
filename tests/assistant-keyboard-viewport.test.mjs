import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isChatKeyboardVisible,shouldBlockChatTouchScroll} from '../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts';
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
  assert.match(module,/root\.classList\.add\('mc-assistant-route'\)/);
  assert.match(module,/root\.classList\.remove\('mc-chat-input-focused','mc-chat-keyboard-open','mc-assistant-route'\)/);
  assert.match(module,/window\.scrollTo\(0,0\)/);
});
test('composer follows viewport pageTop; tabs return even if iOS keeps focus',()=>{
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-ionic-footer/);
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-mobile-tabbar/);
  assert.doesNotMatch(css,/html\.mc-chat-input-focused \.mc-mobile-tabbar/);
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-mobile-content\.mc-assistant-page/);
  assert.match(css,/top:var\(--mc-chat-visible-page-top,0px\) !important/);
  assert.match(css,/position:absolute !important/);
  assert.doesNotMatch(css,/position:fixed !important;\s*top:var\(--mc-chat-visible-top/);
  const module=read('../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts');
  assert.match(module,/visual\?\.pageTop/);
  assert.match(module,/wasKeyboardOpen&&!keyboardOpen/);
  assert.match(module,/--mc-chat-visible-page-top/);
  assert.match(css,/height:var\(--mc-chat-visible-height,100dvh\) !important/);
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-chat-log/);
  assert.doesNotMatch(css,/\.mc-chat-composer-wrap\s*\{[^}]*position:fixed/);
});
test('keyboard freezes the outer iPhone document but not message scrolling',()=>{
  const html=css.match(/html\.mc-chat-keyboard-open\s*\{([^}]+)\}/)?.[1]??'';
  const body=css.match(/html\.mc-chat-keyboard-open body\s*\{([^}]+)\}/)?.[1]??'';
  const chat=css.match(/html\.mc-chat-keyboard-open \.mc-chat-log\s*\{([^}]+)\}/)?.[1]??'';
  assert.match(html,/overflow:\s*hidden\s*!important/);
  assert.match(body,/position:\s*fixed\s*!important/);
  assert.match(body,/height:\s*100dvh\s*!important/);
  assert.match(body,/overflow:\s*hidden\s*!important/);
  assert.match(css,/html\.mc-chat-keyboard-open #root,\s*html\.mc-chat-keyboard-open ion-app\.mc-ionic-app\s*\{[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(chat,/overflow-y:\s*auto/);
  assert.match(chat,/touch-action:\s*pan-y/);
  assert.doesNotMatch(css,/html\.mc-chat-input-focused body\s*\{/);
});

test('AI route locks document in both editions, not just while keyboard is visible',()=>{
  const html=css.match(/html\.mc-assistant-route\.plt-pwa\s*\{([^}]+)\}/)?.[1]??'';
  const body=css.match(/html\.mc-assistant-route body\s*\{([^}]+)\}/)?.[1]??'';
  const chat=css.match(/html\.mc-assistant-route \.mc-chat-log\s*\{([^}]+)\}/)?.[1]??'';
  assert.match(html,/overflow:\s*hidden\s*!important/);
  assert.match(body,/position:\s*fixed\s*!important/);
  assert.match(body,/overflow:\s*hidden\s*!important/);
  assert.match(chat,/overflow-y:\s*auto/);
  const module=read('../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts');
  assert.match(module,/document\.addEventListener\('touchstart',onTouchStart,\{passive:true\}\)/);
  assert.match(module,/document\.addEventListener\('touchmove',onTouchMove,\{passive:false\}\)/);
  assert.match(module,/document\.removeEventListener\('touchmove',onTouchMove\)/);
});

test('touches scroll messages but cannot rubber-band past either edge',()=>{
  assert.equal(shouldBlockChatTouchScroll(null,15),true);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:0,scrollHeight:500,clientHeight:500},-10),true);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:0,scrollHeight:1000,clientHeight:500},10),true);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:0,scrollHeight:1000,clientHeight:500},-10),false);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:250,scrollHeight:1000,clientHeight:500},10),false);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:250,scrollHeight:1000,clientHeight:500},-10),false);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:500,scrollHeight:1000,clientHeight:500},-10),true);
  assert.equal(shouldBlockChatTouchScroll({scrollTop:500,scrollHeight:1000,clientHeight:500},10),false);
});

test('new assistant replies scroll only chat log, never the document',()=>{
  const voice=read('../artifacts/market-compass/src/components/VoiceAssistant.tsx');
  assert.match(voice,/ref=\{chatLog\} className="mc-chat-log/);
  assert.match(voice,/log\.scrollTo\(\{top:log\.scrollHeight,behavior:'smooth'\}\)/);
  assert.doesNotMatch(voice,/bottom\.current\?\.scrollIntoView/);
});

test('iPhone footer caps an inflated safe-area bottom and shares its height with the AI surface',()=>{
  assert.match(css,/--mc-mobile-footer-safe:\s*clamp\(10px,\s*env\(safe-area-inset-bottom,\s*0px\),\s*34px\)/);
  const nav=css.match(/\.mc-mobile-tabbar\s*\{([^}]+)\}/)?.[1]??'';
  assert.match(nav,/height:\s*calc\(66px\s*\+\s*var\(--mc-mobile-footer-safe\)\)/);
  assert.match(nav,/padding:\s*8px 8px var\(--mc-mobile-footer-safe\)/);
  const assistant=css.match(/\.mc-mobile-content\.mc-assistant-page\s*\{([^}]+)\}/)?.[1]??'';
  assert.match(assistant,/height:\s*calc\(var\(--mc-chat-resting-height,\s*100dvh\)\s*-\s*66px\s*-\s*var\(--mc-mobile-footer-safe\)\)/);
  assert.doesNotMatch(nav,/max\(10px,\s*env\(safe-area-inset-bottom/);
});
test('assistant viewport measurement survives navigation and clears private layout styles',()=>{
  const code=read('../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts');
  assert.match(code,/setProperty\('--mc-chat-resting-height'/);
  assert.match(code,/!keyboardOpen&&\(height>=baseline-110/);
  assert.match(code,/removeProperty\('--mc-chat-resting-height'\)/);
  assert.match(css,/html\.mc-assistant-route body\s*\{[^}]*height:var\(--mc-chat-resting-height,100dvh\)\s*!important/s);
  assert.match(code,/root\.classList\.remove\('mc-chat-input-focused','mc-chat-keyboard-open','mc-assistant-route'\)/);
});
