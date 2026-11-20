import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import type { DesktopAiSettings } from '@/lib/desktopAiSettings';

/** iOS 16.4+ requires this PWA installed to Home Screen and user gesture. */
export default function PrivatePushReminders({ ai }: { ai?: DesktopAiSettings }) {
  const [status,setStatus] = useState('');
  const [subscribed,setSubscribed] = useState(false);
  const privateOrigin = typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !window.location.hostname.endsWith('.github.io') &&
    ai?.enabled && ai.url && new URL(ai.url).origin === window.location.origin;
  useEffect(()=>{
    if(!privateOrigin || !('serviceWorker' in navigator) || !('PushManager' in window))return;
    void navigator.serviceWorker.ready.then(reg=>reg.pushManager.getSubscription())
      .then(sub=>setSubscribed(Boolean(sub))).catch(()=>{});
  },[privateOrigin]);
  if(!privateOrigin)return null;
  async function request(path:string,method:'GET'|'POST'|'DELETE'='GET',body?:unknown){
    const result=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{
      Authorization:'Bearer '+ai!.token,
      ...(body?{'Content-Type':'application/json'}:{})
    },body:body?JSON.stringify(body):undefined});
    const data=await result.json();
    if(!result.ok||data.ok!==true)throw Error(data.error||'Desktop notification service unavailable');
    return data;
  }
  async function enable(){
    setStatus('');
    try{
      if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator))
        throw Error('This browser does not support Web Push.');
      if(!window.matchMedia('(display-mode: standalone)').matches)
        throw Error('On iPhone, open Market Compass using its Home Screen icon first.');
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw Error('Notification permission was not granted.');
      const {publicKey}=await request('/api/push/key');
      const decode=(s:string)=>{
        const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
        return Uint8Array.from(raw,c=>c.charCodeAt(0));
      };
      const reg=await navigator.serviceWorker.ready;
      const subscription=await reg.pushManager.subscribe({userVisibleOnly:true,
        applicationServerKey:decode(publicKey)});
      try{
        await request('/api/push/subscription','POST',{subscription:subscription.toJSON()});
      }catch(error){await subscription.unsubscribe();throw error;}
      setSubscribed(true);
      setStatus('Salary-day notifications enabled. Alerts contain no account or balance information.');
    }catch(error){setStatus(error instanceof Error?error.message:'Push notifications unavailable.');}
  }
  async function disable(){
    try{
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if(sub){
        await request('/api/push/subscription','DELETE',{subscription:sub.toJSON()});
        await sub.unsubscribe();
      }
      setSubscribed(false);setStatus('Salary-day notifications disabled.');
    }catch(error){setStatus(error instanceof Error?error.message:'Unable to disable push.');}
  }
  return <section className="rounded-2xl border border-border bg-card p-4">
    <h2 className="text-[14px] font-bold"><Bell className="mr-1 inline" size={16}/> iPhone salary-day push</h2>
    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
      Optional reminders on the 26th after 08:00 South Africa time, even when the Home Screen app is closed.
      Requires the private Cloudflare Access edition, notification permission and an online HYPRBOX gateway.
      No salary amount or debt details appear in the alert. Delivery depends on Apple and network availability.
    </p>
    <button type="button" className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground"
      onClick={()=>void (subscribed?disable():enable())}>{subscribed?'Disable iPhone push':'Enable iPhone push'}</button>
    {status&&<p role="status" className="mt-2 text-[12px]">{status}</p>}
  </section>;
}
