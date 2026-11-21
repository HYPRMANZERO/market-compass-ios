import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_DEFAULT_VOICE,chooseSpeechVoice,sortedEnglishVoices,speakingRate,voiceFriendlyText
} from '../artifacts/market-compass/src/lib/speechVoices.ts';

const mock=(name,lang,localService=true)=>({name,lang,localService,
  voiceURI:'voice:'+name,default:false});
const v=[
 mock('Robot Fred','en-US'),mock('Enhanced English','en-GB'),
 mock('Premium Siri-like','en-ZA'),mock('French','fr-FR'),
 mock('Generic','en-US')
];
test('iOS advertised English system voices are discoverable, not invented',()=>{
 const english=sortedEnglishVoices(v);
 assert.equal(english.length,4);
 assert.equal(english[0].name,'Enhanced English');
 assert.ok(chooseSpeechVoice(v,'voice:Generic').name==='Generic');
 assert.equal(chooseSpeechVoice(v,'voice:missing').name,'Enhanced English');
});
test('explicit iPhone default allows the device to pick an unrestricted voice',()=>{
 assert.equal(chooseSpeechVoice(v,DEVICE_DEFAULT_VOICE),null);
 assert.ok(speakingRate('natural')>=0.95);
 assert.ok(speakingRate('calm')<speakingRate('natural'));
 assert.ok(speakingRate('brisk')>speakingRate('natural'));
});
test('financial response strings are spoken in natural rand terms',()=>{
 const out=voiceFriendlyText('The cost is ZAR 1,400.50. APR is 12%.');
 assert.match(out,/rand/);
 assert.match(out,/annual interest rate/);
 assert.doesNotMatch(out,/ZAR 1,400.50/);
});
