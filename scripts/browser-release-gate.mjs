/**
 * Repeatable, synthetic-only browser release gate.
 * Requires built artifacts/market-compass/dist/public and Microsoft Edge (or
 * MC_TEST_BROWSER). Runs ONLY on loopback with a disposable browser profile.
 * No live PWA, gateway, existing browser profile or real financial files touched.
 *
 * Usage: node scripts/browser-release-gate.mjs
 * Optional: BASE_PATH=/market-compass-ios/ MC_TEST_BROWSER=<browser executable>
 */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'artifacts','market-compass');
const dist=path.join(app,'dist','public','index.html');
const fixture=path.join(root,'tests','fixtures','synthetic-password-payslip.pdf.b64');
const rawBase=process.env.BASE_PATH||'/';
const base=rawBase.startsWith('/')?(rawBase.endsWith('/')?rawBase:rawBase+'/'):null;
if(!base||base.includes('..'))throw Error('Unsafe BASE_PATH');
assert.ok(existsSync(dist),'Build the PWA before running the browser release gate');
assert.ok(existsSync(fixture),'Synthetic PDF test fixture not available');

function findBrowser(){
  const candidates=[process.env.MC_TEST_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium','/usr/bin/google-chrome'];
  const resolved=candidates.find(s=>s&&existsSync(s));
  if(!resolved)throw Error('A local Edge/Chromium executable is required; set MC_TEST_BROWSER');
  return resolved;
}
async function freePort(){
  return new Promise((resolve,reject)=>{
    const srv=createServer();
    srv.once('error',reject);
    srv.listen(0,'127.0.0.1',()=>{
      const addr=srv.address();
      const port=addr.port;
      srv.close(error=>error?reject(error):resolve(port));
    });
  });
}
async function waitFor(check,label,limitMs=18000){
  const until=Date.now()+limitMs;
  let latest=null;
  while(Date.now()<until){
    try{const result=await check();if(result)return result;}catch(error){latest=error;}
    await sleep(160);
  }
  throw Error('Timed out: '+label+(latest?' ('+latest.message+')':''));
}
function shutDown(child){
  if(!child||!child.pid)return;
  if(process.platform==='win32'){
    spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{
      windowsHide:true,stdio:'ignore',timeout:5000
    });
  }else{
    try{child.kill('SIGTERM');}catch{}
  }
}
class BrowserTab{
  constructor(ws){
    this.ws=ws;
    this.seq=0;
    this.pending=new Map();
    ws.addEventListener('message',event=>{
      let msg;try{msg=JSON.parse(event.data);}catch{return;}
      const item=this.pending.get(msg.id);
      if(!item)return;
      this.pending.delete(msg.id);clearTimeout(item.timer);
      if(msg.error)item.reject(Error(msg.error.message));
      else item.resolve(msg.result);
    });
  }
  static async connect(address){
    const ws=new WebSocket(address);
    await new Promise((resolve,reject)=>{
      ws.addEventListener('open',resolve,{once:true});
      ws.addEventListener('error',reject,{once:true});
    });
    return new BrowserTab(ws);
  }
  command(method,params={}){
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        this.pending.delete(id);
        reject(Error('CDP timeout '+method));
      },12000);
      this.pending.set(id,{resolve,reject,timer});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  async invoke(fn,...args){
    const src='('+fn.toString()+')('+args.map(arg=>JSON.stringify(arg)).join(',')+')';
    const result=await this.command('Runtime.evaluate',{
      expression:src,awaitPromise:true,returnByValue:true,userGesture:true
    });
    if(result.exceptionDetails){
      const error=result.exceptionDetails.exception?.description||
        result.exceptionDetails.text||'Browser expression failed';
      throw Error(error);
    }
    return result.result?.value;
  }
  close(){try{this.ws.close();}catch{}}
}
function assertClick(value,label){assert.equal(value,'clicked',label+': '+String(value));}
async function click(tab,label){
  await waitFor(()=>tab.invoke(function(label){
    const button=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(label));
    return !!button && !button.disabled;
  },label),'enabled button '+label,12000);
  const result=await tab.invoke(function(label){
    const button=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(label));
    if(!button)return 'missing';
    if(button.disabled)return 'disabled';
    button.click();return 'clicked';
  },label);
  assertClick(result,label);
}
async function input(tab,selector,value){
  const actual=await tab.invoke(function(selector,value){
    const field=document.querySelector(selector);
    if(!field||field.disabled)return 'missing/disabled';
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')
      .set.call(field,value);
    field.dispatchEvent(new Event('input',{bubbles:true}));
    return field.value;
  },selector,value);
  assert.equal(actual,value,'Input '+selector+' did not update');
}
async function text(tab){return tab.invoke(function(){return document.body.innerText;});}
async function expectText(tab,needle,label){
  await waitFor(async()=> (await text(tab)).includes(needle),label||needle);
}
async function chooseFiles(tab,selector,docs){
  const result=await tab.invoke(function(selector,docs){
    const field=document.querySelector(selector);
    if(!field)return 'missing';
    if(field.disabled)return 'disabled';
    const transfer=new DataTransfer();
    for(const doc of docs){
      const raw=atob(doc.base64);
      const bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0));
      transfer.items.add(new File([bytes],doc.name,{type:doc.mime}));
    }
    const selectedCount=transfer.files.length;
    field.files=transfer.files;
    field.dispatchEvent(new Event('change',{bubbles:true}));
    // React intentionally clears the input after reading the FileList.
    return 'selected '+selectedCount;
  },selector,docs);
  assert.equal(result,'selected '+docs.length,
    'Synthetic Files picker: '+result);
}
function syntheticCsv(name,description,date,amount){
  return {name,mime:'text/csv',base64:Buffer.from(
    'Date,Description,Amount\n'+date+','+description+','+amount+'\n'
  ).toString('base64')};
}
async function storedRecord(tab){
  return tab.invoke(async function(){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open('market-compass-local-vault',1);
      open.onerror=()=>reject(Error('IndexedDB vault unavailable'));
      open.onsuccess=()=>{
        const db=open.result;
        const tx=db.transaction('records','readonly');
        const req=tx.objectStore('records').get('workspace');
        req.onsuccess=()=>{db.close();resolve(req.result??null);};
        req.onerror=()=>{db.close();reject(Error('Cannot read synthetic test vault'));};
      };
    });
  });
}
async function main(){
  const browser=findBrowser();
  const pdfBase64=(await readFile(fixture,'utf8')).trim();
  const profile=await mkdtemp(path.join(tmpdir(),'mc-browser-release-gate-'));
  let edge=null,previews=[],tab=null;
  try{
    const ports=[await freePort(),await freePort()];
    assert.notEqual(ports[0],ports[1]);
    const launchPreview=async port=>{
      const child=spawn(process.execPath,[
        path.join(app,'node_modules','vite','bin','vite.js'),
        'preview','--config','vite.config.ts',
        '--host','127.0.0.1','--port',String(port),'--strictPort'
      ],{
        cwd:app,windowsHide:true,stdio:'ignore',
        env:{...process.env,PORT:String(port),BASE_PATH:base,NODE_ENV:'production'}
      });
      previews.push(child);
      const url='http://127.0.0.1:'+port+base;
      await waitFor(async()=>{
        if(child.exitCode!==null)throw Error('Vite preview exited');
        const r=await fetch(url);
        return r.status===200 && (await r.text()).includes('Market Compass');
      },'localhost-only PWA preview '+port);
      return url;
    };
    const first=await launchPreview(ports[0]);
    const second=await launchPreview(ports[1]);
    edge=spawn(browser,[
      '--headless=new','--disable-gpu','--no-first-run',
      '--no-default-browser-check','--disable-extensions',
      '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
      '--user-data-dir='+profile,'--window-size=390,844',first
    ],{windowsHide:true,stdio:'ignore'});
    const dbg=await waitFor(async()=>{
      const file=path.join(profile,'DevToolsActivePort');
      if(!existsSync(file))return null;
      const value=(await readFile(file,'utf8')).trim().split(/\r?\n/)[0];
      return /^\d+$/.test(value)?Number(value):null;
    },'isolated browser debugging endpoint');
    const target=await waitFor(async()=>{
      const r=await fetch('http://127.0.0.1:'+dbg+'/json/list');
      if(!r.ok)return null;
      const pages=await r.json();
      return pages.find(item=>item.type==='page'&&item.url.startsWith(first));
    },'disposable browser tab');
    tab=await BrowserTab.connect(target.webSocketDebuggerUrl);
    // Test a real mobile viewport, not merely Edge's desktop minimum window width.
    await tab.command('Emulation.setDeviceMetricsOverride',{
      width:390,height:844,deviceScaleFactor:3,mobile:true
    });
    await expectText(tab,'Create encrypted workspace','initial synthetic vault screen');
    const pass='synthetic-browser-gate-'+randomUUID();
    await input(tab,'#vault-password',pass);
    await click(tab,'Create encrypted workspace');
    await expectText(tab,'Encrypted vault & settings','synthetic vault created');
    console.log('PASS: isolated AES-GCM vault creation in actual browser');

    const ui=await tab.invoke(function(){
      const hero=document.querySelector('.mc-wallet-hero');
      const actions=document.querySelector('.mc-bs-quick-actions');
      const columns=actions?[...actions.querySelectorAll('.col-4')]:[];
      const nav=document.querySelector('[aria-label="Mobile app tabs"]');
      return {
        hero:!!hero,
        accountDisclaimer:hero?.innerText.includes('Not a live or bank-verified balance')||
          hero?.innerText.includes('private picture'),
        actionCount:columns.length,
        bootstrapDisplay:actions?getComputedStyle(actions).display:null,
        columnWidth:columns.length?columns[0].getBoundingClientRect().width:0,
        rowWidth:actions?.getBoundingClientRect().width??0,
        nav:!!nav,navTabs:nav?.querySelectorAll('.mc-tab-link').length??0,
        privacyText:document.body.innerText.includes('No bank connection')
      };
    });
    assert.equal(ui.hero,true,'mobile banking overview card must render');
    assert.equal(ui.accountDisclaimer,true,'manual account figures must not appear bank-verified');
    assert.equal(ui.actionCount,3,'quick actions must expose three mobile routes');
    assert.equal(ui.bootstrapDisplay,'flex','locally bundled Bootstrap grid must control quick actions');
    assert.ok(ui.rowWidth>0 && Math.abs(ui.columnWidth/ui.rowWidth-1/3)<0.025,
      'Bootstrap col-4 quick action must occupy one third of the row');
    assert.equal(ui.nav,true,'mobile tab navigation must remain');
    assert.equal(ui.navTabs,6,'all six existing PWA routes must remain accessible');
    assert.equal(ui.privacyText,true,'clear offline, manual-entry boundary must remain');
    console.log('PASS: Bootstrap mobile grid, finance card, quick actions, privacy and six-tab shell');
    if(process.env.MC_TEST_SCREENSHOT){
      // Captures only the fabricated, isolated test vault; never capture owner data.
      const frame=await tab.command('Page.captureScreenshot',{
        format:'png',captureBeyondViewport:false,fromSurface:true
      });
      await writeFile(process.env.MC_TEST_SCREENSHOT,Buffer.from(frame.data,'base64'));
      console.log('Synthetic mobile screenshot captured for local visual review');
    }

    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/debt'));
      if(!link)throw Error('Debt route unavailable');
      link.click();
    });
    await expectText(tab,'Debt payoff','debt account editor');
    await click(tab,'Add an account');
    async function fillDebtField(label,value){
      const result=await tab.invoke(function(label,value){
        const matches=[...document.querySelectorAll('label')].filter(item=>item.textContent?.trim().startsWith(label));
        const field=matches.map(item=>item.querySelector('input')).find(Boolean);
        if(!field)return 'missing';
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);
        field.dispatchEvent(new Event('input',{bubbles:true}));
        return 'filled';
      },label,value);
      assert.equal(result,'filled','Debt field '+label+' must be editable');
    }
    await fillDebtField('Account name','SYNTHETIC CREDIT CARD 123456789012');
    await fillDebtField('Balance','1840');
    await fillDebtField('APR (%)','18.5');
    await fillDebtField('Minimum / month','120');
    await tab.invoke(function(){
      const link=document.querySelector('a[aria-label="Go to Market Compass home"]');
      if(!link)throw Error('Home link unavailable');
      link.click();
    });
    await expectText(tab,'SYNTHETIC CREDIT CARD','owner-entered account row on Home');
    const accountUi=await tab.invoke(function(){
      const account=[...document.querySelectorAll('.mc-account-row')].find(x=>x.textContent.includes('SYNTHETIC CREDIT CARD'));
      if(!account)return null;
      account.querySelector('summary')?.click();
      return {
        balance:account.querySelector('.mc-account-right')?.textContent,
        expanded:account.open,
        details:account.querySelector('.mc-account-details')?.textContent,
        source:account.querySelector('.mc-account-label small')?.textContent
      };
    });
    assert.ok(accountUi?.balance?.includes('1')&&accountUi?.balance?.includes('840'),
      'entered account balance should be visible in banking row');
    assert.equal(accountUi?.expanded,true,'per-account details must expand');
    assert.ok(accountUi?.details?.includes('18.5%'),
      'account details must preserve owner-entered APR');
    assert.match(accountUi?.source??'',/Not bank connected/);
    const privateLabels=await tab.invoke(function(){
      return [...document.querySelectorAll('.mc-account-label strong')].map(element=>element.textContent);
    });
    assert.ok(privateLabels.some(label=>label?.includes('[redacted number]')),
      'account identifiers entered in names must be masked in the mobile banking view');
    assert.ok(privateLabels.every(label=>!label?.includes('123456789012')),
      'the full synthetic account identifier must never be displayed as a label');
    console.log('PASS: vertical account row, privacy-masked identifier, saved balance and APR');

    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/expenses'));
      if(!link)throw Error('Spend route unavailable');
      link.click();
    });
    await expectText(tab,'Import & review','Spend import screen');
    const picker='input[type="file"][multiple]';
    const firstCsv=syntheticCsv('synthetic-2026-11.csv','Synthetic groceries','2026-11-21','-125.25');
    const secondCsv=syntheticCsv('synthetic-2026-10.csv','Synthetic transit','2026-10-21','-80.00');
    await chooseFiles(tab,picker,[firstCsv,secondCsv]);
    await expectText(tab,'Synthetic groceries','first batch preview');
    await expectText(tab,'Reviewing document 1 of 2','batch progress');
    await click(tab,'Save these reviewed excerpts');
    await expectText(tab,'Synthetic transit','second batch preview');
    await expectText(tab,'Reviewing document 2 of 2','second batch progress');
    await click(tab,'Skip this document without saving');
    await expectText(tab,'1 of 100 saved','first saved, second skipped');
    console.log('PASS: two selected files queued, first saved and second skipped');

    await chooseFiles(tab,picker,[{...firstCsv,name:'synthetic-renamed.csv'}]);
    await expectText(tab,'Synthetic groceries','duplicate preview');
    await click(tab,'Save these reviewed excerpts');
    await expectText(tab,'already saved','duplicate suppression');
    await click(tab,'Skip this document without saving');
    await expectText(tab,'1 of 100 saved','unchanged saved count');
    console.log('PASS: renamed duplicate refused without doubling evidence');

    await chooseFiles(tab,picker,[{
      name:'synthetic-encrypted-payslip.pdf',mime:'application/pdf',
      base64:pdfBase64
    }]);
    await expectText(tab,'Encrypted PDF · password required','encrypted PDF prompt');
    await input(tab,'input[placeholder="Password for this document"]','SYNTHETIC_WRONG');
    await click(tab,'Unlock & review this PDF');
    await expectText(tab,'Encrypted PDF · password required','wrong password rejected');
    await input(tab,'input[placeholder="Password for this document"]','SYNTHETIC_ONLY');
    await click(tab,'Unlock & review this PDF');
    await expectText(tab,'Net pay','correct PDF review');
    await expectText(tab,'Save these reviewed excerpts','PDF review not auto-saved');
    await click(tab,'Skip this document without saving');
    await expectText(tab,'1 of 100 saved','no PDF saved without approval');
    console.log('PASS: encrypted PDF wrong/correct password and skip review');

    await waitFor(async()=>{
      return tab.invoke(function(){
        const section=document.querySelector('#mc-backup-controls');
        if(!section)return false;
        section.open=true;
        const exportButton=[...document.querySelectorAll('button')]
          .find(button=>button.textContent.includes('Backup & lock app'));
        return exportButton&&!exportButton.disabled;
      });
    },'encrypted vault auto-save completed');
    const backup=await storedRecord(tab);
    assert.equal(backup?.cipher,'AES-256-GCM');
    assert.equal(backup?.version,2);
    assert.ok(!JSON.stringify(backup).includes('Synthetic groceries'));
    console.log('PASS: encrypted IndexedDB record and no plaintext in backup');

    await tab.invoke(function(){
      Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
      window.confirm=()=>true;
    });
    await click(tab,'Backup & lock app');
    await expectText(tab,'Unlock Market Compass','lock after final persistence');
    await input(tab,'#vault-password',pass);
    await click(tab,'Unlock Market Compass');
    await expectText(tab,'1 of 100 saved','document restored after lock and unlock');
    console.log('PASS: export fallback, final lock persistence and unlock');

    await tab.command('Page.navigate',{url:second});
    await expectText(tab,'Create encrypted workspace','separate empty browser origin');
    await input(tab,'#vault-password','SYNTHETIC_WRONG');
    const restorePicker='input[aria-label="Import encrypted vault backup"]';
    const backupDoc={
      name:'synthetic.mc-vault.json',mime:'application/json',
      base64:Buffer.from(JSON.stringify(backup)).toString('base64')
    };
    await chooseFiles(tab,restorePicker,[backupDoc]);
    await expectText(tab,'Incorrect password or damaged encrypted vault',
      'incorrect backup password rejected');
    await input(tab,'#vault-password',pass);
    await chooseFiles(tab,restorePicker,[backupDoc]);
    await expectText(tab,'Encrypted vault & settings','synthetic cross-origin restore');
    // A restored browser origin opens Home; its file list may be collapsed.
    // Verify saved evidence on the dedicated Spend route instead.
    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/expenses'));
      if(!link)throw Error('Restored Spend route missing');
      link.click();
    });
    await expectText(tab,'1 of 100 saved','restored count on independent origin');
    const restored=await storedRecord(tab);
    assert.equal(restored.ciphertext,backup.ciphertext,
      'restored ciphertext should match the exported backup');
    console.log('PASS: rejected wrong backup password and restored encrypted vault to isolated second origin');
    console.log('BROWSER RELEASE GATE PASS (synthetic data, Chromium; not iPhone Safari)');
  }finally{
    tab?.close();
    if(edge)shutDown(edge);
    for(const preview of previews)shutDown(preview);
    try{await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:250});}
    catch{console.error('Temporary synthetic browser profile cleanup requires manual review');}
  }
}
main().catch(error=>{
  console.error('BROWSER RELEASE GATE FAIL:',error.message);
  process.exitCode=1;
});
