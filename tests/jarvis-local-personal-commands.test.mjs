import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {interpretJarvisPersonalCommand,stripCompassWakeWord} from '../artifacts/market-compass/src/lib/jarvisPersonalCommands.ts';
import {interpretCompassCommand} from '../artifacts/market-compass/src/lib/compassCommands.ts';
const context={currency:'ZAR',accounts:[],monthlyExtra:'0',draftCount:0};
test('Compass and Jarvis wake prefixes strip before existing financial safety rules',()=>{
  assert.equal(stripCompassWakeWord('Hey Compass, open Debt Plan'),'open Debt Plan');
  assert.equal(stripCompassWakeWord('Jarvis: open Home'),'open Home');
  const query=stripCompassWakeWord('Compass, transfer money to my bank');
  const result=interpretCompassCommand(query,context);
  assert.equal(result.type,'answer');
  assert.match(result.reply,/cannot transfer money/);
});
test('explicit website shortcuts never auto-open nor accept untrusted origins',()=>{
  const expected={youtube:'https://www.youtube.com/',google:'https://www.google.com/',
    spotify:'https://open.spotify.com/',github:'https://github.com/',whatsapp:'https://web.whatsapp.com/'};
  for(const [name,url] of Object.entries(expected)){
    const r=interpretJarvisPersonalCommand('Jarvis, open '+name);
    assert.equal(r?.kind,'link');assert.equal(r.url,url);
    assert.match(r.text,/not opened a website automatically/);
  }
  assert.equal(interpretJarvisPersonalCommand('open evil-site.example'),null);
  assert.equal(interpretJarvisPersonalCommand('buy bitcoin'),null);
  assert.equal(interpretJarvisPersonalCommand('open javascript:alert(1)')?.kind,'answer');
  assert.equal(interpretJarvisPersonalCommand('open file:///C:/private')?.kind,'answer');
});
test('search links encode user query but require direct click',()=>{
  const result=interpretJarvisPersonalCommand('Compass, search for payslip dates in Cape Town');
  assert.equal(result.kind,'link');
  assert.equal(result.url,'https://www.google.com/search?q=payslip+dates+in+Cape+Town');
  assert.match(result.text,/No search was sent/);
  assert.equal(interpretJarvisPersonalCommand('search for ' + 'x'.repeat(160))?.kind,'answer');
});
test('time, news, and music/desktop controls avoid remote execution',()=>{
  const date=new Date('2026-11-23T12:00:00Z');
  assert.match(interpretJarvisPersonalCommand('current time',date)?.text??'',/device clock/);
  const news=interpretJarvisPersonalCommand('news');
  assert.equal(news?.kind,'link');assert.equal(news.url,'https://news.google.com/');
  assert.match(interpretJarvisPersonalCommand('list apps')?.text??'',/not enabled/);
  assert.match(interpretJarvisPersonalCommand('open VS Code')?.text??'',/separately approved/);
  assert.match(interpretJarvisPersonalCommand('play my song')?.text??'',/not configured/);
});
test('personal-assistant web links remain user-tap actions in the chat UI',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/components/VoiceAssistant.tsx',import.meta.url),'utf8');
  assert.match(src,/interpretJarvisPersonalCommand\(question\)/);
  assert.match(src,/const cleanQuestion=stripCompassWakeWord\(question\)/);
  assert.match(src,/href=\{message\.link\.url\}/);
  assert.match(src,/rel="noopener noreferrer"/);
  assert.match(src,/if\(personal\)\{/);
  assert.doesNotMatch(src,/window\.open\(personal\.url/);
});
