import {useCallback,useEffect,useState} from 'react';
import {ExternalLink,RefreshCw,ShieldCheck,WalletCards} from 'lucide-react';
import {Link} from 'wouter';
import type {DesktopAiSettings} from '@/lib/desktopAiSettings';
import {currentAssistantEdition} from '@/lib/assistantEdition';

type BankAccount={id:string;displayName:string;last4:string;currency:string;balance?:number;selected:boolean};
type BankStatus={provider:string;ready:boolean;linked:boolean;accounts:BankAccount[];lastError:string;message:string};
const bankHost=(host:string)=>/^(?:[a-z0-9-]+\.)*standardbank\.(?:co\.za|com)$/i.test(host);
const allowedReturnUrl=(raw:string)=>{
  try {
    const url=new URL(raw);
    return url.protocol==='https:'&&!url.username&&!url.password&&
      !url.port&&bankHost(url.hostname)&&!url.hash?url.href:null;
  }catch{return null;}
};
const formatBalance=(value:number,currency:string)=>{
  try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(value);}
  catch{return String(value)+' '+currency;}
};
/** OAuth account consent is Finance-only and never stores provider tokens in the PWA. */
export default function StandardBankConnection({settings}:{settings:DesktopAiSettings}){
  const [status,setStatus]=useState<BankStatus|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const finance=currentAssistantEdition()==='finance';
  const allowedOrigin=typeof window!=='undefined'&&/^([a-z0-9-]+)\.ngrok-free\.(?:app|dev)$/.test(window.location.hostname);
  const readyForLocalAuth=Boolean(finance&&allowedOrigin&&settings.enabled&&settings.token?.length>=48&&
    settings.url&&new URL(settings.url,window.location.href).origin===window.location.origin);
  const invoke=useCallback(async(route:string,method:'GET'|'POST'='GET',body?:unknown)=>{
    if(!readyForLocalAuth)throw Error('Connect the private desktop AI in this Finance workspace before linking a bank.');
    const response=await fetch('/api/banks/standard-bank/'+route,{
      method,credentials:'same-origin',cache:'no-store',
      headers:{Authorization:'Bearer '+settings.token,
        ...(method==='POST'?{'Content-Type':'application/json'}:{})},
      ...(body!==undefined?{body:JSON.stringify(body)}:{})});
    let data;
    try{data=await response.json();}catch{throw Error('Private bank-connection gateway unavailable.');}
    if(!response.ok){
      if(response.status===503&&data?.error==='bank_not_configured'){
        setStatus(data);
        throw Error('Standard Bank has not approved this application or its verified read-only endpoints yet.');
      }
      throw Error(response.status===401?'Private desktop token rejected. Reconnect on the AI page.':
        'Bank-connection request not accepted ('+response.status+').');
    }
    return data;
  },[readyForLocalAuth,settings.token]);
  const refresh=useCallback(async()=>{
    if(!readyForLocalAuth)return;
    try{setStatus(await invoke('status'));setMessage('');}
    catch(error){setMessage(error instanceof Error?error.message:'Connection unavailable.');}
  },[readyForLocalAuth,invoke]);
  useEffect(()=>{void refresh();},[refresh]);
  const connect=async()=>{
    setBusy(true);setMessage('');
    try{
      const result=await invoke('connect','POST');
      const url=allowedReturnUrl(result.authorizationUrl);
      if(!url)throw Error('The bank returned an unapproved consent destination. Connection aborted.');
      window.location.assign(url);
    }catch(error){setMessage(error instanceof Error?error.message:'Unable to start bank consent.');}
    finally{setBusy(false);}
  };
  const select=async(accountId:string)=>{
    setBusy(true);
    try{setStatus(await invoke('select','POST',{accountId}));setMessage('Account selected for read-only viewing.');}
    catch(error){setMessage(error instanceof Error?error.message:'Account selection failed.');}
    finally{setBusy(false);}
  };
  const disconnect=async()=>{
    if(!window.confirm('Clear the local Standard Bank session? You must also revoke third-party consent in Standard Bank Internet Banking.'))return;
    setBusy(true);
    try{
      const updated=await invoke('disconnect','POST');
      setStatus(updated);setMessage(updated.notice);
    }catch(error){setMessage(error instanceof Error?error.message:'Unable to clear bank session.');}
    finally{setBusy(false);}
  };
  if(!finance)return null;
  return <section id="mc-standard-bank-connection" className="mt-3 min-w-0 rounded-2xl border border-primary/30 bg-background p-4" aria-label="Connect Standard Bank" data-testid="standard-bank-consent">
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><WalletCards size={21}/></span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-bold">Standard Bank</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Official partner consent, read-only accounts. Sign-in happens on the bank's authorized page, never inside Compass.</p>
      </div>
    </div>
    {!readyForLocalAuth?<div className="mt-3 rounded-xl bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
      Connect the protected HYPRBOX AI session in the Finance edition first.
      <Link className="ml-1 font-semibold text-primary" href="/assistant">Open AI settings</Link>
    </div>:<>
      {status&&!status.ready&&<p className="mt-3 rounded-xl bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
        Partner onboarding pending. Standard Bank has not issued verified account API access and OAuth client credentials for this application.
      </p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!status?.linked&&<button type="button" disabled={busy||!status?.ready}
          onClick={connect}
          className="min-h-11 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-45">
          {busy?'Preparing bank authorization...':'Connect Standard Bank'}
        </button>}
        <button type="button" disabled={busy} onClick={()=>void refresh()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-45">
          <RefreshCw size={15}/>Check connection
        </button>
        {status?.linked&&<button type="button" disabled={busy} onClick={disconnect}
          className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-45">Disconnect locally</button>}
      </div>
      <a href="https://developer.standardbank.co.za/" target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
        Standard Bank official API developer portal <ExternalLink size={13}/>
      </a>
      {status?.lastError&&<p role="alert" className="mt-3 text-[11px] text-destructive">{status.lastError}</p>}
      {status?.linked&&<div className="mt-4 space-y-2">
        <h4 className="text-[12px] font-bold">Choose an account to view</h4>
        {status.accounts.length===0?<p className="text-[11px] text-muted-foreground">No accounts were returned under this consent.</p>:
        status.accounts.map(account=><article key={account.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center" data-testid="standard-bank-account">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold">{account.displayName} •••• {account.last4}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {typeof account.balance==='number'?formatBalance(account.balance,account.currency):'Balance unavailable'}
              {' · '}{account.currency} · Bank-provided
            </p>
          </div>
          <button type="button" disabled={busy||account.selected} onClick={()=>void select(account.id)}
            className="min-h-11 rounded-xl border border-primary px-3 text-[12px] font-semibold text-primary disabled:opacity-50">
            {account.selected?'Selected':'View account'}
          </button>
        </article>)}
        <p className="text-[11px] leading-5 text-muted-foreground">Only the selected account is marked for viewing. Statement history and bank refresh require a separately approved API contract; no data is imported automatically.</p>
      </div>}
    </>}
    {message&&<p role="status" className="mt-3 rounded-xl bg-muted/50 p-3 text-[11px] leading-5">{message}</p>}
    <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary"/>Provider tokens remain only in HYPRBOX process memory and expire. No banking passwords, payments or withdrawals are supported. Local disconnect does not revoke consent at the bank.
    </p>
  </section>;
}
