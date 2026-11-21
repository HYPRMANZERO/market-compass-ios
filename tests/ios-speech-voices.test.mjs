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
 assert.equal(english[0].name,'Premium Siri-like');
 assert.ok(chooseSpeechVoice(v,'voice:Generic').name==='Generic');
 assert.equal(chooseSpeechVoice(v,'voice:missing').name,'Premium Siri-like');
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

test('debt replies pronounce rand suffixes, rand symbols and interest percentages',()=>{
 const out=voiceFriendlyText('Total debt 209,618.00 ZAR; minimum 4,152.20 ZAR; paid R 200.01; APR 21%.');
 assert.match(out,/rand/);
 assert.match(out,/rand and 20 cents/);
 assert.match(out,/200 rand and 1 cent/);
 assert.match(out,/annual interest rate 21 percent/);
 assert.doesNotMatch(out,/209,618\.00 ZAR|4,152\.20 ZAR|R 200\.01/);
});
test('market abbreviations are expanded for speech without inventing a quote',()=>{
 const out=voiceFriendlyText('The S&P 500 is a stock index. No verified BTC/USD price is available.');
 assert.match(out,/S and P five hundred/);
 assert.match(out,/Bitcoin to US dollars/);
 assert.match(out,/No verified/);
 assert.doesNotMatch(out,/S&P 500|BTC\/USD/);
});
