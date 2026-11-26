import {useState} from 'react';
import {isFinanceReferenceLabel} from '@/lib/vehicleFinance';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import {preparedDocumentReview} from '@/lib/reviewSuggestions';
import {isReviewableLine} from '@/lib/reviewInbox';
import {timeContextLabel} from '@/lib/documentTimeContext';
import {type LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {
  EXPENSE_CATEGORIES,EXPENSE_KINDS,
  type ExpenseEntry,type ExpenseCategory,type ExpenseKind
} from '@/lib/monthlyExpenses';
import {
  applyReviewedDocumentToLedger,allowedDocumentCategories,separateRepeatedDocumentChoices,
  documentAppliedIndices,type ReviewedLedgerDecision
} from '@/lib/reviewedDocumentLedger';

type ReviewRow={checked:boolean;date:string;kind:ExpenseKind|'';category:ExpenseCategory|''};
type Props={
  document:LocalFinanceDocument;
  entries:ExpenseEntry[];
  currency:string;
  currencyReviewRequired:boolean;
  onApply:(entries:ExpenseEntry[])=>void;
};
const showMoney=(value:number|null)=>value===null?'Unknown amount':
  new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(value);

/** No import posts to the Spend ledger until every selected row is classified
 * by the owner and a second confirmation is given. No remote requests. */
export default function ReviewedDocumentLedger({
  document,entries,currency,currencyReviewRequired,onApply
}:Props){
  const [draft,setDraft]=useState<Record<number,ReviewRow>>({});
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const applied=documentAppliedIndices(document,entries);
  const available=document.lines.length-applied.size;
  const selected=document.lines.map((_,i)=>i).filter(i=>draft[i]?.checked&&!applied.has(i));
  const canApply=currency==='ZAR'&&!currencyReviewRequired;
  const undatedCount=document.lines.filter((line,index)=>!line.date&&!applied.has(index)&&isReviewableLine(document,line)).length;
  const preparedCandidates=document.lines.map((_,i)=>({index:i,proposal:preparedDocumentReview(document,i)}))
    .filter((item):item is {index:number;proposal:NonNullable<typeof item.proposal>}=>
      item.proposal!==null&&!applied.has(item.index));
  const checkedDuplicates=separateRepeatedDocumentChoices(document,entries,preparedCandidates.map(({index,proposal})=>({
    lineIndex:index,date:proposal.date,kind:proposal.kind,category:proposal.category
  })));
  const safePreparedIds=new Set(checkedDuplicates.accepted.map(choice=>choice.lineIndex));
  const prepared=preparedCandidates.filter(({index})=>safePreparedIds.has(index));
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
    const line=document.lines[index];
    setDraft(old=>{
      const proposed=preparedDocumentReview(document,index);
      const previous:ReviewRow=old[index]??{
        checked:false,date:line.date??'',kind:proposed?.kind??'',category:proposed?.category??''
      };
      return {...old,[index]:{...previous,...fields}};
    });
    setError('');setFeedback('');
  };
  function submit(automatic=false){
    setError('');setFeedback('');
    if(!canApply){
      setError('Review the workspace currency first. This importer labels all extracted R amounts as ZAR and does not convert other currencies.');
      return;
    }
    const decisions:ReviewedLedgerDecision[]=automatic?
      prepared.map(({index,proposal})=>({lineIndex:index,date:proposal.date,kind:proposal.kind,category:proposal.category})):
      selected.map(i=>({
        lineIndex:i,date:draft[i].date,
        kind:draft[i].kind as ExpenseKind,
        category:draft[i].category as ExpenseCategory
      }));
    try{
      const revised=applyReviewedDocumentToLedger(document,entries,decisions,currency);
      if(!window.confirm(
        'Add '+decisions.length+' individually reviewed line(s) to your encrypted Spend ledger? '+
        'These are owner-classified partial excerpts, not bank-reconciled transactions. '+
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
        {applied.size}/{document.lines.length} posted
      </span>
    </summary>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Dates printed on individual transactions are used automatically: you do not need to type them again.
      When a clearly labelled debit or credit has a usable date, Market Compass prepares
      a category suggestion for your review. Select prepared rows and approve once to record them.
      Unclear deposits, missing dates and ambiguous descriptions still need your correction.
      PDF columns may be merged or incomplete. Do not select uncertain rows.
      Loan contract terms, scheduled instalments, rates and settlement quotations
      are reference evidence only and cannot be posted as payments. Previous
      entries are never silently deleted or changed; inspect any already posted
      finance reference in the Activity ledger to correct it manually.
      Existing manually entered transactions must be checked to avoid double counting.
    </p>
    {currency!=='ZAR'||currencyReviewRequired?
      <p role="alert" className="mt-2 text-[11px] font-semibold text-destructive">
        Your currency needs review. This importer does not know whether the source
        document uses a currency other than ZAR. Verify currency before adding.
      </p>:null}
    <div className="mt-3 rounded-xl border border-border bg-muted/35 p-3 text-[11px] leading-5">
      <strong className="block text-foreground">Source date coverage</strong>
      <p className="mt-1 text-muted-foreground">{timeContextLabel(document.timeContext)} · {document.timeContext?.basis==='explicit-period'?'Explicit statement/reporting period':document.timeContext?.basis==='dated-rows'?'Date range observed in extracted lines':document.timeContext?.basis==='explicit-as-of'?'Explicit document as-of date':'No period available'}</p>
      {document.timeContext?.asOf&&<p className="mt-1 text-muted-foreground">As of {document.timeContext.asOf} · historical source reference, not a current balance</p>}
      <p className="mt-1 text-muted-foreground">A document period does not establish the payment date of an undated line. No unapproved amount is counted in Spend.</p>
    </div>
    {checkedDuplicates.needsReview.length>0&&<p role="status" className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5">
      {checkedDuplicates.needsReview.length} possible duplicate(s) from other recorded sources were excluded from prepared approval.
      Keep them as evidence, or select an individual row if this was a separate payment.
    </p>}
    {prepared.length>0&&<div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <p className="text-[12px] font-bold">{prepared.length} source-dated transaction(s) ready to confirm</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Dates, debit/credit direction, amounts and suggested categories are extracted. Confirm once to record these matching rows; you can still expand individual rows to correct categories before using manual review.</p>
      <button type="button" disabled={!canApply} onClick={()=>submit(true)}
        className="mt-3 min-h-12 w-full rounded-xl bg-primary px-3 text-[12px] font-bold text-primary-foreground disabled:opacity-40">
        Review and approve {prepared.length} extracted transaction(s)
      </button>
      <button type="button" disabled={!canApply} onClick={selectPrepared}
        className="mt-2 min-h-11 w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-[12px] font-semibold disabled:opacity-40">
        Prepare {prepared.length} dated, source-labelled transaction(s) for one approval · edit classifications
      </button>
    </div>}
    {undatedCount>0&&<p role="status" className="mt-3 rounded-xl bg-muted/35 p-3 text-[11px] leading-5 text-muted-foreground">{undatedCount} amount(s) lack an explicit transaction date. They remain document evidence for their identified reporting period, but are not posted to a particular salary day. Re-import a clearer statement/export if available. You do not need to invent a date.</p>}
    <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-background/40 p-2 sm:max-h-[640px] sm:p-3">
      {document.lines.map((line,index)=>{
        const already=applied.has(index);
        const referenceOnly=line.semanticRole==='contract-term'||line.semanticRole==='balance-reference'||
          line.semanticRole==='rate-reference'||isFinanceReferenceLabel(line.label)||
          (document.documentKind&&document.documentKind!=='unclassified'&&line.semanticRole!=='transaction');
        const oldBankRow=document.format==='pdf'&&
          document.accountProfile?.category==='bank-statement'&&
          (line.semanticRole!=='transaction'||line.date===null);
        const unusable=line.amount===null||line.amount===0||!line.date||Boolean(referenceOnly)||oldBankRow;
        const proposal=preparedDocumentReview(document,index);
        const row=draft[index]??{
          checked:false,date:line.date??'',kind:proposal?.kind??'',category:proposal?.category??''
        };
        const options=row.kind?allowedDocumentCategories(row.kind):[];
        return <div key={index} className={`rounded-xl border bg-background p-3 ${row.checked ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
          <label className="flex items-start gap-2 text-[12px] font-semibold">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0"
              disabled={already||unusable||!canApply} checked={already||row.checked}
              onChange={e=>change(index,{checked:e.target.checked})}/>
            <span className="min-w-0 break-words">
              Line {index+1}: {maskDocumentPII(line.label)} · {showMoney(line.amount)}
              <span className="block text-[11px] font-normal text-muted-foreground">
                {already?(referenceOnly?'Previously posted — review: may be a loan reference, not a payment':'Already added to Spend'):referenceOnly?'Reference figure only — not a completed payment':unusable?'Amount unknown or zero':
                  'Source direction: '+(line.direction==='unclassified'?'unconfirmed':line.direction)}
              </span>
            </span>
          </label>
          {line.date&&<p className="mt-1 pl-6 text-[11px] text-muted-foreground">Transaction date extracted from file: <strong className="text-foreground">{line.date}</strong> · no date entry needed</p>}
          {!line.date&&<p className="mt-1 pl-6 text-[11px] text-muted-foreground">No individual transaction date extracted. Kept as document-period evidence; no date entry required or allowed for posting.</p>}
          {proposal&&!already&&!unusable&&<p className="mt-1 pl-6 text-[10px] text-muted-foreground">Prepared classification: {proposal.kind} · {proposal.category}. {proposal.explanation}. Confirm before recording.</p>}
          {!already&&!unusable&&row.checked&&<div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="text-[11px] font-semibold">Source payment date<p className="mt-1 rounded-lg border border-border bg-muted/35 px-3 py-3 text-[12px]">{line.date}</p></div>
            <label className="text-[11px] font-semibold">
              Confirm transaction type
              <select aria-label={'Type for imported line '+(index+1)}
                value={row.kind}
                onChange={e=>change(index,{kind:e.target.value as ExpenseKind,category:''})}
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-2 text-[13px]">
                <option value="">Choose type</option>
                {EXPENSE_KINDS.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold">
              Confirm category
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
      {selected.length} selected; {available} not yet added. This shows only
      extracted lines, not the full file. Imported entries do not update lender
      balances, current cash or the private desktop's document inventory.
    </p>
    <button type="button" disabled={selected.length===0||!canApply}
      onClick={()=>submit(false)}
      className="mt-2 min-h-12 w-full rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
      Approve and record {selected.length} selected source transaction(s)
    </button>
    {error&&<p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {feedback&&<p role="status" className="mt-2 text-[12px] text-muted-foreground">{feedback}</p>}
  </details>;
}
