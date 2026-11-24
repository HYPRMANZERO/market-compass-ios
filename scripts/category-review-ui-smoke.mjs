/**
 * Synthetic, isolated 390px browser acceptance for the Spend categorizer.
 * Tests both editions with no access to personal documents or production vaults.
 * Requires an existing Vite production build, Edge/Chromium and Node 24.
 */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'artifacts','market-compass');
const out=path.resolve(process.env.MC_PWA_OUT_DIR||path.join(app,'dist','public'));
assert.ok(existsSync(path.join(out,'index.html')),'Build this edition before testing');
const base=process.env.BASE_PATH||'/market-compass-ios/';
assert.match(base,/^\/(?:[a-z0-9-]+\/)?$/);
const browser=[process.env.MC_TEST_BROWSER,
 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
 '/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!browser)throw Error('Edge or Chromium required for category review acceptance');
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const chosen=server.address().port;
  server.close(e=>e?reject(e):resolve(chosen));
 });
});
const profile=await mkdtemp(path.join(tmpdir(),'compass-category-review-'));
let vite,chrome,ws,seq=0;
const pending=new Map();
const stop=handle=>{
 if(!handle?.pid)return;
 if(process.platform==='win32'){
  spawnSync('taskkill',['/PID',String(handle.pid),'/F','/T'],{windowsHide:true,stdio:'ignore',timeout:10000});
 }else{try{handle.kill('SIGTERM')}catch{}}
};
async function wait(fn,description,timeout=25000){
 const ends=Date.now()+timeout;
 let lastError;
 while(Date.now()<ends){
  try{if(await fn())return;}catch(error){lastError=error;}
  await sleep(180);
 }
 throw Error(description+' timed out'+(lastError?': '+lastError.message:''));
}
function cdp(method,params={}){
 const id=++seq;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('DevTools '+method+' timed out'))},12000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
}
async function js(fn,...args){
 const expr='('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')';
 const response=await cdp('Runtime.evaluate',{expression:expr,returnByValue:true,
  awaitPromise:true,userGesture:true});
 if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
 return response.result?.value;
}
async function click(selector){
 await wait(()=>js(selector=>{
  const el=document.querySelector(selector);
  return !!el&&!el.disabled;
 },selector),'control '+selector);
 assert.equal(await js(selector=>{
  const el=document.querySelector(selector);if(!el||el.disabled)return false;
  el.click();return true;
 },selector),true);
}
async function setValue(selector,value){
 const accepted=await js((selector,value)=>{
  const el=document.querySelector(selector);if(!el)return false;
  const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));
  return el.value===value;
 },selector,value);
 assert.equal(accepted,true,'set '+selector);
}
const origin='http://127.0.0.1:'+port;
try{
 const address=origin+base;
 vite=spawn(process.execPath,[path.join(app,'node_modules','vite','bin','vite.js'),
  'preview','--config','vite.config.ts','--host','127.0.0.1',
  '--port',String(port),'--strictPort'],{cwd:app,windowsHide:true,stdio:'ignore',
    env:{...process.env,BASE_PATH:base,NODE_ENV:'production'}});
 await wait(async()=>{
  if(vite.exitCode!==null)throw Error('preview exited');
  const r=await fetch(address);
  return r.status===200&&/(Compass Personal|Compass Financial Advisor)/.test(await r.text());
 },'preview');
 chrome=spawn(browser,['--headless=new','--disable-gpu','--no-first-run',
  '--no-default-browser-check','--disable-extensions','--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,address],
  {windowsHide:true,stdio:'ignore'});
 let activePort;
 await wait(async()=>{
  const file=path.join(profile,'DevToolsActivePort');
  if(!existsSync(file))return false;
  const x=(await readFile(file,'utf8')).split(/\r?\n/)[0];
  if(!/^\d+$/.test(x))return false;activePort=Number(x);return true;
 },'headless browser DevTools');
 let target;
 await wait(async()=>{
  const pages=await(await fetch('http://127.0.0.1:'+activePort+'/json/list')).json();
  target=pages.find(p=>p.type==='page'&&p.url.startsWith(address));
  return !!target;
 },'headless browser tab');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 ws.addEventListener('message',event=>{
  const message=JSON.parse(event.data),p=pending.get(message.id);
  if(!p)return;
  pending.delete(message.id);clearTimeout(p.timer);
  message.error?p.reject(Error(message.error.message)):p.resolve(message.result);
 });
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
 await wait(()=>js(()=>!!document.querySelector('#vault-password')),'encrypted workspace prompt');
 await setValue('#vault-password','synthetic-'+randomUUID());
 assert.equal(await js(()=>{
   const button=[...document.querySelectorAll('.mc-vault-entry button')]
     .find(x=>x.textContent.includes('Create encrypted workspace'));
   if(!button||button.disabled)return false;
   button.click();return true;
 }),true,'create synthetic encrypted workspace');
 await wait(()=>js(()=>document.body.textContent.includes('Encrypted vault & settings')),'local encrypted workspace');
 await click('a[href$="/expenses"]');
 await wait(()=>js(()=>!!document.querySelector('nav[aria-label="Spend sections"]')),'Spend section navigation');
 const nav=await js(()=>{
  const root=document.querySelector('nav[aria-label="Spend sections"]');
  return {route:location.pathname.endsWith('/expenses'),
    hasActivity:[...root?.querySelectorAll('ion-segment-button')||[]]
      .some(b=>b.textContent.trim().startsWith('Activity'))};
 });
 assert.deepEqual(nav,{route:true,hasActivity:true},'Ionic Spend workspace available');
 assert.equal(await js(()=>{
  const tab=[...document.querySelectorAll('nav[aria-label="Spend sections"] ion-segment-button')]
    .find(b=>b.textContent.trim().startsWith('Activity'));
  if(!tab)return false;
  tab.click();return true;
 }),true,'Ionic Activity segment is clickable');
 await wait(()=>js(()=>!!document.querySelector('#mc-expense-form form')),'Spend transaction form');
 await wait(()=>js(()=>!!document.querySelector('[aria-label="Scan saved payments for categories"]')),'category review scan button');
 assert.equal(await js(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'phone viewport no overflow');
 for(let i=0;i<10;i++){
  const desc=i===9?'Unidentified QR merchant synthetic':'Bank account service fee synthetic '+(i+1);
  await setValue('#mc-expense-form input[maxlength="100"]',desc);
  await setValue('#mc-expense-form input[maxlength="60"]','Synthetic test');
  await setValue('#mc-expense-form input[type="number"][required]','11.00');
  await click('#mc-expense-form button[type="submit"]');
  await wait(()=>js(()=>document.querySelector('#mc-expense-form input[maxlength="100"]')?.value===''),'reset after save '+(i+1));
 }
 const container='[aria-label="Review uncategorized saved payments"]';
 await click(container+' [aria-label="Scan saved payments for categories"]');
 await wait(()=>js(sel=>{
  const text=document.querySelector(sel)?.innerText||'';
  return text.includes('Suggested (9)')&&text.includes('Needs your decision (1)');
 },container),'10 stored entries scanned as 9 suggestions plus 1 unknown');
 const summary=await js(sel=>{
  const box=document.querySelector(sel);
  const controls=[...box.querySelectorAll('[aria-label="Category review pagination"] button')];
  return {page:box.innerText.includes('Page 1 of 2'),
    firstPageRows:box.querySelectorAll('[aria-label="Suggested category corrections"] label').length,
    nextEnabled:!controls.at(-1)?.disabled,previousDisabled:controls[0]?.disabled,
    overflow:document.documentElement.scrollWidth>innerWidth+1};
 },container);
 assert.deepEqual(summary,{page:true,firstPageRows:8,nextEnabled:true,
  previousDisabled:true,overflow:false});
 await click(container+' [aria-label="Category review pagination"] button:last-child');
 await wait(()=>js(sel=>document.querySelector(sel)?.innerText.includes('Page 2 of 2'),container),
  'second review page');
 const page2Rows=await js(sel=>document.querySelector(sel)
  ?.querySelectorAll('[aria-label="Suggested category corrections"] label').length,container);
 assert.equal(page2Rows,1,'last review page has one additional suggestion');
 await click(container+' [aria-label="Category review pagination"] button:first-child');
 await wait(()=>js(sel=>document.querySelector(sel)?.innerText.includes('Page 1 of 2'),container),
  'previous review page');
 const approveButton=await js(sel=>{
   const button=[...document.querySelector(sel).querySelectorAll('button')]
     .find(x=>x.textContent.includes('Approve 8 selected on this page'));
   if(!button||button.disabled)return false;
   button.click();return true;
 },container);
 assert.equal(approveButton,true,'page-scoped approval control');
 await wait(()=>js(sel=>{
   const text=document.querySelector(sel)?.innerText||'';
   return text.includes('Suggested (1)')&&text.includes('Needs your decision (1)');
 },container),'8 approvals must update the remaining review queue');
 await click(container+' [aria-label="Category review mode"] button:last-child');
 await wait(()=>js(sel=>document.querySelector(sel)
   ?.querySelectorAll('[aria-label="Unresolved payments to review"] > div').length===1,container),
   'unresolved manual review opened');
 await setValue(container+' select','shopping');
 const manualSaved=await js(sel=>{
   const button=[...document.querySelector(sel).querySelectorAll('button')]
     .find(x=>x.textContent.includes('Save this category'));
   if(!button||button.disabled)return false;
   button.click();return true;
 },container);
 assert.equal(manualSaved,true,'owner-selected category save');
 await wait(()=>js(sel=>{
   const text=document.querySelector(sel)?.innerText||'';
   return text.includes('Needs your decision (0)')&&text.includes('Suggested (1)');
 },container),'manual category disappears from unresolved without discarding other proposals');
 const evidence=await js(sel=>{
   const root=document.querySelector(sel);
   return {checked:root?.innerText.includes('Checked'),remaining:root?.innerText.includes('Suggested (1)'),
     unresolved:root?.innerText.includes('Needs your decision (0)'),
     plaintext:localStorage.getItem('market-compass-workspace-v1'),
     overflow:document.documentElement.scrollWidth>innerWidth+1};
 },container);
 assert.equal(evidence.checked,true);
 assert.equal(evidence.remaining,true);
 assert.equal(evidence.unresolved,true);
 assert.equal(evidence.plaintext,null,'no plaintext legacy localStorage copy');
 assert.equal(evidence.overflow,false,'review page remains phone-width safe');
 console.log('PASS: 390px encrypted Spend scan, next/previous, page approval, unresolved manual edit and persistent queue; '+process.env.VITE_MC_EDITION);
}catch(error){
 console.error('CATEGORY REVIEW UI SMOKE FAIL:',error.message);
 process.exitCode=1;
}finally{
 try{ws?.close()}catch{}
 stop(chrome);stop(vite);
 try{await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:250})}
 catch{console.error('Synthetic profile cleanup needs review');}
}
