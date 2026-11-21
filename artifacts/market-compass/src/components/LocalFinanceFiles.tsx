import {useRef,useState} from 'react';
import {extractLocalPdfText,MAX_LOCAL_PDF_BYTES} from '@/lib/localPdfText';
import {
  extractLocalFinanceDocument,validateLocalFinanceDocument,
  MAX_FINANCE_FILE_BYTES,MAX_FINANCE_FILES,type LocalFinanceDocument
} from '@/lib/localFinanceDocs';

const money=(n:number|null)=>n===null?'Amount unavailable':
  new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',
    minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
type Props={
  documents:LocalFinanceDocument[];
  onAdd:(value:LocalFinanceDocument)=>void;
  onRemove:(id:string)=>void;
};

/**
 * No API fetch or File upload: parsing stays on the device.
 * Only owner-approved, bounded excerpts enter the existing encrypted vault.
 */
export default function LocalFinanceFiles({documents,onAdd,onRemove}:Props){
  const [label,setLabel]=useState('');
  const passwordInput=useRef<HTMLInputElement>(null);
  const [reading,setReading]=useState(false);
  const [preview,setPreview]=useState<LocalFinanceDocument|null>(null);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const safe=documents.map(validateLocalFinanceDocument)
    .filter((x):x is LocalFinanceDocument=>x!==null);
  async function selected(file:File|undefined,oneTimePassword:string){
    setPreview(null);setFeedback('');setError('');
    if(!file||reading)return;
    const pdf=/\\.pdf$/i.test(file.name);
    const limit=pdf?MAX_LOCAL_PDF_BYTES:MAX_FINANCE_FILE_BYTES;
    if(!file.size||file.size>limit){
      setError(pdf?'Choose a PDF smaller than 2 MB. Nothing was saved.':
        'Choose a CSV, TXT or JSON file smaller than 256 KB. Nothing was saved.');
      return;
    }
    setReading(true);
    // The password is passed only to the local PDF reader. It never enters
    // React state, IndexedDB, settings, requests, logs or saved document data.
    let temporaryPassword=oneTimePassword;
    try{
      const data=pdf?await extractLocalPdfText(file,temporaryPassword):await file.text();
      const privateLabel=label.trim() || 'iPhone financial export';
      const draft=extractLocalFinanceDocument(file.name,data,privateLabel);
      setPreview(draft);
      setFeedback('Local review ready. Only the extracted excerpts below will be saved if you approve. The original document and its password were not uploaded or saved.');
    }catch(e){
      setError(e instanceof Error?e.message:'Could not read this financial file privately.');
    }finally{
      temporaryPassword='';
      setReading(false);
    }
  }
  function save(){
    if(!preview)return;
    try{
      onAdd(preview);
      setPreview(null);setLabel('');setError('');
      setFeedback('Reviewed document excerpts added to the unlocked workspace. Wait for Last saved in Vault & Settings, then export a new encrypted backup into iPhone Files.');
    }catch(e){setError(e instanceof Error?e.message:'Document could not be saved.');}
  }
  return <section id="mc-financial-files" className="mb-5 scroll-mt-28 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Import selected financial files privately">
    <h2 className="text-[15px] font-bold">
      Import financial statement exports · {safe.length} saved
    </h2>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      Select CSV, TXT, transaction JSON or text-based PDF documents from iPhone Files.
      Market Compass extracts up to 60 labelled financial lines, lets you review
      them, and stores only approved excerpts in this device’s encrypted workspace.
      The original document is not uploaded to GitHub, HYPRBOX or another service.
    </p>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      PDF limit: 2 MB and 12 pages of selectable text. CSV, TXT and JSON limit:
      256 KB. Scanned PDFs, photographs, DOCX and XLSX need a separate local
      extractor and are not read here. Do not use online converters for private
      financial documents.
    </p>
    <label className="mt-3 block text-[12px] font-semibold">
      Optional file label · e.g. October bank export
      <input type="text" autoComplete="off" maxLength={70} value={label}
        onChange={e=>{setLabel(e.target.value);setPreview(null);setError('');setFeedback('');}}
        placeholder="Optional · defaults to iPhone financial export"
        className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px]"/>
    </label>
    <label className="mt-3 block text-[12px] font-semibold">
      Temporary PDF password (only if required)
      <input ref={passwordInput} type="password" autoComplete="off" spellCheck={false}
        aria-label="Temporary PDF password, never stored"
        placeholder="Enter password before selecting a protected PDF"
        className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px]"/>
    </label>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      The password field is cleared as soon as you choose a file. The password
      is used only during local PDF decryption; it is not saved in your vault
      or sent to Ollama. Browser memory cannot be guaranteed to erase instantly.
      If a PDF reports an incorrect password, re-enter it and select the PDF again.
    </p>
    <label className="mt-3 block text-[12px] font-semibold">
      Choose a document from iPhone Files
      <input type="file"
        aria-label="Choose private CSV TXT JSON or PDF document from iPhone Files"
        disabled={safe.length>=MAX_FINANCE_FILES||reading}
        onChange={event=>{
          const selectedFile=event.currentTarget.files?.[0];
          event.currentTarget.value='';
          const oneTimePassword=passwordInput.current?.value??'';
          if(passwordInput.current)passwordInput.current.value='';
          void selected(selectedFile,oneTimePassword);
        }}
        className="mt-1 block w-full rounded-xl border border-input bg-background p-3 text-[13px] disabled:opacity-40"/>
      {reading&&<span role="status" className="mt-2 block text-[11px] font-normal">Reading locally…</span>}
    </label>
    <p className="mt-2 text-[11px] text-muted-foreground">
      You can choose a file without entering a label or password. Only
      protected PDFs require the temporary password. Always review the extracted
      dates, amounts and transaction direction before saving.
    </p>
    {preview && <section className="mt-3 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[12px] font-semibold">
        Review {preview.lines.length} extracted lines · {preview.label}
      </p>
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
            <span className="break-words font-medium">{line.label}</span>
            <strong>{money(line.amount)}</strong>
          </div>
          <p className="text-muted-foreground">{line.date??'Date not identified'} · {line.direction==='unclassified'?'Direction unconfirmed':line.direction}</p>
        </div>)}
      </div>
      {preview.truncated&&<p role="alert" className="text-[11px] font-semibold text-destructive">
        Import was limited to the first 60 recognised lines. This is not the full file.
      </p>}
      <button type="button" onClick={save}
        className="min-h-12 w-full rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground">
        Save these reviewed excerpts to encrypted workspace
      </button>
      <button type="button" onClick={()=>{setPreview(null);setFeedback('');}}
        className="min-h-11 w-full rounded-xl border border-border px-4 text-[12px] font-medium">
        Cancel without saving
      </button>
    </section>}
    {error&&<p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {feedback&&<p role="status" className="mt-2 text-[12px] text-muted-foreground">{feedback}</p>}
    {safe.length>0&&<section className="mt-4 space-y-3">
      <h3 className="text-[12px] font-bold">Encrypted local document excerpts</h3>
      {safe.map(document=><details key={document.id} className="rounded-xl border border-border bg-background p-3">
        <summary className="min-h-10 cursor-pointer text-[12px] font-semibold">
          {document.label} · {document.lines.length} lines
        </summary>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Owner-selected on {new Date(document.importedAt).toLocaleDateString('en-ZA')}.
          This is not a full document or verified bank record. Only reviewed
          excerpts are saved to the local encrypted workspace and included
          in subsequent encrypted vault backups.
        </p>
        <ul className="mt-2 max-h-56 space-y-2 overflow-auto text-[11px]">
          {document.lines.map((line,index)=><li key={index} className="flex flex-wrap justify-between gap-2">
            <span>{line.date??'Unspecified date'} · {line.label}</span>
            <strong>{money(line.amount)}</strong>
          </li>)}
        </ul>
        <button type="button" onClick={()=>{
          if(window.confirm('Remove only these local excerpts? The original iPhone file and other vault records remain untouched.'))onRemove(document.id);
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
  </section>;
}
