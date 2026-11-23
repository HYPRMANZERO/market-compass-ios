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
assert.ok(existsSync(path.join(app,'dist','public','index.html')),'Build public PWA first');
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
    const r=await fetch(url);return r.status===200&&(await r.text()).includes('Market Compass');
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
  assert.equal(ui.tabs,6);assert.equal(ui.privacy,true);
  assert.equal(ui.horizontalOverflow,false,'no horizontal scrolling at iPhone width');
  console.log('PASS: local Bootstrap grid, private dashboard, iPhone viewport, six tabs');
  await js(function(){
    const a=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/debt'));
    if(!a)throw Error('Debt navigation missing');a.click();
  });
  await expect('Debt payoff','debt editor');
  await click('Add an account');
  for(const [name,value] of [['Account name','TEST CARD 123456789012'],
    ['Balance','1840'],['APR (%)','18.5'],['Minimum / month','120']]){
    assert.equal(await js(function(name,value){
      const input=[...document.querySelectorAll('label')]
        .filter(label=>label.textContent.trim().startsWith(name))
        .map(label=>label.querySelector('input')).find(Boolean);
      if(!input)return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));return true;
    },name,value),true,name+' control');
  }
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
