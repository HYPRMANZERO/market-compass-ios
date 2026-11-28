import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isChatKeyboardVisible,shouldBlockChatTouchScroll,assistantRestingViewportGeometry,chatSurfaceVisibleTop} from '../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts';
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

test('resting iPhone visual viewport anchors tabs above hidden layout bottom',()=>{
  const ordinary=assistantRestingViewportGeometry(844,844,0,101);
  assert.deepEqual(ordinary,{visibleBottom:844,bottomInset:0,tabbarHeight:101});
  assert.equal(ordinary.visibleBottom-ordinary.tabbarHeight,743);
  // Real-device screenshot regression: restored PWA exposes roughly 148px
  // of the layout viewport below the visual bottom after opening the AI route.
  const restored=assistantRestingViewportGeometry(896,748,0,101);
  assert.deepEqual(restored,{visibleBottom:748,bottomInset:148,tabbarHeight:101});
  assert.equal(restored.visibleBottom-restored.tabbarHeight,647);
  const topShift=assistantRestingViewportGeometry(896,730,18,101);
  assert.equal(topShift.visibleBottom,748);
  assert.equal(topShift.bottomInset,148);
  const tooLarge=assistantRestingViewportGeometry(896,400,0,101);
  assert.equal(tooLarge.bottomInset,200,'unexpected viewport mismatch is capped');
  const recovery=assistantRestingViewportGeometry(896,896,0,101);
  assert.equal(recovery.bottomInset,0,'navigation returns after dismissing keyboard');
  assert.equal(assistantRestingViewportGeometry(896,896,0,NaN).tabbarHeight,100);
});
test('both editions share the resting dock anchor and measure its edge, then clean up',()=>{
  const module=read('../artifacts/market-compass/src/lib/assistantKeyboardViewport.ts');
  assert.match(module,/if\(!keyboardOpen\)\{/);
  assert.match(module,/assistantRestingViewportGeometry\(/);
  for(const variable of ['--mc-chat-resting-visible-bottom','--mc-chat-resting-bottom-inset','--mc-chat-tabbar-height','--mc-chat-dock-top']){
    assert.ok(module.includes("root.style.setProperty('"+variable+"'"));
    assert.ok(module.includes("root.style.removeProperty('"+variable+"'"));
  }
  assert.match(css,/html\.mc-assistant-route:not\(\.mc-chat-keyboard-open\) \.mc-mobile-tabbar/);
  assert.match(css,/bottom:0 !important/);
  assert.match(css,/height:var\(--mc-chat-dock-top, calc\(100dvh - var\(--mc-dock-height, 102px\)\)\) !important/);
  assert.match(css,/padding-bottom:clamp\(10px,env\(safe-area-inset-bottom,0px\),34px\) !important/);
  assert.match(css,/html\.mc-chat-keyboard-open \.mc-mobile-content\.mc-assistant-page/);
});

test('focused chat surface follows the visible band, not a frozen page scroll',()=>{
  // No panning: both agree.
  assert.equal(chatSurfaceVisibleTop(0,0),0);
  // WebKit panned the visual viewport and reports pageTop as 0 (frozen document):
  // the surface must start at the pan, otherwise it ends above the keyboard and
  // leaves an empty strip under the composer.
  assert.equal(chatSurfaceVisibleTop(140,0),140);
  assert.equal(chatSurfaceVisibleTop(88,0),88);
  // A genuinely scrolled document wins when it is the larger of the two.
  assert.equal(chatSurfaceVisibleTop(0,140),140);
  assert.equal(chatSurfaceVisibleTop(120,120),120);
  // Defensive: junk input never produces a negative or NaN offset.
  assert.equal(chatSurfaceVisibleTop(Number.NaN,Number.NaN),0);
  assert.equal(chatSurfaceVisibleTop(-40,-10),0);
});
