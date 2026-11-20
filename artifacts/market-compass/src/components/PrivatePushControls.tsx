import { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import type { DesktopAiSettings } from '@/lib/desktopAiSettings';
import { privateTailnetOrigin } from '@/lib/privateTailnetUrl';

function decodeBase64Url(text:string):Uint8Array {
  const raw=atob(text.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(text.length/4)*4,'='));
  return Uint8Array.from(raw,char=>char.charCodeAt(0));
}
export default function PrivatePushControls({settings,connected}:{settings:DesktopAiSettings;connected:boolean}){
  const [supported,setSupported]=useState(false);
  const [subscribed,setSubscribed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  // An installed Home Screen application on iPhone is required for iOS Web Push.
  const privateSameOrigin=typeof window!=='undefined' && privateTailnetOrigin(settings.url)===window.location.origin
    && !window.location.hostname.endsWith('.github.io');
  useEffect(()=>{
    const supportedNow=privateSameOrigin&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
    setSupported(supportedNow);
    if(!supportedNow)return;
    void navigator.serviceWorker.ready.then(async registration=>{
      const subscription=await registration.pushManager.getSubscription();
      setSubscribed(Boolean(subscription));
    }).catch(()=>{});
  },[privateSameOrigin]);
  async function request(path:string,method:'GET'|'POST'|'DELETE'='GET',body?:object) {
    const response=await fetch('/api/push/'+path,{method,credentials:'omit',cache:'no-store',
      headers:{Authorization:'Bearer '+settings.token,...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined});
    const result=await response.json();
    if(!response.ok||result.ok!==true)throw Error(result.error||'Private notification service unavailable.');
    return result;
  }
  async function enable(){
    if(!connected||!supported)return;
    setBusy(true);setStatus('');
    try{
      // The explicit button press is required for iOS notification permission.
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw Error('Notification permission was not granted in iOS Settings.');
      const registration=await navigator.serviceWorker.ready;
      const keys=await request('key');
      const key=decodeBase64Url(keys.publicKey);
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,
        applicationServerKey:key.buffer.slice(key.byteOffset,key.byteOffset+key.byteLength) as ArrayBuffer});
      await request('subscription','POST',{subscription:subscription.toJSON()});
      setSubscribed(true);setStatus('Registered with the private HYPRBOX reminder service. A Home Screen installation and a running desktop are required for delivery.');
    }catch(error){setStatus(error instanceof Error?error.message:'Could not enable notifications.');}
    finally{setBusy(false);}
  }
  async function disable(){
    setBusy(true);setStatus('');
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){
        await request('subscription','DELETE',{subscription:subscription.toJSON()});
        await subscription.unsubscribe();
      }
      setSubscribed(false);setStatus('This device has been removed from private reminders.');
    }catch(error){setStatus(error instanceof Error?error.message:'Unable to disable reminders.');}
    finally{setBusy(false);}
  }
  async function test(){
    setBusy(true);setStatus('');
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(!subscription)throw Error('Enable notifications first.');
      const outcome=await request('test','POST',{subscription:subscription.toJSON()});
      setStatus(outcome.submitted?'Test notification accepted by the push provider. Check your iPhone; delivery is not guaranteed.':'Test request completed.');
    }catch(error){setStatus(error instanceof Error?error.message:'Test notification failed.');}
    finally{setBusy(false);}
  }
  return <section className="mt-4 rounded-xl border border-border p-3" aria-label="Private iPhone push reminders">
    <h3 className="text-[12px] font-bold">iPhone salary-day notifications</h3>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
      Optional generic alerts on the 26th at or after 08:00 South Africa time. Only available from your private, Cloudflare Access-protected Home Screen app when HYPRBOX is online; not from GitHub Pages. No debt amounts appear on the lock screen.
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      {!subscribed?<button type="button" disabled={!connected||!supported||busy} onClick={()=>void enable()} className="min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold disabled:opacity-50"><Bell size={15} className="mr-1 inline"/> Enable iPhone alerts</button>:
      <button type="button" disabled={!connected||busy} onClick={()=>void disable()} className="min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold disabled:opacity-50"><BellOff size={15} className="mr-1 inline"/> Disable alerts</button>}
      {subscribed&&<button type="button" disabled={!connected||busy} onClick={()=>void test()} className="min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold disabled:opacity-50"><Send size={15} className="mr-1 inline"/> Send test alert</button>}
    </div>
    {!privateSameOrigin&&<p className="mt-2 text-[11px] text-muted-foreground">For background notifications, install the private Market Compass address using Safari → Share → Add to Home Screen.</p>}
    {privateSameOrigin&&!supported&&<p className="mt-2 text-[11px] text-muted-foreground">This browser does not offer push here. On iPhone use iOS 16.4 or later and launch the app from its Home Screen icon.</p>}
    {status&&<p role="status" className="mt-2 text-[11px] text-muted-foreground">{status}</p>}
  </section>;
}
