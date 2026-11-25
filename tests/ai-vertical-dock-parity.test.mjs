import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const voice=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../artifacts/market-compass/src/ionic-shell.css',import.meta.url),'utf8');
test('both editions show full-width vertically stacked AI tool cards',()=>{
 assert.match(voice,/mc-assistant-dock flex min-w-0 w-full flex-col items-stretch gap-3 pb-2/);
 assert.equal((voice.match(/mc-assistant-dock-card rounded-\[20px\]/g)||[]).length,4);
 assert.match(css,/\.mc-assistant-dock\{display:flex;flex-direction:column;align-items:stretch/);
 assert.match(css,/\.mc-assistant-dock-card\{box-sizing:border-box;width:100%;flex:0 0 auto/);
 assert.match(css,/\.mc-assistant-dock-card\[open\]\{width:100%;max-height:none/);
 assert.doesNotMatch(voice,/mc-assistant-dock[^"\n]*overflow-x-auto/);
 assert.doesNotMatch(voice,/mc-assistant-dock[^"\n]*snap-x/);
 assert.doesNotMatch(css,/scroll-snap-type:x|clamp\(142px,43vw,188px\)/);
});
