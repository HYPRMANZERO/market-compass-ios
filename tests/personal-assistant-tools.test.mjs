import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAssistantEdition,mayUsePersonalTools} from '../artifacts/market-compass/src/lib/assistantEdition.ts';
import {makeDailyPlan,makeMessageDraft,makeCalendarFile,PERSONAL_CAPABILITIES} from '../artifacts/market-compass/src/lib/personalTools.ts';
import {privateTailnetOrigin} from '../artifacts/market-compass/src/lib/privateTailnetUrl.ts';

test('explicit build selection is authoritative; legacy hostname fallback is only visual',()=>{
  assert.equal(selectAssistantEdition('personal','owner.ngrok-free.app'),'personal');
  assert.equal(selectAssistantEdition('finance','hyprmanzero.github.io'),'finance');
  assert.equal(selectAssistantEdition(undefined,'owner.ngrok-free.dev'),'finance');
  assert.equal(selectAssistantEdition(undefined,'hyprmanzero.github.io'),'personal');
  assert.equal(selectAssistantEdition('secret','random.example'),'personal');
  assert.equal(mayUsePersonalTools('finance'),false);
});
test('local productivity returns drafts without sending or executing',()=>{
  assert.match(makeDailyPlan('Prepare for a meeting'),/Focus \(25 minutes\)/);
  assert.match(makeMessageDraft('Project update','We completed the review'),/Draft only\. Not sent/);
  assert.doesNotMatch(makeMessageDraft('Hello\nBcc:evil@example.org','text'),/\nBcc:/);
});
test('calendar export is explicit, bounded and standards-shaped',()=>{
  const out=makeCalendarFile('Deep work','2026-11-25','10:30',45,new Date('2026-11-24T00:00:00Z'));
  assert.match(out,/BEGIN:VCALENDAR\r\nVERSION:2\.0/);
  assert.match(out,/DTSTAMP:20261124T000000Z/);
  assert.match(out,/SUMMARY:Deep work/);
  assert.match(out,/END:VEVENT\r\nEND:VCALENDAR/);
  assert.throws(()=>makeCalendarFile('Test','2026-02-30','10:30'),/invalid/);
  assert.throws(()=>makeCalendarFile('Test','2026-11-25','10:30',0),/duration/);
});
test('cited research and connectors are not falsely marked as already connected',()=>{
  assert.equal(PERSONAL_CAPABILITIES.find(x=>x.id==='cited_research')?.availability,'private_ai_required');
  assert.equal(PERSONAL_CAPABILITIES.find(x=>x.id==='selected_file_review')?.effect,'explicit_file_import');
  assert.equal(PERSONAL_CAPABILITIES.find(x=>x.id==='message_draft')?.effect,'copy_after_click');
});

test('original Pages PWA permits only a separately build-pinned Personal gateway',()=>{
  const pinned='https://owner-personal.ngrok-free.app';
  const pages='https://hyprmanzero.github.io';
  assert.equal(privateTailnetOrigin(pinned,pinned,pages),pinned);
  assert.equal(privateTailnetOrigin('https://owner-finance.ngrok-free.app',pinned,pages),null);
  assert.equal(privateTailnetOrigin(pinned,pinned,'https://owner-finance.ngrok-free.app'),null);
  assert.equal(privateTailnetOrigin('http://owner-personal.ngrok-free.app',pinned,pages),null);
  assert.equal(privateTailnetOrigin('https://owner-personal.ngrok-free.app/api/chat',pinned,pages),null);
  assert.equal(privateTailnetOrigin(pinned,'https://arbitrary.example',pages),null);
});
