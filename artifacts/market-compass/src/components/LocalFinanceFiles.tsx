import {useRef,useState} from 'react';
import HistoricalEarnings from './HistoricalEarnings';
import FolderDocumentAccess from './FolderDocumentAccess';
import ReviewedDocumentLedger from './ReviewedDocumentLedger';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import {detectFinanceDocument,isFinanceReferenceLabel} from '@/lib/vehicleFinance';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import {documentAppliedIndices} from '@/lib/reviewedDocumentLedger';
import {importFinanceBatch} from '@/lib/batchFinanceImport';
import {buildPayrollHistory} from '@/lib/earningsHistory';
import {
  extractLocalFinanceDocument,validateLocalFinanceDocument,
  MAX_FINANCE_FILES,type LocalFinanceDocument
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
  const [reading,setReading]=useState(false);
  const [progress,setProgress]=useState<{page:number;total:number;stage:string}>({page:0,total:0,stage:'reading'});
  const readController=useRef<AbortController|null>(null);
  const [preview,setPreview]=useState<LocalFinanceDocument|null>(null);
  const [remaining,setRemaining]=useState<LocalFinanceDocument[]>([]);
  const [batchCount,setBatchCount]=useState(0);
  const [reviewIndex,setReviewIndex]=useState(0);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const safe=documents.map(validateLocalFinanceDocument)
    .filter((x):x is LocalFinanceDocument=>x!==null);
  const [batchProgress,setBatchProgress]=useState({file:0,total:0});
  function nextReview(){
    setPreview(remaining[0]??null);
    setRemaining(old=>old.slice(1));
    setReviewIndex(old=>old+1);
  }
  async function selected(files:File[],oneTimePassword:string){
    if(!files.length||reading)return undefined;
    if(preview||remaining.length){
      setError('Finish or discard the existing review queue before opening another batch.');
      return undefined;
    }
    setPreview(null);setRemaining([]);setReviewIndex(0);setBatchCount(0);
    setFeedback('');setError('');
    setReading(true);
    setProgress({page:0,total:0,stage:'reading'});
    setBatchProgress({file:0,total:files.length});
    const controller=new AbortController();
    readController.current=controller;
    // The single temporary password stays in this local call only, never in
    // React state, IndexedDB, persistent settings or a network request.
    let temporaryPassword=oneTimePassword;
    try{
      const result=await importFinanceBatch(files,{
        existing:safe,label,password:temporaryPassword,signal:controller.signal,
        progress:status=>{
          setBatchProgress({file:status.file,total:status.total});
          setProgress({page:status.page,total:status.pages,
            stage:status.stage==='classifying'?'classifying':'reading'});
        }
      });
      setPreview(result.drafts[0]??null);
      setRemaining(result.drafts.slice(1));
      setBatchCount(result.drafts.length);
      const notes=[result.drafts.length+' ready for individual owner review'];
      if(result.duplicateCount)notes.push(result.duplicateCount+' duplicate(s) skipped');
      if(result.failedCount)notes.push(result.failedCount+' file(s) could not be read');
      if(result.passwordRequiredCount)notes.push(result.passwordRequiredCount+' password-protected PDF(s) need a retry');
      if(result.oversizeCount)notes.push(result.oversizeCount+' unsupported/oversize file(s)');
      setFeedback(notes.join(' · ')+'. No extracted information has been saved or posted to Spend.');
      if(!result.drafts.length&&result.failedCount)setError(
        'No documents are ready. Check whether PDFs require the shared local password and select those files again.');
      return result;
    }catch(e){
      setError(e instanceof Error?e.message:'Batch processing failed locally; nothing was saved.');
      return undefined;
    }finally{
      temporaryPassword='';
      readController.current=null;
      setReading(false);
    }
  }
  function save(){
    if(!preview)return;
    try{
      onAdd(preview);
      nextReview();
      if(!remaining.length)setLabel('');
      setError('');
      setFeedback('One reviewed document saved to the encrypted workspace. '+
        (remaining.length?remaining.length+' more awaiting review.':
          'Export an encrypted backup after the vault save completes.'));
    }catch(e){setError(e instanceof Error?e.message:'Document could not be saved.');}
  }
  return <section id="mc-financial-files" className="mb-5 scroll-mt-28 rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6" aria-label="Import selected financial files privately">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Financial documents</p>
        <h2 className="mt-1 text-[17px] font-bold tracking-tight">Import & review</h2>
      </div>
      <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold">{safe.length} of {MAX_FINANCE_FILES} saved</span>
    </div>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      Select multiple bank statements or payslips from this device. Files are parsed
      sequentially and reviewed one by one. The originals are not uploaded to HYPRBOX, GitHub or an AI provider.
    </p>
    <details className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
      <summary className="min-h-9 cursor-pointer text-[11px] font-semibold">Supported files, privacy & limits</summary>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Batch selection supports CSV, TXT, transaction JSON and selectable-text PDF. Multi-page PDFs
        are processed across all pages with visible progress; a 64 MB on-device
        memory ceiling remains to prevent Safari crashes. Source evidence is
        bounded for encrypted storage and any truncation is disclosed.
        Scanned PDFs, photographs, Word and Excel need a separate local extractor.
        Originals remain on the device. Do not use online converters for
        private financial documents.
      </p>
    </details>
    <label className="mt-3 block text-[12px] font-semibold">
      Optional file label · e.g. October bank export
      <input type="text" autoComplete="off" maxLength={70} value={label}
        onChange={e=>{setLabel(e.target.value);setPreview(null);setError('');setFeedback('');}}
        placeholder="Optional · defaults to iPhone financial export"
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
      Choose one or more local financial documents
      <input type="file" multiple accept=".pdf,.csv,.txt,.json,application/pdf"
        aria-label="Choose multiple private CSV TXT JSON or PDF documents from this device"
        disabled={safe.length>=MAX_FINANCE_FILES||reading}
        onChange={event=>{
          const selectedFiles=Array.from(event.currentTarget.files??[]);
          event.currentTarget.value='';
          const oneTimePassword=passwordInput.current?.value??'';
          if(passwordInput.current)passwordInput.current.value='';
          void selected(selectedFiles,oneTimePassword);
        }}
        className="mt-1 block w-full rounded-xl border border-input bg-background p-3 text-[13px] disabled:opacity-40"/>
      {reading&&<span role="status" className="mt-2 block text-[11px] font-normal">Reading document {batchProgress.file} of {batchProgress.total} privately…</span>}
    </label>
    <FolderDocumentAccess disabled={safe.length>=MAX_FINANCE_FILES||reading}
      reviewPending={Boolean(preview)||remaining.length>0||reading}
      onImport={selected}/>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Next: review each document in the queue, then save its masked excerpts. To
      update Spend, also approve the individual rows in the saved document.
    </p>
    {preview && <section className="mt-3 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[11px] font-semibold">Review {reviewIndex+1} of {batchCount} · {remaining.length} remaining</p>
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
          <p className="text-muted-foreground">{line.payrollField?'Payroll period '+(line.date??'needs confirmation'):lineDateLabel(line)} · {line.payrollField?'Payroll reference only — NOT a bank deposit':roleLabel(line.semanticRole)}</p>
          {line.ratePercent!==undefined&&<p className="font-semibold">Quoted rate {line.ratePercent}%</p>}
          {line.runningBalance!==undefined&&<p className="text-muted-foreground">
            Running balance after transaction: {money(line.runningBalance)} · historical, not another payment
          </p>}
        </div>)}
      </div>
      {preview.truncated&&<p role="alert" className="text-[11px] font-semibold text-destructive">
        The saved excerpt is partial. The original remains in iPhone Files; review further source entries separately.
      </p>}
      <button type="button" onClick={save}
        className="min-h-12 w-full rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground">
        Save these reviewed excerpts to encrypted workspace
      </button>
      <button type="button" onClick={()=>{nextReview();setFeedback('Document skipped without saving.');}}
        className="min-h-11 w-full rounded-xl border border-border px-4 text-[12px] font-medium">
        Skip this document without saving
      </button>
      {remaining.length>0&&<button type="button" onClick={()=>{setPreview(null);setRemaining([]);setFeedback('Remaining batch discarded; no additional documents saved.');}}
        className="min-h-11 w-full rounded-xl border border-border px-4 text-[12px] font-medium">Discard remaining previews</button>}
    </section>}
    {error&&<p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {feedback&&<p role="status" className="mt-2 text-[12px] text-muted-foreground">{feedback}</p>}
    <HistoricalEarnings documents={safe} entries={ledgerEntries}/>
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
          {progress.stage==='reading'?'Opening document '+batchProgress.file+' of '+batchProgress.total+' privately…':
            progress.stage==='classifying'?'Identifying account and financial fields…':
            'Reading page '+progress.page+' of '+progress.total}
        </p>
        {progress.total>0&&<div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all"
            style={{width:Math.max(1,Math.round(progress.page/progress.total*100))+'%'}}/>
        </div>}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Text is processed on this device. Raw PDFs and passwords are not sent to HYPRBOX.
        </p>
        <button type="button" onClick={()=>readController.current?.abort()}
          className="mt-4 min-h-11 w-full rounded-xl border border-border text-[12px] font-semibold">
          Cancel processing
        </button>
      </div>
    </div>}
  </section>;
}
