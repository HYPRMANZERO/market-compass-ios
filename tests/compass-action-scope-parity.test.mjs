import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  compassActionsForEdition,isPersonalOnlyAction
} from '../artifacts/market-compass/src/lib/compassActionMenu.ts';

const voice=readFileSync(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
const shortcuts=readFileSync(new URL('../artifacts/market-compass/src/components/CompassQuickActions.tsx',import.meta.url),'utf8');

const finance=compassActionsForEdition('finance');
const personal=compassActionsForEdition('personal');

test('Personal exposes every financial action in the same order plus its own five actions',()=>{
  const fIds=finance.map(x=>x.id);
  const pIds=personal.map(x=>x.id);
  assert.deepEqual(fIds,[
    'vault','document','scan-payments','source-status','debt-plan',
    'spend-review','markets','voice','permissions'
  ]);
  assert.deepEqual(pIds.slice(0,fIds.length),fIds);
  assert.deepEqual(pIds.slice(fIds.length),['scan-files','memory','tasks','research','devices']);
  for(const item of finance)assert.deepEqual(personal.find(p=>p.id===item.id),item);
});

test('Finance does not offer any Personal-only functions',()=>{
  assert.equal(finance.some(x=>x.group==='personal'),false);
  for(const action of personal.filter(x=>x.group==='personal')){
    assert.equal(isPersonalOnlyAction(action.id),true);
    assert.equal(finance.some(x=>x.id===action.id),false);
  }
  assert.equal(isPersonalOnlyAction('debt-plan'),false);
});

test('Both chat screens expose the same functional plus button and scoped modal actions',()=>{
  assert.match(voice,/aria-label="Open Compass actions"/);
  assert.match(voice,/onClick=\{\(\)=>setOptionsOpen\(true\)\}/);
  assert.match(voice,/CompassQuickActions edition=\{currentAssistantEdition\(\)\} onAction=\{runCompassAction\}/);
  assert.match(voice,/if\(currentAssistantEdition\(\)==='finance'&&isPersonalOnlyAction\(id\)\)return/);
  assert.match(voice,/case 'source-status':showOptionDetails/);
  assert.match(voice,/case 'vault':/);
  assert.match(voice,/case 'scan-files': importFromOptions\(\)/);
  assert.match(voice,/case 'debt-plan':go\('\/debt'\)/);
  assert.match(voice,/case 'spend-review': go\('\/expenses'\)/);
  assert.match(voice,/case 'research':showOptionDetails/);
  assert.match(voice,/case 'permissions':showOptionDetails/);
  assert.match(shortcuts,/compassActionsForEdition\(edition\)/);
  assert.match(shortcuts,/Encryp[t]ed local data stays on this device/);
});

test('App action menu does not grant bank auth, transfer funds or alter local vault data',()=>{
  const combined=shortcuts+readFileSync(new URL('../artifacts/market-compass/src/lib/compassActionMenu.ts',import.meta.url),'utf8');
  assert.doesNotMatch(combined,/fetch\(|localStorage\.|fetchOAuth|transferFunds|executeOrder|saveVault\(/);
});
