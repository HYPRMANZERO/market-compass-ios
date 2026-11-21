import { useEffect, useState } from 'react';
import { Bell, BellOff, ShieldCheck } from 'lucide-react';
import type { DesktopAiSettings } from '@/lib/desktopAiSettings';
import { privateTailnetOrigin } from '@/lib/privateTailnetUrl';

type Props = { settings:DesktopAiSettings };
function vapidBytes(value:string):ArrayBuffer {
  const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes.buffer;
}
export default function SalaryPush({settings}:Props){
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const privateOrigin=typeof window!=='undefined' &&
    privateTailnetOrigin(window.location.origin)===window.location.origin &&
    settings.enabled && privateTailnetOrigin(settings.url)===window.location.origin;
  const available=typeof window!=='undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  useEffect(()=>{
    if(!available || !privateOrigin)return;
    let live=true;
    navigator.serviceWorker.ready.then(reg=>reg.pushManager.getSubscription()).then(sub=>{
      if(live)setEnabled(Boolean(sub));
    }).catch(()=>{});
    return()=>{live=false};
  },[available,privateOrigin]);
  async function sendTest(){
    setBusy(true);setMessage('');
    try{
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if(!sub)throw Error('Enable private reminders before testing.');
      const response=await fetch('/api/push/test',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.token},
        body:JSON.stringify({subscription:sub.toJSON()})
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error||'Test notification could not be submitted.');
      setMessage('Test submitted to the push provider. Check your iPhone Notification Center; delivery must be confirmed on the device.');
    }catch(error){setMessage(error instanceof Error?error.message:'Push test failed.');}
    finally{setBusy(false);}
  }
  async function change(enable:boolean){
    if(!available || !privateOrigin)return;
    setBusy(true);setMessage('');
    try{
      // Request iOS permission directly from the button gesture; do not wait
      // for service-worker readiness before triggering the system prompt.
      if(enable){
        if(/iPhone|iPad|iPod/i.test(navigator.userAgent) &&
           !window.matchMedia('(display-mode: standalone)').matches)
          throw Error('Open the private Market Compass app from its Home Screen icon first.');
        if(Notification.permission==='denied')throw Error('Notifications are blocked in iPhone Settings.');
        const permission=await Notification.requestPermission();
        if(permission!=='granted')throw Error('Notification permission was not granted.');
      }
      const reg=await navigator.serviceWorker.ready;
      const existing=await reg.pushManager.getSubscription();
      if(enable){
        const response=await fetch('/api/push/key',{headers:{Authorization:'Bearer '+settings.token},cache:'no-store'});
        if(!response.ok)throw Error('Private notification service is not configured.');
        const data=await response.json() as {publicKey:string};
        const sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(data.publicKey)});
        const saved=await fetch('/api/push/subscription',{
          method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.token},
          body:JSON.stringify({subscription:sub.toJSON()})
        });
        if(!saved.ok)throw Error('Notification subscription could not be saved.');
        setEnabled(true);setMessage('Private salary-day notification enabled for the 26th at 08:00 South African time.');
      } else {
        if(existing){
          const response=await fetch('/api/push/subscription',{
            method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.token},
            body:JSON.stringify({subscription:existing.toJSON()})
          });
          if(!response.ok)throw Error('Could not remove subscription from the desktop. Retry while connected.');
          await existing.unsubscribe();
        }
        setEnabled(false);setMessage('iPhone push reminders disabled.');
      }
    }catch(error){setMessage(error instanceof Error?error.message:'Notification setup failed.');}
    finally{setBusy(false);}
  }
  return <section className="rounded-xl border border-border bg-muted/40 p-3">
    <h3 className="flex items-center gap-2 text-[12px] font-semibold"><Bell size={15}/> iPhone salary-day notification</h3>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
      On the protected private HTTPS version, a Home Screen installation can receive an opt-in reminder
      on the 26th even while the app is closed, as long as HYPRBOX, the tunnel and its push service remain online.
      The lock-screen message contains no salary amounts or account balances.
    </p>
    {!privateOrigin?<p className="mt-2 text-[11px] text-muted-foreground">
      Requires the private HTTPS version and a saved, connected desktop AI token. The public GitHub Pages version still supports Calendar reminders.
    </p>:!available?<p className="mt-2 text-[11px] text-muted-foreground">
      Browser Push is unavailable. On iPhone, open the private site in Safari, use Add to Home Screen, launch it from the icon, then return here.
    </p>:<>
      <button type="button" disabled={busy} onClick={()=>void change(!enabled)}
        className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-[12px] font-semibold disabled:opacity-50">
        {enabled?<BellOff size={15}/>:<Bell size={15}/>}
        {busy?'Updating…':enabled?'Disable private push reminder':'Enable private push reminder'}
      </button>
      {enabled&&<button type="button" disabled={busy} onClick={()=>void sendTest()}
        className="mt-2 min-h-11 rounded-xl border border-border bg-background px-3 text-[12px] font-semibold disabled:opacity-50">
        Send test notification now
      </button>}
    </>}
    {message&&<p role="status" className="mt-2 text-[11px]">{message}</p>}
    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck size={13}/> No personal expenses are uploaded to the notification service.</p>
  </section>;
}
