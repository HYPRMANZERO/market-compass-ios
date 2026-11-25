import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
const ai=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../artifacts/market-compass/src/ionic-shell.css',import.meta.url),'utf8');
const vite=readFileSync(new URL('../artifacts/market-compass/vite.config.ts',import.meta.url),'utf8');

test('Finance header and login use the actual edition, not a hard-coded Market Compass label',()=>{
  assert.match(app,/const editionName=currentAssistantEdition\(\)==='finance'\?'Compass Financial Advisor':'Compass Personal';/);
  assert.match(app,/<h1[^>]*>\{editionName\}<\/h1>/);
  assert.match(app,/truncate text-\[16px\][^"]*">\{editionName\}<\/div>/);
  assert.match(app,/>\{editionName\} menu<\/h2>/);
  assert.match(vite,/manifest\.name='Compass Financial Advisor'/);
  assert.match(vite,/manifest\.short_name='Finance'/);
});
test('Internet status does not pretend the AI is connected',()=>{
  assert.match(app,/Internet online/);
  assert.match(app,/Internet offline/);
  assert.match(ai,/Private link unavailable/);
  assert.match(ai,/connected\?'Compass connected'/);
  assert.match(ai,/modelAvailable/);
});
test('Agent stays read-only, always on, with no misleading checkbox toggle',()=>{
  assert.match(ai,/const agentMode = true/);
  assert.match(ai,/Read-only agent mode always active/);
  assert.doesNotMatch(ai,/checked=\{agentMode\}/);
  assert.match(ai,/payload\.answerSource\s*!==\s*'private-desktop-model'/);
});
test('Mobile AI panel fills the screen with a short inline tools drawer, not a modal',()=>{
  assert.match(ai,/mc-chat-panel flex min-h-0 flex-1 flex-col/);
  assert.match(ai,/aria-label="Compass actions drawer"/);
  assert.match(ai,/optionsOpen&&\(/);
  assert.doesNotMatch(ai,/createPortal\(/);
  assert.match(css,/max-height:min\(45dvh,380px\)/);
  assert.match(ai,/mc-chat-log min-h-0 flex-1/);
  assert.match(ai,/mc-assistant-dock flex min-w-0 w-full flex-col items-stretch/);
  assert.match(css,/width:100%;flex:0 0 auto/);
  assert.match(css,/\.mc-assistant-dock-card\[open\]/);
  assert.match(css,/max-height:none/);
  assert.match(css,/\.mc-assistant-dock-card:not\(\[open\]\)/);
});
test('iPhone safe-area padding and native bottom navigation are preserved',()=>{
  assert.match(css,/env\(safe-area-inset-top/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(app,/mc-mobile-tabbar fixed inset-x-0 bottom-0/);
  assert.match(app,/mc-mobile-header sticky top-0/);
});
