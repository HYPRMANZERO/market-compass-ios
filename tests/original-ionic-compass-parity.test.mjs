import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const uiUrl=new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url);
const cssUrl=new URL('../artifacts/market-compass/src/ionic-shell.css',import.meta.url);

test('original Ionic assistant keeps a compact Compass header and maximizes conversation area',async()=>{
  const src=await readFile(uiUrl,'utf8');
  const css=await readFile(cssUrl,'utf8');
  assert.match(src,/aria-label="Compass model connection"/);
  assert.match(src,/Compass connected/);
  assert.match(src,/mc-chat-panel flex min-h-0 flex-1 flex-col/);
  assert.match(src,/mc-chat-log min-h-0 flex-1/);
  assert.match(src,/aria-label="Compass actions drawer"/);
  assert.doesNotMatch(src,/>Just ask\.</);
  assert.match(css,/\.mc-assistant-dock\{display:flex;flex-direction:column/);
  assert.match(css,/\.mc-assistant-dock-card\{box-sizing:border-box;width:100%/);
  assert.match(css,/\.mc-assistant-dock-card > summary\{min-height:40px/);
});

test('original PWA preserves vault and voice safety instead of importing ngrok-only assistant',async()=>{
  const src=await readFile(uiUrl,'utf8');
  assert.match(src,/privateTailnetOrigin\(settings\.url\)/);
  assert.match(src,/const agentMode = true/);
  assert.match(src,/Read-only agent mode always active/);
  assert.doesNotMatch(src,/aria-label="Enable read-only agent mode"/);
  assert.match(src,/Agent mode/);
  assert.match(src,/Read-only agent mode|read-only/);
  assert.match(src,/Turn on spoken replies/);
  assert.match(src,/SpeechRecognition/);
  assert.match(src,/encrypted vault/i);
  assert.match(src,/Safety and permissions/);
  assert.match(src,/Send now/);
  assert.doesNotMatch(src,/ownerPreviewModel/);
  assert.doesNotMatch(src,/protectedSameOrigin/);
});
