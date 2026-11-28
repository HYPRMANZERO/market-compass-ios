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
// Release candidates must be validated without touching the active gateway dist.
// Vite preview resolves the same MC_PWA_OUT_DIR from its config.
const dist=path.join(path.resolve(process.env.MC_PWA_OUT_DIR||path.join(app,'dist','public')),'index.html');
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
async function assertDocumentScrolling(tab,label){
  const result=await tab.invoke(async function(){
    const css=getComputedStyle(document.body);
    const doc=document.scrollingElement;
    const extent=Math.max(0,(doc?.scrollHeight??0)-innerHeight);
    window.scrollTo(0,Math.min(260,extent));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const scrolled=window.scrollY;
    const header=document.querySelector('.mc-mobile-header');
    const headerTop=header?.getBoundingClientRect().top??null;
    window.scrollTo(0,0);
    return {position:css.position,touch:css.touchAction,extent,scrolled,headerTop};
  });
  assert.notEqual(result.position,'fixed',label+': Ionic must not fix the body');
  assert.notEqual(result.touch,'manipulation',label+': vertical finger panning must be allowed');
  assert.ok(result.extent>120,label+': content needs vertical room, '+JSON.stringify(result));
  assert.ok(result.scrolled>40,label+': window must actually scroll, '+JSON.stringify(result));
  assert.ok(result.headerTop===null || Math.abs(result.headerTop)<3,
    label+': sticky header should remain visible, '+JSON.stringify(result));
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
        return r.status===200 && /(?:Market Compass|Compass Personal)/.test(await r.text());
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
    const login=await tab.invoke(function(){
      const wrapper=document.querySelector('.mc-vault-entry');
      const card=wrapper?.querySelector('.rounded-\\[22px\\]');
      const input=document.querySelector('#vault-password');
      const restore=[...wrapper?.querySelectorAll('details')||[]]
        .find(x=>x.innerText.includes('Restore from encrypted backup'));
      const privacy=[...wrapper?.querySelectorAll('details')||[]]
        .find(x=>x.innerText.includes('Vault & privacy information'));
      return {
        exists:!!wrapper,
        cardWidth:card?.getBoundingClientRect().width||0,
        cardHeight:card?.getBoundingClientRect().height||0,
        fontSize:input?getComputedStyle(input).fontSize:null,
        inputHeight:input?.getBoundingClientRect().height||0,
        privacyCollapsed:!!privacy&&!privacy.open,
        restoreAvailable:!!restore,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
      };
    });
    assert.equal(login.exists,true,'compact vault entry must render');
    assert.ok(login.cardWidth>0&&login.cardWidth<=390,'vault card must fit iPhone width');
    assert.ok(login.cardHeight>0&&login.cardHeight<550,'vault card must be compact');
    assert.equal(login.fontSize,'16px','iPhone password input must not force Safari zoom');
    assert.ok(login.inputHeight>=44,'password input requires a usable touch target');
    assert.equal(login.privacyCollapsed,true,'long privacy disclosure must be expandable');
    assert.equal(login.restoreAvailable,true,'encrypted vault restore must remain accessible');
    assert.equal(login.horizontalOverflow,false,'compact vault must not horizontally overflow');
    console.log('PASS: compact iPhone login dimensions, 16px input and expandable privacy guidance');
    if(process.env.MC_TEST_LOGIN_SCREENSHOT){
      const frame=await tab.command('Page.captureScreenshot',{
        format:'png',captureBeyondViewport:false,fromSurface:true
      });
      await writeFile(process.env.MC_TEST_LOGIN_SCREENSHOT,Buffer.from(frame.data,'base64'));
    }
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
    assert.equal(ui.navTabs,4,'Home, Markets, AI, and Menu tabs remain visible; other sections are in Menu');
    assert.equal(ui.privacyText,true,'clear offline, manual-entry boundary must remain');
    await assertDocumentScrolling(tab,'Home on a 390px iPhone-sized viewport');
    console.log('PASS: unlocked Ionic Home supports real vertical page scrolling with sticky header');
    // Market Data Saver is opt-in and never changes encrypted finance records.
    await tab.invoke(function(){
      const markets=[...document.querySelectorAll('[aria-label="Mobile app tabs"] a')]
        .find(a=>a.textContent?.includes('Markets'));
      if(!markets)throw Error('Markets tab missing');markets.click();
    });
    await waitFor(()=>tab.invoke(function(){
      return !!document.querySelector('input[aria-label="Data Saver for market refreshes"]');
    }),'Markets Data Saver checkbox');
    const saverDefault=await tab.invoke(function(){
      const box=document.querySelector('input[aria-label="Data Saver for market refreshes"]');
      return {checked:box?.checked,stored:localStorage.getItem('compass-market-data-saver-v1')};
    });
    assert.equal(saverDefault.checked,false,'Data Saver must be off by default');
    assert.equal(saverDefault.stored,null,'Data Saver requires explicit consent');
    await tab.invoke(function(){
      document.querySelector('input[aria-label="Data Saver for market refreshes"]').click();
    });
    await waitFor(()=>tab.invoke(function(){
      return document.querySelector('input[aria-label="Data Saver for market refreshes"]')?.checked &&
        localStorage.getItem('compass-market-data-saver-v1')==='on';
    }),'Data Saver saved on');
    const audit=await tab.invoke(async function(){
      const original=window.fetch;
      const attempted=[];
      window.fetch=function(resource,init){
        const url=typeof resource==='string'?resource:(resource?.url||'');
        if((url.startsWith('http://')||url.startsWith('https://'))&&!url.includes('127.0.0.1'))attempted.push(url);
        return original.call(this,resource,init);
      };
      try{
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('online'));
        const range=document.querySelector('select[data-testid="select-market-range"]');
        if(!range)throw Error('Market lookback selector missing');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')
          .set.call(range,'1m');
        range.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(resolve=>setTimeout(resolve,450));
        return {
          calls:attempted.length,
          text:document.body.innerText.includes('Automatic crypto, SOL and FX refreshes are paused'),
          manual:!!document.querySelector('button[aria-label="Refresh live cryptocurrency quotes"]')
        };
      }finally{window.fetch=original;}
    });
    assert.equal(audit.calls,0,'Data Saver must not automatically fetch markets after visibility/online/range change');
    assert.equal(audit.text,true,'Data Saver must explain that quotes are paused');
    assert.equal(audit.manual,true,'Manual crypto refresh must remain available');
    await tab.invoke(function(){
      document.querySelector('[aria-label="Mobile app tabs"] a[aria-label="Overview"]')?.click();
    });
    await waitFor(()=>tab.invoke(function(){return !!document.querySelector('.mc-bs-quick-actions');}),'Home after Data Saver');
    await tab.invoke(function(){
      const markets=[...document.querySelectorAll('[aria-label="Mobile app tabs"] a')]
        .find(a=>a.textContent?.includes('Markets'));
      markets?.click();
    });
    await waitFor(()=>tab.invoke(function(){
      return !!document.querySelector('input[aria-label="Data Saver for market refreshes"]');
    }),'Markets reloaded with Data Saver');
    assert.equal(await tab.invoke(function(){
      return document.querySelector('input[aria-label="Data Saver for market refreshes"]')?.checked;
    }),true,'Data Saver persists across navigation in this browser');
    await tab.invoke(function(){
      document.querySelector('input[aria-label="Data Saver for market refreshes"]').click();
      document.querySelector('[aria-label="Mobile app tabs"] a[aria-label="Overview"]')?.click();
    });
    await waitFor(()=>tab.invoke(function(){return !!document.querySelector('.mc-bs-quick-actions');}),'Home after saver reset');
    console.log('PASS: explicit Market Data Saver pauses background fetches, persists, preserves manual buttons');

    await tab.invoke(function(){document.querySelector('button[aria-label="Open Market Compass menu"]')?.click();});
    const menu=await tab.invoke(function(){const root=document.querySelector('[aria-label="Market Compass quick menu"]');return {visible:!!root,labels:root?.innerText||''};});
    assert.equal(menu.visible,true,'iPhone menu must open an in-app action sheet');
    for(const text of ['View accounts','Add account','Import document','Ask Compass','Markets','Orders & drafts','Spend history','Vault & backup'])
      assert.ok(menu.labels.includes(text),'quick menu missing '+text);
    await tab.invoke(function(){document.querySelector('button[aria-label="Close Market Compass menu"]')?.click();});
    await tab.invoke(function(){document.querySelector('.mc-bs-quick-actions button.mc-quick-action')?.click();});
    assert.equal(await tab.invoke(function(){return !!document.querySelector('[aria-label="Account actions"]');}),true,'account options must open directly from Home');
    await tab.invoke(function(){document.querySelector('button[aria-label="Close account actions"]')?.click();});
    await tab.invoke(function(){
      const menu=document.querySelector('[data-testid="mobile-nav-menu"]');
      if(!menu)throw Error('Mobile Menu tab unavailable');
      menu.click();
    });
    await waitFor(()=>tab.invoke(function(){return !!document.querySelector('[aria-label="Market Compass quick menu"]');}),'mobile quick menu open for Spend');
    await tab.invoke(function(){
      const item=[...document.querySelectorAll('[aria-label="Market Compass quick menu"] button')]
        .find(x=>x.textContent?.includes('Spend history'));
      if(!item)throw Error('Spend history action missing from menu');
      item.click();
    });
    await expectText(tab,'Your finances','Spend landing page');
    await assertDocumentScrolling(tab,'Spend on a 390px iPhone-sized viewport');
    console.log('PASS: Ionic Spend can scroll through transaction history and page sections');
    await tab.invoke(function(){ const choices=[...document.querySelectorAll('ion-segment-button')]; const item=choices.find(x=>x.value==='activity'||x.textContent?.includes('Activity')); if(!item)throw Error('Ionic Spend Activity tab missing: '+choices.length+' segments; nav='+!!document.querySelector('nav[aria-label="Spend sections"]')); item.click(); });
    await expectText(tab,'Where your income goes','salary-cycle allocation panel');
    assert.equal(await tab.invoke(function(){return !!document.querySelector('[aria-label="Spend and income allocation"]');}),true,'salary allocation is visible in Spend activity');
    await tab.invoke(function(){document.querySelector('[aria-label="Mobile app tabs"] a[aria-label="Overview"]')?.click();});
    await expectText(tab,'Quick actions','Home after allocation review');
    console.log('PASS: banking-style quick menu, account action sheet and income allocation route');
    const pulseUi=await tab.invoke(function(){
      const review=document.querySelector('.mc-financial-pulse');
      const buttons=[...review?.querySelectorAll('button[aria-pressed]')||[]];
      return {
        present:!!review,
        buttons:buttons.map(x=>x.textContent.trim()),
        source:review?.textContent.includes('Not connected · No automatic sync'),
        missing:review?.textContent.includes('Not recorded'),
        width:review?.getBoundingClientRect().width??0,
        noOverflow:document.documentElement.scrollWidth<=innerWidth+1
      };
    });
    assert.equal(pulseUi.present,true,'monthly finance review must render');
    assert.deepEqual(pulseUi.buttons,['Current','Previous','Earlier']);
    assert.equal(pulseUi.source,true,'bank source not connected must be clear');
    assert.equal(pulseUi.missing,true,'missing ledger evidence must not be shown as zero');
    assert.ok(pulseUi.width>200&&pulseUi.width<=390);
    assert.equal(pulseUi.noOverflow,true,'monthly review must not overflow iPhone');
    await tab.invoke(function(){
      const review=document.querySelector('.mc-financial-pulse');
      [...review.querySelectorAll('button[aria-pressed]')].find(x=>x.textContent.trim()==='Previous')?.click();
    });
    await waitFor(async()=>tab.invoke(function(){
      return [...document.querySelectorAll('.mc-financial-pulse button[aria-pressed]')]
        .some(x=>x.textContent.trim()==='Previous'&&x.getAttribute('aria-pressed')==='true');
    }),'previous salary cycle selected');
    console.log('PASS: monthly review, evidence status, missing-data guard and salary-cycle selector');
    if(process.env.MC_TEST_PULSE_SCREENSHOT){
      await tab.invoke(function(){
        const review=document.querySelector('.mc-financial-pulse');
        [...review.querySelectorAll('button[aria-pressed]')].find(x=>x.textContent.trim()==='Current')?.click();
        review.scrollIntoView({block:'start',behavior:'instant'});
      });
      await waitFor(async()=>tab.invoke(function(){
        const review=document.querySelector('.mc-financial-pulse');
        return [...review.querySelectorAll('button[aria-pressed]')].some(x=>
          x.textContent.trim()==='Current'&&x.getAttribute('aria-pressed')==='true');
      }),'current cycle restored for synthetic preview');
      await tab.invoke(function(){
        return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))));
      });
      const frame=await tab.command('Page.captureScreenshot',{
        format:'png',captureBeyondViewport:false,fromSurface:true
      });
      await writeFile(process.env.MC_TEST_PULSE_SCREENSHOT,Buffer.from(frame.data,'base64'));
    }
    console.log('PASS: Bootstrap mobile grid, finance card, quick actions, privacy and four-tab Menu shell');
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
    // New accounts begin as an unsaved blank draft; do not create empty persisted records.
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
    await click(tab,'Save account');
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
    assert.match(accountUi?.source??'',/Manual balance · Not bank synced/);
    assert.match(accountUi?.details??'',/owner-entered planning figure/);
    assert.match(accountUi?.details??'',/Latest linked transaction: Not recorded/);
    assert.match(accountUi?.details??'',/not a live bank feed/);
    const privateLabels=await tab.invoke(function(){
      return [...document.querySelectorAll('.mc-account-label strong')].map(element=>element.textContent);
    });
    assert.ok(privateLabels.some(label=>label?.includes('[redacted number]')),
      'account identifiers entered in names must be masked in the mobile banking view');
    assert.ok(privateLabels.every(label=>!label?.includes('123456789012')),
      'the full synthetic account identifier must never be displayed as a label');
    console.log('PASS: vertical account row, privacy-masked identifier, saved balance and APR');
    // Layout parity is tested in the SAME disposable encrypted browser vault:
    // synthetic mobile debt must equal desktop debt, with no data migration.
    const mobileDebt=await tab.invoke(function(){
      const hero=document.querySelector('[data-testid="financial-space-hero"]');
      return hero?.querySelector('[data-testid="financial-space-debt-total"]')?.textContent?.trim()??null;
    });
    assert.ok(mobileDebt?.includes('1')&&mobileDebt.includes('840'),'Synthetic saved debt visible on mobile');
    await tab.command('Emulation.setDeviceMetricsOverride',{
      width:1366,height:850,deviceScaleFactor:1,mobile:false
    });
    const desktop=await waitFor(async()=>tab.invoke(function(){
      const area=document.querySelector('[data-testid="desktop-financial-overview"]');
      const hero=area?.querySelector('[data-testid="financial-space-hero"]');
      const total=area?.querySelector('[data-testid="financial-space-debt-total"]');
      const nav=document.querySelector('[data-testid="desktop-nav-menu"]');
      const top=document.querySelector('[data-testid="desktop-header-menu"]');
      const bounds=hero?.getBoundingClientRect();
      return bounds?.height>150&&nav?.getBoundingClientRect().height>=40&&top?.getBoundingClientRect().height>=36
        ? {debt:total?.textContent?.trim(),visible:true,wide:bounds?.width,nav:true,top:true}
        : null;
    }),'desktop debt hero and desktop menu controls');
    assert.equal(desktop.debt,mobileDebt,'Desktop must use the same unlocked synthetic debt value as mobile');
    assert.ok(desktop.wide>350,'Desktop card should use the available desktop content width');
    await tab.invoke(function(){document.querySelector('[data-testid="desktop-nav-menu"]')?.click();});
    const desktopMenu=await waitFor(async()=>tab.invoke(function(){
      const dialog=document.querySelector('[aria-label="Market Compass quick menu"]');
      return dialog&&dialog.getBoundingClientRect().height>100 ? dialog.textContent : null;
    }),'desktop shared quick action menu');
    for(const action of ['Add account','Import document','Ask Compass','Vault & backup']){
      assert.ok(desktopMenu.includes(action),'Desktop menu missing '+action);
    }
    await tab.invoke(function(){
      document.querySelector('button[aria-label="Close Market Compass menu"]')?.click();
    });
    assert.equal(await tab.invoke(function(){
      return document.querySelector('[aria-label="Market Compass quick menu"]')===null;
    }),true,'Desktop menu must close cleanly');
    await tab.invoke(function(){
      const action=document.querySelector('[data-testid="desktop-financial-overview"] [aria-label="View saved accounts"]');
      if(!action)throw Error('Desktop View accounts action unavailable');
      action.click();
    });
    await expectText(tab,'Debt payoff','desktop View accounts opens debt planner');
    await tab.invoke(function(){
      const home=document.querySelector('[data-testid="link-nav-overview"]');
      if(!home)throw Error('Desktop Home navigation missing');
      home.click();
    });
    await expectText(tab,'YOUR FINANCIAL SPACE','desktop Home reopened');
    await tab.command('Emulation.setDeviceMetricsOverride',{
      width:390,height:844,deviceScaleFactor:3,mobile:true
    });
    await waitFor(async()=>tab.invoke(function(){
      const card=document.querySelector('.mc-app-overview [data-testid="financial-space-hero"]');
      return card?.getBoundingClientRect().height>100;
    }),'iPhone hero restored after desktop layout');
    console.log('PASS: shared debt hero matches mobile/desktop, desktop nav and header menu open, View accounts routes correctly');
    const homeHeader=await tab.invoke(async function(){
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const header=document.querySelector('.mc-mobile-header');
      const toolbar=header?.querySelector('.mc-ionic-toolbar');
      return {top:header?.getBoundingClientRect().top,bottom:header?.getBoundingClientRect().bottom,
        inset:header?parseFloat(getComputedStyle(header).paddingTop):null,
        toolbarHeight:toolbar?.getBoundingClientRect().height};
    });
    assert.ok(homeHeader.inset!==null&&homeHeader.inset>=16,'unlocked Home header keeps safe-area clearance');
    assert.ok(homeHeader.toolbarHeight>=68,'unlocked Home toolbar retains common height');


    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/assistant'));
      if(!link)throw Error('Assistant tab missing');link.click();
    });
    await expectText(tab,'Conversation','assistant chat');
    const assistantHeader=await tab.invoke(async function(){
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const page=document.querySelector('.mc-mobile-content.mc-assistant-page');
      const header=page?.querySelector('section[aria-label="Compass model connection"]');
      return {top:header?.getBoundingClientRect().top,bottom:header?.getBoundingClientRect().bottom,
        inset:page?parseFloat(getComputedStyle(page).paddingTop):null,height:header?.getBoundingClientRect().height};
    });
    assert.ok(assistantHeader.inset!==null&&Math.abs(assistantHeader.inset-homeHeader.inset)<=1,
      'Home and AI share unlocked safe-area clearance: '+JSON.stringify({homeHeader,assistantHeader}));
    assert.ok(Math.abs(assistantHeader.height-homeHeader.toolbarHeight)<=2,
      'Home and AI bars have matching heights: '+JSON.stringify({homeHeader,assistantHeader}));
    assert.ok(Math.abs(assistantHeader.bottom-homeHeader.bottom)<=2,
      'Header bottom must not jump when navigating to AI: '+JSON.stringify({homeHeader,assistantHeader}));
    console.log('PASS: unlocked Home and AI header geometry matches');
    const beforeChat=await tab.invoke(function(){
      const input=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      const plus=document.querySelector('button[aria-label="Open Compass actions"]');
      const mic=document.querySelector('button[aria-label="Speak a question"]');
      return {
        present:!!input&&!!mic&&!!plus,
        width:input?.getBoundingClientRect().width??0,
        font:input?getComputedStyle(input).fontSize:null,
        micWidth:mic?.getBoundingClientRect().width??0,
        plusWidth:plus?.getBoundingClientRect().width??0,
        plusHeight:plus?.getBoundingClientRect().height??0,
        micHeight:mic?.getBoundingClientRect().height??0,
        bubbles:document.querySelectorAll('.mc-chat-bubble').length,
        bankStatus:document.querySelector('details[aria-label="Bank connectivity and consent status"]')?.textContent,
        overflow:document.documentElement.scrollWidth>innerWidth+1
      };
    });
    assert.equal(beforeChat.present,true,'chat input and buttons present');
    assert.ok(beforeChat.width>=155,'iPhone text input cannot be crowded out');
    assert.equal(beforeChat.font,'16px','no Safari keyboard focus zoom');
    assert.ok(beforeChat.micWidth>=44&&beforeChat.plusWidth>=44,'accessible plus/voice buttons');
    assert.ok(Math.abs(beforeChat.plusHeight-beforeChat.micHeight)<=1,'matching plus and microphone heights');
    assert.equal(beforeChat.overflow,false,'AI tab must not horizontally overflow');
    // The document must be locked on the AI route even with the keyboard CLOSED.
    // Home and Spend still rely on ordinary document scrolling.
    const chatOnly=await tab.invoke(async function(){
      const html=document.documentElement;
      const log=document.querySelector('.mc-chat-log');
      const rootStyle=getComputedStyle(html);
      const bodyStyle=getComputedStyle(document.body);
      const before=window.scrollY;
      window.scrollTo(0,99999);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {route:html.classList.contains('mc-assistant-route'),
        rootOverflow:rootStyle.overflowY,bodyPosition:bodyStyle.position,
        bodyOverflow:bodyStyle.overflowY,chatOverflow:log?getComputedStyle(log).overflowY:null,
        before,after:window.scrollY};
    });
    assert.equal(chatOnly.route,true,'assistant-only document lock is installed');
    assert.equal(chatOnly.rootOverflow,'hidden','assistant viewport cannot root-scroll');
    assert.equal(chatOnly.bodyPosition,'fixed','assistant page must remain stationary');
    assert.equal(chatOnly.bodyOverflow,'hidden','assistant has no second scroll layer');
    assert.equal(chatOnly.chatOverflow,'auto','only AI messages scroll by default');
    assert.ok(Math.abs(chatOnly.before-chatOnly.after)<=1,'AI document cannot pan while keyboard is closed: '+JSON.stringify(chatOnly));

    const restingBounds=await tab.invoke(async function(){
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const nav=document.querySelector('.mc-mobile-tabbar')?.getBoundingClientRect();
      const page=document.querySelector('.mc-assistant-page')?.getBoundingClientRect();
      const visual=window.visualViewport;
      const visibleBottom=(visual?.offsetTop??0)+(visual?.height??window.innerHeight);
      const root=document.documentElement.style;
      return {navBottom:nav?.bottom,pageBottom:page?.bottom,navTop:nav?.top,
        visibleBottom,cssBottom:root.getPropertyValue('--mc-chat-resting-visible-bottom'),
        cssInset:root.getPropertyValue('--mc-chat-resting-bottom-inset'),
        cssNav:root.getPropertyValue('--mc-chat-tabbar-height')};
    });
    assert.ok(restingBounds.navBottom!==undefined&&restingBounds.pageBottom!==undefined,
      'assistant resting footer and page must exist');
    assert.ok(Math.abs(restingBounds.navBottom-restingBounds.visibleBottom)<=5,
      'AI nav must end at the real visual viewport bottom: '+JSON.stringify(restingBounds));
    assert.ok(Math.abs(restingBounds.navTop-restingBounds.pageBottom)<=5,
      'composer cannot leave a dead strip above navigation: '+JSON.stringify(restingBounds));
    assert.ok(restingBounds.cssBottom.endsWith('px')&&restingBounds.cssInset.endsWith('px')&&
      restingBounds.cssNav.endsWith('px'),'dynamic visible viewport geometry must be attached');

    // Synthetic approximation of iPhone keyboard visualViewport contraction.
    // A real Safari keyboard still needs physical-device confirmation.
    await tab.invoke(function(){
      const input=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      if(!input)throw Error('Composer missing');input.focus();
    });
    await waitFor(()=>tab.invoke(function(){
      return document.documentElement.classList.contains('mc-chat-input-focused');
    }),'chat composer gets keyboard-aware focus');
    await tab.command('Emulation.setDeviceMetricsOverride',{
      width:390,height:520,deviceScaleFactor:3,mobile:true
    });
    await waitFor(()=>tab.invoke(function(){
      return document.documentElement.classList.contains('mc-chat-keyboard-open');
    }),'visual viewport keyboard contraction applied');
    const keyboard=await tab.invoke(function(){
      const page=document.querySelector('.mc-assistant-page');
      const composer=document.querySelector('.mc-chat-composer-wrap');
      const nav=document.querySelector('.mc-mobile-tabbar');
      const visual=window.visualViewport;
      const top=visual?.offsetTop??0, height=visual?.height??innerHeight;
      const pageRect=page?.getBoundingClientRect();
      const composerRect=composer?.getBoundingClientRect();
      return {
        navHidden:!!nav&&getComputedStyle(nav).display==='none',
        pageMode:page?getComputedStyle(page).position:null,
        visibleBottom:top+height,
        pageBottom:pageRect?.bottom??null,
        composerBottom:composerRect?.bottom??null,
        composerWidth:composerRect?.width??0,
        overflow:document.documentElement.scrollWidth>innerWidth+1
      };
    });
    assert.equal(keyboard.navHidden,true,'bottom tabbar must hide while keyboard is active');
    assert.equal(keyboard.pageMode,'absolute','chat follows the visible page viewport without WebKit fixed-position drift');
    assert.ok(keyboard.pageBottom!==null &&
      Math.abs(keyboard.visibleBottom-keyboard.pageBottom)<=4,
      'assistant must meet keyboard top: '+JSON.stringify(keyboard));
    assert.ok(keyboard.composerBottom!==null &&
      keyboard.composerBottom<=keyboard.visibleBottom+3 &&
      keyboard.composerBottom>=keyboard.visibleBottom-160,
      'composer must remain visible immediately above keyboard');
    assert.ok(keyboard.composerWidth>320,'composer retains width on keyboard resize');
    assert.equal(keyboard.overflow,false,'keyboard cannot introduce horizontal scroll');
    // Regression: dragging beyond the conversation limit must NOT pan the
    // outer document and reveal a previously hidden header behind the chat.
    const scrollBoundary=await tab.invoke(async function(){
      const html=document.documentElement;
      const body=document.body;
      const log=document.querySelector('.mc-chat-log');
      const before=window.scrollY;
      const style=getComputedStyle(body);
      const root=getComputedStyle(html);
      const chat=log?getComputedStyle(log):null;
      window.scrollTo(0,999999);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {
        bodyFixed:style.position==='fixed',
        bodyHidden:style.overflowY==='hidden',
        rootHidden:root.overflowY==='hidden',
        scrollBefore:before,
        scrollAfter:window.scrollY,
        chatOverflow:chat?.overflowY,
        chatTouchAction:chat?.touchAction
      };
    });
    assert.equal(scrollBoundary.bodyFixed,true,'keyboard must freeze outer document to prevent iPhone rubber-band header reveal');
    assert.equal(scrollBoundary.bodyHidden,true,'keyboard must clip the body behind the conversation');
    assert.equal(scrollBoundary.rootHidden,true,'keyboard must clip the document root behind the conversation');
    assert.equal(scrollBoundary.chatOverflow,'auto','messages remain individually scrollable');
    assert.equal(scrollBoundary.chatTouchAction,'pan-y','message gestures remain vertical');
    assert.ok(Math.abs(scrollBoundary.scrollBefore-scrollBoundary.scrollAfter)<=1,
      'dragging outside chat must not scroll the outer document: '+JSON.stringify(scrollBoundary));
    await tab.command('Emulation.setDeviceMetricsOverride',{
      width:390,height:844,deviceScaleFactor:3,mobile:true
    });
    // iOS Done/gesture may dismiss the keyboard without blurring the textarea.
    // Navigation and chat height must recover before any blur event.
    await waitFor(()=>tab.invoke(function(){
      const root=document.documentElement;
      const nav=document.querySelector('.mc-mobile-tabbar');
      return root.classList.contains('mc-chat-input-focused') &&
        !root.classList.contains('mc-chat-keyboard-open') &&
        nav && getComputedStyle(nav).display!=='none';
    }),'tabs restore while textarea still focused after keyboard dismissal');
    const retainedFocus=await tab.invoke(function(){
      const page=document.querySelector('.mc-assistant-page');
      const nav=document.querySelector('.mc-mobile-tabbar');
      return {mode:getComputedStyle(page).position,
        gap:nav.getBoundingClientRect().top-page.getBoundingClientRect().bottom};
    });
    assert.notEqual(retainedFocus.mode,'absolute','assistant must leave keyboard positioning on dismiss');
    assert.ok(Math.abs(retainedFocus.gap)<=5,'no retained-focus strip after keyboard dismissal: '+JSON.stringify(retainedFocus));
    await tab.invoke(function(){
      document.querySelector('textarea[aria-describedby="mc-composer-hint"]')?.blur();
    });
    await waitFor(()=>tab.invoke(function(){
      const root=document.documentElement;
      const nav=document.querySelector('.mc-mobile-tabbar');
      return !root.classList.contains('mc-chat-input-focused') &&
        !root.classList.contains('mc-chat-keyboard-open') &&
        nav&&getComputedStyle(nav).display!=='none';
    }),'bottom nav restored after keyboard dismissal');
    const keyboardRestored=await tab.invoke(function(){
      const page=document.querySelector('.mc-assistant-page')?.getBoundingClientRect();
      const nav=document.querySelector('.mc-mobile-tabbar')?.getBoundingClientRect();
      return {gap:page&&nav?nav.top-page.bottom:null,
        overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert.ok(keyboardRestored.gap!==null&&Math.abs(keyboardRestored.gap)<=5,
      'no blank band when the keyboard closes: '+JSON.stringify(keyboardRestored));
    assert.equal(keyboardRestored.overflow,false,'keyboard dismissal must preserve viewport width');
    console.log('PASS: synthetic keyboard open/close keeps composer visible and nav seamless');

    // Bank consent lives in the inline + drawer, not the initial chat viewport.
    await tab.invoke(function(){
      const plus=document.querySelector('button[aria-label="Open Compass actions"]');
      if(!plus)throw Error('Compass action trigger missing');
      plus.click();
    });
    await waitFor(()=>tab.invoke(function(){
      const bank=document.querySelector('details[aria-label="Bank connectivity and consent status"]');
      return Boolean(bank?.textContent?.includes('Not connected'));
    }),'bank consent remains disconnected in inline actions');
    await tab.invoke(function(){
      document.querySelector('button[aria-label="Close Compass actions"]')?.click();
    });
    if(process.env.MC_TEST_ASSISTANT_SCREENSHOT){
      const shot=await tab.command('Page.captureScreenshot',{
        format:'png',captureBeyondViewport:false,fromSurface:true
      });
      await writeFile(process.env.MC_TEST_ASSISTANT_SCREENSHOT,Buffer.from(shot.data,'base64'));
      console.log('Synthetic assistant screenshot captured for mobile layout inspection');
    }
    await tab.invoke(function(){
      const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')
        .set.call(field,'What is my total debt?');
      field.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await waitFor(()=>tab.invoke(function(){
      return !document.querySelector('button[aria-label="Send question"]').disabled;
    }),'ready to send typed question');
    const protections=await tab.invoke(function(){
      const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      const shift=new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true});
      field.dispatchEvent(shift);
      const composition=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});
      field.dispatchEvent(composition);
      const unchanged=document.querySelectorAll('.mc-chat-bubble').length;
      const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
      field.dispatchEvent(enter);
      return {shift:shift.defaultPrevented,composition:composition.defaultPrevented,
        bubblesBefore:unchanged,enter:enter.defaultPrevented};
    });
    assert.equal(protections.shift,false,'Shift+Enter must allow a newline');
    assert.equal(protections.composition,false,'IME completion must not send');
    assert.equal(protections.bubblesBefore,beforeChat.bubbles,'modifiers do not send');
    assert.equal(protections.enter,true,'plain Enter must send and prevent newline');
    await waitFor(()=>tab.invoke(function(){
      return document.querySelectorAll('.mc-chat-bubble').length>=3;
    }),'a single local AI answer');
    const afterChat=await tab.invoke(function(){
      return {bubbles:document.querySelectorAll('.mc-chat-bubble').length,
        input:document.querySelector('textarea[aria-describedby="mc-composer-hint"]').value};
    });
    assert.equal(afterChat.bubbles,beforeChat.bubbles+2,'send exactly once');
    assert.equal(afterChat.input,'','clear sent question');
    // Clear is intentionally inside Advanced settings of the inline + drawer.
    await tab.invoke(function(){
      const plus=document.querySelector('button[aria-label="Open Compass actions"]');
      if(!plus)throw Error('Compass actions missing');
      plus.click();
    });
    await waitFor(()=>tab.invoke(function(){
      const advanced=document.querySelector('details[aria-label="Additional Compass settings"]');
      if(!advanced)return false;
      advanced.open=true;
      return [...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Clear chat');
    }),'advanced Clear chat button');
    await tab.invoke(function(){
      const btn=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Clear chat');
      if(!btn)throw Error('Clear chat missing in advanced settings');btn.click();
    });
    await expectText(tab,'Conversation cleared. Ask a new question below.','compact clear state');
    console.log('PASS: iPhone chat bubbles and compact composer; Enter, Shift+Enter, IME and Clear');

    // Jarvis source audit: only offer a click-through HTTPS link for explicit
    // website commands; no browser navigation or Windows program is launched.
    await tab.invoke(function(){
      const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')
        .set.call(field,'Compass, open YouTube');
      field.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await waitFor(()=>tab.invoke(function(){
      return !document.querySelector('button[aria-label="Send question"]').disabled;
    }),'Jarvis-derived command ready');
    await tab.invoke(function(){
      const field=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    });
    if(process.env.VITE_MC_EDITION==='finance'){
      // The finance-only edition must not inherit Personal web shortcuts.
      const financeReply=await waitFor(()=>tab.invoke(function(){
        if(document.querySelectorAll('.mc-chat-bubble').length<2)return null;
        return {
          hasPersonalShortcut:!!document.querySelector('.mc-chat-bubble a[aria-label="Open YouTube"]'),
          bubbles:document.querySelectorAll('.mc-chat-bubble').length
        };
      }),'finance-only assistant handles non-financial command without Personal shortcut');
      assert.equal(financeReply.hasPersonalShortcut,false,'Financial Advisor must not expose Personal web shortcuts');
      console.log('PASS: Finance edition declines Personal browser shortcut');
    }else{
      const jarvisLink=await waitFor(()=>tab.invoke(function(){
        const anchor=document.querySelector('.mc-chat-bubble a[aria-label="Open YouTube"]');
        if(!anchor)return null;
        return {href:anchor.getAttribute('href'),target:anchor.getAttribute('target'),
          rel:anchor.getAttribute('rel'),text:anchor.closest('.mc-chat-bubble')?.innerText};
      }),'safe Jarvis browser shortcut');
      assert.equal(jarvisLink.href,'https://www.youtube.com/');
      assert.equal(jarvisLink.target,'_blank');
      assert.ok(jarvisLink.rel.includes('noopener')&&jarvisLink.rel.includes('noreferrer'));
      assert.ok(jarvisLink.text.includes('not opened a website automatically'));
      console.log('PASS: Personal assistant offers explicit safe HTTPS link, no auto-launch');
    }

    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')?.endsWith('/expenses'));
      if(!link)throw Error('Spend route unavailable');
      link.click();
    });
    await expectText(tab,'Import & review','Spend import screen');
    // On an empty synthetic workspace, Spend starts in Documents. The guide
    // lives in Activity after the owner enters or approves transactions.
    await waitFor(()=>tab.invoke(function(){
      const buttons=[...document.querySelectorAll('ion-segment-button,[role="tab"],button')];
      const activity=buttons.find(el=>el.value==='activity'||
        el.getAttribute('value')==='activity'||
        el.getAttribute('aria-label')==='Activity'||
        (el.tagName.toLowerCase()==='ion-segment-button'&&el.textContent?.includes('Activity')));
      if(!activity)return false;
      activity.click();
      return true;
    }),'Spend Activity tab hydrated',15000);
    // Cash-flow guide must deliver a safe intent, not a blank generic AI page.
    await waitFor(()=>tab.invoke(function(){
      return !![...document.querySelectorAll('a')].find(a=>
        a.getAttribute('href')?.includes('/assistant?review=cashflow'));
    }),'Spend-to-AI cash-flow review link');
    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')].find(a=>
        a.getAttribute('href')?.includes('/assistant?review=cashflow'));
      link.click();
    });
    await waitFor(()=>tab.invoke(function(){
      return !!document.querySelector('[aria-label="Cash-flow review from Spend"]');
    }),'cash-flow review appears in conversation');
    const handoff=await tab.invoke(function(){
      const panel=document.querySelector('[aria-label="Cash-flow review from Spend"]');
      const editor=document.querySelector('textarea[aria-describedby="mc-composer-hint"]');
      return {
        query:editor?.value||'',path:location.pathname,search:location.search,
        text:panel?.textContent||'',rootLocked:getComputedStyle(document.body).position==='fixed',
        links:[...document.querySelectorAll('a[href]')].filter(a=>a.getAttribute('href')?.includes('10400')).length
      };
    });
    assert.equal(handoff.search,'?review=cashflow','intent-only URL reaches assistant');
    assert.ok(handoff.text.includes('No approved transactions')||
      handoff.text.includes('approved entries'),'local ledger preview must be visible');
    assert.ok(handoff.query.includes('recorded salary-cycle spending'),'cash-flow question must be drafted');
    assert.ok(handoff.text.includes('not an AI-generated recommendation')||
      handoff.text.includes('financial-context sharing is off')||
      handoff.text.includes('Private Compass is connected'),'connection limitations shown');
    assert.equal(handoff.rootLocked,true,'handoff must retain chat-only scroll lock');
    assert.equal(handoff.links,0,'no financial amounts leaked into links');
    await tab.invoke(function(){
      const back=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Back to Spend'));
      if(!back)throw Error('Back to Spend button missing');
      back.click();
    });
    await expectText(tab,'Import & review','return to Spend after preview');
    console.log('PASS: cash-flow guide opens read-only approved-cycle preview and drafted question with no URL financial data');
    const picker='input[type="file"][multiple]';
    const firstCsv=syntheticCsv('synthetic-2026-11.csv','Synthetic groceries','2026-11-21','-125.25');
    const secondCsv=syntheticCsv('synthetic-2026-10.csv','Synthetic transit','2026-10-21','-80.00');
    await chooseFiles(tab,picker,[firstCsv,secondCsv]);
    await expectText(tab,'Synthetic groceries','first batch preview');
    await waitFor(()=>tab.invoke(function(){const s=document.body.innerText;return s.includes('Reviewing document 1 of 2')||s.includes('Review 1 of 2');}),'first of two batch previews');
    await click(tab,'Save these reviewed excerpts');
    await expectText(tab,'Synthetic transit','second batch preview');
    await waitFor(()=>tab.invoke(function(){const s=document.body.innerText;return s.includes('Reviewing document 2 of 2')||s.includes('Review 2 of 2');}),'second of two batch previews');
    await click(tab,'Skip this document without saving');
    await expectText(tab,'1 of 100 saved','first saved, second skipped');
    console.log('PASS: two selected files queued, first saved and second skipped');

    // The owner must see saved evidence in Home without silently posting it.
    await tab.invoke(function(){
      document.querySelector('a[aria-label="Go to Market Compass home"]')?.click();
    });
    await expectText(tab,'Needs review','document review inbox on Home');
    const inbox=await tab.invoke(function(){
      const panel=document.querySelector('.mc-evidence-inbox');
      const nums=[...panel?.querySelectorAll('[aria-label="Review counts"] strong')||[]]
        .map(x=>Number(x.textContent));
      panel?.querySelector('details summary')?.click();
      return {nums,card:panel?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert.ok(inbox.card?.includes('Review by document'),'per-document review is available');
    assert.equal(inbox.nums[2],1,'one saved imported document, not the skipped second file');
    assert.ok(inbox.nums[0]>=1,'document evidence needs explicit owner review');
    assert.equal(inbox.nums[1],0,'import must not auto-post Spend entries');
    assert.equal(inbox.overflow,false,'review inbox cannot overflow iPhone width');
    await tab.invoke(function(){
      const link=[...document.querySelectorAll('a')]
        .find(a=>a.getAttribute('href')?.endsWith('/expenses'));
      if(!link)throw Error('Spend link missing');link.click();
    });
    await expectText(tab,'Import & review','return to Spend from review inbox');
    console.log('PASS: synthetic Home review inbox counts imported evidence, no automatic posting');

    await chooseFiles(tab,picker,[{...firstCsv,name:'synthetic-renamed.csv'}]);
    await waitFor(()=>tab.invoke(function(){
      const txt=document.querySelector('#mc-financial-files')?.innerText||'';
      return /duplicate\(s\) skipped|already saved/i.test(txt) ||
        [...document.querySelectorAll('button')].some(b=>b.textContent.includes('Save these reviewed excerpts'));
    }),'duplicate excluded by batch or flagged at save');
    const wasSkippedAtImport=await tab.invoke(function(){
      const panel=document.querySelector('#mc-financial-files');
      return /duplicate\(s\) skipped/i.test(panel?.innerText||'');
    });
    if(!wasSkippedAtImport){
      await click(tab,'Save these reviewed excerpts');
      await expectText(tab,'already saved','duplicate suppression');
      await click(tab,'Skip this document without saving');
    }
    await expectText(tab,'1 of 100 saved','unchanged saved count');
    console.log('PASS: renamed duplicate refused without doubling evidence');

    const encryptedFixture={
      name:'synthetic-encrypted-payslip.pdf',mime:'application/pdf',
      base64:pdfBase64
    };
    await chooseFiles(tab,picker,[encryptedFixture]);
    await waitFor(()=>tab.invoke(function(){
      const text=document.body.innerText;
      return text.includes('Encrypted PDF · password required') ||
        /password-protected PDF\(s\) need a retry|No documents are ready/i.test(text);
    }),'encrypted PDF requires owner-supplied password');
    const inlinePasswordPrompt=await tab.invoke(function(){
      return document.body.innerText.includes('Encrypted PDF · password required');
    });
    if(inlinePasswordPrompt){
      await input(tab,'input[placeholder="Password for this document"]','SYNTHETIC_WRONG');
      await click(tab,'Unlock & review this PDF');
      await expectText(tab,'Encrypted PDF · password required','wrong password rejected');
      await input(tab,'input[placeholder="Password for this document"]','SYNTHETIC_ONLY');
      await click(tab,'Unlock & review this PDF');
    }else{
      const oneTime='input[aria-label="Temporary PDF password, never stored"]';
      await input(tab,oneTime,'SYNTHETIC_WRONG');
      await chooseFiles(tab,picker,[encryptedFixture]);
      await waitFor(()=>tab.invoke(function(){
        const text=document.querySelector('#mc-financial-files')?.innerText||'';
        return /password-protected PDF\(s\) need a retry|No documents are ready/i.test(text);
      }),'wrong one-time PDF password rejected');
      await input(tab,oneTime,'SYNTHETIC_ONLY');
      await chooseFiles(tab,picker,[encryptedFixture]);
    }
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
    assert.equal(restored?.cipher,'AES-256-GCM','restored vault remains authenticated and encrypted');
    assert.equal(restored?.version,2,'restored vault retains supported encrypted format');
    // The normal encrypted auto-save may produce fresh salt and IV after a
    // restore. Ciphertext equality is NOT a valid no-data-loss invariant.
    // Decrypt both synthetic records and compare the actual full workspace.
    const verified=await tab.invoke(async function(original,restored,pass){
      async function decrypt(record,password){
        const bytes=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
        const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),
          'PBKDF2',false,['deriveKey']);
        const key=await crypto.subtle.deriveKey({
          name:'PBKDF2',salt:bytes(record.salt),iterations:record.iterations,hash:'SHA-256'
        },secret,{name:'AES-GCM',length:256},false,['decrypt']);
        const encrypted=bytes(record.ciphertext);
        const packed=await crypto.subtle.decrypt({
          name:'AES-GCM',iv:bytes(record.iv)
        },key,encrypted);
        const payload=record.compression==='gzip'?
          await new Response(new Blob([packed]).stream().pipeThrough(
            new DecompressionStream('gzip'))).arrayBuffer():packed;
        return JSON.parse(new TextDecoder().decode(payload));
      }
      return {
        before:await decrypt(original,pass),
        after:await decrypt(restored,pass)
      };
    },backup,restored,pass);
    assert.deepEqual(verified.after,verified.before,
      'restoring on an independent origin must preserve the full decrypted workspace');
    console.log('PASS: rejected wrong password and restored identical decrypted workspace on isolated origin');
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
