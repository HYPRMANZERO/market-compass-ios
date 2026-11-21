import {useState} from 'react';
import {type LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {
  EXPENSE_CATEGORIES,EXPENSE_KINDS,
  type ExpenseEntry,type ExpenseCategory,type ExpenseKind
} from '@/lib/monthlyExpenses';
import {
  applyReviewedDocumentToLedger,allowedDocumentCategories,
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
  const change=(index:number,fields:Partial<ReviewRow>)=>{
    const line=document.lines[index];
    setDraft(old=>({
      ...old,[index]:{checked:false,date:line.date??'',kind:'',category:'',...old[index],...fields}
    }));
    setError('');setFeedback('');
  };
  function submit(){
    setError('');setFeedback('');
    if(!canApply){
      setError('Review the workspace currency first. This importer labels all extracted R amounts as ZAR and does not convert other currencies.');
      return;
    }
    const decisions:ReviewedLedgerDecision[]=selected.map(i=>({
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
  return <details className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
    <summary className="min-h-11 cursor-pointer text-[12px] font-semibold">
      Review and add to Spend · {applied.size} of {document.lines.length} already added
    </summary>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Saving a document stores excerpts, but does not create transaction entries.
      To update your Spend ledger, select each relevant line, verify its date and
      amount against the original file, then choose its type and category.
      PDF columns may be merged or incomplete. Do not select uncertain rows.
      Existing manually entered transactions must be checked to avoid double counting.
    </p>
    {currency!=='ZAR'||currencyReviewRequired?
      <p role="alert" className="mt-2 text-[11px] font-semibold text-destructive">
        Your currency needs review. This importer does not know whether the source
        document uses a currency other than ZAR. Verify currency before adding.
      </p>:null}
    <div className="mt-3 space-y-3">
      {document.lines.map((line,index)=>{
        const already=applied.has(index);
        const unusable=line.amount===null||line.amount===0;
        const row=draft[index]??{
          checked:false,date:line.date??'',kind:'' as const,category:'' as const
        };
        const options=row.kind?allowedDocumentCategories(row.kind):[];
        return <div key={index} className="rounded-lg border border-border bg-background p-3">
          <label className="flex items-start gap-2 text-[12px] font-semibold">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0"
              disabled={already||unusable||!canApply} checked={already||row.checked}
              onChange={e=>change(index,{checked:e.target.checked})}/>
            <span className="min-w-0 break-words">
              Line {index+1}: {line.label} · {showMoney(line.amount)}
              <span className="block text-[11px] font-normal text-muted-foreground">
                {already?'Already added to Spend':unusable?'Amount unknown or zero':
                  'Source direction: '+(line.direction==='unclassified'?'unconfirmed':line.direction)}
              </span>
            </span>
          </label>
          {!already&&!unusable&&row.checked&&<div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-semibold">
              Confirm date
              <input aria-label={'Date for imported line '+(index+1)}
                type="date" value={row.date}
                onChange={e=>change(index,{date:e.target.value})}
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-2 text-[16px]"/>
            </label>
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
      onClick={submit}
      className="mt-2 min-h-12 w-full rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
      Review confirmation and add {selected.length} selected line(s) to Spend
    </button>
    {error&&<p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    {feedback&&<p role="status" className="mt-2 text-[12px] text-muted-foreground">{feedback}</p>}
  </details>;
}
