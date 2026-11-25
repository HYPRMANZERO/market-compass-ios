/**
 * iOS visual-viewport recovery for the persistent mobile tab bar.
 *
 * WebKit sometimes leaves a fixed footer attached to its older layout viewport
 * after the software keyboard closes. Align its *visible* bottom to the actual
 * visualViewport bottom, without resizing other content or touching storage.
 */
export function mobileFooterCorrection(
  visibleViewportBottom:number,
  measuredFooterBottom:number,
  existingShift:number
):number {
  if(![visibleViewportBottom,measuredFooterBottom,existingShift].every(Number.isFinite))
    return 0;
  const correction=Math.round(visibleViewportBottom-(measuredFooterBottom-existingShift));
  // Ignore a transient keyboard resize or bogus WebKit viewport reading.
  if(Math.abs(correction)>180)return 0;
  return Math.abs(correction)<8?0:correction;
}

export function installMobileViewportRecovery():()=>void {
  if(!/iphone|ipad|ipod/i.test(navigator.userAgent))return ()=>{};
  if(window.matchMedia('(min-width: 1024px)').matches)return ()=>{};
  const visual=window.visualViewport;
  const root=document.documentElement;
  let appliedShift=0;
  let frame=0;
  const timers=new Set<number>();
  let disposed=false;
  const measure=()=>{
    frame=0;
    if(disposed)return;
    const nav=document.querySelector<HTMLElement>('.mc-mobile-tabbar');
    if(!nav)return;
    if(root.classList.contains('mc-chat-keyboard-open') ||
       window.getComputedStyle(nav).display==='none'){
      nav.style.removeProperty('translate');
      appliedShift=0;
      return;
    }
    const bottom=(visual?.offsetTop??0)+(visual?.height??window.innerHeight);
    const rect=nav.getBoundingClientRect();
    if(rect.height===0)return;
    const next=mobileFooterCorrection(bottom,rect.bottom,appliedShift);
    if(next!==appliedShift){
      nav.style.translate=next?('0 '+next+'px'):'';
      appliedShift=next;
    }
  };
  const schedule=()=>{
    if(disposed)return;
    if(frame)window.cancelAnimationFrame(frame);
    frame=window.requestAnimationFrame(measure);
  };
  const settle=()=>{
    schedule();
    for(const delay of [100,280,520]){
      const timer=window.setTimeout(()=>{timers.delete(timer);schedule();},delay);
      timers.add(timer);
    }
  };
  const onVisibility=()=>{if(document.visibilityState==='visible')settle();};
  visual?.addEventListener('resize',schedule);
  visual?.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('pageshow',settle);
  window.addEventListener('focusout',settle);
  window.addEventListener('focusin',settle);
  document.addEventListener('visibilitychange',onVisibility);
  settle();
  return ()=>{
    disposed=true;
    if(frame)window.cancelAnimationFrame(frame);
    for(const timer of timers)window.clearTimeout(timer);
    timers.clear();
    visual?.removeEventListener('resize',schedule);
    visual?.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);
    window.removeEventListener('pageshow',settle);
    window.removeEventListener('focusout',settle);
    window.removeEventListener('focusin',settle);
    document.removeEventListener('visibilitychange',onVisibility);
    document.querySelector<HTMLElement>('.mc-mobile-tabbar')?.style.removeProperty('translate');
  };
}
