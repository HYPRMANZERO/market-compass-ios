import {useEffect,useState} from 'react';
import {IonCard,IonList} from '@ionic/react';
import {
  Activity, ArrowRight, ArrowUpRight, ChevronDown, FileClock,
  FileText, Landmark, Plus, ReceiptText, ShieldCheck,
  Sparkles, WalletCards, X
} from 'lucide-react';
import { Link } from 'wouter';
import {createPortal} from 'react-dom';
import type { MarketSeries } from '@workspace/api-client-react';
import { approximateLocalValue, type FxReference } from '@/lib/fxRates';
import { maskDocumentPII } from '@/lib/documentIntelligence';
import FinancialPulse from '@/components/FinancialPulse';
import BankCarousel from '@/components/BankCarousel';
import FinancialSpaceHero from '@/components/FinancialSpaceHero';
import EvidenceReviewInbox from '@/components/EvidenceReviewInbox';
import {recurringPatterns} from '@/lib/historicalRecurring';
import {accountLinkedEvidence} from '@/lib/accountLinkedEvidence';
import {localDate} from '@/lib/dailyBackup';
import type {ExpenseEntry,ExpenseSettings} from '@/lib/monthlyExpenses';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';

type AccountPreview = {
  id: string;
  name: string;
  balance: string;
  apr: string;
  minimumPayment: string;
};
type Props = {
  currency: string;
  totalDebt: number;
  accountsCount: number;
  accounts?: AccountPreview[];
  documentsCount?: number;
  approvedEntryCount?: number;
  entries?:ExpenseEntry[];
  documents?:LocalFinanceDocument[];
  expenseSettings?:ExpenseSettings;
  currencyReviewRequired?:boolean;
  pendingDrafts: number;
  market: MarketSeries | null;
  fxQuote?: FxReference | null;
  onImportDocuments?:()=>void;
  onRecoverVault?:()=>void;
  onAddAccount?:()=>void;
};
const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};
const latestDay = (market: MarketSeries) => {
  const last = market.candles?.at(-1)?.date;
  if (!last) return 'Unknown';
  const date = new Date(last);
  return Number.isNaN(date.getTime()) ? last : date.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
};
const entered = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default function MobileOverview({
  currency,totalDebt,accountsCount,accounts=[],documentsCount=0,
  approvedEntryCount=0,entries=[],documents=[],expenseSettings,currencyReviewRequired=false,pendingDrafts,market,fxQuote,
  onImportDocuments,onRecoverVault,onAddAccount
}: Props) {
  const [accountActionsOpen,setAccountActionsOpen]=useState(false);
  useEffect(()=>{
    if(!accountActionsOpen)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setAccountActionsOpen(false);};
    document.addEventListener('keydown',onKey);
    return ()=>document.removeEventListener('keydown',onKey);
  },[accountActionsOpen]);
  const emptyFinancialWorkspace=accountsCount===0&&documentsCount===0&&approvedEntryCount===0;
  const recurringOutflows=recurringPatterns(entries,currency,localDate())
    .filter(p=>p.kind==='expense'||p.kind==='debt-payment');
  const nativeClose = market?.candles?.at(-1)?.close;
  const localClose = typeof nativeClose === 'number' && market
    ? approximateLocalValue(nativeClose, market.currency, currency, fxQuote) : null;
  return <div className="mc-app-overview space-y-4 pb-3" data-testid="mobile-home">
    <FinancialSpaceHero
      currency={currency}
      totalDebt={totalDebt}
      accountsCount={accountsCount}
      onViewAccounts={()=>setAccountActionsOpen(true)}
    />

    {emptyFinancialWorkspace&&<section aria-label="Empty workspace and backup recovery" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[13px] font-semibold">No financial records saved in this workspace</p>
      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">An empty dashboard does not mean your other Market Compass vault is empty. Safari, Home Screen apps and different website origins can keep separate encrypted workspaces.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRecoverVault&&<button type="button" onClick={onRecoverVault} className="min-h-11 rounded-xl border border-primary/30 bg-primary/10 px-3 text-[12px] font-semibold">Restore an encrypted backup</button>}
        {onImportDocuments&&<button type="button" onClick={onImportDocuments} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">Import documents</button>}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Never replace an existing vault without first exporting a backup and reviewing the restore instructions.</p>
    </section>}

    <section aria-label="Quick actions" className="mc-app-section">
      <div className="mc-app-section-heading">
        <h2>Quick actions</h2><span>Do more, in fewer taps</span>
      </div>
      <div className="row g-2 mc-bs-quick-actions">
        <div className="col-4">
          <button type="button" onClick={()=>setAccountActionsOpen(true)} className="mc-quick-action w-full">
            <span className="mc-quick-icon"><Plus size={20} aria-hidden="true"/></span>
            <span>Accounts</span>
          </button>
        </div>
        <div className="col-4">
          <button type="button" onClick={onImportDocuments} className="mc-quick-action w-full">
            <span className="mc-quick-icon"><FileText size={20} aria-hidden="true"/></span>
            <span>Documents</span>
          </button>
        </div>
        <div className="col-4">
          <Link href="/assistant" className="mc-quick-action ion-activatable">
            <span className="mc-quick-icon"><Sparkles size={20} aria-hidden="true"/></span>
            <span>Ask Compass</span>
          </Link>
        </div>
      </div>
    </section>

    <BankCarousel compact onImportDocuments={onImportDocuments}/>

    <section aria-label="Workspace snapshot" className="mc-app-section">
      <div className="mc-app-section-heading">
        <h2>At a glance</h2><span>Saved locally</span>
      </div>
      <div className="row g-3 mc-bs-summary">
        <div className="col-6">
          <Link href="/expenses" className="mc-stat-card">
            <span className="mc-stat-icon"><ReceiptText size={19} aria-hidden="true"/></span>
            <span className="mc-stat-number">{approvedEntryCount}</span>
            <span className="mc-stat-label">Spend entries</span>
            <span className="mc-stat-meta">Owner-approved records</span>
          </Link>
        </div>
        <div className="col-6">
          <Link href="/expenses" className="mc-stat-card">
            <span className="mc-stat-icon"><FileText size={19} aria-hidden="true"/></span>
            <span className="mc-stat-number">{documentsCount}</span>
            <span className="mc-stat-label">Documents</span>
            <span className="mc-stat-meta">Reviewed summaries</span>
          </Link>
        </div>
        <div className="col-12">
          <Link href="/drafts" className="mc-stat-strip">
            <span className="mc-stat-strip-icon"><FileClock size={18} aria-hidden="true"/></span>
            <span className="min-w-0 flex-1"><strong>{pendingDrafts} pending drafts</strong><small>Review-only, never placed automatically</small></span>
            <ArrowRight size={17} aria-hidden="true"/>
          </Link>
        </div>
      </div>
    </section>

    <EvidenceReviewInbox documents={documents} entries={entries} currency={currency}
      currencyReviewRequired={currencyReviewRequired}/>

    <FinancialPulse entries={entries} documents={documents} currency={currency} settings={expenseSettings}/>

    <IonCard className="mc-app-section mc-ionic-surface rounded-[22px] border border-border bg-card p-4 shadow-sm" role="region" aria-label="Recurring expense identification">
      <div className="mc-app-section-heading"><h2>Recurring outflows</h2><span>Approved history only</span></div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Suggestions require matching payments across two or more separate salary cycles. They are not future bills or scheduled debits.</p>
      {recurringOutflows.length===0?<p className="mt-3 text-[12px] text-muted-foreground">No repeated outgoing pattern confirmed yet. Approve dated transactions across multiple salary cycles to identify candidates.</p>:
        <ul className="mt-3 space-y-2">{recurringOutflows.slice(0,4).map(p=><li key={p.key} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-muted/35 p-3 text-[12px]">
          <span className="min-w-0 flex-1"><strong className="block break-words">{maskDocumentPII(p.description)}</strong><small className="text-[10px] text-muted-foreground">{p.observedCycles} observed salary cycles · last recorded {p.lastDate}</small></span>
          <strong className="tabular-nums">{money(p.typicalAmount,currency)} typical</strong>
        </li>)}</ul>}
      <Link href="/expenses" className="mt-3 inline-flex min-h-10 items-center text-[11px] font-semibold text-primary">Review source transactions <ArrowRight size={14} className="ml-1"/></Link>
    </IonCard>

    <section className="mc-app-section" aria-label="Your saved accounts">
      <div className="mc-app-section-heading">
        <h2>Your accounts</h2>
        <Link href="/debt" className="mc-app-heading-link">Manage <ArrowRight size={14} aria-hidden="true"/></Link>
      </div>
      {accounts.length ? <IonList className="mc-account-list">
        {accounts.slice(0,4).map((account,index)=>{
          const balance=entered(account.balance);
          const apr=entered(account.apr);
          const minimum=entered(account.minimumPayment);
          // The linked transaction date is evidence of historical activity,
          // never proof of when the separately entered account balance changed.
          const evidence=accountLinkedEvidence(entries,account.id,currency,localDate());
          const linked=evidence.recentEntries;
          return <details className="mc-account-row" key={account.id}>
            <summary aria-label={'Expand details for '+maskDocumentPII(account.name||'account')}>
              <span className="mc-account-avatar" aria-hidden="true"><WalletCards size={20}/></span>
              <span className="mc-account-label">
                <strong>{maskDocumentPII(account.name.trim())||`Account ${index+1}`}</strong>
                <small>Manual balance · Not bank synced</small>
              </span>
              <span className="mc-account-right">
                <strong>{balance===null?'Not entered':money(balance,currency)}</strong>
                <ChevronDown className="mc-account-chevron" size={17} aria-hidden="true"/>
              </span>
            </summary>
            <div className="mc-account-details row g-2">
              <div className="col-6">
                <span>Annual rate</span>
                <strong>{apr===null?'Not entered':`${apr}%`}</strong>
              </div>
              <div className="col-6">
                <span>Minimum / month</span>
                <strong>{minimum===null?'Not entered':money(minimum,currency)}</strong>
              </div>
              <div className="col-12 rounded-xl bg-muted/35 p-3">
                <strong className="block text-[12px]">Linked transaction history</strong>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Owner-approved records linked explicitly to this account; not a live bank feed.</p>
                <p className="mt-2 rounded-lg bg-background px-2.5 py-2 text-[11px] leading-5 text-muted-foreground">
                  Balance: owner-entered planning figure, with no bank-confirmed as-of date.
                  <span className="block">Latest linked transaction: <strong className="text-foreground">{evidence.latestTransactionDay??'Not recorded'}</strong> · historical activity only.</span>
                </p>
                {(evidence.futureDatedCount>0||evidence.invalidDatedCount>0||evidence.otherCurrencyCount>0)&&<p className="mt-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300" role="status">
                  Date/source review: {evidence.futureDatedCount} future-dated, {evidence.invalidDatedCount} invalid/incomplete, {evidence.otherCurrencyCount} different-currency linked row(s) excluded from this history view. Saved records are unchanged.
                </p>}
                {linked.length?<ul className="mt-2 divide-y divide-border">{linked.slice(0,5).map(item=><li key={item.id} className="flex items-start justify-between gap-2 py-2 text-[11px]">
                  <span className="min-w-0"><strong className="block break-words">{maskDocumentPII(item.description)}</strong><small className="text-muted-foreground">{item.date} · {item.kind}</small></span>
                  <strong className="shrink-0 tabular-nums">{money(item.amount,currency)}</strong>
                </li>)}</ul>:<p className="mt-2 text-[11px] text-muted-foreground">No approved transactions linked to this account.</p>}
                {evidence.approvedLinkedCount>5&&<p className="mt-1 text-[10px] text-muted-foreground">Showing latest five of {evidence.approvedLinkedCount} dated linked records. Open Spend for all approved history.</p>}
              </div>
              <div className="col-12">
                <Link href="/debt">Edit repayment details <ArrowUpRight size={14} aria-hidden="true"/></Link>
              </div>
            </div>
          </details>;
        })}
        {accounts.length>4&&<Link href="/debt" className="mc-account-more">
          View all {accountsCount} accounts <ArrowRight size={15} aria-hidden="true"/>
        </Link>}
      </IonList> : <div className="mc-account-empty">
        <span className="mc-account-empty-icon"><Landmark size={22} aria-hidden="true"/></span>
        <div className="min-w-0 flex-1">
          <strong>No accounts added yet</strong>
          <p>Add an account to see it here, with balances and repayments in a familiar banking layout.</p>
        </div>
        <Link href="/debt" aria-label="Add a debt account" className="mc-account-empty-action"><ArrowRight size={17}/></Link>
      </div>}
    </section>

    <section className="mc-app-market" aria-label="Market snapshot">
      <div className="mc-app-section-heading">
        <h2><Activity size={18} aria-hidden="true"/> Market snapshot</h2>
        <span className="mc-market-history-label">Historical only</span>
      </div>
      {market ? <div className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[20px] font-bold tracking-tight">{market.symbol}</span>
          <span className="text-[11px] text-muted-foreground">{market.currency}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{market.candles?.length??0} saved daily candles · Last day {latestDay(market)} UTC</p>
        {localClose!==null&&<div className="mc-market-value">
          <span>{market.currency===currency?'Last saved close':'Approximate converted value'}</span>
          <strong>{money(localClose,currency)}</strong>
          {market.currency!==currency&&<small>Reference rate {fxQuote?.rateDate??'unavailable'} · Not executable</small>}
        </div>}
      </div> : <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
        No market history saved yet. Visit Markets to select a symbol and save dated prices.
      </p>}
      <Link href="/markets" className="mc-app-market-link">Open markets <ArrowRight size={16} aria-hidden="true"/></Link>
    </section>

    {accountActionsOpen && createPortal(
      <div className="mc-quick-menu-layer fixed inset-0 z-[120] flex items-end justify-center bg-black/45" role="presentation" onClick={()=>setAccountActionsOpen(false)}>
        <section role="dialog" aria-modal="true" aria-label="Account actions"
          className="mc-quick-menu-panel w-full max-w-[560px] overflow-y-auto rounded-t-[26px] bg-card px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3 text-foreground shadow-2xl"
          onClick={event=>event.stopPropagation()}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden="true"/>
          <div className="flex items-center justify-between gap-3"><h2 className="text-[17px] font-bold">Your accounts</h2><button type="button" aria-label="Close account actions" onClick={()=>setAccountActionsOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl border border-border"><X size={18}/></button></div>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Review saved accounts or open a blank form to add another. No account is created until you save it.</p>
          <div className="mt-4 grid gap-2">
            <Link href="/debt" onClick={()=>setAccountActionsOpen(false)} className="flex min-h-12 items-center justify-between rounded-xl border border-border px-4 text-[13px] font-semibold">View saved accounts and balances <ArrowRight size={17}/></Link>
            <button type="button" onClick={()=>{setAccountActionsOpen(false);onAddAccount?.();}} className="flex min-h-12 items-center justify-between rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground">Add an account <Plus size={17}/></button>
          </div>
        </section>
      </div>,document.body)}

    <div className="mc-app-privacy"><ShieldCheck size={17} aria-hidden="true"/>
      <p>Only reviewed, manually entered financial information is shown. No bank connection, automatic payments or trade execution.</p>
    </div>
  </div>;
}
