import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'artifacts/market-compass/src/components/VoiceAssistant.tsx'),'utf8');
test('stronger-model canary requires an explicitly requested protected owner origin',()=>{
  assert.match(source,/const ownerPreviewModel = Boolean\(protectedSameOrigin\)/);
  assert.match(source,/new URLSearchParams\(window\.location\.search\)\.get\('compassAI'\) === 'qwen35-4b'/);
  assert.match(source,/publicPagesEdition[\s\S]*?Private Compass AI is not available on the unauthenticated public edition/);
});
test('canary session and read-only agent use dedicated routes; normal mode keeps original',()=>{
  assert.match(source,/ownerPreviewModel \? '\/api\/session\/preview' : '\/api\/session'/);
  assert.match(source,/ownerPreviewModel\s*\?\s*'\/api\/agent\/preview'\s*:\s*'\/api\/agent\/run'/);
  assert.match(source,/const agentMode = true/);
  assert.match(source,/payload\.answerSource !== 'private-desktop-model'/);
});
