/**
 * Owner-approved Compass Core AI peers, not an arbitrary LAN scanner.
 * A PWA cannot enumerate private devices or make unauthenticated connections.
 * Status checks use the existing identity-verified, read-only session endpoint.
 */
import {acquirePersonalTailnetSession,personalTailnetOrigin} from './personalTailnetAuto.ts';

export type PersonalDeviceChoice='auto'|'primary'|'standby';
export type ApprovedPersonalDevice={
  id:'primary'|'standby';name:string;origin:string;role:'Primary'|'Standby';
};
export type PersonalDeviceStatus='ready'|'unreachable';

export function approvedPersonalDevices(hosts:readonly string[]):ApprovedPersonalDevice[]{
  if(!Array.isArray(hosts)||hosts.length>2)return [];
  const found=new Set<string>();
  const devices:ApprovedPersonalDevice[]=[];
  for(let i=0;i<hosts.length;i++){
    const origin=personalTailnetOrigin(hosts[i]);
    if(!origin||origin!==hosts[i]||found.has(origin))return [];
    found.add(origin);
    const hostname=new URL(origin).hostname;
    const node=hostname.split('.')[0].slice(0,48).toUpperCase();
    devices.push({id:i===0?'primary':'standby',role:i===0?'Primary':'Standby',
      name:node,origin});
  }
  return devices;
}
/** A selected device is never silently replaced by another. Automatic is the
 * only mode that permits the already-approved fallback order. */
export function selectedPersonalHosts(
  hosts:readonly string[],choice:PersonalDeviceChoice
):string[]{
  const devices=approvedPersonalDevices(hosts);
  if(devices.length!==hosts.length)return [];
  if(choice==='auto')return devices.map(device=>device.origin);
  const device=devices.find(d=>d.id===choice);
  return device?[device.origin]:[];
}
/** This probes only the configured hosts; it discards short-lived bearer tokens
 * and never returns or persists operator credentials. */
export async function probeApprovedPersonalDevices(
  hosts:readonly string[],fetchImpl:typeof fetch=fetch
):Promise<Record<string,PersonalDeviceStatus>>{
  const devices=approvedPersonalDevices(hosts);
  if(devices.length!==hosts.length)return {};
  const statuses=await Promise.all(devices.map(async device=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      await acquirePersonalTailnetSession(device.origin,
        (url,options)=>fetchImpl(url,{...options,signal:controller.signal}));
      return [device.origin,'ready'] as const;
    }catch{
      return [device.origin,'unreachable'] as const;
    }finally{clearTimeout(timer);}
  }));
  return Object.fromEntries(statuses);
}
export type PersonalDeviceCommand=
  |{kind:'list'}
  |{kind:'select';choice:PersonalDeviceChoice}
  |{kind:'reject'};
export function interpretPersonalDeviceCommand(input:unknown):PersonalDeviceCommand|null{
  if(typeof input!=='string'||input.length>500)return null;
  const text=input.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ');
  if(/^(?:list|show)(?: my| approved)? (?:devices|compass core devices|network devices)$/.test(text)||
     /^(?:device status|devices status|which devices are available)$/.test(text))
    return {kind:'list'};
  if(/^(?:connect to|switch to|use|connect with) (?:the )?(?:hyprbox|primary(?: device)?)$/.test(text))
    return {kind:'select',choice:'primary'};
  if(/^(?:connect to|switch to|use|connect with) (?:the )?(?:hyprslap|standby(?: device)?)$/.test(text))
    return {kind:'select',choice:'standby'};
  if(/^(?:connect to|switch to|use|connect with) (?:automatic|auto|automatic failover|auto failover)$/.test(text)||
     /^(?:restore|enable|use) automatic (?:device selection|connection|failover)$/.test(text))
    return {kind:'select',choice:'auto'};
  // Do not send a command to connect to arbitrary endpoints through an LLM.
  if(/^(?:connect to|switch to|connect with|scan (?:the )?(?:network|devices))\b/.test(text))
    return {kind:'reject'};
  return null;
}
