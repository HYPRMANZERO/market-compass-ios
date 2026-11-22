import {useEffect,useRef,useState} from 'react';
import {
 pickFinanceFolder,scanGrantedFinanceFolder,financeFileSignature,SUPPORT_FILE,
 type FinanceFolderHandle
} from '@/lib/financialSourcePermissions';

type ImportReport={failedCount:number;passwordRequiredCount:number};
type Props={
 disabled:boolean;reviewPending:boolean;
 onImport:(files:File[],temporaryPassword:string)=>Promise<ImportReport|undefined>;
};
/** A desktop browser's explicit folder grant. Never scan the whole device or
 * retain handles/passwords after leaving this unlocked screen. */
export default function FolderDocumentAccess({disabled,reviewPending,onImport}:Props){
 const folder=useRef<FinanceFolderHandle|null>(null);
 const seen=useRef(new Set<string>());
 const passwordInput=useRef<HTMLInputElement>(null);
 const scanning=useRef(false);
 const [connected,setConnected]=useState(false);
 const [autoScan,setAutoScan]=useState(false);
 const [queued,setQueued]=useState<File[]>([]);
 const [status,setStatus]=useState('No folder connected.');
 const [lastScan,setLastScan]=useState('');
 const [busy,setBusy]=useState(false);
 const supported=typeof window!=='undefined'&&
  typeof (window as Window&{showDirectoryPicker?:unknown}).showDirectoryPicker==='function';
 useEffect(()=>()=>{folder.current=null;},[]);
 async function scan(handle=folder.current){
  if(!handle||scanning.current)return;
  scanning.current=true;setBusy(true);
  try{
   const found=await scanGrantedFinanceFolder(handle);
   setQueued(current=>{
    const map=new Map<string,File>();
    for(const file of [...current,...found.files]){
     const key=financeFileSignature(file);
     if(!seen.current.has(key))map.set(key,file);
    }
    return [...map.values()];
   });
   setLastScan(new Date().toLocaleString('en-ZA'));
   setStatus(found.truncated?
     'Directory scan reached the per-pass safety limit. Choose a smaller subfolder for remaining files.':
     'Read-only scan complete. Newly discovered documents stay pending until reviewed.');
  }catch{
   folder.current=null;setConnected(false);setAutoScan(false);
   setStatus('Folder access expired or was denied. Choose the folder again.');
  }finally{scanning.current=false;setBusy(false);}
 }
 async function selectFolder(){
  try{
   // Browser permission prompt must be directly initiated by this button.
   const chosen=await pickFinanceFolder();
   folder.current=chosen;seen.current.clear();setQueued([]);
   setConnected(true);setStatus('Read-only folder selected for this unlocked session.');
   await scan(chosen);
  }catch(e){setStatus(e instanceof Error?e.message:'Folder permission was not granted.');}
 }
 function importFolderSnapshot(files:File[]){
  const supportedFiles=files.filter(f=>SUPPORT_FILE.test(f.name)&&f.size>0&&f.size<=64*1024*1024);
  setQueued(current=>{
   const combined=new Map<string,File>();
   for(const file of [...current,...supportedFiles]){
    const key=financeFileSignature(file);
    if(!seen.current.has(key))combined.set(key,file);
   }
   return [...combined.values()];
  });
  setStatus(supportedFiles.length+' supported file(s) selected from this folder snapshot. Review explicitly before saving.');
 }
 function disconnect(){
  folder.current=null;seen.current.clear();setQueued([]);
  setConnected(false);setAutoScan(false);
  if(passwordInput.current)passwordInput.current.value='';
  setStatus('Market Compass stopped accessing this folder. Revoke website permission in your browser settings if needed.');
 }
 useEffect(()=>{
  if(!connected||!autoScan)return;
  const poll=()=>{if(document.visibilityState==='visible'&&!reviewPending&&!disabled)void scan();};
  const timer=window.setInterval(poll,5*60_000);
  document.addEventListener('visibilitychange',poll);
  return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',poll);};
 },[connected,autoScan,reviewPending,disabled]);
 async function reviewDiscovered(){
  if(!queued.length||busy||reviewPending||disabled)return;
  setBusy(true);
  let temporaryPassword=passwordInput.current?.value??'';
  if(passwordInput.current)passwordInput.current.value='';
  try{
   const selected=[...queued];
   const report=await onImport(selected,temporaryPassword);
   if(!report){setStatus('Import did not complete. No permission changes were made.');return;}
   if(report.failedCount===0){
    for(const file of selected)seen.current.add(financeFileSignature(file));
    setQueued([]);
    setStatus('Documents sent to the local review queue. No financial totals were changed.');
   }else{
    setStatus(report.passwordRequiredCount+' encrypted PDF(s) need a password or retry. '+
      'Finish the current document reviews first, then retry. Already saved duplicates will be skipped.');
   }
  }finally{temporaryPassword='';setBusy(false);}
 }
 return <section className="mt-4 rounded-xl border border-border bg-muted/20 p-3" aria-label="Permission-based financial document discovery">
  <p className="text-[12px] font-bold">Document access permissions</p>
  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
   Desktop browsers can grant read-only access to one chosen folder.
   Recurring checks work only while this unlocked page is open; no background device-wide searches.
   On iPhone, use the multi-file Files picker above instead.
  </p>
  <div className="mt-2 flex flex-wrap gap-2">
   <button type="button" disabled={!supported||disabled||busy} onClick={()=>void selectFolder()}
     className="min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold disabled:opacity-40">
    {connected?'Choose another folder':'Grant access to a folder'}
   </button>
   {connected&&<button type="button" disabled={busy} onClick={()=>void scan()}
     className="min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold disabled:opacity-40">Scan selected folder</button>}
   {connected&&<button type="button" onClick={disconnect}
     className="min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold">Disconnect folder</button>}
  </div>
  {!supported&&<label className="mt-3 block text-[12px] font-semibold">
    Choose a local folder snapshot (one-time selection, no monitoring)
    <input type="file" multiple
      ref={element=>{if(element)element.setAttribute('webkitdirectory','');}}
      aria-label="Choose a folder containing financial documents, including subfolders"
      onChange={event=>{
        const files=Array.from(event.currentTarget.files??[]);
        event.currentTarget.value='';
        importFolderSnapshot(files);
      }}
      className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-[12px]"/>
    <span className="mt-1 block text-[11px] text-muted-foreground">
      Supported browsers include files from subfolders. No persistent folder permission
      or background scanning is requested.
    </span>
  </label>
  {connected&&<label className="mt-3 flex items-start gap-2 text-[12px]">
   <input type="checkbox" checked={autoScan} onChange={e=>setAutoScan(e.target.checked)}
      className="mt-1 h-4 w-4"/>
   <span>Check this granted folder every 5 minutes while Market Compass is open and unlocked.
    New files are discovered only; nothing is posted without review.</span>
  </label>}
  {queued.length>0&&<div className="mt-3 space-y-2">
   <p className="text-[12px] font-semibold">{queued.length} new or changed file(s) awaiting local review.</p>
   <label className="block text-[11px] font-semibold">One-time password for encrypted PDFs (if needed)
    <input type="password" ref={passwordInput} autoComplete="off" spellCheck={false}
      className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-[16px]"
      placeholder="Optional; remains only in this browser session"/>
   </label>
   <button type="button" disabled={busy||disabled||reviewPending} onClick={()=>void reviewDiscovered()}
     className="min-h-11 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
    Review discovered financial files
   </button>
   {reviewPending&&<p className="text-[11px]">Finish or discard the existing review queue before importing another batch.</p>}
  </div>}
  <p role="status" className="mt-2 text-[11px] text-muted-foreground">
   {status}{lastScan?' Last scan: '+lastScan+'.':''}
  </p>
  <p className="mt-2 text-[11px] text-muted-foreground">
   Email and bank account synchronization are not connected. They require separate, revocable provider authorization; folder access never grants email permissions.
  </p>
 </section>;
}