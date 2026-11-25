import {useState} from 'react';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import {preparedDocumentReview} from '@/lib/reviewSuggestions';
import {matchingApprovedEntriesForDocumentLine} from '@/lib/ledgerIntegrity';
import {isReviewableLine} from '@/lib/reviewInbox';
import {timeContextLabel,sourceTimeContext} from '@/lib/documentTimeContext';
import {type LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {suggestRegionalDocumentClassification} from '@/lib/regionalDocumentReview';
import {
  EXPENSE_CATEGORIES,EXPENSE_KINDS,
  type ExpenseEntry,type ExpenseCategory,type ExpenseKind
} from '@/lib/monthlyExpenses';
import {
  applyReviewedDocumentToLedger,allowedDocumentCategories,
  documentAppliedIndices,documentRowBlockReason,type ReviewedLedgerDecision
} from '@/lib/reviewedDocumentLedger';

type ReviewRow={checked:boolean;date:string;kind:ExpenseKind|'';category:ExpenseCategory|''};
type Props={
  document:LocalFinanceDocument;
  entries:ExpenseEntry[];
  currency:string;
  region?:string;
  currencyReviewRequired:boolean;
  onApply:(entries:ExpenseEntry[])=>void;
};
const showMoney=(value:number|null)=>value===null?'Unknown amount':
  new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(value);

/** Suggest classifications locally and require confirmation before posting. */
export default function ReviewedDocumentLedger({
  document,entries,currency,region='ZA',currencyReviewRequired,onApply
}:Props){
  const [draft,setDraft]=useState<Record<number,ReviewRow>>({});
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const applied=documentAppliedIndices(document,entries);
  function initialRow(index:number):ReviewRow{
    const line=document.lines[index];
    const suggestion=suggestRegionalDocumentClassification(line,region);
    return {checked:false,date:line.date??'',kind:suggestion?.kind??'',category:suggestion?.category??''};
  }
  const ready=document.lines.map((line,index)=>({line,index})).filter(({line,index})=>
    !applied.has(index)&&!documentRowBlockReason(document,line)&&line.amount!==null&&line.amount!==0);
  // A matching excerpt from another file or manual record is never silently
  // merged. Exclude from bulk Prepare; owner may still inspect and select it.
  const possibleDuplicateIndices=new Set(ready.filter(({line})=>
    matchingApprovedEntriesForDocumentLine(line,entries,currency).length>0
  ).map(({index})=>index));
  // Unreviewed movements are visible, but never included in approved Spend totals.
  const pendingCredits=ready.filter(({line})=>line.direction==='incoming')
    .reduce((sum,{line})=>sum+Math.abs(line.amount??0),0);
  const pendingDebits=ready.filter(({line})=>line.direction==='outgoing')
    .reduce((sum,{line})=>sum+Math.abs(line.amount??0),0);
  const pendingUnclear=ready.filter(({line})=>line.direction==='unclassified').length;
  const pendingUnsorted=ready.filter(({line})=>{
    const proposed=suggestRegionalDocumentClassification(line,region);
    return proposed===null||proposed.category==='unsorted';
  }).length;
  const suggested=ready.filter(({index})=>{
    const row=draft[index]??initialRow(index);
    return row.date&&row.kind&&row.category;
  });
  const selected=document.lines.map((_,i)=>i).filter(i=>draft[i]?.checked&&!applied.has(i));
  const canApply=currency==='ZAR'&&!currencyReviewRequired;
  const prepared=document.lines.map((_,i)=>({index:i,proposal:preparedDocumentReview(document,i,region)}))
    .filter((item):item is {index:number;proposal:NonNullable<typeof item.proposal>}=>
      item.proposal!==null&&!applied.has(item.index)&&!possibleDuplicateIndices.has(item.index));
  const selectPrepared=()=>{
    if(!canApply)return;
    setDraft(old=>{
      const next={...old};
      for(const {index,proposal} of prepared){
        next[index]={checked:true,date:proposal.date,kind:proposal.kind,category:proposal.category};
      }
      return next;
    });
    setError('');setFeedback('');
  };
  const change=(index:number,fields:Partial<ReviewRow>)=>{
    setDraft(old=>{
      const previous=old[index]??initialRow(index);
      return {...old,[index]:{...previous,...fields}};
    });
    setError('');setFeedback('');
  };
  function submit(){
    setError('');setFeedback('');
    if(!canApply){
      setError('Review the workspace currency first. This importer labels all extracted R amounts as ZAR and does not convert other currencies.');
      return;
    }
    const similarCount=selected.filter(i=>possibleDuplicateIndices.has(i)).length;
    const decisions:ReviewedLedgerDecision[]=selected.map(i=>({
      lineIndex:i,date:draft[i].date,
      kind:draft[i].kind as ExpenseKind,
      category:draft[i].category as ExpenseCategory
    }));
    try{
      const revised=applyReviewedDocumentToLedger(document,entries,decisions,currency);
      if(!window.confirm(
        'Add '+decisions.length+' reviewed line(s) to your encrypted Spend ledger? '+
        (similarCount>0?similarCount+' selected row(s) look like existing approved transactions. '+'Confirm these are not repeat imports before continuing. ':'')+
        'These are reviewed statement excerpts, not bank-reconciled transactions. '+
        'This will change recorded cycle totals and local Assistant summaries; it will NOT change Debt Plan balances, send data to HYPRBOX, or execute payments.'
      ))return;
      onApply(revised);
      setDraft({});
      setFeedback(decisions.length+' approved line(s) added to Spend. Open Monthly Expenses and select the relevant 26th–25th salary cycle. These are not confirmed bank balances; export an encrypted vault backup after auto-save.');
    }catch(e){setError(e instanceof Error?e.message:'Cannot apply these reviewed document lines.');}
  }
  return <details className="mt-3 rounded-2xl border border-primary/20 bg-primary/[.035] p-3 sm:p-4">
    <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 text-[12px] font-semibold">
      <span>Review and add to Spend</span>
      <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-medium">
        {applied.size} posted
      </span>
    </summary>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Explicit transaction dates are populated automatically; no duplicate date entry is needed.
      You can prepare clear source-labelled rows together and approve once to record them.
      Source direction is taken from the document's explicitly labelled or signed transactions; check it before approving. Recognized merchants receive a suggested category. Unknown categories stay Unsorted, and you may label them later in Spend. Transfers, refunds and unclear directions need human review; no unapproved row affects your budget.
    </p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Unreviewed historical money movements">
      {[
        ['Unreviewed credits',showMoney(pendingCredits)],
        ['Unreviewed debits',showMoney(pendingDebits)],
        ['Unknown direction',String(pendingUnclear)+' row(s)'],
        ['Unsorted to review',String(pendingUnsorted)+' row(s)']
      ].map(([label,value])=><div key={label} className="rounded-lg border border-border bg-background p-2.5">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-[12px] font-bold">{value}</p>
      </div>)}
    </div>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      These are historical, unapproved document movements. They are not bank-verified balances or Spend totals.
    </p>
    {currency!=='ZAR'||currencyReviewRequired?
      <p role="alert" className="mt-2 text-[11px] font-semibold text-destructive">
        Your currency needs review. This importer does not know whether the source
        document uses a currency other than ZAR. Verify currency before adding.
      </p>:null}
    <div className="mt-3 rounded-xl border border-border bg-muted/35 p-3 text-[11px] leading-5">
      <strong className="block text-foreground">Source date coverage</strong>
      <p className="mt-1 text-muted-foreground">{timeContextLabel(sourceTimeContext(document))} · {sourceTimeContext(document)?.basis==='explicit-period'?'Explicit statement/reporting period':sourceTimeContext(document)?.basis==='dated-rows'?'Range of dated transaction rows':sourceTimeContext(document)?.basis==='explicit-as-of'?'Document as-of date only':'No source reporting period'}</p>
      {sourceTimeContext(document)?.asOf&&<p className="mt-1 text-muted-foreground">Historical document as of {sourceTimeContext(document)?.asOf} · not a current balance</p>}
      <p className="mt-1 text-muted-foreground">Reporting periods do not date individual undated transactions. No unapproved amounts affect Spend.</p>
    </div>
    {possibleDuplicateIndices.size>0&&<p role="status" className="mt-3 rounded-xl border border-border bg-muted/45 p-3 text-[11px] leading-5">
      {possibleDuplicateIndices.size} possible duplicate source row(s) match existing approved entries by date, amount and description.
      They are excluded from bulk Prepare. Compare the original documents before selecting them manually. Nothing has been deleted or approved.
    </p>}
    {prepared.length>0&&<button type="button" disabled={!canApply} onClick={selectPrepared}
      className="mt-3 min-h-11 w-full rounded-xl border border-primary/30 bg-primary/10 px-3 text-[12px] font-semibold disabled:opacity-40">
      Prepare {prepared.length} dated, source-labelled transaction(s) for one approval
    </button>}
    {suggested.length>0&&<button type="button" disabled={!canApply}
      className="mt-2 min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-40"
      onClick={()=>{
        setDraft(old=>({...old,...Object.fromEntries(suggested.map(({index})=>[
          index,{...(old[index]??initialRow(index)),checked:true}
        ]))}));
        setError('');setFeedback('');
      }}>
      Select {suggested.length} suggested transactions
    </button>}
    <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-background/40 p-2 sm:max-h-[640px] sm:p-3">
      {document.lines.map((line,index)=>{
        const already=applied.has(index);
        const possibleRepeat=possibleDuplicateIndices.has(index);
        const blocked=documentRowBlockReason(document,line);
        const unusable=line.amount===null||line.amount===0||Boolean(blocked);
        const row=draft[index]??initialRow(index);
        const proposal=preparedDocumentReview(document,index);
        const options=row.kind?allowedDocumentCategories(row.kind):[];
        return <div key={index} className={`rounded-xl border bg-background p-3 ${row.checked ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
          <label className="flex items-start gap-2 text-[12px] font-semibold">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0"
              disabled={already||unusable||!canApply} checked={already||row.checked}
              onChange={e=>change(index,{checked:e.target.checked})}/>
            <span className="min-w-0 break-words">
              Line {index+1}: {maskDocumentPII(line.label)} · {showMoney(line.amount)}
              <span className="block text-[11px] font-normal text-muted-foreground">
                {already?(blocked?'Previously posted · review in Spend':'Already added to Spend'):blocked??(unusable?'Amount unknown or zero':
                  (line.direction==='incoming'?'Credit':line.direction==='outgoing'?'Debit':'Direction unclear')+
                  (row.kind&&row.category?' · '+EXPENSE_KINDS.find(k=>k.value===row.kind)?.label+
                    ' · '+EXPENSE_CATEGORIES.find(c=>c.value===row.category)?.label:''))}
              </span>
            </span>
          </label>
          {possibleRepeat&&!already&&<p className="mt-2 pl-6 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            Possible duplicate of a saved transaction. Compare the source before approving this row.
          </p>}
          {line.date&&<p className="mt-1 pl-6 text-[11px] text-muted-foreground">Transaction date extracted from file: <strong className="text-foreground">{line.date}</strong> · no date entry needed</p>}
          {!line.date&&<p className="mt-1 pl-6 text-[11px] text-muted-foreground">No transaction date extracted from this row. The document period is not a substitute.</p>}
          {proposal&&!already&&!unusable&&<p className="mt-1 pl-6 text-[10px] text-muted-foreground">Prepared classification: {proposal.kind} · {proposal.category}. {proposal.explanation}. Confirm before recording.</p>}
          {!already&&!unusable&&row.checked&&<div className="mt-3 grid gap-2 sm:grid-cols-3">
            {line.date?<div className="text-[11px] font-semibold">Source payment date<p className="mt-1 rounded-lg border border-border bg-muted/35 px-3 py-3 text-[12px]">{line.date}</p></div>:
            <label className="text-[11px] font-semibold">
              Missing transaction date · enter only if source proves it
              <input aria-label={'Date for imported line '+(index+1)}
                type="date" value={row.date}
                onChange={e=>change(index,{date:e.target.value})}
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-2 text-[16px]"/>
            </label>}
            <label className="text-[11px] font-semibold">
              Transaction type
              <select aria-label={'Type for imported line '+(index+1)}
                value={row.kind}
                onChange={e=>change(index,{kind:e.target.value as ExpenseKind,category:e.target.value?'unsorted':''})}
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-2 text-[13px]">
                <option value="">Choose type</option>
                {EXPENSE_KINDS.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold">
              Category
              <select aria-label={'Category for imported line '+(index+1)}
                disabled={!row.kind} value={row.category}
                onChange={e=>change(index,{category:e.target.value as ExpenseCategory})}
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-2 text-[13px]">
                <option value="">Choose category</option>
                {EXPENSE_CATEGORIES.filter(c=>options.includes(c.value))
                  .map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </div>}
        </div>;
      })}
    </div>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
      {selected.length} selected; {ready.length} available to review, {pendingUnsorted} uncategorized. This shows only
      extracted lines, not the full file. Imported entries do not update lender
      balances, current cash or the private desktop's document inventory.
    </p>
    <button type="button" disabled={selected.length===0||!canApply}
      onClick={submit}
      className="mt-2 min-h-12 w-full rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
      Approve and record {selected.length} selected source transaction(s)
    </button>
    {error&&<p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {feedback&&<p role="status" className="mt-2 text-[12px] text-muted-foreground">{feedback}</p>}
  </details>;
}
