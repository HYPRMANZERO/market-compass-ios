import {useEffect,useRef,useState} from 'react';
import ReviewedDocumentLedger from './ReviewedDocumentLedger';
import DocumentHistorySummary from './DocumentHistorySummary';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import {detectFinanceDocument,isFinanceReferenceLabel} from '@/lib/vehicleFinance';
import {classifyDocument,maskDocumentPII} from '@/lib/documentIntelligence';
import {documentAppliedIndices} from '@/lib/reviewedDocumentLedger';
import {listConsentedFinanceFiles,type ReadableFolder,type DiscoveredFinanceFile} from '@/lib/consentedFolderScan';
import {extractLocalPdfText,MAX_LOCAL_PDF_BYTES} from '@/lib/localPdfText';
import {
  addLocalFinanceDocument,extractLocalFinanceDocument,validateLocalFinanceDocument,
  MAX_FINANCE_FILE_BYTES,MAX_FINANCE_FILES,type LocalFinanceDocument
} from '@/lib/localFinanceDocs';

const money=(n:number|null)=>n===null?'Amount unavailable':
  new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',
    minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const financeLabel=(kind:string|undefined)=>kind==='absa-vehicle-finance'?'ABSA vehicle finance · financing evidence':
  kind==='vehicle-finance'?'Vehicle-finance contract · financing evidence':'Financial document · owner review';
const roleLabel=(role:string|undefined)=>role==='contract-term'?'Contract term, NOT a payment':
  role==='balance-reference'?'Historical/reference balance, NOT spendable cash':
  role==='rate-reference'?'Quoted rate, NOT a payment':
  role==='transaction'?'Dated transaction candidate — verify against source':'Unclassified · owner review';
const lineDateLabel=(line:{date:string|null;semanticRole?:string})=>
  (line.semanticRole==='contract-term'||line.semanticRole==='balance-reference')?
  (line.date?'Reference/effective date '+line.date:'Reference date not identified'):
  (line.date??'Transaction date not confirmed');
type Props={
  documents:LocalFinanceDocument[];
  onAdd:(value:LocalFinanceDocument)=>void;
  onRemove:(id:string)=>void;
  ledgerEntries:ExpenseEntry[];
  currency:string;
  currencyReviewRequired:boolean;
  onApplyEntries:(entries:ExpenseEntry[])=>void;
};

/**
 * No API fetch or File upload: parsing stays on the device.
 * Only owner-approved, bounded excerpts enter the existing encrypted vault.
 */
