/**
 * Isolated synthetic browser smoke for the PUBLIC GitHub Pages UI.
 * Build the static PWA first. Does not connect to any live origin.
 * No external deps: Node 22 WebSocket, installed Vite, Edge/Chromium.
 */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'artifacts','market-compass');
assert.ok(existsSync(path.join(path.resolve(process.env.MC_PWA_OUT_DIR||path.join(app,'dist','public')),'index.html')),'Build public PWA first');
const base=process.env.BASE_PATH||'/market-compass-ios/';
assert.match(base,/^\/(?:[a-z0-9-]+\/)?$/,'Safe static BASE_PATH required');
const candidates=[process.env.MC_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium','/usr/bin/google-chrome'];
const browser=candidates.find(p=>p&&existsSync(p));
if(!browser)throw Error('Edge/Chromium required (MC_TEST_BROWSER)');
const port=await new Promise((ok,no)=>{
  const server=createServer();server.once('error',no);
  server.listen(0,'127.0.0.1',()=>{
    const n=server.address().port;server.close(e=>e?no(e):ok(n));
  });
});
const profile=await mkdtemp(path.join(tmpdir(),'mc-public-bootstrap-test-'));
let preview,edge,ws,seq=0;const pending=new Map();
function kill(processHandle){
  if(!processHandle?.pid)return;
  if(process.platform==='win32')
    spawnSync('taskkill',['/PID',String(processHandle.pid),'/F','/T'],{windowsHide:true,stdio:'ignore',timeout:8000});
  else try{processHandle.kill('SIGTERM')}catch{}
}
async function until(check,label,timeout=18000){
  const end=Date.now()+timeout;let reason;
  while(Date.now()<end){
    try{const value=await check();if(value)return value}catch(e){reason=e}
    await sleep(160);
  }
  throw Error(label+' timed out'+(reason?': '+reason.message:''));
}
async function cdp(method,params={}){
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('DevTools '+method+' timed out'))},12000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function js(fn,...args){
  const expression='('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')';
  const response=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
  return response.result?.value;
}
async function expect(value,label){
  await until(()=>js(function(value){return document.body.innerText.includes(value)},value),label);
}
async function click(label){
  await until(()=>js(function(label){
    const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(label));
    return !!b&&!b.disabled;
  },label),'enabled '+label);
  const result=await js(function(label){
    const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(label));
    if(!b||b.disabled)return false;b.click();return true;
  },label);
  assert.equal(result,true,label+' button must respond');
}
async function fill(selector,value){
  assert.equal(await js(function(selector,value){
    const input=document.querySelector(selector);if(!input)return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));return input.value===value;
  },selector,value),true,'input '+selector);
}
try{
  const url='http://127.0.0.1:'+port+base;
  preview=spawn(process.execPath,[path.join(app,'node_modules','vite','bin','vite.js'),
    'preview','--config','vite.config.ts','--host','127.0.0.1',
    '--port',String(port),'--strictPort'],{
    cwd:app,windowsHide:true,stdio:'ignore',
    env:{...process.env,BASE_PATH:base,NODE_ENV:'production',PORT:String(port)}
  });
  await until(async()=>{if(preview.exitCode!==null)throw Error('Preview exited');
    const r=await fetch(url);return r.status===200&&/(?:Market Compass|Compass Personal|Compass Financial Advisor)/.test(await r.text());
  },'localhost preview');
  edge=spawn(browser,['--headless=new','--disable-gpu','--no-first-run',
    '--no-default-browser-check','--disable-extensions','--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,url],
    {windowsHide:true,stdio:'ignore'});
  const dbg=await until(async()=>{const p=path.join(profile,'DevToolsActivePort');
    if(!existsSync(p))return null;const n=(await readFile(p,'utf8')).split(/\r?\n/)[0];
    return /^\d+$/.test(n)?+n:null},'isolated DevTools port');
  const target=await until(async()=>{
    const pages=await(await fetch('http://127.0.0.1:'+dbg+'/json/list')).json();
    return pages.find(p=>p.type==='page'&&p.url.startsWith(url));
  },'isolated browser tab');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok,no)=>{
    ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});
  });
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data),entry=pending.get(data.id);
    if(!entry)return;pending.delete(data.id);clearTimeout(entry.timer);
    data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result);
  });
  await cdp('Emulation.setDeviceMetricsOverride',{
    width:390,height:844,deviceScaleFactor:3,mobile:true
  });
  await expect('Create encrypted workspace','synthetic vault entry');
  const login=await js(function(){
    const wrapper=document.querySelector('.mc-vault-entry');
    const card=wrapper?.querySelector('.rounded-\\[22px\\]');
    const input=document.querySelector('#vault-password');
    const details=[...wrapper?.querySelectorAll('details')||[]];
    const privacy=details.find(x=>x.innerText.includes('Vault & privacy information'));
    return {
      cardWidth:card?.getBoundingClientRect().width||0,
      cardHeight:card?.getBoundingClientRect().height||0,
      fontSize:input?getComputedStyle(input).fontSize:null,
      inputHeight:input?.getBoundingClientRect().height||0,
      privacyCollapsed:!!privacy&&!privacy.open,
      restoreAvailable:details.some(x=>x.innerText.includes('Restore from encrypted backup')),
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
    };
  });
  assert.ok(login.cardWidth>0&&login.cardWidth<=390,'vault card must fit a phone');
  assert.ok(login.cardHeight>0&&login.cardHeight<550,'vault card must be compact');
  assert.equal(login.fontSize,'16px','Safari-safe focus font size');
  assert.ok(login.inputHeight>=44,'touch target size');
  assert.equal(login.privacyCollapsed,true,'vault privacy details must be collapsed');
  assert.equal(login.restoreAvailable,true,'encrypted restore action still visible');
  assert.equal(login.horizontalOverflow,false,'no horizontal overflow on login');
  console.log('PASS: public compact vault login mobile dimensions and safe input');
  await fill('#vault-password','test-only-'+randomUUID());
  await click('Create encrypted workspace');
  await expect('Encrypted vault & settings','encrypted workspace unlock');
  const ui=await js(function(){
    const hero=document.querySelector('.mc-wallet-hero');
    const row=document.querySelector('.mc-bs-quick-actions');
    const cols=[...row?.querySelectorAll('.col-4')||[]];
    const nav=document.querySelector('[aria-label="Mobile app tabs"]');
    return {
      hero:!!hero,grid:getComputedStyle(row).display,
      columns:cols.length,width:row?.getBoundingClientRect().width,
      colWidth:cols[0]?.getBoundingClientRect().width,
      tabs:nav?.querySelectorAll('.mc-tab-link').length,
      privacy:document.body.innerText.includes('No bank connection'),
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
    };
  });
  assert.equal(ui.hero,true);assert.equal(ui.grid,'flex');assert.equal(ui.columns,3);
  assert.ok(Math.abs(ui.colWidth/ui.width-1/3)<0.025);
  assert.equal(ui.tabs,4,'Current Ionic navigation has Home, Markets, AI and Menu');assert.equal(ui.privacy,true);
  assert.equal(ui.horizontalOverflow,false,'no horizontal scrolling at iPhone width');
  const pulse=await js(function(){
    const review=document.querySelector('.mc-financial-pulse');
    return {
      present:!!review,
      buttons:[...review?.querySelectorAll('button[aria-pressed]')||[]].map(x=>x.textContent.trim()),
      missing:review?.textContent.includes('Not recorded'),
      bank:review?.textContent.includes('Not connected · No automatic sync'),
      width:review?.getBoundingClientRect().width??0
    };
  });
  assert.equal(pulse.present,true,'monthly review visible');
  assert.deepEqual(pulse.buttons,['Current','Previous','Earlier']);
  assert.equal(pulse.missing,true,'unknown income/outflows never become zero');
  assert.equal(pulse.bank,true,'no invented bank API connection');
  assert.ok(pulse.width>200&&pulse.width<=390);
  await js(function(){
    const review=document.querySelector('.mc-financial-pulse');
    [...review.querySelectorAll('button[aria-pressed]')].find(x=>x.textContent.trim()==='Previous')?.click();
  });
  await until(()=>js(function(){
    const review=document.querySelector('.mc-financial-pulse');
    return [...review.querySelectorAll('button[aria-pressed]')].some(x=>
      x.textContent.trim()==='Previous'&&x.getAttribute('aria-pressed')==='true');
  }),'previous salary cycle selected');
  const reviewInbox=await js(function(){
    const section=document.querySelector('.mc-evidence-inbox');
    if(!section)return null;
    const counts=[...section.querySelectorAll('[aria-label="Review counts"] strong')].map(el=>Number(el.textContent));
    return {counts,empty:section.textContent.includes('Nothing imported yet'),
      hasReviewLink:[...section.querySelectorAll('a')].some(a=>a.getAttribute('href')?.endsWith('/expenses')),
      noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
  });
  assert.ok(reviewInbox,'evidence review inbox must be visible on public Home');
  assert.deepEqual(reviewInbox.counts,[0,0,0],'new encrypted vault cannot invent evidence');
  assert.equal(reviewInbox.empty,true);
  assert.equal(reviewInbox.hasReviewLink,true);
  assert.equal(reviewInbox.noOverflow,true);
  console.log('PASS: empty evidence inbox, source disclosures and mobile fit');
  console.log('PASS: financial pulse, cycle navigation, consented evidence and missing-data disclosure');
  console.log('PASS: local Bootstrap grid, private dashboard, iPhone viewport, four tabs');
  await js(function(){
    const a=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/debt'));
    if(!a)throw Error('Debt navigation missing');a.click();
  });
  await expect('Debt payoff','debt editor');
  await until(()=>js(function(){return !!document.querySelector('#mc-add-debt-account input');}),'blank account form visible');
  for(const [name,value] of [['Account name','TEST CARD 123456789012'],
    ['Balance','1840'],['APR (%)','18.5'],['Minimum / month','120']]){
    assert.equal(await js(function(name,value){
      const input=[...document.querySelectorAll('#mc-add-debt-account label')]
        .filter(label=>label.textContent.trim().startsWith(name))
        .map(label=>label.querySelector('input')).find(Boolean);
      if(!input)return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));return true;
    },name,value),true,name+' control');
  }
  await click('Save account');
  await expect('TEST CARD','account draft saved');
  await js(function(){
    const a=document.querySelector('a[aria-label="Go to Market Compass home"]');
    if(!a)throw Error('Home link missing');a.click();
  });
  await expect('TEST CARD','saved account overview');
  const row=await js(function(){
    const box=document.querySelector('.mc-account-row');if(!box)return null;
    box.querySelector('summary')?.click();
    return {name:box.querySelector('.mc-account-label strong')?.textContent,
      source:box.querySelector('.mc-account-label small')?.textContent,
      balance:box.querySelector('.mc-account-right strong')?.textContent,
      details:box.querySelector('.mc-account-details')?.textContent,open:box.open};
  });
  assert.ok(row);assert.equal(row.open,true);
  assert.match(row.name,/\[redacted number\]/);
  assert.ok(!row.name.includes('123456789012'));
  assert.match(row.source,/Not bank connected/);
  assert.ok(row.balance.includes('1')&&row.balance.includes('840'));
  assert.match(row.details,/18\.5%/);
  console.log('PASS: manual banking account, masked identifier, rate, amount and provenance');

  // Real browser check: Enter sends, Shift+Enter creates a newline, and
  // composition confirmation must never submit a financial question.
  await js(function(){
    const link=[...document.querySelectorAll('a')]
      .find(item=>item.getAttribute('href')?.endsWith('/assistant'));
    if(!link)throw Error('Assistant route missing');link.click();
  });
  await expect('Conversation','mobile assistant screen');
  // Chat occupies the available iPhone viewport. Auxiliary controls must be
  // accessible in the modal instead of shrinking the conversation.
  const compact=await js(function(){
    const chat=document.querySelector('[aria-label="AI chat interface"]');
    const open=document.querySelector('button[aria-label="Open Compass options"]');
    const header=document.querySelector('.mc-mobile-header');
    const log=document.querySelector('[role="log"][aria-label="AI conversation"]');
    return {
      chatHeight:chat?.getBoundingClientRect().height??0,
      logHeight:log?.getBoundingClientRect().height??0,
      hasOptions:!!open,
      toolbarAbsent:!header,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
    };
  });
  assert.equal(compact.toolbarAbsent,true,'AI view should not waste height on main mobile header');
  assert.ok(compact.chatHeight>400,'AI conversation must fill most of iPhone screen');
  assert.ok(compact.logHeight>130,'chat messages need usable scroll area');
  assert.equal(compact.hasOptions,true,'options opener must remain available');
  assert.equal(compact.horizontalOverflow,false,'AI screen must not overflow on iPhone');
  await js(function(){document.querySelector('button[aria-label="Open Compass options"]').click();});
  await until(()=>js(function(){return !!document.querySelector('[role="dialog"][aria-label="Compass AI options"]')}),'Compass options open');
  const dock=await js(function(){
    const dialog=document.querySelector('[role="dialog"][aria-label="Compass AI options"]');
    const host=dialog?.querySelector('.mc-assistant-dock');
    const cards=[...host?.children||[]];
    const personal=dialog?.querySelector('[aria-label="Compass Personal productivity tools"]');
    const rect=dialog?.getBoundingClientRect();
    const width=host?.getBoundingClientRect().width||0;
    return {
      vertical:host?getComputedStyle(host).flexDirection==='column':false,
      panels:cards.length,
      fullWidth:cards.every(card=>Math.abs(card.getBoundingClientRect().width-width)<4),
      hasPersonal:!!personal,
      personalSummaryWidth:personal?.querySelector('summary')?.getBoundingClientRect().width||0,
      bankStatus:dialog?.querySelector('details[aria-label="Bank connectivity and consent status"]')?.textContent,
      dialogFits:!!rect&&rect.width<=innerWidth+1&&rect.height<=innerHeight+1,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
    };
  });
  assert.equal(dock.vertical,true,'options contents should stack vertically');
  assert.ok(dock.panels>=4,'all options remain reachable');
  assert.equal(dock.fullWidth,true,'options cards should use full modal width');
  assert.equal(dock.hasPersonal,true,'Personal tool desk must remain in the modal');
  assert.ok(dock.personalSummaryWidth>250,'Personal tool summary must not be squeezed');
  assert.ok(dock.bankStatus?.includes('Not connected'),'bank consent is not fabricated');
  assert.equal(dock.dialogFits,true,'options sheet must fit inside iPhone viewport');
  assert.equal(dock.horizontalOverflow,false,'options should not cause sideways scrolling');
  await js(function(){document.querySelector('button[aria-label="Close Compass options"]').click();});
  await until(()=>js(function(){return !document.querySelector('[role="dialog"][aria-label="Compass AI options"]')}),'Compass options close');
  console.log('PASS: full-height Personal chat and accessible full-width options sheet');
  const before=await js(function(){
    const input=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
    const log=document.querySelector('[role="log"][aria-label="AI conversation"]');
    const submit=document.querySelector('button[aria-label="Send question"]');
    const mic=document.querySelector('button[aria-label="Speak a question"]');
    return {
      present:!!input&&!!log&&!!submit&&!!mic,
      width:input?.getBoundingClientRect().width||0,
      fontSize:input?getComputedStyle(input).fontSize:null,
      actions:[submit?.getBoundingClientRect().width,mic?.getBoundingClientRect().width],
      count:log?.querySelectorAll('.mc-chat-bubble').length??0,
      noOverflow:document.documentElement.scrollWidth<=innerWidth+1
    };
  });
  assert.equal(before.present,true,'composer and accessible controls visible');
  assert.ok(before.width>=155,'assistant text input must not be squeezed');
  assert.equal(before.fontSize,'16px','iPhone composer must not zoom on focus');
  assert.ok(before.actions.every(n=>n>=44),'voice/send tap targets at least 44px');
  assert.equal(before.noOverflow,true,'no horizontal overflow on AI tab');
  const setQuestion=async value=>{
    assert.equal(await js(function(value){
      const input=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')
        .set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return input.value;
    },value),value);
    await until(()=>js(function(){
      return !document.querySelector('button[aria-label="Send question"]').disabled;
    }),'question ready');
  };
  await setQuestion('What is my total debt?');
  const shift=await js(function(){
    const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
    const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',shiftKey:true,cancelable:true,bubbles:true});
    field.dispatchEvent(event);
    return {prevented:event.defaultPrevented,count:document.querySelectorAll('.mc-chat-bubble').length};
  });
  assert.equal(shift.prevented,false,'Shift+Enter should retain native newline behaviour');
  assert.equal(shift.count,before.count,'Shift+Enter must not send');
  const composing=await js(function(){
    const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
    const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,cancelable:true,bubbles:true});
    field.dispatchEvent(event);
    return {prevented:event.defaultPrevented,count:document.querySelectorAll('.mc-chat-bubble').length};
  });
  assert.equal(composing.prevented,false,'IME Enter must not be intercepted');
  assert.equal(composing.count,before.count,'IME composition must not send');
  const enter=await js(function(){
    const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
    const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});
    field.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(enter,true,'Enter must prevent insertion of an unwanted newline');
  await until(()=>js(function(){
    return document.querySelectorAll('.mc-chat-bubble').length>=3;
  }),'Enter local response');
  const after=await js(function(){
    return {
      count:document.querySelectorAll('.mc-chat-bubble').length,
      text:[...document.querySelectorAll('.mc-chat-bubble')].map(x=>x.textContent).join(' '),
      input:document.querySelector('textarea[aria-describedby="mc-composer-hint"]').value
    };
  });
  assert.equal(after.count,before.count+2,'Enter sends exactly once, with one local response');
  assert.ok(after.text.includes('What is my total debt?'));
  assert.equal(after.input,'','sent question clears input');
  await js(function(){document.querySelector('button[aria-label="Open Compass options"]').click();});
  await until(()=>js(function(){return !!document.querySelector('[role="dialog"][aria-label="Compass AI options"]')}),'options reopen for clearing chat');
  await js(function(){
    const button=[...document.querySelectorAll('[role="dialog"][aria-label="Compass AI options"] button')]
      .find(x=>x.textContent.trim()==='Clear chat');
    if(!button)throw Error('Clear chat action missing from options');
    button.click();
  });
  await until(()=>js(function(){return !document.querySelector('[role="dialog"][aria-label="Compass AI options"]')}),'options closed after clear');
  await expect('Conversation cleared. Ask a new question below.','compact empty chat state');
  // The original Personal edition must persist tasks in the same encrypted
  // workspace as finances, not in plaintext browser storage.
  await js(function(){document.querySelector('button[aria-label="Open Compass options"]').click();});
  await until(()=>js(function(){return !!document.querySelector('[role="dialog"][aria-label="Compass AI options"]')}),'options opened for Personal tasks');
  await js(function(){
    const planner=document.querySelector('[role="dialog"][aria-label="Compass AI options"] details[aria-label="Encrypted Personal task planner"]');
    if(!planner)throw Error('Personal task planner missing');
    planner.open=true;
    const input=planner.querySelector('input[aria-label="New Personal task"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')
      .set.call(input,'SYNTHETIC PERSONAL TASK');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await until(()=>js(function(){
    const planner=document.querySelector('details[aria-label="Encrypted Personal task planner"]');
    return !!planner?.querySelector('button[type="submit"]:not(:disabled)');
  }),'Personal task add ready');
  await js(function(){
    document.querySelector('details[aria-label="Encrypted Personal task planner"] button[type="submit"]').click();
  });
  await until(()=>js(function(){
    return !![...document.querySelectorAll('[aria-label="Saved Personal tasks"] li')]
      .find(x=>x.textContent.includes('SYNTHETIC PERSONAL TASK'));
  }),'Personal task created in encrypted workspace state');
  const personalTask=await js(function(){
    const row=[...document.querySelectorAll('[aria-label="Saved Personal tasks"] li')]
      .find(x=>x.textContent.includes('SYNTHETIC PERSONAL TASK'));
    return {present:!!row,done:row?.querySelector('[aria-label="Mark task complete"]')!==null,
      plaintext:localStorage.getItem('personalTasks')};
  });
  assert.equal(personalTask.present,true);
  assert.equal(personalTask.done,true);
  assert.equal(personalTask.plaintext,null,'no separate plaintext task cache');
  await js(function(){
    document.querySelector('[aria-label="Saved Personal tasks"] [aria-label="Mark task complete"]').click();
  });
  await until(()=>js(function(){
    return document.querySelector('[aria-label="Saved Personal tasks"] [aria-label="Mark task unfinished"]')!==null;
  }),'Personal task complete');
  await js(function(){document.querySelector('button[aria-label="Close Compass options"]').click();});
  console.log('PASS: Personal tasks remain accessible inside options and encrypted-vault-only');
  console.log('PASS: responsive AI bubbles and composer; Enter/Shift+Enter/IME and compact empty state');
  console.log('PUBLIC BOOTSTRAP UI SMOKE PASS (synthetic localhost; not real iPhone)');
}catch(error){
  console.error('PUBLIC BOOTSTRAP UI SMOKE FAIL:',error.message);
  process.exitCode=1;
}finally{
  try{ws?.close()}catch{}
  kill(edge);kill(preview);
  try{await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:250})}
  catch{console.error('Temporary synthetic browser-profile cleanup needs review')}
}
