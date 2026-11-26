import {useState} from 'react';
import {IonCard,IonAccordionGroup,IonAccordion,IonItem,IonLabel} from '@ionic/react';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {EXPENSE_CATEGORIES,salaryCycle,type ExpenseEntry,type ExpenseCategory} from '@/lib/monthlyExpenses';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import {spendingCycleSummaries} from '@/lib/spendingCycleSummaries';

type Props={entries:ExpenseEntry[];documents:LocalFinanceDocument[];currency:string};
const zar=(n:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',minimumFractionDigits:2,maximumFractionDigits:2
}).format(n);
const labelOf=(category:ExpenseCategory)=>EXPENSE_CATEGORIES.find(item=>item.value===category)?.label??'Other';
const cycleTitle=(start:string)=>{
  const range=salaryCycle(start);
  const display=(day:string)=>new Date(day+'T00:00:00Z').toLocaleDateString('en-ZA',{
    day:'numeric',month:'short',year:'numeric',timeZone:'UTC'
  });
  return display(range.start)+' – '+display(range.lastDay);
};
const sourceId=(entry:ExpenseEntry,documents:LocalFinanceDocument[])=>
  documents.find(doc=>entry.id.startsWith('doc-'+doc.id+'-'))?.id??'manual';

/** Portfolio-like category drilldown. Uses recorded/approved Spend entries ONLY. */
export default function SpendingPortfolio({entries,documents,currency}:Props){
  const [period,setPeriod]=useState('all');
  const [account,setAccount]=useState('all');
  const cycles=[...new Set(entries.map(item=>{
    try{return salaryCycle(item.date).start;}catch{return null;}
  }).filter((v):v is string=>Boolean(v)))].sort().reverse();
  const timeline=spendingCycleSummaries(entries.filter(item=>account==='all'||sourceId(item,documents)===account),6);
  const timelineMax=Math.max(1,...timeline.map(point=>point.spending));
  const filtered=entries.filter(item=>{
    if(item.currency!=='ZAR'||!Number.isFinite(item.amount))return false;
    if(account!=='all'&&sourceId(item,documents)!==account)return false;
    if(period!=='all'){
      try{if(salaryCycle(item.date).start!==period)return false;}catch{return false;}
    }
    return true;
  });
  const spending=filtered.filter(item=>item.kind==='expense'||item.kind==='debt-payment');
  const total=spending.reduce((sum,item)=>sum+item.amount,0);
  const income=filtered.filter(item=>item.kind==='income').reduce((sum,item)=>sum+item.amount,0);
  const debt=filtered.filter(item=>item.kind==='debt-payment').reduce((sum,item)=>sum+item.amount,0);
  const categories=[...new Set(spending.map(item=>item.category))].map(category=>{
    const items=spending.filter(item=>item.category===category).sort((a,b)=>b.date.localeCompare(a.date));
    return {category,items,total:items.reduce((sum,item)=>sum+item.amount,0)};
  }).sort((a,b)=>b.total-a.total);
  return <IonCard role="region" aria-label="Spending portfolio" className="mc-ionic-surface rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Spend insights</p>
        <h2 className="mt-1 text-[19px] font-bold">Your spending portfolio</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Tap a category to explore purchases and repayments. Amounts come only from your recorded or approved dated transactions.</p>
      </div>
      <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold">{spending.length} transactions</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <label className="text-[11px] font-semibold">Salary cycle
        <select aria-label="Spending portfolio salary cycle" value={period} onChange={e=>setPeriod(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-2 text-[12px]">
          <option value="all">All recorded history</option>
          {cycles.map(c=><option key={c} value={c}>{cycleTitle(c)}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold">Account / source
        <select aria-label="Spending portfolio account" value={account} onChange={e=>setAccount(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-2 text-[12px]">
          <option value="all">All sources</option><option value="manual">Manual records</option>
          {documents.map(doc=><option key={doc.id} value={doc.id}>{maskDocumentPII(doc.label).slice(0,44)}</option>)}
        </select>
      </label>
    </div>
    {timeline.length>0&&<section aria-label="Historical spending by salary cycle" className="mt-4 rounded-[19px] border border-border bg-background p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold">Spending by salary cycle</h3>
        <button type="button" onClick={()=>setPeriod('all')}
          className="min-h-9 rounded-lg border border-border px-2.5 text-[11px] font-semibold">All history</button>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Tap a cycle to see its recorded transactions below. Historical imported spending appears here after approval, not when a file is merely extracted.
      </p>
      <div className="mt-3 space-y-2">{timeline.map(point=><button type="button" key={point.start}
        aria-pressed={period===point.start} onClick={()=>setPeriod(point.start)}
        className={`w-full rounded-xl border p-2.5 text-left transition-colors ${period===point.start?'border-primary bg-primary/5':'border-border hover:bg-muted/40'}`}>
        <span className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold">{cycleTitle(point.start)}</span>
          <span className="font-bold tabular-nums">{zar(point.spending)}</span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="block h-full rounded-full bg-primary/80" style={{width:point.spending?Math.max(2,point.spending/timelineMax*100)+'%':'0%'}}/>
        </span>
        <span className="mt-1 block text-[10px] text-muted-foreground">{point.expenseCount} recorded purchases/repayments · {zar(point.income)} recorded income</span>
      </button>)}</div>
    </section>}
    <div className="mt-4 rounded-[19px] bg-primary px-4 py-5 text-primary-foreground">
      <p className="text-[12px] font-medium opacity-80">Recorded spending and debt repayments</p>
      <strong className="mt-1 block text-[27px] font-bold tracking-tight">{currency==='ZAR'?zar(total):'ZAR review required'}</strong>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-primary-foreground/20 pt-3 text-[11px]">
        <div><span className="block opacity-70">Income recorded</span><strong className="text-[15px]">{zar(income)}</strong></div>
        <div><span className="block opacity-70">Debt repayments included</span><strong className="text-[15px]">{zar(debt)}</strong></div>
      </div>
    </div>
    {categories.length===0?<p className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-[12px] leading-5 text-muted-foreground">
      No approved transactions in this view. Historical statement evidence does not automatically become a bank-verified transaction.
      Open a saved document to approve eligible dated rows once, or import a new document and approve it.
    </p>:<div className="mt-4 space-y-2">
      <h3 className="text-[13px] font-bold">Purchases by category</h3>
      <IonAccordionGroup multiple={true} className="mc-spend-category-list">
      {categories.map(group=><IonAccordion key={group.category} value={group.category} className="mc-spend-category">
        <IonItem slot="header" lines="none" className="mc-spend-category-header">
          <IonLabel>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-bold">{labelOf(group.category)} <small className="ml-1 text-[10px] font-normal text-muted-foreground">({group.items.length})</small></span>
              <strong className="text-[13px]">{zar(group.total)}</strong>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{width:total?Math.max(2,group.total/total*100)+'%':'0%'}}/>
            </div>
          </IonLabel>
        </IonItem>
        <div slot="content" className="space-y-2 border-t border-border bg-card px-3 py-3">
          {group.items.map(item=><div key={item.id} className="flex items-start justify-between gap-3 text-[11px]">
            <div className="min-w-0"><span className="block break-words font-semibold">{maskDocumentPII(item.description)}</span>
              <span className="block text-muted-foreground">{item.date} · {item.kind==='debt-payment'?'Debt repayment':'Expense'} · {maskDocumentPII(documents.find(doc=>doc.id===sourceId(item,documents))?.label??item.paidVia).slice(0,50)}</span>
            </div><strong className="shrink-0">{zar(item.amount)}</strong>
          </div>)}
        </div>
      </IonAccordion>)}
      </IonAccordionGroup>
    </div>}
    <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
      Internal transfers are excluded. This is a locally recorded, unverified spending history, not a bank statement or live balance.
      Cross-source duplicates may require review.
    </p>
  </IonCard>;
}
