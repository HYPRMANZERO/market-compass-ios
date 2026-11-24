import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ChevronLeft,ChevronRight,Filter,RotateCcw,ShieldCheck} from 'lucide-react';
import type {ExpenseCategory,ExpenseEntry} from '@/lib/monthlyExpenses';
import {EXPENSE_CATEGORIES,EXPENSE_KINDS,expenseCategoryNeedsSorting} from '@/lib/monthlyExpenses';
import {allowedSavedCategory} from '@/lib/savedCategoryReview';
import {
  scanSavedCategories,categoryReviewPage,type SavedCategoryScan,type SavedCategorySuggestion
} from '@/lib/savedCategoryReview';
import {regionalPackInfo} from '@/lib/regionalSpendRules';
import {maskDocumentPII} from '@/lib/documentIntelligence';

type Props={
  entries:ExpenseEntry[];
  currency:string;
  region:string;
  onApprove:(choices:SavedCategorySuggestion[])=>void;
  onManualCategorize:(entryId:string,category:ExpenseCategory)=>void;
};
const PAGE_SIZE=8;
const categoryName=(id:string)=>EXPENSE_CATEGORIES.find(x=>x.value===id)?.label??id;
const kindName=(id:string)=>EXPENSE_KINDS.find(x=>x.value===id)?.label??id;
const amount=(n:number,currency:string)=>{
  try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(n);}
  catch{return currency+' '+n.toFixed(2);}
};

