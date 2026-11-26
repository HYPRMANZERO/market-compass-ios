import {useState} from 'react';
import {IonButton,IonCard,IonCardContent,IonChip,IonItem,IonLabel,IonList,IonSegment,IonSegmentButton} from '@ionic/react';
import type {ExpenseEntry,ExpenseKind} from '@/lib/monthlyExpenses';
import {maskDocumentPII} from '@/lib/documentIntelligence';

type Props={entries:ExpenseEntry[];currency:string;debtAccounts?:{id:string;name:string;balance:string}[];onOpenDocuments:()=>void};
const zar=(amount:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(amount);

/** Main Ionic Spend activity. Reads existing approved encrypted-vault props; does not
 * approve, migrate, upload or duplicate financial entries. */
export default function IonicSpendPreview({entries,currency,debtAccounts=[],onOpenDocuments}:Props){
  const [filter,setFilter]=useState<'all'|ExpenseKind>('all');
  const valid=entries.filter(entry=>entry.currency==='ZAR'&&Number.isFinite(entry.amount)&&entry.amount>0);
  const spending=valid.filter(entry=>entry.kind==='expense'||entry.kind==='debt-payment');
  const income=valid.filter(entry=>entry.kind==='income');
  const transfers=valid.filter(entry=>entry.kind==='transfer');
  const visible=valid.filter(entry=>filter==='all'||entry.kind===filter)
    .sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  const total=spending.reduce((sum,item)=>sum+item.amount,0);
  const savedDebtTotal=debtAccounts.reduce((sum,account)=>sum+(Number(account.balance)||0),0);
  const formatted=(value:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(value);
  return <section className="mc-ionic-finance mb-4" aria-label="Ionic spending dashboard">
    <div className="mb-3 px-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your transactions</p>
      <h2 className="mt-1 text-[20px] font-bold">Spend overview</h2>
    </div>
    <IonCard className="mc-ionic-finance-card">
      <IonCardContent>
        <p className="mc-finance-eyebrow">Recorded spending · historical</p>
        <strong className="mc-finance-total">{currency!=='ZAR'?'Review currency':spending.length?zar(total):'Not recorded'}</strong>
        <p className="mc-finance-helper">{spending.length?`${spending.length} approved purchases and debt repayments. Not a live bank balance.`:'No spending approved in this local vault. Another Market Compass PWA or Safari origin may hold a separate encrypted workspace.'}</p>
        <div className="mc-finance-metrics">
          <div><span>Income recorded</span><strong>{zar(income.reduce((sum,item)=>sum+item.amount,0))}</strong></div>
          <div><span>Transfers excluded</span><strong>{transfers.length}</strong></div>
        </div>
      </IonCardContent>
    </IonCard>
    <IonCard className="mc-ionic-finance-card mt-3">
      <IonCardContent>
        <div className="mb-3">
          <h3 className="text-[16px] font-bold">Recent activity</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">Choose a transaction type to filter your saved history.</p>
        </div>
        <IonSegment scrollable value={filter} aria-label="Transaction type" onIonChange={event=>{
          const value=String(event.detail.value);
          setFilter(value==='expense'||value==='income'||value==='debt-payment'||value==='transfer'?value:'all');
        }}>
          <IonSegmentButton value="all"><IonLabel>All</IonLabel></IonSegmentButton>
          <IonSegmentButton value="expense"><IonLabel>Purchases</IonLabel></IonSegmentButton>
          <IonSegmentButton value="income"><IonLabel>Income</IonLabel></IonSegmentButton>
          <IonSegmentButton value="debt-payment"><IonLabel>Debt</IonLabel></IonSegmentButton>
        </IonSegment>
        {filter==='debt-payment'&&<div className="mb-3 rounded-xl border border-primary/20 bg-primary/[.055] p-3" aria-label="Saved debt balance summary">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saved debt balances · same as Home</p>
          <strong className="mt-1 block text-[22px] font-extrabold">{debtAccounts.length?formatted(savedDebtTotal):"Not entered"}</strong>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Outstanding debt in your local plan, not a recorded repayment or live bank balance. Actual repayments appear separately below.</p>
          {debtAccounts.length>0&&<div className="mt-2 space-y-1 border-t border-border/60 pt-2">
            {debtAccounts.map(account=><div key={account.id} className="flex justify-between gap-3 text-[12px]"><span className="min-w-0 truncate">{account.name||"Unnamed debt account"}</span><strong className="shrink-0">{formatted(Number(account.balance)||0)}</strong></div>)}
          </div>}
        </div>}
        {visible.length===0?<div className="mc-ionic-finance-empty">
          <p className="font-semibold">No approved transactions in this view</p>
          <p className="mt-1">Review a saved financial document to add its verified source-dated transactions, or record a purchase manually.</p>
        </div>:<IonList className="mc-ionic-finance-list">
          {visible.slice(0,15).map(item=><IonItem key={item.id} lines="full">
            <IonLabel className="ion-text-wrap">
              <h3>{maskDocumentPII(item.description)}</h3>
              <p>{item.date} · {item.category.replaceAll('-',' ')}</p>
            </IonLabel>
            <strong slot="end" className="mc-finance-row-amount">{zar(item.amount)}</strong>
          </IonItem>)}
        </IonList>}
        {visible.length>15&&<p className="mt-3 text-[11px] text-muted-foreground">Showing 15 recent records. The full activity ledger remains below.</p>}
        <IonButton expand="block" className="mc-finance-documents-button mt-4" onClick={onOpenDocuments}>Review financial documents</IonButton>
      </IonCardContent>
    </IonCard>
    <p className="mt-2 px-1 text-[11px] leading-5 text-muted-foreground">
      Your approved local records only. Bank integrations are not connected; no payments or trading actions are performed here.
    </p>
  </section>;
}
