import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {queueNativeSpeech} from '../artifacts/market-compass/src/lib/speechPlayback.ts';

function synth({speaking=false,pending=false,paused=false}={}){
  const events=[];
  return {speaking,pending,paused,events,
    cancel(){events.push('cancel');},
    speak(){events.push('speak');},
    resume(){events.push('resume');}
  };
}
test('short Safari preview speaks immediately without cancelling an idle speech queue',()=>{
  const engine=synth();
  queueNativeSpeech(engine,{});
  assert.deepEqual(engine.events,['speak']);
});
test('queued speaking is cancelled once and paused synthesis is resumed',()=>{
  const speaking=synth({speaking:true});
  queueNativeSpeech(speaking,{});
  assert.deepEqual(speaking.events,['cancel','speak']);
  const paused=synth({paused:true});
  queueNativeSpeech(paused,{});
  assert.deepEqual(paused.events,['speak','resume']);
  const pending=synth({pending:true});
  queueNativeSpeech(pending,{});
  assert.deepEqual(pending.events,['cancel','speak']);
});
test('native preview stays on-device and explicitly reports Safari start/end/error',async()=>{
  const s=await readFile(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(s,/speechUtterance\.current=utterance/);
  assert.match(s,/utterance\.onstart=/);
  assert.match(s,/utterance\.onend=/);
  assert.match(s,/utterance\.onerror=/);
  assert.match(s,/queueNativeSpeech\(synth,utterance\)/);
  assert.match(s,/voicePreviewStatus && <p role="status"/);
  assert.match(s,/Use iPhone system default voice/);
  assert.doesNotMatch(s,/const synth=window\.speechSynthesis;\s*synth\.cancel\(\);\s*const utterance/);
});
