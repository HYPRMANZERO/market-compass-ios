import {useMemo,useState} from 'react';
import {CheckCircle2,RotateCcw} from 'lucide-react';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';
import {EXPENSE_CATEGORIES,EXPENSE_KINDS} from '@/lib/monthlyExpenses';
import {suggestSavedCategoryChanges,type SavedCategorySuggestion} from '@/lib/savedCategoryReview';
import {maskDocumentPII} from '@/lib/documentIntelligence';

type Props={entries:ExpenseEntry[];currency:string;onApprove:(choices:SavedCategorySuggestion[])=>void};
const categoryName=(id:string)=>EXPENSE_CATEGORIES.find(x=>x.value===id)?.label??id;
const kindName=(id:string)=>EXPENSE_KINDS.find(x=>x.value===id)?.label??id;
const amount=(n:number,currency:string)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(n);

export default function SavedCategoryReview({entries,currency,onApprove}:Props){
 const proposals=useMemo(()=>suggestSavedCategoryChanges(entries),[entries]);
 const [excluded,setExcluded]=useState<Set<string>>(()=>new Set());
 const [notice,setNotice]=useState('');
 const selected=proposals.filter(p=>!excluded.has(p.id));
 const approve=()=>{
   if(!selected.length)return;
   try{
     onApprove(selected);
     setExcluded(new Set());
     setNotice('Approved category updates saved in this encrypted workspace. Dates, amounts and source records were not changed.');
   }catch(e){setNotice(e instanceof Error?e.message:'Unable to apply category review.');}
 };
 return <details className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Re-sort saved transactions">
   <summary className="flex min-h-10 cursor-pointer items-center gap-3 text-[13px] font-bold">
     <RotateCcw size={17} className="shrink-0 text-primary"/>
     <span className="flex-1">Re-sort saved transactions</span>
     <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{proposals.length} suggestions</span>
   </summary>
   <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
     Review categories on transactions already in this encrypted vault, including approved document lines.
     This checks their saved payment descriptions; it does not require another upload or alter the original dates or amounts.
   </p>
   {proposals.length===0?<p className="mt-3 rounded-xl bg-muted/50 p-3 text-[12px] text-muted-foreground">
     No confident category corrections identified. Unclear payments remain unchanged.
   </p>:<>
     <div className="mt-3 max-h-[310px] space-y-2 overflow-y-auto overscroll-contain" aria-label="Suggested category corrections">
       {proposals.map(p=><label key={p.id} className="flex cursor-pointer gap-3 rounded-xl border border-border/75 px-3 py-3 text-[12px]">
         <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={!excluded.has(p.id)}
           onChange={e=>setExcluded(old=>{const next=new Set(old);if(e.target.checked)next.delete(p.id);else next.add(p.id);return next;})}/>
         <span className="min-w-0 flex-1">
           <span className="block break-words font-semibold">{maskDocumentPII(p.description)}</span>
           <span className="mt-1 block text-muted-foreground">{p.date} · {amount(p.amount,currency)}</span>
           <span className="mt-1 block">{kindName(p.previousKind)} / {categoryName(p.previousCategory)} → <strong>{kindName(p.kind)} / {categoryName(p.category)}</strong></span>
           <span className="mt-1 block text-[11px] text-muted-foreground">{p.reason}</span>
         </span>
       </label>)}
     </div>
     <button type="button" disabled={!selected.length} onClick={approve}
       className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[12px] font-bold text-primary-foreground disabled:opacity-40">
       <CheckCircle2 size={17}/> Approve {selected.length} category {selected.length===1?'change':'changes'}
     </button>
   </>}
   {notice&&<p role="status" className="mt-2 text-[11px] leading-5 text-muted-foreground">{notice}</p>}
   <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
     No new payment is created. Ambiguous debit orders, refunds and transfers remain for manual review.
   </p>
 </details>;
}
