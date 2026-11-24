/**
 * Owner-initiated Compass Personal connection to the separately enabled
 * /api/personal/ paths on the already OAuth-protected ngrok domain.
 *
 * PKCE verifier exists only briefly in sessionStorage during top-level OAuth.
 * The resulting 15-minute Personal bearer is NEVER persisted or exported.
 * Disable this flow by default until the matching private backend/edge policy
 * has passed Safari and identity-deny acceptance.
 */
export type PersonalSession={origin:string;token:string;expiresAt:number};
type Pending={origin:string;verifier:string;state:string;issuedAt:number};
const KEY='mc-personal-pkce-pending-v1';
const PAGES_ORIGIN='https://hyprmanzero.github.io';
const CALLBACK_PATH='/market-compass-ios/';
const TOKEN=/^[A-Za-z0-9_-]{40,256}$/;
const CODE=/^[A-Za-z0-9_-]{32,128}$/;
const STATE=/^[A-Za-z0-9_-]{24,128}$/;

export function verifyPersonalOrigin(raw:string):string{
  if(typeof raw!=='string'||raw.length>180)throw Error('Invalid private origin.');
  let url:URL;
  try{url=new URL(raw);}catch{throw Error('Invalid HTTPS origin.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||
     url.pathname!=='/'||url.search||url.hash||
     !/^[a-z0-9-]+\.ngrok-free\.(?:dev|app)$/.test(url.hostname))
    throw Error('Enter the exact owner-protected ngrok HTTPS origin.');
  return url.origin;
}
function assertPwaSite():void{
  if(typeof window==='undefined'||window.location.origin!==PAGES_ORIGIN||
     !window.location.pathname.startsWith(CALLBACK_PATH))
    throw Error('Personal connection is only available in the original Compass Personal PWA.');
}
function generate(size:number):string{
  const bytes=new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function challengeFor(verifier:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export async function beginPersonalOauth(rawOrigin:string,approvedOwnerOrigin:string):Promise<never>{
  assertPwaSite();
  const origin=verifyPersonalOrigin(rawOrigin);
  if(origin!==verifyPersonalOrigin(approvedOwnerOrigin))throw Error('Host is not the approved owner endpoint.');
  const pending:Pending={origin,verifier:generate(48),state:generate(24),issuedAt:Date.now()};
  // Save the transient verifier before asynchronous hashing. No access token is stored.
  sessionStorage.setItem(KEY,JSON.stringify(pending));
  const challenge=await challengeFor(pending.verifier);
  const params=new URLSearchParams({challenge,state:pending.state});
  window.location.assign(origin+'/personal/connect?'+params.toString());
  return new Promise<never>(()=>{});
}
export async function consumePersonalOauth(approvedOwnerOrigin:string):Promise<PersonalSession|null>{
  assertPwaSite();
  const hash=new URLSearchParams(window.location.hash.slice(1));
  if(!hash.has('mc-personal-code'))return null;
  // Strip authorization code from the address before any network request.
  window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
  const raw=sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if(!raw)throw Error('Personal OAuth handoff expired. Start connection again.');
  let p:Pending;
  try{p=JSON.parse(raw) as Pending;}catch{throw Error('Invalid Personal OAuth handoff.');}
  const code=hash.get('mc-personal-code')||'';
  const state=hash.get('state')||'';
  if(!CODE.test(code)||!STATE.test(state)||state!==p.state||
     !Number.isSafeInteger(p.issuedAt)||p.issuedAt>Date.now()||
     Date.now()-p.issuedAt>600_000)
    throw Error('Personal sign-in state expired or changed.');
  const origin=verifyPersonalOrigin(p.origin);
  if(origin!==verifyPersonalOrigin(approvedOwnerOrigin))throw Error('Unexpected Personal return origin.');
  const response=await fetch(origin+'/api/personal/exchange',{
    method:'POST',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code,verifier:p.verifier,state})
  });
  if(!response.ok)throw Error('Personal approval could not be verified.');
  const value=await response.json() as {accessToken?:unknown;expiresInSeconds?:unknown;edition?:unknown};
  if(!value||value.edition!=='personal'||typeof value.accessToken!=='string'||
     !TOKEN.test(value.accessToken)||value.expiresInSeconds!==900)
    throw Error('Unexpected private Personal session response.');
  return {origin,token:value.accessToken,expiresAt:Date.now()+900_000};
}
export function isValidPersonalSession(value:PersonalSession|null):value is PersonalSession{
  if(!value || typeof value.token!=='string'||!TOKEN.test(value.token)||value.expiresAt<=Date.now())return false;
  try{verifyPersonalOrigin(value.origin);return true;}catch{return false;}
}
export async function askPersonalCompass(session:PersonalSession,query:string,financialContext?:unknown){
  if(!isValidPersonalSession(session))throw Error('Personal session expired; reconnect securely.');
  if(typeof query!=='string'||!query.trim()||query.length>2000)throw Error('Invalid question.');
  const response=await fetch(session.origin+'/api/personal/chat',{
    method:'POST',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},
    body:JSON.stringify({query,...(financialContext?{financialContext}:{})})
  });
  if(!response.ok)throw Error('Private Compass is unavailable or the Personal session expired.');
  return response.json();
}
