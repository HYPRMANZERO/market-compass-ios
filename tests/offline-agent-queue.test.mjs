import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueOfflineQuestion,eligibleToSendQueuedQuestion,
  isReadOnlyOfflineQuestion,removeOfflineQuestion,
  validateQueuedQuestion,MAX_OFFLINE_QUESTIONS,OFFLINE_QUESTION_TTL_MS
} from '../artifacts/market-compass/src/lib/offlineAgentQueue.ts';

const NOW=new Date('2026-11-21T12:00:00.000Z');
const id='3b6b8d5e-e957-4a65-8b0d-ad8fd781a000';
test('offline queues only read-only questions in the encrypted workspace shape',()=>{
  assert.ok(isReadOnlyOfflineQuestion('What is my hourly rate?'));
  assert.ok(isReadOnlyOfflineQuestion('Review my budget.'));
  assert.ok(isReadOnlyOfflineQuestion('Summarize my income and expenses'));
  for(const command of [
    'Transfer money to dad','Restart HYPRBOX','Run PowerShell',
    'Delete my financial files','Buy Bitcoin','Trade my savings',
    'Withdraw funds','Install malware','pay my credit card',
    'ssh to my desktop','Start an application','Send money',
  ])assert.equal(isReadOnlyOfflineQuestion(command),false,command);
  const out=enqueueOfflineQuestion([],'Review my budget',{now:NOW,id});
  assert.equal(out.created.question,'Review my budget');
  assert.equal(out.items.length,1);
  assert.equal(out.created.kind,'read_only_question');
  assert.equal(out.created.status,'pending');
  assert.equal(out.created.createdAt,NOW.toISOString());
  assert.equal(eligibleToSendQueuedQuestion(out.created,NOW),true);
  assert.equal(Object.keys(out.created).sort().join(','),'createdAt,id,kind,question,status');
});
test('de-duplicate questions, bound queue length and reject invalid/tampered entries',()=>{
  const first=enqueueOfflineQuestion([],'Review my budget',{now:NOW,id});
  assert.throws(()=>enqueueOfflineQuestion(first.items,'review my budget',{now:NOW,id:'a'.repeat(32)}),/already waiting/);
  assert.throws(()=>enqueueOfflineQuestion(first.items,'Send money',{now:NOW,id:'b'.repeat(32)}),/read-only/);
  const bad={...first.created,kind:'execute'};
  assert.equal(validateQueuedQuestion(bad),null);
  assert.throws(()=>enqueueOfflineQuestion([bad],'What is my debt?',{now:NOW,id:'c'.repeat(32)}),/repair/);
  assert.throws(()=>removeOfflineQuestion([bad],id),/unrecognized/);
  assert.throws(()=>enqueueOfflineQuestion([], 'What is my budget?',{now:NOW,id:'invalid'}),/identity/);
  const full=Array.from({length:MAX_OFFLINE_QUESTIONS},(_,n)=>({...first.created,id:String(n).padStart(32,'0'),question:'Review item '+n}));
  assert.throws(()=>enqueueOfflineQuestion(full,'What is my debt?',{now:NOW,id:'d'.repeat(32)}),/full/);
});
test('no implicit background send and expired/future items are not eligible',()=>{
  const item=enqueueOfflineQuestion([],'Explain my debt plan',{now:NOW,id}).created;
  assert.equal(eligibleToSendQueuedQuestion(item,new Date(NOW.getTime()+OFFLINE_QUESTION_TTL_MS)),true);
  assert.equal(eligibleToSendQueuedQuestion(item,new Date(NOW.getTime()+OFFLINE_QUESTION_TTL_MS+1)),false);
  assert.equal(eligibleToSendQueuedQuestion(item,new Date(NOW.getTime()-1000)),false);
  assert.equal(removeOfflineQuestion([item],id).length,0);
  assert.equal(removeOfflineQuestion([item],'not-matching').length,1);
  assert.ok(!('url' in item));
  assert.ok(!('auth' in item));
  assert.ok(!('command' in item));
});
test('injection-like, unsafe and non-question commands do not become remote jobs',()=>{
  for(const q of [
    'Restart services and send money','What is my debt?\nDELETE ALL',
    'What is the API key?', 'Open a shell on HYPRBOX',
    'approve a payment','show the password',
    'How do I withdraw money?','   ','x'.repeat(501),
  ])assert.equal(isReadOnlyOfflineQuestion(q),false,q);
});
