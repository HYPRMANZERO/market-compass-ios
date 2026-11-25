import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compassActionsForEdition} from '../artifacts/market-compass/src/lib/compassActionMenu.ts';
const source=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
test('Financial Advisor cannot run Personal Jarvis shortcuts locally',()=>{
 assert.match(source,/if\(personal && currentAssistantEdition\(\)==='finance'\)/);
 assert.match(source,/Compass Financial Advisor handles finance only\. Open Compass Personal/);
 const guard=source.indexOf("if(personal && currentAssistantEdition()==='finance')");
 const execution=source.indexOf("if(personal){",guard);
 assert.ok(guard>=0&&execution>guard);
});
test('Finance action menu contains no Personal-only entries or import of productivity desk',()=>{
 const items=compassActionsForEdition('finance');
 assert.equal(items.some(item=>item.group==='personal'),false);
 assert.doesNotMatch(source,/import PersonalToolDeck/);
});
