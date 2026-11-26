import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../artifacts/market-compass/src/App.tsx');
const chat=read('../artifacts/market-compass/src/components/VoiceAssistant.tsx');
const css=read('../artifacts/market-compass/src/ionic-shell.css');
const home=read('../artifacts/market-compass/src/components/HomeFinancialEvidence.tsx');
test('edge-to-edge AI uses the available phone viewport, not a floating card',()=>{
 assert.match(app,/mc-assistant-page w-full px-0 pt-0/);
 assert.match(css,/\.mc-mobile-content\.mc-assistant-page\{/);
 assert.match(css,/height:calc\(100dvh - 66px - max\(10px,env\(safe-area-inset-bottom,0px\)\)\)/);
 assert.match(chat,/mc-assistant flex min-h-0 min-w-0 max-w-full flex-col/);
 assert.match(chat,/mc-chat-panel flex min-h-0 flex-1 flex-col/);
 assert.match(chat,/mc-chat-log min-h-0 flex-1/);
 assert.match(css,/\.mc-assistant-page \.mc-chat-panel\{/);
 assert.match(css,/padding:calc\(env\(safe-area-inset-top,0px\) \+ 10px\) 0 0 !important/);
});
test('the composer plus and header open the same short inline drawer, never an overlay',()=>{
 assert.match(chat,/aria-label="Toggle Compass tools" aria-controls="mc-chat-tools-drawer"/);
 assert.match(chat,/aria-label="Open Compass actions" aria-controls="mc-chat-tools-drawer"/);
 assert.match(chat,/id="mc-chat-tools-drawer" role="region" aria-label="Compass actions drawer"/);
 assert.match(chat,/className="mc-chat-actions-drawer"/);
 assert.match(chat,/className="mc-chat-advanced" aria-label="Additional Compass settings"/);
 assert.match(chat,/aria-label="Close Compass actions"/);
 assert.doesNotMatch(chat,/createPortal\(|aria-modal="true"|document\.body\.style\.overflow/);
 assert.match(css,/max-height:min\(45dvh,380px\)/);
 assert.match(css,/overscroll-behavior:contain/);
 assert.match(chat,/const sendFromOptions=\(idea:string\)=>\{setOptionsOpen\(false\);submit\(idea\);\}/);
 assert.match(chat,/const importFromOptions=\(\)=>\{setOptionsOpen\(false\);if\(onImportDocuments\)/);
 assert.match(chat,/auxiliaryPanel&&<section aria-label="Additional Compass tools"/);
});
test('composer, settings and finance rights survive the layout change',()=>{
 assert.match(chat,/mc-chat-composer-wrap border-t/);
 assert.match(chat,/mc-assistant-composer grid grid-cols-\[52px_minmax\(0,1fr\)_52px\]/);
 assert.match(chat,/handleComposerKeyDown/);
 assert.match(chat,/Speak a question|Send question/);
 assert.match(chat,/CompassQuickActions edition=\{currentAssistantEdition\(\)\}/);
 assert.match(chat,/if\(advanced\)advanced\.open=true/);
 assert.match(chat,/Private memory/);
 assert.match(chat,/Financial sources/);
 assert.match(home,/aria-label="Saved debt accounts"/);
 assert.match(home,/Debt planning · not bank-connected/);
});


test('the status-bar seam and action controls remain flush',()=>{
 assert.match(css,/background:linear-gradient\(to bottom,/);
 // Finance v2 paints the strip above the assistant bar in the new ink and stops
 // it at the bar's exact top edge (safe area + 10px), so no light hairline shows.
 assert.match(css,/#0b1620 0,/);
 assert.match(css,/calc\(env\(safe-area-inset-top,0px\) \+ 10px\)/);
 assert.doesNotMatch(css,/hsl\(165,24%,20%\)/);
 assert.match(css,/grid-template-columns:52px minmax\(0,1fr\) 52px/);
 assert.match(css,/width:52px/);
 assert.match(css,/height:52px/);
 assert.match(css,/.mc-assistant-page .mc-assistant-composer > button:first-child/);
});
