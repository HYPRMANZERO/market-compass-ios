import {useState} from 'react';
import {
  parseOwnerBudgetDraft,summarizeOwnerBudgetDraft,validateOwnerBudgetDraft,
  type OwnerBudgetDraft
} from '@/lib/ownerBudgetDraft';

const money=(n:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',minimumFractionDigits:2,maximumFractionDigits:2
}).format(n);
const range=(a:number,b:number)=>a===b?money(a):money(a)+' to '+money(b);
type Props={profile:OwnerBudgetDraft|null;onSave:(value:OwnerBudgetDraft)=>void};

/** Read a user-selected local file without a network request. Older WebKit
 * engines may lack Blob.text(), so support the native FileReader fallback. */
export async function readOwnerFileText(file:File):Promise<string>{
  if(typeof file.text==='function')return file.text();
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):
      reject(Error('Could not decode this local file as text.'));
    reader.onerror=()=>reject(Error('Safari could not read the selected file.'));
    reader.readAsText(file,'utf-8');
  });
}

/**
 * Always-visible iPhone Files chooser; review before inserting into the
 * existing passphrase-encrypted PWA vault. Plaintext is never sent to GitHub.
 * This is an owner-reported local draft, NOT a verified bank account feed.
 */
export default function OwnerBudgetDraftEditor({profile,onSave}:Props){
  const [source,setSource]=useState('');
  const [preview,setPreview]=useState<OwnerBudgetDraft|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [fileLabel,setFileLabel]=useState('');
  const saved=(()=>{
    if(!profile)return null;
    try{return summarizeOwnerBudgetDraft(validateOwnerBudgetDraft(profile));}
    catch{return null;}
  })();
  const proposed=preview?summarizeOwnerBudgetDraft(preview):null;

  async function readPrivateFile(file:File|undefined){
    setError('');setMessage('');setPreview(null);setSource('');setFileLabel('');
    if(!file)return;
    if(file.size>20_000){
      setError('This owner budget file is over 20 KB. Choose a smaller owner-budget JSON document.');
      return;
    }
    if(!file.name.toLowerCase().endsWith('.json')){
      setError('Select a .json owner-budget file. This picker cannot read PDF, CSV or encrypted backups.');
      return;
    }
    if(file.name.toLowerCase().endsWith('.mc-vault.json')){
      setError('This is an encrypted vault backup. Do not import it here or overwrite your existing vault. Use Vault & Settings for full restores.');
      return;
    }
    try{
      const text=await readOwnerFileText(file);
      const candidate=parseOwnerBudgetDraft(text);
      setPreview(candidate);
      setFileLabel(file.name.slice(0,90));
      setMessage('File read locally. Review the salary and expenses below, then choose Save to encrypted workspace. Nothing has been uploaded.');
    }catch(e){
      setError(e instanceof Error?e.message:'This file could not be read. Nothing was saved.');
    }
  }
  function reviewPaste(){
    setError('');setMessage('');setPreview(null);setFileLabel('');
    try{
      setPreview(parseOwnerBudgetDraft(source));
      setMessage('Pasted JSON validated locally. Review the preview before saving.');
    }catch(e){
      setError(e instanceof Error?e.message:'The budget JSON is invalid.');
    }
  }
  function save(){
    if(!preview)return;
    if(profile && !window.confirm(
      'Replace ONLY this iPhone’s owner budget draft? Other transactions, debt records and encrypted backups remain unchanged. Export a backup first.'
    ))return;
    onSave(preview);
    setSource('');setPreview(null);setFileLabel('');setError('');
    setMessage('Owner budget added to the unlocked iPhone workspace. Wait for the Last saved indicator, then export a NEW encrypted vault backup in Vault & Settings. This was not sent to GitHub, HYPRBOX or your second PWA.');
  }
  return <section id="mc-finance-import"
    className="mb-5 scroll-mt-28 rounded-2xl border-2 border-primary/35 bg-card p-4 shadow-sm"
    aria-label="Import personal financial budget from iPhone Files">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[16px] font-bold">Import your financial information</h2>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">
        {saved?'Encrypted budget saved':'Private · on this iPhone'}
      </span>
    </div>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      Open a private owner-budget JSON file from iPhone Files. You can review it
      before adding it to this app’s encrypted workspace, so Compass can answer
      supported salary and expense questions offline. This is not a bank connection.
    </p>

    <label className="mt-4 block rounded-xl border border-primary/30 bg-muted/35 p-3 text-[13px] font-semibold">
      <span className="mb-2 block">1. Choose owner-budget JSON from Files</span>
      <input type="file"
        aria-label="Choose personal owner-budget JSON file from iPhone Files"
        onChange={event=>{
          const chosen=event.currentTarget.files?.[0];
          event.currentTarget.value='';
          void readPrivateFile(chosen);
        }}
        className="block min-h-12 w-full max-w-full rounded-lg border border-input bg-background px-2 py-3 text-[16px]"/>
    </label>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      On iPhone, tap the file selector, choose <strong>Browse</strong>, then
      select your saved <code>.json</code> file in Files. Choose any file to
      open the picker; unsupported types are rejected safely after selection.
      An encrypted <code>.mc-vault.json</code> backup is a different type of file.
    </p>

    <details className="mt-3 rounded-xl border border-border p-3">
      <summary className="min-h-11 cursor-pointer text-[12px] font-semibold">
        File picker not working? Paste owner-budget JSON instead
      </summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Copy text from your private JSON document in Files and paste it below.
        This is a local alternative that does not require an upload or desktop connection.
      </p>
      <textarea aria-label="Paste personal owner budget JSON as fallback" rows={7}
        value={source} spellCheck={false}
        onChange={event=>{
          setSource(event.target.value.slice(0,20_000));
          setPreview(null);setError('');setMessage('');setFileLabel('');
        }}
        className="mt-2 w-full rounded-xl border border-input bg-background p-3 font-mono text-[16px] leading-6"
        placeholder={'{\n  "schema": "market-compass-owner-budget-v1",\n  "recordedAt": "YYYY-MM-DD",\n  ...\n}'}/>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={reviewPaste} disabled={!source.trim()}
          className="min-h-11 rounded-xl border border-border px-4 text-[12px] font-semibold disabled:opacity-40">
          Review pasted budget
        </button>
        <button type="button" onClick={()=>{setSource('');setPreview(null);setError('');setMessage('');setFileLabel('');}}
          className="min-h-11 rounded-xl border border-border px-4 text-[12px]">Clear</button>
      </div>
    </details>

    {proposed&&<section className="mt-4 space-y-3 rounded-xl border border-primary/40 p-3 text-[12px]"
      aria-label="Private owner budget approval preview">
      <p className="font-bold">2. Review your file {fileLabel?'· '+fileLabel:''}</p>
      <p>Reported date: <strong>{proposed.recordedAt}</strong>. Not bank or employer verified.</p>
      <div className="grid grid-cols-2 gap-3">
        <p>Monthly salary<br/><strong>{money(proposed.salary)}</strong></p>
        <p>Conditional incentive<br/><strong>{money(proposed.conditionalIncentive)}</strong></p>
        <p>Hourly rate<br/><strong>{money(proposed.hourlyRate)}/hour</strong></p>
        <p>Normal listed costs<br/><strong>{range(proposed.recurringMin,proposed.recurringMax)}</strong></p>
      </div>
      <details className="rounded-lg border border-border p-3">
        <summary className="min-h-11 cursor-pointer font-semibold">Review all imported figures</summary>
        <ul className="mt-2 space-y-2">
          {proposed.recurring.map((item,i)=><li key={i} className="flex justify-between gap-2">
            <span>{item.label}</span><strong>{range(item.min,item.max)}</strong>
          </li>)}
        </ul>
        {proposed.scheduledMonths.map((item,i)=><p key={i} className="mt-2">
          Exception {item.month}: {item.label} {money(item.cost)}; listed costs {range(item.listedMin,item.listedMax)}.
        </p>)}
        {proposed.historicalCycles.map(item=><p key={item.date} className="mt-2">
          Historical {item.date}: reported income {money(item.income)};
          listed costs {money(item.listedExpenses)}; {item.entries.length} entries (incomplete).
        </p>)}
      </details>
      <p className="text-muted-foreground">
        The salary-only remainder is an incomplete planning estimate, not spendable cash.
        Your hourly pay might already be included in payroll. No bank feeds or trades are enabled.
      </p>
      <button type="button" onClick={save}
        className="min-h-12 w-full rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground">
        3. Save approved budget to encrypted workspace
      </button>
    </section>}

    {saved?<details className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
      <summary className="min-h-11 cursor-pointer text-[12px] font-semibold">
        View saved local budget · {saved.recordedAt}
      </summary>
      <div className="mt-2 space-y-2 text-[12px]">
        <p>Monthly salary {money(saved.salary)} · conditional incentive {money(saved.conditionalIncentive)}
          · hourly rate {money(saved.hourlyRate)}/hour.</p>
        <p>Recurring costs {range(saved.recurringMin,saved.recurringMax)}.
          Salary-only listed difference {range(saved.salaryOnlyDifferenceMin,saved.salaryOnlyDifferenceMax)}
          (not confirmed available cash).</p>
        <ul className="space-y-1">
          {saved.recurring.map((line,i)=><li key={i} className="flex justify-between gap-2">
            <span>{line.label}</span><strong>{range(line.min,line.max)}</strong>
          </li>)}
        </ul>
        {saved.scheduledMonths.map((line,i)=><p key={i}>
          {line.month}: {line.label} {money(line.cost)}; monthly listed total {range(line.listedMin,line.listedMax)}.
        </p>)}
        {saved.historicalCycles.map(line=><div key={line.date} className="mt-3">
          <p className="font-semibold">{line.date}: reported {money(line.income)};
            listed {money(line.listedExpenses)}, incomplete.</p>
          <ul className="mt-1 space-y-1">{line.entries.map((entry,i)=><li key={i}
            className="flex justify-between gap-2"><span>{entry.label}</span><strong>{money(entry.min)}</strong></li>)}</ul>
        </div>)}
        {saved.creditCardFigureStatus==='unknown_balance_or_limit'&&saved.creditCardFigure!==null&&
          <p>The reported credit-card figure {money(saved.creditCardFigure)} might be a limit or a balance; unverified.</p>}
      </div>
    </details>:<p className="mt-3 text-[11px] text-muted-foreground">
      No owner budget is saved on this iPhone yet. Missing information does not mean zero income.
    </p>}
    {error&&<p role="alert" className="mt-3 rounded-lg bg-muted px-3 py-2 text-[12px] text-destructive">{error}</p>}
    {message&&<p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">{message}</p>}
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
      The plaintext file remains in iPhone Files until you manage it there.
      Once encrypted auto-save finishes, use <strong>Vault &amp; Settings → Export encrypted backup</strong>.
      Importing a budget does not synchronize the other PWA or HYPRBOX.
    </p>
  </section>;
}
