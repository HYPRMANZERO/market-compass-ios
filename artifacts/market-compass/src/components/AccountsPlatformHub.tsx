import {useState} from 'react';
import {ChevronDown,ChevronUp,Coins,ExternalLink,FileUp,Gift,Landmark,Plus,RefreshCw,ShieldCheck,TrendingUp,WalletCards} from 'lucide-react';
import {Link} from 'wouter';
import BankCarousel from './BankCarousel';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import StandardBankConnection from './StandardBankConnection';
import type {DesktopAiSettings} from '@/lib/desktopAiSettings';
import {currentAssistantEdition} from '@/lib/assistantEdition';

type DebtRecord={id:string;name:string;balance?:string};
type Group='bank'|'investments'|'rewards'|'cryptocurrency'|'credit';
type Provider={name:string;note:string;guide?:string;mode:'Manual import'|'Read-only API candidate'};
const investments:Provider[]=[
  {name:'EasyEquities',note:'Download a transaction history or portfolio statement. No public account-linking API has been verified.',mode:'Manual import',
    guide:'https://support.easyequities.co.za/support/solutions/articles/5000642097-how-do-i-get-a-report-of-my-transaction-history-'},
  {name:'SatrixNOW',note:'Statement-import candidate for share and ETF holdings.',mode:'Manual import'},
  {name:'Sygnia',note:'Statement-import candidate for investments and retirement holdings.',mode:'Manual import'},
  {name:'Old Mutual',note:'Investment and retirement statements can be imported for local review; account linking is not enabled.',mode:'Manual import'},
  {name:'Standard Bank investments',note:'Share trading and investment statement-import candidate. This is separate from Standard Bank everyday banking.',mode:'Manual import'}
];
const crypto:Provider[]=[
  {name:'Luno',note:'Future owner-authorized balance and transaction history connector, subject to scoped API validation.',mode:'Read-only API candidate'},
  {name:'Coinbase',note:'Future connector must use an appropriate account product and view-only permissions.',mode:'Read-only API candidate',
    guide:'https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getaccount'},
  {name:'Kraken',note:'Future connector should request Query Funds and Query Ledger Entries, never withdrawal or trading permissions.',mode:'Read-only API candidate',
    guide:'https://docs.kraken.com/api/docs/rest-api/get-api-key-info'}
];

