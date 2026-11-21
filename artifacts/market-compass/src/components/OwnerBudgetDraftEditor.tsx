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

/** Safari-only owner-approved local import; existing encrypted PWA vault owns persistence. */
export default function OwnerBudgetDraftEditor({profile,onSave}:Props){
  const [source,setSource]=useState('');
  const [preview,setPreview]=useState<OwnerBudgetDraft|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const saved=(()=>{
    if(!profile)return null;
    try{return summarizeOwnerBudgetDraft(validateOwnerBudgetDraft(profile));}
    catch{return null;}
  })();
  const proposed=preview?summarizeOwnerBudgetDraft(preview):null;
  async function readPrivateFile(file:File|undefined){
    setError('');setMessage('');setPreview(null);setSource('');
    if(!file)return;
    if(file.size>20_000){
      setError('This private budget file exceeds the 20 KB limit; nothing imported.');
      return;
    }
    try{
      const text=await file.text();
      const candidate=parseOwnerBudgetDraft(text);
      setSource(text);setPreview(candidate);
      setMessage('Private file reviewed in this browser only. Inspect the totals below before choosing Save. It has not been uploaded or added to the encrypted vault.');
    }catch(e){
      setError(e instanceof Error?e.message:'Could not read that private budget file.');
      setSource('');
    }
  }
  function review(){
    setError('');setMessage('');setPreview(null);
    try {setPreview(parseOwnerBudgetDraft(source));}
    catch(e){setError(e instanceof Error?e.message:'The budget cannot be read.');}
  }
  function save(){
    if(!preview)return;
    if(profile && !window.confirm('Replace only this device’s owner budget draft? Your other expenses and debt records will remain unchanged. Export an encrypted backup first.'))return;
    onSave(preview);
    setSource('');setPreview(null);setError('');
    setMessage('Owner budget added to this device’s unlocked workspace. Wait for “Last saved” in Vault & Settings, then export a new encrypted backup to Files. No information was sent to HYPRBOX, GitHub, or the other app.');
  }
  return <details className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Safari-only encrypted owner budget draft">
    <summary className="min-h-11 cursor-pointer text-[14px] font-bold">
      Owner budget · encrypted on this iPhone {saved?'· saved locally':'· not saved'}
    </summary>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      While away from HYPRBOX, you can preserve your owner-reported salary,
      hourly pay, spending and dated exceptions in this iPhone's existing
      encrypted workspace. No App Store installation, remote connection or bank login.
      <strong> This draft is not yet mirrored to HYPRBOX or the other PWA.</strong>
    </p>
    {saved ? <div className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3 text-[12px]">
      <p className="font-semibold">Owner report dated {saved.recordedAt} · local draft only</p>
      <div className="grid grid-cols-2 gap-3">
        <p>Reported salary<br/><strong>{money(saved.salary)}</strong></p>
        <p>Conditional incentive<br/><strong>{money(saved.conditionalIncentive)}</strong></p>
        <p>Hourly rate<br/><strong>{money(saved.hourlyRate)}/hour</strong></p>
        <p>Normal listed costs<br/><strong>{range(saved.recurringMin,saved.recurringMax)}</strong></p>
      </div>
      <p>Salary-only listed difference: <strong>{range(saved.salaryOnlyDifferenceMin,saved.salaryOnlyDifferenceMax)}</strong>. This is not verified spendable cash.</p>
      <p className="font-medium">Recorded entries: {saved.recurring.length} monthly cost lines, {saved.scheduledMonths.length} month-specific exceptions, {saved.historicalCycles.length} incomplete historical snapshots.</p>
      <details className="rounded-lg border border-border bg-background p-3">
        <summary className="min-h-10 cursor-pointer font-semibold">Detailed listed monthly costs ({saved.recurring.length})</summary>
        <ul className="mt-2 space-y-2">
          {saved.recurring.map((entry,index)=><li key={index} className="flex justify-between gap-3">
            <span className="min-w-0">{entry.label} <span className="text-muted-foreground">· {entry.category==='debt_payment'?'debt payment':entry.category==='fee'?'fee':'expense'}</span></span>
            <strong className="shrink-0 text-right">{range(entry.min,entry.max)}</strong>
          </li>)}
        </ul>
      </details>
      {saved.scheduledMonths.length>0 && <details className="rounded-lg border border-border bg-background p-3">
        <summary className="min-h-10 cursor-pointer font-semibold">Month-specific changes</summary>
        {saved.scheduledMonths.map((change,index)=><div key={index} className="mt-2 text-[12px]">
          {change.month} · {change.label}: {money(change.cost)}. Total listed costs: {range(change.listedMin,change.listedMax)}.
        </div>)}
      </details>}
      {saved.historicalCycles.length>0 && <details className="rounded-lg border border-border bg-background p-3">
        <summary className="min-h-10 cursor-pointer font-semibold">Historical owner-reported entries</summary>
        {saved.historicalCycles.map(cycle=><div key={cycle.date} className="mt-3">
          <p className="font-semibold">{cycle.date} · reported income {money(cycle.income)} · listed costs {money(cycle.listedExpenses)}</p>
          <ul className="mt-2 space-y-1">
            {cycle.entries.map((item,index)=><li key={index} className="flex justify-between gap-3">
              <span>{item.label}</span><strong>{money(item.min)}</strong>
            </li>)}
          </ul>
          <p className="mt-1 text-muted-foreground">Incomplete historical record, not bank verified.</p>
        </div>)}
      </details>}
      <p className="text-muted-foreground">
        Incentive is not guaranteed; hourly earnings may already be included in salary.
        {saved.creditCardFigureStatus==='unknown_balance_or_limit' && ' A reported credit-card figure exists, but it is not confirmed as an outstanding balance or credit limit.'}
        {' '}The local planning remainder is not spendable cash.
      </p>
    </div> : <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[12px]">
      No owner budget draft has been saved here yet. This does not mean zero salary or zero expenses.
    </p>}
    <details className="mt-3 rounded-xl border border-border p-3">
      <summary className="min-h-10 cursor-pointer text-[12px] font-semibold">{saved?'Import updated owner budget JSON':'Paste owner budget JSON to save privately'}</summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Select your private owner-budget JSON from iPhone Files, or paste it below.
        Only a validated, owner-approved record is saved. The app does not
        upload the file. Do not import vault-backup files here; use Vault &amp; Settings
        for encrypted full-workspace backups.
      </p>
      <label className="mt-3 block text-[12px] font-semibold">
        Import owner budget from iPhone Files
        <input type="file" accept=".json,application/json" aria-label="Choose private owner budget JSON file"
          onChange={event=>{
            const file=event.currentTarget.files?.[0];
            event.currentTarget.value='';
            void readPrivateFile(file);
          }}
          className="mt-1 block w-full rounded-xl border border-input bg-background p-3 text-[13px]"/>
      </label>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        The selected file remains unencrypted in Files until you delete it.
        Once the encrypted workspace reports saved, export an encrypted vault
        backup from Vault &amp; Settings and keep it somewhere safe.
        Do not paste passwords, account numbers or API tokens.
      </p>
      <textarea aria-label="Owner-reported private budget JSON"
        rows={10} spellCheck={false} value={source}
        onChange={event=>{setSource(event.target.value.slice(0,20000));setPreview(null);setError('');setMessage('');}}
        placeholder={'{\n  "schema": "market-compass-owner-budget-v1",\n  "recordedAt": "YYYY-MM-DD",\n  ...\n}'}
        className="mt-2 w-full rounded-xl border border-input bg-background p-3 font-mono text-[13px] leading-5"/>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={review} disabled={!source.trim()}
          className="min-h-11 rounded-xl border border-border px-4 text-[12px] font-semibold disabled:opacity-40">Review pasted budget</button>
        <button type="button" onClick={()=>{setSource('');setPreview(null);setError('');setMessage('');}}
          className="min-h-11 rounded-xl px-4 text-[12px] font-medium">Clear pasted text</button>
      </div>
      {proposed && <div className="mt-3 space-y-2 rounded-xl border border-border p-3 text-[12px]">
        <p className="font-semibold">Preview · owner reported {proposed.recordedAt}</p>
        <p>Monthly salary: {money(proposed.salary)}. Conditional incentive: {money(proposed.conditionalIncentive)}. Hourly pay: {money(proposed.hourlyRate)} per hour.</p>
        <p>Listed recurring costs: {range(proposed.recurringMin,proposed.recurringMax)}. Incomplete salary-only difference: {range(proposed.salaryOnlyDifferenceMin,proposed.salaryOnlyDifferenceMax)}.</p>
        <p>Included: {proposed.recurring.length} recurring items, {proposed.scheduledMonths.length} month-specific exceptions and {proposed.historicalCycles.length} historical snapshots.</p>
        <ul className="space-y-1">
          {proposed.recurring.map((item,index)=><li key={index} className="flex justify-between gap-2">
            <span>{item.label}</span><strong>{range(item.min,item.max)}</strong>
          </li>)}
        </ul>
        {proposed.scheduledMonths.map((item,index)=><p key={index}>Exception {item.month} · {item.label} {money(item.cost)} · total listed {range(item.listedMin,item.listedMax)}</p>)}
        {proposed.historicalCycles.map(item=><p key={item.date}>Historical {item.date}: income {money(item.income)}, listed costs {money(item.listedExpenses)} ({item.entries.length} items, incomplete).</p>)}
        <p className="text-muted-foreground">Not bank-verified and not confirmed spare money. Nothing is being transferred or sent to HYPRBOX.</p>
        <button type="button" onClick={save}
          className="min-h-12 w-full rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground">
          Save to this iPhone's encrypted workspace
        </button>
      </div>}
      {error && <p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
      {message && <p role="status" className="mt-2 text-[12px] text-muted-foreground">{message}</p>}
    </details>
    {!saved && profile && <p role="alert" className="mt-2 text-[11px] text-destructive">
      This saved local draft failed validation; import a corrected copy after backing up your vault.
    </p>}
  </details>;
}
