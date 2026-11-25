import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
test('AI conversation loads on demand instead of blocking Home and Markets',()=>{
  assert.match(src,/const VoiceAssistant=lazy\(\(\)=>import\('@\/components\/VoiceAssistant'\)\)/);
  assert.doesNotMatch(src,/import VoiceAssistant from '@\/components\/VoiceAssistant'/);
  assert.match(src,/<Suspense fallback=\{<p role="status"[^>]*>Preparing Compass AI/);
  assert.match(src,/<VoiceAssistant context=\{context\}[\s\S]*?<\/Suspense>/);
});
test('offline question queue, owner settings and route stay intact',()=>{
  assert.match(src,/queuedReadOnlyQuestions=\{Array\.isArray\(data\.offlineAgentQuestions\)/);
  assert.match(src,/onQueueReadOnlyQuestion=\{question=>/);
  assert.match(src,/onRemoveQueuedReadOnlyQuestion=\{id=>/);
  assert.match(src,/<Route path="\/assistant">/);
});
