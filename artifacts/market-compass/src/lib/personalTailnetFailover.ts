/**
 * Safe failover order for Compass Personal's two separately authenticated AI
 * nodes. Each host must independently run the model and Tailscale Serve.
 * No provider keys, account records or encrypted vault bytes are copied here.
 */
import {personalTailnetOrigin,acquirePersonalTailnetSession,
  type PersonalTailnetSession} from './personalTailnetAuto.ts';

export function approvedPersonalHosts(
  primary:unknown,fallback:unknown,legacy:unknown
):string[]{
  const first=personalTailnetOrigin(primary)||personalTailnetOrigin(legacy);
  const second=personalTailnetOrigin(fallback);
  if(!first)return [];
  return second&&second!==first?[first,second]:[first];
}
export async function acquireAvailablePersonalNode(
  orderedHosts:readonly string[], fetchImpl:typeof fetch=fetch
):Promise<PersonalTailnetSession>{
  if(!Array.isArray(orderedHosts)||orderedHosts.length<1||orderedHosts.length>2)
    throw Error('Only one primary and one approved standby are supported.');
  const attempted=new Set<string>();
  for(const host of orderedHosts){
    const validated=personalTailnetOrigin(host);
    if(validated!==host||attempted.has(host))throw Error('Unapproved failover host.');
    attempted.add(host);
    try{
      // Service identity and active private-model health are verified at each
      // node. A network failure is only retried for this idempotent GET,
      // never for the potentially costly POST agent request.
      // A powered-off primary cannot leave the iPhone waiting indefinitely.
      // Only the authenticated GET is timed out; no agent POST is replayed.
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),8000);
      try{
        const session=await acquirePersonalTailnetSession(host,
          (url,options)=>fetchImpl(url,{...options,signal:controller.signal}));
        if(session.origin===host)return session;
      }finally{clearTimeout(timer);}
    }catch{/* Only known, pinned hosts are eligible for fallback. */}
  }
  throw Error('All private Compass AI nodes are unavailable.');
}
