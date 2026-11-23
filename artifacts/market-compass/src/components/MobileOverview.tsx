import {
  Activity, ArrowRight, ArrowUpRight, ChevronDown, Compass, FileClock,
  FileText, Landmark, LockKeyhole, Plus, ReceiptText, ShieldCheck,
  Sparkles, WalletCards
} from 'lucide-react';
import { Link } from 'wouter';
import type { MarketSeries } from '@workspace/api-client-react';
import { approximateLocalValue, type FxReference } from '@/lib/fxRates';
import { maskDocumentPII } from '@/lib/documentIntelligence';
import FinancialPulse from '@/components/FinancialPulse';
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
  pendingDrafts: number;
  market: MarketSeries | null;
  fxQuote?: FxReference | null;
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
  approvedEntryCount=0,entries=[],documents=[],expenseSettings,pendingDrafts,market,fxQuote
}: Props) {
  const nativeClose = market?.candles?.at(-1)?.close;
  const localClose = typeof nativeClose === 'number' && market
    ? approximateLocalValue(nativeClose, market.currency, currency, fxQuote) : null;
  return <div className="mc-app-overview space-y-4 pb-3" data-testid="mobile-home">
    <section className="mc-wallet-hero" aria-label="Private financial overview">
      <div className="mc-wallet-orbit mc-wallet-orbit-first" aria-hidden="true"/>
      <div className="mc-wallet-orbit mc-wallet-orbit-second" aria-hidden="true"/>
      <div className="mc-wallet-content">
        <div className="flex items-center justify-between gap-2">
          <span className="mc-wallet-eyebrow">YOUR FINANCIAL SPACE</span>
          <span className="mc-wallet-lock"><LockKeyhole size={12} aria-hidden="true"/> Private workspace</span>
        </div>
        <p className="mt-7 text-[12px] font-medium text-white/75">
          {accountsCount ? 'Total entered debt balances' : 'Your financial overview'}
        </p>
        <h1 className="mc-wallet-number">
          {accountsCount ? money(totalDebt,currency) : 'Start with clarity'}
        </h1>
        <p className="mt-3 max-w-[300px] text-[12px] leading-5 text-white/75">
          {accountsCount
            ? 'Based on amounts you entered. Not a live or bank-verified balance.'
            : 'Add an account or import a statement to begin building your private picture.'}
        </p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="mc-wallet-footnote"><ShieldCheck size={14} aria-hidden="true"/> Encrypted on your device</span>
          <Link href="/debt" className="mc-wallet-cta">
            {accountsCount ? 'View accounts' : 'Add account'} <ArrowUpRight size={15} aria-hidden="true"/>
          </Link>
        </div>
      </div>
    </section>

    <section aria-label="Quick actions" className="mc-app-section">
      <div className="mc-app-section-heading">
        <h2>Quick actions</h2><span>Do more, in fewer taps</span>
      </div>
      <div className="row g-2 mc-bs-quick-actions">
        <div className="col-4">
          <Link href="/debt" className="mc-quick-action">
            <span className="mc-quick-icon"><Plus size={20} aria-hidden="true"/></span>
            <span>Accounts</span>
          </Link>
        </div>
        <div className="col-4">
          <Link href="/expenses" className="mc-quick-action">
            <span className="mc-quick-icon"><FileText size={20} aria-hidden="true"/></span>
            <span>Documents</span>
          </Link>
        </div>
        <div className="col-4">
          <Link href="/assistant" className="mc-quick-action">
            <span className="mc-quick-icon"><Sparkles size={20} aria-hidden="true"/></span>
            <span>Ask Compass</span>
          </Link>
        </div>
      </div>
    </section>

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

    <FinancialPulse entries={entries} documents={documents} currency={currency} settings={expenseSettings}/>

    <section className="mc-app-section" aria-label="Your saved accounts">
      <div className="mc-app-section-heading">
        <h2>Your accounts</h2>
        <Link href="/debt" className="mc-app-heading-link">Manage <ArrowRight size={14} aria-hidden="true"/></Link>
      </div>
      {accounts.length ? <div className="mc-account-list">
        {accounts.slice(0,4).map((account,index)=>{
          const balance=entered(account.balance);
          const apr=entered(account.apr);
          const minimum=entered(account.minimumPayment);
          return <details className="mc-account-row" key={account.id}>
            <summary>
              <span className="mc-account-avatar" aria-hidden="true"><WalletCards size={20}/></span>
              <span className="mc-account-label">
                <strong>{maskDocumentPII(account.name.trim())||`Account ${index+1}`}</strong>
                <small>Manual entry · Not bank connected</small>
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
              <div className="col-12">
                <Link href="/debt">Edit repayment details <ArrowUpRight size={14} aria-hidden="true"/></Link>
              </div>
            </div>
          </details>;
        })}
        {accounts.length>4&&<Link href="/debt" className="mc-account-more">
          View all {accountsCount} accounts <ArrowRight size={15} aria-hidden="true"/>
        </Link>}
      </div> : <div className="mc-account-empty">
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

    <div className="mc-app-privacy"><ShieldCheck size={17} aria-hidden="true"/>
      <p>Only reviewed, manually entered financial information is shown. No bank connection, automatic payments or trade execution.</p>
    </div>
  </div>;
}
