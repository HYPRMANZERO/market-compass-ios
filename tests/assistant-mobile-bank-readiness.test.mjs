import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=()=>readFile(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
test('AI composer handles Enter to send, Shift+Enter newline and IME composition safely',async()=>{
  const ui=await source();
  assert.match(ui,/function handleComposerKeyDown\(/);
  assert.match(ui,/event\.key !== 'Enter'/);
  assert.match(ui,/event\.shiftKey/);
  assert.match(ui,/event\.nativeEvent\.isComposing/);
  assert.match(ui,/event\.preventDefault\(\)/);
  assert.match(ui,/if \(!busy && query\.trim\(\)\) submit\(query\)/);
  assert.match(ui,/onKeyDown=\{handleComposerKeyDown\}/);
  assert.match(ui,/enterKeyHint="send"/);
  assert.match(ui,/Shift\+Enter for a new line/);
  assert.match(ui,/text-\[16px\]/);
});
test('chat bubbles and fields have accessible, non-crowded mobile layout',async()=>{
  const ui=await source();
  assert.match(ui,/mc-assistant-composer grid grid-cols-\[48px_minmax\(0,1fr\)_48px\]/);
  assert.match(ui,/aria-label="Open Compass actions"/);
  assert.match(ui,/aria-controls="mc-chat-tools-drawer" aria-expanded=\{optionsOpen\}/);
  assert.match(ui,/role="group" aria-label="Compass voice controls"/);
  assert.match(ui,/query\.trim\(\)&&!listening\?/);
  assert.match(ui,/mc-chat-bubble/);
  assert.doesNotMatch(ui,/min-h-\[160px\] space-y-3 overflow-y-auto/);
  assert.match(ui,/messages\.length===0 && !busy/);
  assert.match(ui,/aria-label="Send question"/);
  assert.match(ui,/aria-label=\{listening\s*\?\s*'Stop listening'\s*:\s*'Speak a question'\}/);
});
test('bank connection view never pretends OAuth is active or asks for credentials',async()=>{
  const ui=await source();
  assert.match(ui,/aria-label="Bank connectivity and consent status"/);
  assert.match(ui,/Not connected/);
  assert.match(ui,/Direct bank feeds are not activated in this release/);
  assert.match(ui,/No banking passwords/);
  assert.match(ui,/Missing bank data is unknown, not R0/);
  assert.match(ui,/onNavigate\('\/expenses'\)/);
});
