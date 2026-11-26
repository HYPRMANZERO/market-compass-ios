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

export function shouldBlockChatTouchScroll(
  scrollHost:{scrollTop:number;scrollHeight:number;clientHeight:number}|null,
  direction:number,
):boolean {
  if(!scrollHost || scrollHost.scrollHeight<=scrollHost.clientHeight+1)return true;
  if(direction>0&&scrollHost.scrollTop<=0)return true;
  if(direction<0&&scrollHost.scrollTop+scrollHost.clientHeight>=scrollHost.scrollHeight-1)return true;
  return false;
}

/**
 * In installed iOS WebKit the layout viewport may extend BELOW the visual
 * viewport, leaving an apparently oversized footer beneath the home indicator.
 * Anchor the chat surface and tabs to the actual resting visual bottom.
 * This is deliberately a geometry-only calculation with no data side effects.
 */
export function assistantRestingViewportGeometry(
  layoutHeight:number,
  visualHeight:number,
  visualTop:number,
  tabbarHeight:number,
):{visibleBottom:number;bottomInset:number;tabbarHeight:number}{
  const layout=Number.isFinite(layoutHeight)&&layoutHeight>200?Math.round(layoutHeight):844;
  const visible=Number.isFinite(visualHeight)&&visualHeight>200?visualHeight:layout;
  const top=Number.isFinite(visualTop)?Math.max(0,visualTop):0;
  const visibleBottom=Math.min(layout,Math.max(220,Math.round(visible+top)));
  const bottomInset=Math.min(200,Math.max(0,layout-visibleBottom));
  const nav=Number.isFinite(tabbarHeight)&&tabbarHeight>=58&&tabbarHeight<=180
    ?Math.round(tabbarHeight):100;
  return {visibleBottom,bottomInset,tabbarHeight:nav};
}

/**
 * The chat surface is absolutely positioned in document coordinates, but the
 * region it has to fill is the VISUAL viewport band. Installed iOS WebKit keeps
 * the document frozen while it pans the visual viewport down to keep the focused
 * composer above the keyboard: scrollY stays 0, so visualViewport.pageTop reports
 * 0 while offsetTop reports the pan. Using pageTop alone then draws the surface
 * too high and leaves a strip of empty page between the composer and the
 * keyboard. The band's top on screen is therefore the larger of the two.
 */
export function chatSurfaceVisibleTop(offsetTop:number,pageTop:number):number {
  const offset=Number.isFinite(offsetTop)?Math.max(0,Math.round(offsetTop)):0;
  const page=Number.isFinite(pageTop)?Math.max(0,Math.round(pageTop)):0;
  return Math.max(offset,page);
}

export function installAssistantKeyboardViewport():()=>void {
  const root=document.documentElement;
  const visual=window.visualViewport;
  // The AI screen is a viewport-bound application surface, not a long page.
  // Scope the lock to this route; other pages still scroll normally.
  root.classList.add('mc-assistant-route');
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
    if(!keyboardOpen){
      // The footer is outside the assistant component; only this route owns
      // its bottom inset. A 100dvh-only calculation can place the tabbar
      // BELOW the visible screen in standalone iOS Safari.
      const nav=document.querySelector<HTMLElement>('.mc-mobile-tabbar');
      const geometry=assistantRestingViewportGeometry(
        window.innerHeight,height,top,nav?.getBoundingClientRect().height??100
      );
      root.style.setProperty('--mc-chat-resting-visible-bottom',geometry.visibleBottom+'px');
      root.style.setProperty('--mc-chat-resting-bottom-inset',geometry.bottomInset+'px');
      root.style.setProperty('--mc-chat-tabbar-height',geometry.tabbarHeight+'px');
    }
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
      root.style.setProperty('--mc-chat-visible-page-top',chatSurfaceVisibleTop(top,pageTop)+'px');
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
  // WebKit can rubber-band the document even when CSS overflow is hidden.
  // Keep touch gestures inside the conversation (or a deliberately opened
  // tools/menu drawer). Do not interfere with taps, pinches or other routes.
  let touchScrollHost:HTMLElement|null=null;
  let touchY=0;
  const onTouchStart=(event:TouchEvent)=>{
    if(window.innerWidth>=1024||event.touches.length!==1){touchScrollHost=null;return;}
    touchY=event.touches[0].clientY;
    touchScrollHost=event.target instanceof Element
      ?event.target.closest<HTMLElement>('.mc-chat-log, .mc-chat-actions-drawer, .mc-composer-input, .mc-quick-menu-panel')
      :null;
  };
  const onTouchMove=(event:TouchEvent)=>{
    if(window.innerWidth>=1024||event.touches.length!==1||!event.cancelable)return;
    const nextY=event.touches[0].clientY;
    const direction=nextY-touchY;
    touchY=nextY;
    if(shouldBlockChatTouchScroll(touchScrollHost,direction))event.preventDefault();
  };
  document.addEventListener('touchstart',onTouchStart,{passive:true});
  document.addEventListener('touchmove',onTouchMove,{passive:false});
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
    document.removeEventListener('touchstart',onTouchStart);
    document.removeEventListener('touchmove',onTouchMove);
    document.removeEventListener('focusin',onFocus);
    document.removeEventListener('focusout',onBlur);
    visual?.removeEventListener('resize',schedule);
    visual?.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);
    window.removeEventListener('pageshow',schedule);
    root.classList.remove('mc-chat-input-focused','mc-chat-keyboard-open','mc-assistant-route');
    root.style.removeProperty('--mc-chat-visible-height');
    root.style.removeProperty('--mc-chat-visible-top');
    root.style.removeProperty('--mc-chat-visible-page-top');
    root.style.removeProperty('--mc-chat-resting-visible-bottom');
    root.style.removeProperty('--mc-chat-resting-bottom-inset');
    root.style.removeProperty('--mc-chat-tabbar-height');
  };
}
