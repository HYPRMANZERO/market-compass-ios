import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {privateTailnetOrigin} from '../artifacts/market-compass/src/lib/privateTailnetUrl.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const client=readFileSync(resolve(root,'artifacts/market-compass/src/components/VoiceAssistant.tsx'),'utf8');
const config=readFileSync(resolve(root,'artifacts/market-compass/src/lib/desktopAiSettings.ts'),'utf8');

test('desktop or laptop may explicitly select private tailnet HTTPS, not an arbitrary public model or tunnel',()=>{
  assert.equal(privateTailnetOrigin('https://desktop.example-tailnet.ts.net/'),'https://desktop.example-tailnet.ts.net');
  assert.equal(privateTailnetOrigin('desktop.example-tailnet.ts.net'),'https://desktop.example-tailnet.ts.net');
  for(const forbidden of ['http://desktop.example-tailnet.ts.net','https://desktop.example-tailnet.ts.net:8788/',
    'https://desktop.example-tailnet.ts.net/api/chat','https://site.github.io',
    'https://private.ngrok-free.dev','https://example.com','https://user:password@desktop.example-tailnet.ts.net']){
    assert.equal(privateTailnetOrigin(forbidden),null,forbidden);
  }
  assert.match(config,/token:\s*value\.token/);
  assert.match(config,/privateTailnetOrigin\(value\.url\)/);
});
test('PWA Compass requests allow CPU-bound standalone replies without erasing session on timeout',()=>{
  assert.match(client,/window\.setTimeout\(\(\) => controller\.abort\(\), 130000\)/);
  assert.match(client,/if \(controller\.signal\.aborted\)\s*\{/);
  const match=client.match(/if \(controller\.signal\.aborted\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(match);
  assert.match(match[1],/retry manually/i);
  assert.doesNotMatch(match[1],/setConnection\('offline'\)/);
  assert.doesNotMatch(match[1],/onRemoveQueuedReadOnlyQuestion\(/);
  assert.match(client,/payload\.answerSource\s*!==\s*'private-desktop-model'/);
});
test('Compass public PWA keeps explicit private connection and source-sharing consent',()=>{
  assert.match(client,/shareFinancialContext/);
  assert.match(client,/privateTailnetOrigin\(settings\.url\)/);
  assert.match(client,/Authorization: `Bearer \$\{settings\.token\}`/);
  assert.match(client,/'same-origin' : 'omit'/);
  assert.match(client,/publicPagesEdition/);
  assert.doesNotMatch(client,/window\.localStorage\.setItem\([^)]*token/i);
  assert.doesNotMatch(client,/Desktop Ollama/);
});