export default function SavedCategoryReview({entries,currency,region,onApprove,onManualCategorize}:Props){
  const [scan,setScan]=useState<SavedCategoryScan|null>(null);
  const [excluded,setExcluded]=useState<Set<string>>(()=>new Set());
  const [manualChoices,setManualChoices]=useState<Record<string,ExpenseCategory|''>>({});
  const [mode,setMode]=useState<'suggested'|'unresolved'>('suggested');
  const [page,setPage]=useState(0);
  const [notice,setNotice]=useState('');
  // Keep the review queue current after a manual category is saved.
  // A region change still invalidates the old scan and needs an explicit rerun.
  useEffect(()=>{
    setScan(previous=>previous&&previous.region===region
      ?scanSavedCategories(entries,region):previous);
  },[entries]);
  const summary=regionalPackInfo(region);
  const stale=scan!==null&&scan.region!==region;
  const suggestedIds=useMemo(()=>new Set(scan?.proposals.map(item=>item.id)??[]),[scan]);
  const unresolved=useMemo(()=>scan?entries
    .filter(entry=>expenseCategoryNeedsSorting(entry.category)&&!suggestedIds.has(entry.id))
    .sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt)):[],
    [entries,scan,suggestedIds]);
  const items:Array<SavedCategorySuggestion|ExpenseEntry>=mode==='suggested'?(scan?.proposals??[]):unresolved;
  const pageInfo=categoryReviewPage(items,page,PAGE_SIZE);
  const {pages,start,items:visible}=pageInfo;
  const currentPage=pageInfo.page;
  const visibleSuggestions=visible.filter((item):item is SavedCategorySuggestion=>'previousKind' in item);
  const visibleUnresolved=visible.filter((item):item is ExpenseEntry=>'recordedAt' in item);
  const currentSuggestions=mode==='suggested'?
    visibleSuggestions.filter(p=>!excluded.has(p.id)):[];
  const button='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-[12px] font-bold disabled:opacity-40';
  const startScan=()=>{
    const result=scanSavedCategories(entries,region);
    setScan(result);setExcluded(new Set());setManualChoices({});setPage(0);
    setMode(result.proposals.length?'suggested':'unresolved');
    setNotice(result.proposals.length
      ?result.proposals.length+' candidate correction(s) found. Inspect each page before approving.'
      :'Scan complete. No confident automatic matches; inspect the unresolved list.');
  };
  const approve=()=>{
    if(!currentSuggestions.length||stale)return;
    try{
      onApprove(currentSuggestions);
      // Keep the queue on screen. The entries-change effect recalculates it
      // after the encrypted workspace persists this approved page.
      setExcluded(new Set());
      setNotice(currentSuggestions.length+' approved change(s) submitted to the encrypted vault. Remaining suggestions stay available; use Next or Needs your decision to continue.');
    }catch(e){setNotice(e instanceof Error?e.message:'Unable to approve category changes.');}
  };
  const saveManual=(entry:ExpenseEntry)=>{
    const category=manualChoices[entry.id];
    if(!category||!allowedSavedCategory(entry.kind,category)){
      setNotice('Choose a valid category first.');return;
    }
    try{
      onManualCategorize(entry.id,category);
      setManualChoices({});
      setNotice('Manually chosen category saved. The remaining items are still available. Use Next to continue reviewing.');
    }catch(e){setNotice(e instanceof Error?e.message:'Unable to save the chosen category.');}
  };
  return <section className="mb-4 min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Review uncategorized saved payments">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-[14px] font-bold">
          <Filter size={17} className="shrink-0 text-primary"/> Review uncategorized payments
        </h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Scan saved transactions using global financial terminology plus {summary.country} rules.
          Payment rails are not categories. All updates require your approval.
        </p>
      </div>
      <button type="button" onClick={startScan} className={button+' bg-primary text-primary-foreground'} aria-label="Scan saved payments for categories">
        <RotateCcw size={16}/> Scan saved payments
      </button>
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">
      Region: <strong>{summary.country}</strong>. Change country under Debt Plan → Monthly guardrails. Your planning currency is {currency}; each row displays its original currency. Changing country selects a currency default but never converts existing amounts.
    </p>
    {!scan?<p className="mt-3 rounded-xl bg-muted/40 p-3 text-[12px] text-muted-foreground">
      No scan results displayed. Tap <strong>Scan saved payments</strong> to inspect existing records. Already-categorized transactions will not be overwritten.
    </p>:<div className="mt-3 space-y-3">
      {stale&&<p role="alert" className="rounded-xl border border-destructive/30 p-3 text-[12px] text-destructive">
        Region changed since this scan. Run the scan again before approving.
      </p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 p-2"><strong className="block text-[19px] tabular-nums">{scan.checked}</strong><span className="text-[10px] text-muted-foreground">Checked</span></div>
        <div className="rounded-xl bg-muted/40 p-2"><strong className="block text-[19px] tabular-nums">{scan.proposals.length}</strong><span className="text-[10px] text-muted-foreground">Suggested</span></div>
        <div className="rounded-xl bg-muted/40 p-2"><strong className="block text-[19px] tabular-nums">{unresolved.length}</strong><span className="text-[10px] text-muted-foreground">Need your decision</span></div>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Category review mode">
        <button type="button" className={button+(mode==='suggested'?' border-primary bg-primary/10 text-primary':'')}
          aria-pressed={mode==='suggested'} onClick={()=>{setMode('suggested');setPage(0);}}>
          Suggested ({scan.proposals.length})
        </button>
        <button type="button" className={button+(mode==='unresolved'?' border-primary bg-primary/10 text-primary':'')}
          aria-pressed={mode==='unresolved'} onClick={()=>{setMode('unresolved');setPage(0);}}>
          Needs your decision ({unresolved.length})
        </button>
      </div>
      {items.length===0?<p className="rounded-xl bg-muted/35 p-3 text-[12px] text-muted-foreground">
        {mode==='suggested'?'No confident matching references in this group. Choose Needs your decision for manually sorting unclear references.':'All currently uncategorized references have a suggested match.'}
      </p>:<>
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          Showing <strong>{start+1}–{Math.min(start+visible.length,items.length)}</strong> of {items.length} {mode==='suggested'?'suggestions':'uncategorized entries'}
          {' · '}Page {currentPage+1} of {pages}
        </p>
        <div className="space-y-2" aria-label={mode==='suggested'?'Suggested category corrections':'Unresolved payments to review'}>
          {mode==='suggested'?visibleSuggestions.map(p=>
            <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/75 px-3 py-3 text-[12px]">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={!excluded.has(p.id)}
                onChange={e=>setExcluded(old=>{const next=new Set(old);if(e.target.checked)next.delete(p.id);else next.add(p.id);return next;})}/>
              <span className="min-w-0 flex-1">
                <strong className="block break-words">{maskDocumentPII(p.description)}</strong>
                <span className="mt-1 block text-[11px] text-muted-foreground">{p.date} · {amount(p.amount,p.currency)}</span>
                <span className="mt-1 block">{kindName(p.previousKind)} / {categoryName(p.previousCategory)}
                  {' → '}<strong>{kindName(p.kind)} / {categoryName(p.category)}</strong>
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{p.reason}</span>
                {p.kind!==p.previousKind&&<span className="mt-1 block text-[11px] font-semibold text-primary">
                  Movement type changes: verify it was a completed transfer or debt payment
                </span>}
              </span>
            </label>):visibleUnresolved.map(entry=>
            <div key={entry.id} className="rounded-xl border border-border/75 px-3 py-3 text-[12px]">
              <strong className="block break-words">{maskDocumentPII(entry.description)}</strong>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {entry.date} · {amount(entry.amount,entry.currency)} · {kindName(entry.kind)} · No confident matching category
              </span>
              <label className="mt-2 block text-[11px] font-semibold">Choose a category for this entry
                <select value={manualChoices[entry.id]??''}
                  onChange={e=>setManualChoices(old=>({...old,[entry.id]:e.target.value as ExpenseCategory|''}))}
                  aria-label={'Manual category for '+maskDocumentPII(entry.description)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-[16px]">
                  <option value="">Choose category</option>
                  {EXPENSE_CATEGORIES.filter(c=>c.value!=='other'&&c.value!=='unsorted'&&allowedSavedCategory(entry.kind,c.value))
                    .map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <button type="button" className={button+' mt-2 w-full'} disabled={!manualChoices[entry.id]||stale}
                onClick={()=>saveManual(entry)}>
                <CheckCircle2 size={15}/>Save this category
              </button>
            </div>)}
        </div>
        <div className="flex items-center justify-between gap-2" role="group" aria-label="Category review pagination">
          <button type="button" className={button+' min-w-0 flex-1'} disabled={currentPage===0} onClick={()=>setPage(Math.max(0,currentPage-1))}>
            <ChevronLeft size={15}/>Previous
          </button>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums">{currentPage+1} / {pages}</span>
          <button type="button" className={button+' min-w-0 flex-1'} disabled={currentPage>=pages-1} onClick={()=>setPage(Math.min(pages-1,currentPage+1))}>
            Next<ChevronRight size={15}/>
          </button>
        </div>
        {mode==='suggested'&&<button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[12px] font-bold text-primary-foreground disabled:opacity-40"
          onClick={approve} disabled={!currentSuggestions.length||stale}>
          <CheckCircle2 size={17}/>Approve {currentSuggestions.length} selected on this page
        </button>}
      </>}
    </div>}
    {notice&&<p role="status" className="mt-3 rounded-xl bg-muted/40 p-3 text-[11px] leading-5">{notice}</p>}
    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
      <ShieldCheck size={14} className="mt-0.5 shrink-0"/>
      No bank access, automatic transaction creation or silent edits. Ambiguous debit orders, refunds, rails and merchant references stay available for manual review.
    </p>
  </section>;
}
