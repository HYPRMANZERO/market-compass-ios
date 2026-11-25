import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../artifacts/market-compass/src/App.tsx');
const chat=read('../artifacts/market-compass/src/components/VoiceAssistant.tsx');
const home=read('../artifacts/market-compass/src/components/HomeFinancialEvidence.tsx');

test('AI tab uses full-height conversation without global mobile header',()=>{
  assert.match(app,/path!=='\/assistant'&&\(/);
  assert.match(app,/path==='\/assistant'&&<div aria-hidden="true" className="fixed inset-x-0 top-0 z-20 h-\[env\(safe-area-inset-top,0px\)\]/);
  assert.match(app,/path==='\/assistant'.*pt-\[calc\(8px\+env\(safe-area-inset-top,0px\)\)\]/);
  assert.match(chat,/mc-assistant flex h-\[calc\(100dvh-116px-env\(safe-area-inset-top,0px\)\)\]/);
  assert.match(chat,/mc-chat-panel flex min-h-0 flex-1 flex-col/);
  assert.match(chat,/mc-chat-log min-h-0 flex-1/);
  assert.doesNotMatch(chat,/mc-chat-log min-h-\[min\(27dvh/);
});
test('All auxiliary settings and legacy panels are hidden behind an accessible options dialog',()=>{
  assert.match(chat,/aria-label="Open Compass options" aria-haspopup="dialog" aria-expanded=\{optionsOpen\}/);
  assert.match(chat,/optionsOpen&&createPortal\(/);
  assert.match(chat,/role="dialog" aria-modal="true" aria-label="Compass AI options"/);
  assert.match(chat,/aria-label="Close Compass options"/);
  assert.match(chat,/event\.key==='Escape'\)setOptionsOpen\(false\)/);
  assert.match(chat,/auxiliaryPanel&&<section aria-label="Additional Compass tools"/);
  assert.match(chat,/Private memory/);
  assert.match(chat,/Financial sources/);
  assert.match(app,/auxiliaryPanel=\{<div className="space-y-3">/);
  assert.match(app,/Earlier saved instructions/);
});
test('Composer stays in chat, and enter-to-send, voice and safety remain available',()=>{
  assert.match(chat,/mc-assistant-composer grid/);
  assert.match(chat,/onSubmit=\{event => \{ event.preventDefault\(\); submit\(query\); \}\}/);
  assert.match(chat,/handleComposerKeyDown/);
  assert.match(chat,/Speak a question/);
  assert.match(chat,/Send question/);
  assert.match(chat,/Agent mode on/);
  assert.match(chat,/up to 3 read-only tools/);
  assert.match(chat,/bank|Bank/i);
});
test('Home has the same vertical account planning cards as Finance, never fake bank sync',()=>{
  assert.match(home,/aria-label="Saved debt accounts"/);
  assert.match(home,/Debt planning · not bank-connected/);
  assert.match(home,/Balance needed/);
  assert.match(home,/Entered balance/);
  assert.match(home,/APR <strong/);
  assert.match(home,/Minimum <strong/);
  assert.match(home,/maskDocumentPII\(account\.name/);
  assert.match(home,/accounts\.map\(\(account,index\)/);
});