/** Provider directory only. No live balance is inferred, no credentials are collected. */
export default function AccountsPlatformHub({debtAccounts,currency,desktopAi,onImportDocuments}:{
  debtAccounts:DebtRecord[];currency:string;desktopAi:DesktopAiSettings;onImportDocuments:()=>void;
}){
  const [expanded,setExpanded]=useState<Group|null>('bank');
  const [showPicker,setShowPicker]=useState(false);
  const [refreshNotice,setRefreshNotice]=useState(false);
  const enteredLiabilities=debtAccounts.length>0&&debtAccounts.every(account=>
    typeof account.balance==='string'&&/^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(account.balance)&&
    Number.isFinite(Number(account.balance)))
    ?debtAccounts.reduce((sum,account)=>sum+Number(account.balance),0):null;
  const groups:{id:Group;title:string;count:number;Icon:typeof Landmark;description:string}[]=[
    {id:'bank',title:'Bank',count:0,Icon:Landmark,description:'Everyday, cheque and savings accounts'},
    {id:'investments',title:'Investments',count:0,Icon:TrendingUp,description:'Shares, ETFs and investment platforms'},
    {id:'rewards',title:'Rewards',count:0,Icon:Gift,description:'Loyalty accounts and points'},
    {id:'cryptocurrency',title:'Cryptocurrency',count:0,Icon:Coins,description:'Exchange accounts and wallets'},
    {id:'credit',title:'Credit & vehicle finance',count:debtAccounts.length,Icon:WalletCards,description:'Manually recorded liabilities; no lender connection'}
  ];
  const providerCards=(items:Provider[])=><div className="divide-y divide-border">
    {items.map(p=><div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center" key={p.name}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-bold text-primary" aria-hidden="true">{p.name.slice(0,2).toUpperCase()}</span>
        <div className="min-w-0"><p className="text-[12px] font-semibold">{p.name}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{p.mode} · Not connected</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{p.note}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={onImportDocuments} className="min-h-11 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold">Import file</button>
        {p.guide&&<a href={p.guide} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 px-2 text-[11px] font-semibold text-primary">Provider guide <ExternalLink size={13}/></a>}
      </div>
    </div>)}
  </div>;
  return <div className="space-y-4" data-testid="accounts-platform-hub">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="min-w-0"><p className="text-[13px] font-bold">Account overview</p><p className="mt-1 text-[11px] text-muted-foreground">Last synced: Never · 0 live connections</p></div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <button type="button" onClick={()=>setRefreshNotice(true)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-primary px-3 text-[12px] font-semibold text-primary sm:flex-none">
          <RefreshCw size={16}/>Update accounts
        </button>
        <button type="button" onClick={()=>{setShowPicker(v=>!v);setExpanded('bank');setRefreshNotice(false);}}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground sm:flex-none"
          aria-expanded={showPicker}>
          <Plus size={17}/>Add account
        </button>
      </div>
      {refreshNotice&&<p role="status" className="w-full rounded-xl bg-muted/50 p-3 text-[11px] leading-5">
        There are no linked accounts to refresh. You can import a dated statement or export below. This does not create a live connection or update a bank balance.
      </p>}
      {showPicker&&<div className="w-full rounded-xl border border-border bg-background p-3">
        <p className="text-[12px] font-semibold">Choose an account type</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Select a group below, then choose a provider. Live linking is not yet available; import an authorized statement instead.</p>
        <div className="mt-2 flex flex-wrap gap-2">{groups.map(g=><button type="button" key={g.id}
          onClick={()=>{setExpanded(g.id);setShowPicker(false);}} className="min-h-11 rounded-xl border border-border px-3 text-[11px] font-semibold">{g.title}</button>)}</div>
      </div>}
    </div>
    <section id="mc-wealth-history" className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-label="Wealth snapshot and history readiness" data-testid="wealth-history-readiness">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-[15px] font-bold">My Wealth · history</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            Assets, liabilities and historical net-worth snapshots belong here when evidence is available.
          </p>
        </div>
        <button type="button" onClick={onImportDocuments} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-[12px] font-semibold">
          <FileUp size={16}/>Upload statement
        </button>
      </div>
      <div className="mt-3 rounded-xl bg-muted/40 p-4 text-[12px]">
        <p className="font-semibold">Net worth history unavailable</p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          No dated, reconciled asset and liability snapshots are recorded. A net-worth chart and time-range returns would be misleading.
          Imported statements still require local review and do not establish live ownership or valuations.
        </p>
        <p className="mt-3 text-[11px]">
          Manually entered liability subtotal: <strong>{enteredLiabilities===null?'Unavailable':
          new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(enteredLiabilities)}</strong>
          <span className="text-muted-foreground"> · owner-reported in the selected planning currency, not lender-verified; assets and net worth remain unknown</span>
        </p>
      </div>
    </section>
    <div className="space-y-3" aria-label="Account groups">
      {groups.map(g=><section key={g.id} className="overflow-hidden rounded-[20px] border border-border bg-card shadow-sm" data-testid={`account-group-${g.id}`}>
        <button type="button" className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left"
          onClick={()=>setExpanded(old=>old===g.id?null:g.id)}
          aria-expanded={expanded===g.id} aria-controls={`account-panel-${g.id}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><g.Icon size={19} aria-hidden="true"/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">{g.title}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{g.count} {g.id==='credit'?'manual records':'connected accounts'}</span>
          </span>
          <span className="shrink-0 text-right"><span className="block text-[12px] font-semibold">{g.id==='credit'?'Manual':'No linked balance'}</span>
            <span className="text-[10px] text-muted-foreground">{g.id==='credit'?'Not lender-verified':'Unavailable'}</span></span>
          {expanded===g.id?<ChevronUp size={18} className="shrink-0 text-muted-foreground"/>:<ChevronDown size={18} className="shrink-0 text-muted-foreground"/>}
        </button>
        {expanded===g.id&&<div id={`account-panel-${g.id}`} className="border-t border-border">
          <p className="px-4 py-3 text-[11px] leading-5 text-muted-foreground">{g.description}.
            {g.id==='credit'?' Saved liability records are not bank-linked accounts.':' No live accounts are linked; platforms below are options for future integration or manual import.'}
          </p>
          {g.id==='bank'&&<div className="px-3 pb-3"><BankCarousel compact showStandardBankConnect={currentAssistantEdition()==='finance'} onImportDocuments={onImportDocuments}/><StandardBankConnection settings={desktopAi}/></div>}
          {g.id==='investments'&&providerCards(investments)}
          {g.id==='cryptocurrency'&&providerCards(crypto)}
          {g.id==='rewards'&&<div className="border-t border-border px-4 py-4 text-[11px] leading-5 text-muted-foreground">
            No rewards accounts are linked. Rewards points are not counted as cash or investments.
          </div>}
          {g.id==='credit'&&<div className="border-t border-border">
            {debtAccounts.length?debtAccounts.map(a=><div key={a.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-[12px]">
              <span className="min-w-0 break-words font-semibold">{maskDocumentPII(a.name||'Unnamed debt record')}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">Owner-entered</span>
            </div>):<p className="px-4 py-3 text-[11px] text-muted-foreground">No vehicle-finance or credit records entered yet.</p>}
            <Link href="/debt" className="inline-flex min-h-11 items-center px-4 text-[12px] font-semibold text-primary">Manage debt records</Link>
          </div>}
        </div>}
      </section>)}
    </div>
    <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-[11px] leading-5 text-muted-foreground">
      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary"/>
      <p>Accounts are for provider connections and balances, not categorizing payments. Review payment categories in Spend. No bank or exchange is connected, no credentials are collected, and no mock balances are displayed.</p>
    </div>
    <button type="button" onClick={onImportDocuments} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-[12px] font-semibold">
      <FileUp size={16}/>Import an account statement or platform export
    </button>
  </div>;
}
