import {useCallback,useEffect,useState} from 'react';
import {ExternalLink,Landmark,LoaderCircle,ShieldCheck,RefreshCw,WalletCards} from 'lucide-react';
import type {DesktopAiSettings} from '@/lib/desktopAiSettings';
import {currentAssistantEdition} from '@/lib/assistantEdition';
import {eligibleFinanceBankOrigin,standardBankApi,type StandardBankLinkStatus}
  from '@/lib/standardBankLink';

export default function StandardBankLinkPanel({settings}:{settings:DesktopAiSettings}){
  const origin=typeof window==='undefined'?'':window.location.origin;
  const edition=currentAssistantEdition();
  const eligible=eligibleFinanceBankOrigin(origin,settings,edition);
  const [status,setStatus]=useState<StandardBankLinkStatus|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    if(!eligible){setStatus(null);return;}
    setLoading(true);setError('');
    try{
      const result=await standardBankApi(origin,settings,edition,'status');
      setStatus(result as StandardBankLinkStatus);
    }catch{
      setStatus(null);
      setError('Bank linking is unavailable. Check the protected Finance connection.');
    }finally{setLoading(false);}
  },[eligible,origin,settings,edition]);
  useEffect(()=>{void refresh();},[refresh]);
  const act=async(action:'connect'|'select'|'disconnect',accountId?:string)=>{
    if(!eligible||loading)return;
    if(action==='disconnect'&&!window.confirm(
      'Disconnect the local Standard Bank session? You must also revoke the bank consent at Standard Bank.'))return;
    setLoading(true);setError('');
    try{
      const result=await standardBankApi(origin,settings,edition,action,
        accountId?{accountId}:undefined);
      if(action==='connect'){
        const redirect=(result as {authorizationUrl:string}).authorizationUrl;
        window.location.assign(redirect);return;
      }
      setStatus(result as StandardBankLinkStatus);
    }catch{
      setError('This bank action could not be completed or verified. No account data was changed.');
    }finally{setLoading(false);}
  };
  // Do not attempt cross-origin requests from the public Personal PWA.
  if(edition!=='finance')return null;
  return <section className="mt-4 rounded-2xl border border-border bg-card p-4" aria-label="Standard Bank official connection" data-testid="standard-bank-connection">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Landmark size={18} className="text-primary"/>
        <h3 className="text-[14px] font-bold">Standard Bank official connection</h3></div>
      <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold">
        {status?.linked?'Connected · read-only':status?.ready?'Approved provider available':'Not connected'}
      </span>
    </div>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
      Account access requires Standard Bank partner approval and your explicit consent on the bank's own website.
      Compass never asks for your bank password, PIN, card number or OTP.
    </p>
    {!eligible?<p role="status" className="mt-3 text-[12px] leading-5 text-muted-foreground">
      Connect the authenticated private Finance assistant on this HTTPS address before requesting bank status.
      The original public Personal app cannot authorize bank connections.
    </p>:<>
      {error&&<p role="alert" className="mt-3 text-[12px] text-destructive">{error}</p>}
      {status?.lastError&&<p role="status" className="mt-3 text-[12px] text-muted-foreground">{status.lastError}</p>}
      {status&&!status.ready&&<p role="status" className="mt-3 text-[12px] leading-5 text-muted-foreground">
        No approved Standard Bank partner credentials or verified read-only contract are configured yet.
        Bank account linking is disabled. Statement imports remain available.
      </p>}
      {status?.ready&&!status.linked&&<p className="mt-3 text-[12px] text-muted-foreground">
        The next step opens an approved Standard Bank consent screen outside Compass.
      </p>}
      {status?.linked&&<div className="mt-3 space-y-2" aria-label="Consent-provided Standard Bank accounts">
        {status.accounts.length===0?<p className="text-[12px] text-muted-foreground">No selectable accounts returned by the approved provider.</p>:
          status.accounts.map(account=><div key={account.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><WalletCards size={15} aria-hidden="true"/>
                <p className="truncate text-[12px] font-semibold">{account.displayName}</p></div>
              <p className="mt-1 text-[11px] text-muted-foreground">•••• {account.last4} · {account.currency} · Bank-provided, not saved to vault</p>
              {account.balance!==undefined&&<p className="mt-1 text-[13px] font-semibold">{account.currency} {account.balance.toFixed(2)}</p>}
            </div>
            <button type="button" className="min-h-11 shrink-0 rounded-xl border border-border px-3 text-[11px] font-semibold disabled:opacity-50"
              aria-label={account.selected?'Selected bank account':'Select '+account.displayName}
              onClick={()=>{void act('select',account.id)}} disabled={loading||account.selected}>
              {account.selected?'Selected':'View'}
            </button>
          </div>)}
        <p className="text-[11px] leading-5 text-muted-foreground">
          Account details are displayed only while the short-lived private consent session remains valid.
          Nothing is automatically imported into your encrypted financial history.
        </p>
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={()=>{void refresh()}} disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-50">
          {loading?<LoaderCircle size={15} className="animate-spin"/>:<RefreshCw size={15}/>}Refresh status
        </button>
        {status?.ready&&!status.linked&&<button type="button" onClick={()=>{void act('connect')}}
          disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-50">
          <ExternalLink size={15}/>Connect through Standard Bank
        </button>}
        {status?.linked&&<button type="button" onClick={()=>{void act('disconnect')}} disabled={loading}
          className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-50">
          Disconnect local bank session
        </button>}
      </div>
    </>}
    <a href="https://developer.standardbank.co.za/" target="_blank" rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold text-primary underline">
      <ExternalLink size={14}/>Standard Bank official API developer portal
    </a>
    <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
      <ShieldCheck size={15} className="mt-0.5 shrink-0"/>Read-only account viewing. No payment, transfer or trading permissions.
    </p>
  </section>;
}
