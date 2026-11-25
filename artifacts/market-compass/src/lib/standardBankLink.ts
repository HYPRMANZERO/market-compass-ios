/**
 * Standard Bank: finance-edition only, approved PARTNER flow.
 * No password, account number, bank bearer or client secret enters the browser.
 * The bank gateway is the authenticated SAME-ORIGIN finance PWA, never GitHub
 * Pages, arbitrary web origins, the bare AI bridge or a direct bank endpoint.
 */
import type {DesktopAiSettings} from './desktopAiSettings.ts';

const NGROK_HOST=/^[a-z0-9-]+\.ngrok-free\.(?:dev|app)$/;
const BANK_HOST=/^(?:[a-z0-9-]+\.)*standardbank\.(?:co\.za|com)$/;
export type StandardBankViewAccount={
  id:string;displayName:string;last4:string;currency:string;
  balance?:number;selected:boolean;
};
export type StandardBankLinkStatus={
  provider:'standard-bank';mode:'read-only';ready:boolean;linked:boolean;
  accounts:StandardBankViewAccount[];message:string;lastError:string;
};
export function eligibleFinanceBankOrigin(origin:unknown,settings:DesktopAiSettings|undefined,
  edition:'finance'|'personal'):boolean{
  if(edition!=='finance'||typeof origin!=='string'||!settings?.enabled||!settings?.token||
     !/^[a-zA-Z0-9_-]{48,512}$/.test(settings.token))return false;
  try{
    const target=new URL(origin),configured=new URL(settings.url);
    return target.protocol==='https:'&&NGROK_HOST.test(target.hostname)&&
      target.port===''&&target.username===''&&target.password===''&&
      target.pathname==='/'&&!target.search&&!target.hash&&
      configured.origin===target.origin&&configured.username===''&&configured.password==='';
  }catch{return false;}
}
export function validStandardBankRedirect(value:unknown):string|null{
  if(typeof value!=='string'||value.length>4000)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||!BANK_HOST.test(url.hostname)||url.username||url.password||
       url.port||url.hash||url.pathname==='/'||!url.searchParams.has('state')||
       !url.searchParams.has('code_challenge')||
       url.searchParams.get('code_challenge_method')!=='S256'||
       url.searchParams.get('response_type')!=='code')return null;
    return url.href;
  }catch{return null;}
}
export function parseBankLinkStatus(raw:unknown):StandardBankLinkStatus{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Unverified bank status.');
  const data=raw as Record<string,unknown>;
  if(data.provider!=='standard-bank'||data.mode!=='read-only'||
     typeof data.ready!=='boolean'||typeof data.linked!=='boolean'||
     !Array.isArray(data.accounts)||data.accounts.length>100||
     typeof data.message!=='string'||typeof data.lastError!=='string')
    throw Error('Unverified bank status.');
  const accounts:StandardBankViewAccount[]=[];
  for(const a of data.accounts){
    if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Invalid bank account metadata.');
    const account=a as Record<string,unknown>;
    if(typeof account.id!=='string'||!account.id||account.id.length>128||
       typeof account.displayName!=='string'||!account.displayName||
       account.displayName.length>80||!/^\d{4}$/.test(String(account.last4||''))||
       !/^[A-Z]{3}$/.test(String(account.currency||''))||
       typeof account.selected!=='boolean'||
       (account.balance!==undefined&&(!Number.isFinite(account.balance)||Math.abs(account.balance as number)>1e15)))
      throw Error('Invalid bank account metadata.');
    accounts.push({id:account.id,displayName:account.displayName,
      last4:String(account.last4),currency:String(account.currency),
      selected:account.selected,...(account.balance===undefined?{}:{balance:account.balance as number})});
  }
  if(!data.linked&&accounts.length)throw Error('Unlinked provider returned accounts.');
  if(accounts.filter(a=>a.selected).length>1||
     new Set(accounts.map(a=>a.id)).size!==accounts.length)
    throw Error('Inconsistent account selection.');
  return {provider:'standard-bank',mode:'read-only',ready:data.ready,linked:data.linked,
    accounts,message:data.message.slice(0,300),lastError:data.lastError.slice(0,300)};
}
type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export async function standardBankApi(
  origin:string,settings:DesktopAiSettings,edition:'finance'|'personal',
  action:'status'|'connect'|'select'|'disconnect',
  input?:{accountId:string},fetchImpl:Fetcher=fetch
):Promise<StandardBankLinkStatus|{authorizationUrl:string}>{
  if(!eligibleFinanceBankOrigin(origin,settings,edition))
    throw Error('Standard Bank linking is only available from the authenticated Finance edition.');
  const method=action==='status'?'GET':'POST';
  if(action==='select'&&(!input||typeof input.accountId!=='string'||input.accountId.length>128||
    !input.accountId))throw Error('Select a verified bank account.');
  const response=await fetchImpl(new URL('/api/banks/standard-bank/'+action,origin).href,{
    method,mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{Authorization:'Bearer '+settings.token,...(action==='select'?{'Content-Type':'application/json'}:{})},
    ...(action==='select'?{body:JSON.stringify({accountId:input?.accountId})}:{})
  });
  if(!response.ok)throw Error(response.status===503?'Official bank access is not approved or available.':
    response.status===401||response.status===403?'Private Finance session must be reconnected.':
    'Could not verify the bank connection.');
  const raw:unknown=await response.json();
  if(action==='connect'){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Unverified bank authorization URL.');
    const url=validStandardBankRedirect((raw as Record<string,unknown>).authorizationUrl);
    if(!url)throw Error('Bank did not provide a verified authorization redirect.');
    return {authorizationUrl:url};
  }
  return parseBankLinkStatus(raw);
}
