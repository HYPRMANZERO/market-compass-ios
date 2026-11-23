import {useState,type CSSProperties} from 'react';
import {
  IonButton,IonCard,IonCardContent,IonCardHeader,IonCardSubtitle,IonCardTitle,
  IonChip,IonItem,IonLabel,IonList,IonSegment,IonSegmentButton,setupIonicReact
} from '@ionic/react';
import '@ionic/react/css/core.css';
import type {ExpenseEntry,ExpenseKind} from '@/lib/monthlyExpenses';
import {maskDocumentPII} from '@/lib/documentIntelligence';

// Isolated opt-in Ionic UI: uses the same encrypted React workspace props,
// never creates a second vault, storage store, provider session or payment flow.
setupIonicReact({mode:'ios'});
type Props={entries:ExpenseEntry[];currency:string;onOpenDocuments:()=>void};
const amount=(value:number)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency:'ZAR',minimumFractionDigits:2,maximumFractionDigits:2
}).format(value);

export default function IonicSpendPreview({entries,currency,onOpenDocuments}:Props){
  const [filter,setFilter]=useState<'all'|ExpenseKind>('all');
  const safe=entries.filter(entry=>entry.currency==='ZAR'&&Number.isFinite(entry.amount));
  const visible=filter==='all'?safe:safe.filter(entry=>entry.kind===filter);
  const ordered=[...visible].sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  const expenses=safe.filter(entry=>entry.kind==='expense'||entry.kind==='debt-payment');
  const total=expenses.reduce((sum,entry)=>sum+entry.amount,0);
  return <section className="mc-ionic-preview mb-5" aria-label="Ionic component preview of saved Spend data"
    style={{'--ion-color-primary':'#284c42','--ion-color-primary-rgb':'40,76,66',
      '--ion-color-primary-contrast':'#ffffff','--ion-background-color':'#ffffff',
      '--ion-text-color':'#23352f','--ion-border-color':'#d9d6ce'} as CSSProperties}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Optional Ionic preview</p>
        <h2 className="mt-1 text-[18px] font-bold">Native-style finance workspace</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Live local records, new Ionic UI. This preview does not change the existing dashboard or vault.
        </p>
      </div>
      <IonChip color="primary">iOS styling</IonChip>
    </div>
    <IonCard className="!mx-0 !my-3 !rounded-[22px]">
      <IonCardHeader>
        <IonCardSubtitle>Recorded spending · historical</IonCardSubtitle>
        <IonCardTitle>{currency==='ZAR'?amount(total):'Confirm ZAR currency'}</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <p>{expenses.length} recorded purchases and repayments, not a live bank balance.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <IonChip>{safe.filter(e=>e.kind==='income').length} income records</IonChip>
          <IonChip>{safe.filter(e=>e.kind==='transfer').length} transfers excluded</IonChip>
        </div>
      </IonCardContent>
    </IonCard>
    <IonCard className="!mx-0 !my-3 !rounded-[22px]">
      <IonCardHeader>
        <IonCardTitle className="!text-lg">Your activity</IonCardTitle>
        <IonCardSubtitle>Tap a segment to filter the existing Spend ledger</IonCardSubtitle>
      </IonCardHeader>
      <IonCardContent>
        <IonSegment scrollable value={filter} onIonChange={event=>setFilter(
          ['expense','income','debt-payment','transfer'].includes(String(event.detail.value))
            ?event.detail.value as ExpenseKind:'all'
        )} aria-label="Ionic transaction filter">
          <IonSegmentButton value="all"><IonLabel>All</IonLabel></IonSegmentButton>
          <IonSegmentButton value="expense"><IonLabel>Purchases</IonLabel></IonSegmentButton>
          <IonSegmentButton value="income"><IonLabel>Income</IonLabel></IonSegmentButton>
          <IonSegmentButton value="debt-payment"><IonLabel>Debt</IonLabel></IonSegmentButton>
        </IonSegment>
        {ordered.length===0?<p className="px-1 py-5 text-sm text-muted-foreground">
          No approved transactions in this filter. Imported statement evidence is not automatically posted.
        </p>:<IonList inset={false}>
          {ordered.slice(0,12).map(entry=><IonItem key={entry.id} lines="full">
            <IonLabel className="ion-text-wrap">
              <h3>{maskDocumentPII(entry.description)}</h3>
              <p>{entry.date} · {entry.kind.replaceAll('-',' ')} · {entry.category.replaceAll('-',' ')}</p>
            </IonLabel>
            <strong slot="end" className="text-[12px]">{amount(entry.amount)}</strong>
          </IonItem>)}
        </IonList>}
        {ordered.length>12&&<p className="text-[11px] text-muted-foreground">
          Previewing the 12 most recent records. The standard Activity view retains full history.
        </p>}
      </IonCardContent>
    </IonCard>
    <IonButton expand="block" color="primary" onClick={onOpenDocuments}>
      Review financial documents
    </IonButton>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
      Ionic visual comparison only. No bank connection, payment, order execution or account migration occurs.
      Switch back to the original layout at any time.
    </p>
  </section>;
}
