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
    setMessage('Draft added to this device’s unlocked workspace. Confirm the encrypted auto-save finishes in Vault & Settings, then export an encrypted backup. This has NOT been sent to HYPRBOX or another app.');
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
      <p className="text-muted-foreground">Incentive is conditional and hourly pay may already be in payroll. Any credit-card outstanding figure is owner-reported only, not lender-verified or spendable cash.</p>
      {saved.creditCardFigureStatus==='owner_reported_outstanding_balance' && saved.creditCardFigure!==null &&
        <p><strong>Credit-card outstanding debt reported by owner: {money(saved.creditCardFigure)}.</strong> Do not add the debt principal to normal monthly card repayments.</p>}
      {saved.creditCardFigureStatus==='unknown_balance_or_limit' && saved.creditCardFigure!==null &&
        <button type="button" className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold"
          onClick={()=>{
            if(!profile?.creditCardFigure)return;
            if(!window.confirm('Confirm this amount is outstanding credit-card debt, NOT the credit limit? This remains owner-reported and lender-unverified.'))return;
            onSave({...profile,creditCardFigure:{amount:profile.creditCardFigure.amount,meaning:'owner_reported_outstanding_balance'}});
            setMessage('Card amount classified as owner-reported outstanding debt in this local encrypted workspace. Wait for auto-save and export a new backup.');
          }}>
          Confirm card amount is outstanding debt
        </button>}
    </div> : <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[12px]">
      No owner budget draft has been saved here yet. This does not mean zero salary or zero expenses.
    </p>}
    <details className="mt-3 rounded-xl border border-border p-3">
      <summary className="min-h-10 cursor-pointer text-[12px] font-semibold">{saved?'Import updated owner budget JSON':'Paste owner budget JSON to save privately'}</summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Paste the owner-budget-v1 JSON you reviewed. Use proper numbers for amounts,
        mark incentives as conditional and hourly pay inclusion as unknown.
        Preview before saving. Do not paste passwords, account numbers or API tokens.
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
