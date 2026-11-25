/**
 * Compass Personal automatic Tailscale Serve connection.
 * The host is public configuration; the private operator secret never leaves
 * HYPRBOX. A Tailscale user identity and short-lived session are checked by the
 * loopback gateway on every request. Browser bearer is held in memory only.
 */
export type PersonalTailnetSession={origin:string;token:string;expiresAt:number};
const TOKEN=/^[A-Za-z0-9_-]{60,200}$/;
const ORIGIN=/^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net$/;
const SESSION_SECONDS=900;
const MAX_QUESTION=2000;

export function personalTailnetOrigin(raw:unknown):string|null{
  if(typeof raw!=='string'||!raw.trim()||raw.length>300)return null;
  try{
    const value=raw.trim();
    const url=new URL(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net\/?$/i.test(value)?'https://'+value:value);
    if(url.protocol!=='https:'||url.username||url.password||url.port||
       url.pathname!=='/'||url.search||url.hash||!ORIGIN.test(url.hostname))
      return null;
    return url.origin;
  }catch{return null;}
}
export function personalSessionActive(session:PersonalTailnetSession|null,origin:string|null,now=Date.now()):boolean{
  return Boolean(session&&origin&&session.origin===origin&&TOKEN.test(session.token)&&
    Number.isFinite(session.expiresAt)&&session.expiresAt>now);
}
export async function acquirePersonalTailnetSession(origin:string,fetchImpl:typeof fetch=fetch):Promise<PersonalTailnetSession>{
  const clean=personalTailnetOrigin(origin);
  if(!clean||clean!==origin)throw Error('Invalid Personal tailnet endpoint.');
  const response=await fetchImpl(clean+'/api/personal/session',{
    method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
    referrerPolicy:'no-referrer'
  });
  if(!response.ok)throw Error('Tailnet is offline, denied or private Compass is not ready.');
  const data:unknown=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Untrusted Personal session.');
  const info=data as Record<string,unknown>;
  if(info.authorized!==true||info.modelAvailable!==true||info.edition!=='personal'||
     info.readOnly!==true||info.agentMode!=='always-on'||
     info.expiresInSeconds!==SESSION_SECONDS||typeof info.token!=='string'||!TOKEN.test(info.token))
    throw Error('Untrusted Personal session.');
  return {origin:clean,token:info.token,expiresAt:Date.now()+SESSION_SECONDS*1000};
}
export async function sendPersonalTailnetAgent(
  session:PersonalTailnetSession,query:string,financialContext?:unknown,
  fetchImpl:typeof fetch=fetch
):Promise<unknown>{
  if(!personalSessionActive(session,personalTailnetOrigin(session?.origin)))
    throw Error('Personal tailnet session has expired.');
  if(typeof query!=='string'||!query.trim()||query.length>MAX_QUESTION)
    throw Error('Invalid agent question.');
  const response=await fetchImpl(session.origin+'/api/personal/agent/run',{
    method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
    referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},
    body:JSON.stringify({query,...(financialContext===undefined?{}:{financialContext})})
  });
  if(!response.ok)throw Error('Private read-only agent is unavailable.');
  const data:unknown=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid private agent reply.');
  const out=data as Record<string,unknown>;
  if(out.ok!==true||out.readOnly!==true||out.workspaceWritten!==false||
     out.approvalExecutionEnabled!==false||out.answerSource!=='private-desktop-model')
    throw Error('Private agent did not confirm read-only execution.');
  return data;
}
