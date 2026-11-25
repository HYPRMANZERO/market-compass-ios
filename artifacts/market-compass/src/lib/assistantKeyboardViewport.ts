/**
 * iOS Safari/WebKit keeps the layout viewport at its pre-keyboard size while
 * the visible viewport shrinks. Only the AI composer uses this adaptation.
 * Never resize or lock other financial routes and never touch vault storage.
 */
export function isChatKeyboardVisible(
  composerFocused:boolean,
  restingViewportHeight:number,
  visibleViewportHeight:number,
):boolean {
  return composerFocused &&
    Number.isFinite(restingViewportHeight) &&
    Number.isFinite(visibleViewportHeight) &&
    visibleViewportHeight>0 &&
    restingViewportHeight-visibleViewportHeight>=140;
}

export function installAssistantKeyboardViewport():()=>void {
  const root=document.documentElement;
  const visual=window.visualViewport;
  let baseline=Math.max(window.innerHeight,visual?.height??window.innerHeight);
  let baselineWidth=Math.round(visual?.width??window.innerWidth);
  let focused=document.activeElement instanceof Element &&
    document.activeElement.matches('textarea.mc-composer-input');
  let frame=0;
  let restoreTimer=0;
  let wasKeyboardOpen=false;
  const settleTimers=new Set<number>();
  const settle=()=>{
    // WebKit may dispatch the focus event before the keyboard has finished
    // resizing the visual viewport, especially in an installed Home Screen PWA.
    for(const delay of [80,240,480]){
      const timer=window.setTimeout(()=>{settleTimers.delete(timer);schedule();},delay);
      settleTimers.add(timer);
    }
  };

  const measure=()=>{
    frame=0;
    const height=Math.max(220,Math.round(visual?.height??window.innerHeight));
    const top=Math.max(0,Math.round(visual?.offsetTop??0));
    const pageTop=Math.max(0,Math.round(visual?.pageTop??(window.scrollY+top)));
    // Do not mistake a still-visible keyboard for a new resting height
    // during a transient blur. Recalibrate after viewport recovery or rotation.
    const width=Math.round(visual?.width??window.innerWidth);
    if(!focused&&(height>=baseline-80||Math.abs(width-baselineWidth)>80)){
      baseline=Math.max(window.innerHeight,height);
      baselineWidth=width;
    }
    const keyboardOpen=isChatKeyboardVisible(focused,baseline,height);
    root.classList.toggle('mc-chat-input-focused',focused);
    root.classList.toggle('mc-chat-keyboard-open',keyboardOpen);
    if(wasKeyboardOpen&&!keyboardOpen){
      // Closing via the keyboard's Done button may preserve input focus.
      // Reset WebKit's document auto-pan even without a blur event.
      window.clearTimeout(restoreTimer);
      restoreTimer=window.setTimeout(()=>{
        if(!root.classList.contains('mc-chat-keyboard-open'))window.scrollTo(0,0);
      },240);
    }
    wasKeyboardOpen=keyboardOpen;
    if(focused){
      root.style.setProperty('--mc-chat-visible-height',height+'px');
      root.style.setProperty('--mc-chat-visible-top',top+'px');
      root.style.setProperty('--mc-chat-visible-page-top',pageTop+'px');
    }else{
      root.style.removeProperty('--mc-chat-visible-height');
      root.style.removeProperty('--mc-chat-visible-top');
      root.style.removeProperty('--mc-chat-visible-page-top');
    }
  };
  const schedule=()=>{
    if(frame)window.cancelAnimationFrame(frame);
    frame=window.requestAnimationFrame(measure);
  };
  const isComposer=(target:EventTarget|null):boolean=>
    target instanceof Element&&target.matches('textarea.mc-composer-input');
  const onFocus=(event:FocusEvent)=>{
    if(!isComposer(event.target))return;
    window.clearTimeout(restoreTimer);
    focused=true;
    schedule();
    settle();
  };
  const onBlur=(event:FocusEvent)=>{
    if(!isComposer(event.target))return;
    focused=false;
    schedule();
    settle();
    // iOS may preserve the auto-panned document after dismissing the keyboard,
    // exposing the dark page background below the bottom tabs.
    restoreTimer=window.setTimeout(()=>{
      if(!focused)window.scrollTo(0,0);
    },250);
  };
  document.addEventListener('focusin',onFocus);
  document.addEventListener('focusout',onBlur);
  visual?.addEventListener('resize',schedule);
  visual?.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('pageshow',schedule);
  schedule();
  return ()=>{
    if(frame)window.cancelAnimationFrame(frame);
    window.clearTimeout(restoreTimer);
    for(const timer of settleTimers)window.clearTimeout(timer);
    settleTimers.clear();
    document.removeEventListener('focusin',onFocus);
    document.removeEventListener('focusout',onBlur);
    visual?.removeEventListener('resize',schedule);
    visual?.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);
    window.removeEventListener('pageshow',schedule);
    root.classList.remove('mc-chat-input-focused','mc-chat-keyboard-open');
    root.style.removeProperty('--mc-chat-visible-height');
    root.style.removeProperty('--mc-chat-visible-top');
    root.style.removeProperty('--mc-chat-visible-page-top');
  };
}