export default function LocalFinanceFiles({documents,onAdd,onRemove,
  ledgerEntries,currency,currencyReviewRequired,onApplyEntries}:Props){
  const [label,setLabel]=useState('');
  const passwordInput=useRef<HTMLInputElement>(null);
  const retryPasswordInput=useRef<HTMLInputElement>(null);
  // File objects and passwords are transient; neither queue nor password is
  // persisted in localStorage, the encrypted vault, telemetry or network.
  const waitingFiles=useRef<File[]>([]);
  const lockedFile=useRef<File|null>(null);
  const [remaining,setRemaining]=useState(0);
  const [batchTotal,setBatchTotal]=useState(0);
  const [batchCompleted,setBatchCompleted]=useState(0);
  const [batchWarning,setBatchWarning]=useState('');
  const [needsPassword,setNeedsPassword]=useState(false);
  // Wait for the parent vault state to acknowledge a save before moving to
  // the next file. An asynchronous React state update is not a save receipt.
  const [pendingSaveId,setPendingSaveId]=useState<string|null>(null);
  // A browser folder grant lives in memory only while this unlocked view is
  // mounted. No path or FileSystemHandle enters the encrypted vault.
  const watchedFolder=useRef<ReadableFolder|null>(null);
  const scannedFingerprints=useRef(new Set<string>());
  const scanController=useRef<AbortController|null>(null);
  const scanGeneration=useRef(0);
  const [discovered,setDiscovered]=useState<DiscoveredFinanceFile[]>([]);
  const [scanning,setScanning]=useState(false);
  const [scanStatus,setScanStatus]=useState('');
  const [reading,setReading]=useState(false);
  const [progress,setProgress]=useState<{page:number;total:number;stage:string}>({page:0,total:0,stage:'reading'});
  const readController=useRef<AbortController|null>(null);
  const [preview,setPreview]=useState<LocalFinanceDocument|null>(null);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const safe=documents.map(validateLocalFinanceDocument)
    .filter((x):x is LocalFinanceDocument=>x!==null);
  const canPickFolder=typeof window!=='undefined'&&'showDirectoryPicker' in window;
  async function scanFolder(){
    const folder=watchedFolder.current;
    if(!folder||scanController.current)return;
    const generation=scanGeneration.current;
    const controller=new AbortController();
    scanController.current=controller;
    setScanning(true);
    try{
      // Never silently re-prompt for a renewed permission grant.
      const permission=await folder.queryPermission?.({mode:'read'});
      if(permission&&permission!=='granted'){
        setScanStatus('Folder read permission is no longer granted. Choose the folder again to resume.');
        return;
      }
      const found=await listConsentedFinanceFiles(folder,{signal:controller.signal});
      if(controller.signal.aborted||generation!==scanGeneration.current)return;
      const fresh=found.items.filter(item=>!scannedFingerprints.current.has(item.fingerprint));
      for(const item of fresh)scannedFingerprints.current.add(item.fingerprint);
      if(fresh.length)setDiscovered(old=>[...old,...fresh]);
      setScanStatus(fresh.length+' new or changed financial files found for optional review'+
        (found.truncated?'; folder inventory safety limit reached. Select a smaller folder.':'.'));
    }catch{
      if(!controller.signal.aborted&&generation===scanGeneration.current)
        setScanStatus('Folder scan failed or access expired. Regrant access to retry.');
    }finally{
      if(scanController.current===controller){
        scanController.current=null;
        setScanning(false);
      }
    }
  }
  async function chooseFolder(){
    const picker=(window as Window&{
      showDirectoryPicker?:(options:{mode:'read'})=>Promise<ReadableFolder>
    }).showDirectoryPicker;
    if(!picker){setScanStatus('Folder monitoring is unavailable in Safari. Use the multiple-file picker above.');return;}
    try{
      const folder=await picker.call(window,{mode:'read'});
      scanGeneration.current++;
      scanController.current?.abort();
      scanController.current=null;
      setScanning(false);
      watchedFolder.current=folder;
      scannedFingerprints.current.clear();
      setDiscovered([]);
      setScanStatus('Folder read access granted for this open session only. Checking filenames and modification times…');
      void scanFolder();
    }catch(error){
      if(!(error instanceof Error)||error.name!=='AbortError')
        setScanStatus('Folder permission was not granted. No device files were read.');
    }
  }
  function stopFolder(){
    scanGeneration.current++;
    scanController.current?.abort();
    scanController.current=null;
    setScanning(false);
    watchedFolder.current=null;
    scannedFingerprints.current.clear();
    setDiscovered([]);
    setScanStatus('Folder monitoring stopped; no files or folder handles are retained.');
  }
  useEffect(()=>{
    // Only while the PWA is open and this authenticated/unlocked view exists.
    const tick=()=>{if(document.visibilityState==='visible'&&watchedFolder.current)void scanFolder();};
    const timer=window.setInterval(tick,5*60_000);
    document.addEventListener('visibilitychange',tick);
    return ()=>{
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',tick);
      scanGeneration.current++;
      scanController.current?.abort();
      scanController.current=null;
      watchedFolder.current=null;
      scannedFingerprints.current.clear();
      readController.current?.abort();
      waitingFiles.current=[];
      lockedFile.current=null;
      if(passwordInput.current)passwordInput.current.value='';
      if(retryPasswordInput.current)retryPasswordInput.current.value='';
    };
  },[]);
  function startSelection(files:File[],oneTimePassword=''){
    // Do not silently throw away the previous preview, an encrypted retry,
    // or the remaining selected File objects when another picker is opened.
    if(!files.length)return;
    if(reading||readController.current||preview||needsPassword||pendingSaveId||waitingFiles.current.length>0){
      setError('Finish or skip the current document batch before selecting more files.');
      return;
    }
    const capacity=Math.max(0,MAX_FINANCE_FILES-safe.length);
    if(!capacity){setError('Encrypted document-summary capacity reached. Back up and review saved documents first.');return;}
    const accepted=files.slice(0,capacity);
    waitingFiles.current=accepted.slice(1);
    setBatchTotal(accepted.length);
    setBatchCompleted(0);
    setRemaining(waitingFiles.current.length);
    lockedFile.current=null;
    setNeedsPassword(false);
    setBatchWarning(files.length>capacity?
      'Only '+capacity+' documents can fit in the current encrypted workspace; '+
      (files.length-capacity)+' other selected files were not queued.':'');
    void selected(accepted[0],oneTimePassword);
  }
  function advanceQueue(){
    lockedFile.current=null;
    setNeedsPassword(false);
    setPreview(null);
    const next=waitingFiles.current.shift();
    setBatchCompleted(value=>value+1);
    setRemaining(waitingFiles.current.length);
    if(next)void selected(next,'');
    else {setBatchTotal(0);setBatchWarning('');}
  }
  function cancelBatch(){
    if(reading)return;
    waitingFiles.current=[];
    lockedFile.current=null;
    if(passwordInput.current)passwordInput.current.value='';
    if(retryPasswordInput.current)retryPasswordInput.current.value='';
    setNeedsPassword(false);
    setPreview(null);
    setRemaining(0);
    setBatchTotal(0);
    setBatchCompleted(0);
    setBatchWarning('');
    setError('');
    setFeedback('Selected documents discarded without saving any unapproved excerpts.');
  }
  async function selected(file:File|undefined,oneTimePassword:string){
    setPreview(null);setFeedback('');setError('');
    if(!file||readController.current)return;
    const pdf=/\.pdf$/i.test(file.name);
    const limit=pdf?MAX_LOCAL_PDF_BYTES:MAX_FINANCE_FILE_BYTES;
    if(!file.size||file.size>limit){
      setError(pdf?'PDF exceeds on-device memory safety capacity. Nothing was saved.':
        'The file exceeds on-device text processing capacity. Nothing was saved.');
      return;
    }
    setReading(true);
    setProgress({page:0,total:0,stage:'reading'});
    const controller=new AbortController();
    readController.current=controller;
    // The password is passed only to the local PDF reader. It never enters
    // React state, IndexedDB, settings, requests, logs or saved document data.
    let temporaryPassword=oneTimePassword;
    try{
      const data=pdf?await extractLocalPdfText(file,temporaryPassword,{
        signal:controller.signal,
        onProgress:next=>setProgress(next)
      }):await file.text();
      if(controller.signal.aborted)throw Error('Document processing cancelled; nothing was saved.');
      setProgress(old=>({...old,stage:'classifying'}));
      // Stable, descriptive and PII-safe labels let owners distinguish
      // multiple documents without retaining raw filenames or account numbers.
      const account=classifyDocument(data,file.name);
      const privateLabel=maskDocumentPII(label.trim() ||
        (account.category==='unclassified'?'Financial export':account.name)).slice(0,70);
      const draft=extractLocalFinanceDocument(file.name,data,privateLabel);
      setPreview(draft);
      lockedFile.current=null;
      setNeedsPassword(false);
      setFeedback(draft.documentKind&&draft.documentKind!=='unclassified'?
        'Vehicle-finance document recognised locally. Review the labelled terms and reference values below; they are NOT posted as payments. The original document and PDF password are not stored or uploaded.':
        'Local review ready. Only the extracted excerpts below will be saved if you approve. The original document and its password were not uploaded or saved.');
    }catch(e){
      const message=e instanceof Error?e.message:'Could not read this financial file privately.';
      if(pdf&&/requires a password|temporary password was incorrect/i.test(message)){
        lockedFile.current=file;
        setNeedsPassword(true);
        setError('Encrypted PDF detected. Enter its password below to retry on this device. Nothing was saved.');
      }else{
        lockedFile.current=null;
        setNeedsPassword(false);
        setError(message);
      }
    }finally{
      temporaryPassword='';
      readController.current=null;
      setReading(false);
    }
  }
  function save(){
    if(!preview||pendingSaveId||reading)return;
    try{
      // Validate synchronously against the current saved-vault snapshot. This
      // surfaces capacity and duplicate errors before changing the UI.
      addLocalFinanceDocument(documents,preview);
      setPendingSaveId(preview.id);
      setError('');
      setFeedback('Submitting reviewed excerpts to your unlocked workspace…');
      onAdd(preview);
    }catch(e){
      setPendingSaveId(null);
      setError(e instanceof Error?e.message:'Document could not be saved.');
    }
  }
  useEffect(()=>{
    if(!pendingSaveId||!documents.some(document=>document.id===pendingSaveId))return;
    setPendingSaveId(null);
    setError('');
    setFeedback('Reviewed excerpts accepted by the workspace. Confirm Last saved in Vault & Settings, then export an encrypted backup.');
    if(waitingFiles.current.length===0)setLabel('');
    advanceQueue();
  },[documents,pendingSaveId]);
  return <section id="mc-financial-files" className="mb-5 scroll-mt-28 rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6" aria-label="Import selected financial files privately">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Financial documents</p>
        <h2 className="mt-1 text-[17px] font-bold tracking-tight">Import & review</h2>
      </div>
      <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold">{safe.length} of {MAX_FINANCE_FILES} saved</span>
    </div>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      Grant read access by choosing your own statement, payslip, receipt or other financial export.
      You can choose multiple files and review each before saving. Safari cannot silently scan your
      entire device or email. The original file is not uploaded to GitHub, HYPRBOX or a provider.
    </p>
    <details className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
      <summary className="min-h-9 cursor-pointer text-[11px] font-semibold">Supported files, privacy & limits</summary>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        CSV, TXT, transaction JSON and selectable-text PDF. Multi-page PDFs
        are processed across all pages with visible progress; a 64 MB on-device
        memory ceiling remains to prevent Safari crashes. Source evidence is
        bounded for encrypted storage and any truncation is disclosed.
        Scanned PDFs, photographs, Word and Excel need a separate local extractor.
        The original file stays on your phone. Do not use online converters for
        private financial documents.
      </p>
    </details>
    <label className="mt-3 block text-[12px] font-semibold">
      Optional file label · e.g. October bank export
      <input type="text" autoComplete="off" maxLength={70} value={label}
        disabled={reading||!!preview||needsPassword||!!pendingSaveId||remaining>0}
        onChange={e=>{setLabel(e.target.value);setError('');setFeedback('');}}
        placeholder="Optional · defaults to recognised document category"
        className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px]"/>
    </label>
    <details className="mt-3 rounded-xl border border-border bg-background px-3 py-2">
      <summary className="min-h-9 cursor-pointer text-[12px] font-semibold">Password-protected PDF? Open one-time password</summary>
      <label className="mt-2 block text-[12px] font-semibold">
        Temporary PDF password (only if required)
        <input ref={passwordInput} type="password" autoComplete="off" spellCheck={false}
          aria-label="Temporary PDF password, never stored"
          placeholder="Enter the PDF password before selecting the file"
          className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px]"/>
      </label>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        The field is cleared when you select a file. Used only during local
        decryption: never saved to the vault or sent to Ollama. Browser memory
        cannot be guaranteed to erase instantly.
      </p>
    </details>
    <label className="mt-4 block text-[12px] font-semibold">
      Choose documents from Files (read access to selected files only)
      <input type="file" multiple accept=".csv,.txt,.json,.pdf,text/plain,text/csv,application/json,application/pdf"
        aria-label="Choose one or more private CSV TXT JSON or PDF documents from iPhone Files"
        disabled={safe.length>=MAX_FINANCE_FILES||reading||!!preview||needsPassword||!!pendingSaveId||remaining>0}
        onChange={event=>{
          const chosen=Array.from(event.currentTarget.files??[]);
          event.currentTarget.value='';
          const oneTimePassword=passwordInput.current?.value??'';
          if(passwordInput.current)passwordInput.current.value='';
          startSelection(chosen,oneTimePassword);
        }}
        className="mt-1 block w-full rounded-xl border border-input bg-background p-3 text-[13px] disabled:opacity-40"/>
      {reading&&<span role="status" className="mt-2 block text-[11px] font-normal">Reading and classifying locally…</span>}
    </label>
    <details className="mt-3 rounded-xl border border-border bg-background px-3 py-3">
      <summary className="cursor-pointer text-[12px] font-semibold">Permission-based folder discovery &amp; updates</summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        On compatible desktop browsers, grant read access to one folder you choose.
        Only filenames, modification dates and sizes are checked for new financial documents.
        Recheck runs every five minutes while this unlocked page is open, and when you return.
        No document is analysed or saved until you choose Review. No folder grants or paths are stored.
        iPhone Safari cannot grant automatic whole-device or email access.
      </p>
      {canPickFolder?<div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={()=>void chooseFolder()} disabled={scanning}
          className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">
          Grant read access to a folder
        </button>
        {watchedFolder.current&&<>
          <button type="button" onClick={()=>void scanFolder()} disabled={scanning}
            className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">
            {scanning?'Checking…':'Check for updated files'}
          </button>
          <button type="button" onClick={stopFolder}
            className="min-h-11 rounded-xl border border-border px-3 text-[12px]">
            Stop monitoring
          </button>
        </>}
      </div>:<p className="mt-2 text-[11px] text-muted-foreground">
        Use the Files picker above to grant access to specific documents.
        For ongoing updates on iPhone, reselect recent files or connect a supported read-only provider in a future release.
      </p>}
      {scanStatus&&<p role="status" className="mt-2 text-[11px] leading-5 text-muted-foreground">{scanStatus}</p>}
      {discovered.length>0&&<button type="button"
        disabled={reading||!!preview||needsPassword||!!pendingSaveId||remaining>0||safe.length>=MAX_FINANCE_FILES}
        onClick={()=>{
          const capacity=Math.max(0,MAX_FINANCE_FILES-safe.length);
          startSelection(discovered.slice(0,capacity).map(item=>item.file));
          setDiscovered(old=>old.slice(capacity));
        }}
        className="mt-2 min-h-11 w-full rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-50">
        Review {Math.min(discovered.length,MAX_FINANCE_FILES-safe.length)} discovered files, individually
      </button>}
    </details>
    {batchTotal>0&&<section aria-label="Batch document review status" className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <p role="status" className="text-[12px] font-semibold">
        Reviewing document {batchCompleted+1} of {batchTotal}
        {remaining>0?' · '+remaining+' waiting':''}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Save or skip each preview before continuing. You can cancel the remaining
        selection without saving unreviewed files.
      </p>
      {batchWarning&&<p role="alert" className="mt-2 text-[11px] font-semibold">{batchWarning}</p>}
      {!reading&&!pendingSaveId&&<button type="button" onClick={cancelBatch}
        className="mt-2 min-h-10 rounded-lg border border-border px-3 text-[11px] font-semibold">
        Cancel selected batch
      </button>}
    </section>}
    {needsPassword&&<section aria-label="Unlock encrypted document" className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[12px] font-semibold">Encrypted PDF · password required</p>
      <p className="mt-1 text-[11px] text-muted-foreground">The document was not imported. Its password is used once by the local PDF reader and not saved.</p>
      <label className="mt-2 block text-[12px] font-semibold">Temporary PDF password
        <input ref={retryPasswordInput} type="password" autoComplete="off" spellCheck={false}
          placeholder="Password for this document"
          className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px]" />
      </label>
      <button type="button" disabled={reading||!!pendingSaveId} onClick={()=>{
        const file=lockedFile.current;
        const password=retryPasswordInput.current?.value??'';
        if(retryPasswordInput.current)retryPasswordInput.current.value='';
        if(file)void selected(file,password);
      }} className="mt-2 min-h-11 w-full rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground">
        Unlock &amp; review this PDF
      </button>
      <button type="button" disabled={reading||!!pendingSaveId}
        onClick={()=>{setError('');advanceQueue();}}
        className="mt-2 min-h-10 w-full rounded-xl border border-border text-[12px] disabled:opacity-40">Skip encrypted file</button>
    </section>}
    {error&&!needsPassword&&!reading&&!pendingSaveId&&remaining>0&&<button type="button"
      className="mt-2 min-h-10 rounded-xl border border-border px-3 text-[12px] font-semibold"
      onClick={()=>{setError('');advanceQueue();}}>Skip unreadable file &amp; continue</button>}
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Next: inspect dates and amounts, then tap Save reviewed excerpts. To
      update Spend, also approve the individual rows in the saved document.
    </p>
    {preview && <section className="mt-3 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[12px] font-semibold">
        Review {preview.lines.length} extracted lines · {maskDocumentPII(preview.label)}
      </p>
      <p className="rounded-lg border border-primary/20 bg-background p-3 text-[12px] font-semibold">
        Document classification: {preview.accountProfile?.category.replaceAll('-',' ')??financeLabel(preview.documentKind)}
        <span className="mt-1 block font-normal text-muted-foreground">
          Account label: {preview.accountProfile?.name??'Unidentified account'} ·
          {preview.accountProfile?.confidence==='matched-terms'?' Matched document terms':' Needs owner verification'}
        </span>
      </p>
      {preview.documentKind&&preview.documentKind!=='unclassified'&&
        <p className="text-[11px] leading-5 text-muted-foreground">
          The importer recognises contractual instalments, residuals, financing principals,
          settlement quotations and quoted rates separately. An effective date is NOT a debit date.
          Nothing is assumed paid, outstanding today or verified by ABSA.
        </p>}
      <p className="text-[11px] leading-5 text-muted-foreground">
        Excerpts can contain private financial information. Verify the date,
        labels, positive/negative sign and amounts. The parser does not claim a
        verified balance, current account state or complete transaction history.
        Identifiers are masked where recognised, but this is not a guarantee
        that every identifier has been removed.
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {preview.lines.map((line,index)=><div key={index} className="rounded-lg bg-background p-2 text-[11px]">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="break-words font-medium">{maskDocumentPII(line.label)}</span>
            <strong>{money(line.amount)}</strong>
          </div>
          <p className="text-muted-foreground">{lineDateLabel(line)} · {roleLabel(line.semanticRole)}</p>
          {line.ratePercent!==undefined&&<p className="font-semibold">Quoted rate {line.ratePercent}%</p>}
          {line.runningBalance!==undefined&&<p className="text-muted-foreground">
            Running balance after transaction: {money(line.runningBalance)} · historical, not another payment
          </p>}
        </div>)}
      </div>
      {preview.truncated&&<p role="alert" className="text-[11px] font-semibold text-destructive">
        The saved excerpt is partial. The original remains in iPhone Files; review further source entries separately.
      </p>}
      <button type="button" onClick={save} disabled={!!pendingSaveId||reading}
        className="min-h-12 w-full rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
        {pendingSaveId?'Saving reviewed excerpts…':'Save these reviewed excerpts to encrypted workspace'}
      </button>
      <button type="button" disabled={!!pendingSaveId} onClick={()=>{setFeedback('');advanceQueue();}}
        className="min-h-11 w-full rounded-xl border border-border px-4 text-[12px] font-medium disabled:opacity-40">
        Skip this document without saving
      </button>
    </section>}
    {error&&<p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {feedback&&<p role="status" className="mt-2 text-[12px] text-muted-foreground">{feedback}</p>}
    {safe.length>0&&<div className="mt-4"><DocumentHistorySummary documents={safe} currency={currency}/></div>}
    {safe.length>0&&<section className="mt-5 space-y-3 border-t border-border pt-5">
      <div>
        <h3 className="text-[14px] font-bold">Saved documents</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Open a document to review its extracted information and add approved rows to your Spend ledger.</p>
      </div>
      {safe.map(document=><details key={document.id} className="rounded-xl border border-border bg-background p-3">
        <summary className="min-h-10 cursor-pointer text-[12px] font-semibold">
          {maskDocumentPII(document.label)} · {document.lines.length} lines
        </summary>
        {document.format==='pdf'&&document.accountProfile?.category==='bank-statement'&&
          document.lines.some(l=>l.date===null&&l.semanticRole!=='balance-reference')&&
          <p role="alert" className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-5">
            This earlier imported statement contains undated or unclassified entries.
            Reimport the original PDF with the updated parser to recover dates and
            separate payment amounts from running balances. Review the corrected
            import before removing any old excerpts. Previously saved snippets
            cannot reconstruct information missing from their source.
          </p>}
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
          {document.accountProfile?
            document.accountProfile.name+' · '+document.accountProfile.category.replaceAll('-',' '):
            financeLabel(document.documentKind??detectFinanceDocument(document.lines.map(l=>l.label).join(' '),document.label))}
        </p>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Owner-selected on {new Date(document.importedAt).toLocaleDateString('en-ZA')}.
          This is not a full document or verified bank record. Only reviewed
          excerpts are saved to the local encrypted workspace and included
          in subsequent encrypted vault backups.
        </p>
        <ul className="mt-2 max-h-56 space-y-2 overflow-auto text-[11px]">
          {document.lines.map((line,index)=><li key={index} className="flex flex-wrap justify-between gap-2">
            <span>{lineDateLabel(line)} · {maskDocumentPII(line.label)}<span className="block text-[10px] text-muted-foreground">{roleLabel(line.semanticRole)}{line.runningBalance!==undefined?' · Historical running balance '+money(line.runningBalance):''}</span></span>
            <strong>{money(line.amount)}</strong>
          </li>)}
        </ul>
        {documentAppliedIndices(document,ledgerEntries).size>0&&
          document.lines.some((line,i)=>documentAppliedIndices(document,ledgerEntries).has(i)&&
            (isFinanceReferenceLabel(line.label)||line.semanticRole==='contract-term'||line.semanticRole==='balance-reference'))&&
          <p role="alert" className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] leading-5 text-destructive">
            Existing Spend entries include loan terms or reference values. They may have been
            classified as payments in an earlier version. Inspect them under Spend → Activity.
            No existing entry has been silently removed or changed.
          </p>}
        <ReviewedDocumentLedger key={document.id} document={document}
          entries={ledgerEntries} currency={currency}
          currencyReviewRequired={currencyReviewRequired}
          onApply={onApplyEntries}/>
        <button type="button" onClick={()=>{
          if(window.confirm('Remove only these local excerpts? The original iPhone file and other vault records remain untouched. Already approved Spend entries will remain; remove them separately in Monthly Expenses if needed.'))onRemove(document.id);
        }} className="mt-3 min-h-11 rounded-lg border border-border px-4 text-[12px] font-semibold">
          Remove saved excerpts
        </button>
      </details>)}
    </section>}
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
      Saving does not immediately export a backup. Open Vault &amp; Settings,
      wait for the encrypted auto-save to finish, then choose Export encrypted backup.
      Keep the original files separately; only bounded excerpts are stored.
    </p>
    {reading&&<div role="dialog" aria-modal="true" aria-labelledby="mc-processing-title"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-5">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true"/>
        <h2 id="mc-processing-title" className="text-center text-[17px] font-bold">Processing your document</h2>
        <p className="mt-2 text-center text-[12px] leading-5 text-muted-foreground" role="status" aria-live="polite">
          {progress.stage==='reading'?'Opening the document privately…':
            progress.stage==='classifying'?'Identifying account and financial fields…':
            'Reading page '+progress.page+' of '+progress.total}
        </p>
        {progress.total>0&&<div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all"
            style={{width:Math.max(1,Math.round(progress.page/progress.total*100))+'%'}}/>
        </div>}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Text is processed on this iPhone. Raw PDFs and passwords are not sent to HYPRBOX.
        </p>
        <button type="button" onClick={()=>readController.current?.abort()}
          className="mt-4 min-h-11 w-full rounded-xl border border-border text-[12px] font-semibold">
          Cancel processing
        </button>
      </div>
    </div>}
  </section>;
}
