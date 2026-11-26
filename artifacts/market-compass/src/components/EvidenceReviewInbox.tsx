import {ArrowRight,CheckCircle2,ClipboardCheck,FileClock,FileText,ShieldAlert} from 'lucide-react';
import {Link} from 'wouter';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import {reviewInbox} from '@/lib/reviewInbox';
import {groupedDocumentReview} from '@/lib/reviewGroups';
import {timeContextLabel} from '@/lib/documentTimeContext';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import type {ExpenseEntry} from '@/lib/monthlyExpenses';

type Props={
 documents:LocalFinanceDocument[];
 entries:ExpenseEntry[];
 currency:string;
 currencyReviewRequired:boolean;
};

/** Monarch-style review inbox, built from private approved/local evidence only.
 * No new storage, remote request, automated classification or bank OAuth. */
export default function EvidenceReviewInbox({documents,entries,currency,currencyReviewRequired}:Props){
 const summary=reviewInbox(documents,entries);
 const blocked=currency!=='ZAR'||currencyReviewRequired;
 return <section className="mc-evidence-inbox rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5"
   aria-label="Financial evidence review inbox">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-extrabold tracking-tight">
       <ClipboardCheck size={19} className="shrink-0 text-primary" aria-hidden="true"/> Needs review
     </h2>
     <Link href="/expenses" className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border px-3 text-[11px] font-bold text-primary">
       Open Spend <ArrowRight size={14} aria-hidden="true"/>
     </Link>
   </div>
   <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
     Saved document excerpts are not yet transactions. Review dates, directions and currency before approving any entry.
   </p>
   <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Review counts">
     <div className="min-w-0 rounded-[15px] bg-muted/60 px-2.5 py-3 text-center">
       <strong className="block text-[21px] font-extrabold tabular-nums">{summary.needsReview}</strong>
       <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">Excerpts to check</span>
     </div>
     <div className="min-w-0 rounded-[15px] bg-muted/60 px-2.5 py-3 text-center">
       <strong className="block text-[21px] font-extrabold tabular-nums">{summary.approved}</strong>
       <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">Added from files</span>
     </div>
     <div className="min-w-0 rounded-[15px] bg-muted/60 px-2.5 py-3 text-center">
       <strong className="block text-[21px] font-extrabold tabular-nums">{summary.documents}</strong>
       <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">Saved documents</span>
     </div>
   </div>
   {blocked&&<p role="status" className="mt-3 flex gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[11px] leading-5">
     <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>
     Check your workspace currency before adding ZAR statement excerpts to Spend. No conversion is assumed.
   </p>}
   {summary.documents>0&&<details className="mt-3 rounded-xl border border-border px-3 py-3" aria-label="Grouped document review by source period">
     <summary className="cursor-pointer text-[12px] font-semibold">Review groups · financial periods</summary>
     <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Source groups use dated transaction excerpts when available. Undated files are grouped separately by import month. Reporting periods and as-of references are not proof that a payment occurred; approval remains in Spend.</p>
     <div className="mt-3 space-y-2">{groupedDocumentReview(summary.items).map(group=><details key={group.month} className="rounded-xl bg-muted/40 p-3">
       <summary className="cursor-pointer text-[12px] font-semibold">{group.month} · {group.documents.length} files · {group.needsReview} excerpts to check</summary>
       <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{group.basis==='source-period'?'Source-dated history (not a posting date)':group.basis==='as-of'?'As-of reference (not a transaction date)':group.basis==='imported'?'Imported in this month; source period unavailable':'Source and import dates unavailable'}</p>
       <ul className="mt-2 space-y-2">{group.documents.map(doc=><li key={doc.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-card p-2 text-[11px]">
         <div className="min-w-0 flex-1"><strong className="block break-words">{maskDocumentPII(doc.label)}</strong>
           <p className="mt-1 text-[10px] text-muted-foreground">{doc.needsReview} to check · {doc.approved} approved · {doc.undated} undated · {doc.format.toUpperCase()}</p>
           <p className="mt-1 text-[10px] text-muted-foreground">Source period: {timeContextLabel(doc.timeContext)}</p>
         </div>
         <Link href="/expenses" className="shrink-0 rounded-lg border border-border px-2 py-2 text-[11px] font-semibold">Review in Spend</Link>
       </li>)}</ul>
     </details>)}</div>
   </details>}
   {summary.documents===0?
     <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-muted/35 px-3 py-3">
       <FileText size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true"/>
       <p className="text-[11px] leading-5 text-muted-foreground">
         Nothing imported yet. Choose financial files in Spend to build your private review inbox.
       </p>
     </div>:
     <details className="mt-3 rounded-xl border border-border px-3 py-2.5">
       <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-2 text-[12px] font-semibold">
         <span>Review by document</span>
         <span className="text-[10px] font-normal text-muted-foreground">
           {summary.items.filter(item=>item.needsReview>0).length} with unchecked excerpts
         </span>
       </summary>
       <ul className="mt-2 space-y-2 border-t border-border pt-2">
         {summary.items.slice(0,5).map(doc=><li key={doc.id} className="rounded-xl bg-muted/40 px-3 py-2.5">
           <div className="flex min-w-0 items-start gap-2">
             {doc.needsReview?<FileClock size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true"/>:
               <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true"/>}
             <span className="min-w-0 flex-1">
               <strong className="block break-words text-[11px] font-bold">{maskDocumentPII(doc.label)}</strong>
               <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                 {doc.needsReview} to check · {doc.approved} added · {doc.format.toUpperCase()}
               </span>
               {doc.undated>0&&<span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                 {doc.undated} excerpt(s) without a confirmed date
               </span>}
               <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar"
                 aria-label={'Approved excerpts for '+maskDocumentPII(doc.label)}
                 aria-valuemin={0} aria-valuemax={doc.reviewable||1} aria-valuenow={doc.approved}>
                 <div className="h-full rounded-full bg-[hsl(165,79%,32%)]"
                   style={{width:(doc.reviewable?doc.approved/doc.reviewable*100:0)+'%'}}/>
               </div>
             </span>
           </div>
         </li>)}
         {summary.items.length>5&&<li className="text-[10px] text-muted-foreground">
           {summary.items.length-5} additional saved document(s) · View all in Spend
         </li>}
       </ul>
     </details>}
   <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
     {summary.referenceOnly} reference or unusable line(s) excluded from the queue.
     {' '}Items needing review are possible excerpts, not verified payments.
     Only the Spend reviewer can add transactions after your confirmation.
   </p>
 </section>;
}
