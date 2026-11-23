/**
 * Small, browser-safe subset of the owner's Jarvis Local Assistant.
 * The Python project is a desktop CLI; the PWA is NOT authorized to launch
 * Windows programs or use its unrestricted web/browser command target.
 * No AI output, extracted document, or remote tool result enters this parser.
 */
export type PersonalIntent =
  | {kind:'answer'; text:string}
  | {kind:'link'; text:string; label:string; url:string};

const SITES: Readonly<Record<string,{label:string;url:string}>>=Object.freeze({
  youtube:{label:'YouTube',url:'https://www.youtube.com/'},
  google:{label:'Google',url:'https://www.google.com/'},
  spotify:{label:'Spotify',url:'https://open.spotify.com/'},
  github:{label:'GitHub',url:'https://github.com/'},
  whatsapp:{label:'WhatsApp Web',url:'https://web.whatsapp.com/'}
});
const LOCAL_DESKTOP_APPS = /^(?:open|launch|start)\s+(?:(?:my|the)\s+)?(?:vs\s*code|visual studio code|discord|obs(?:\s+studio)?|ps remote play|playstation remote play|radmin vpn|firefox|chrome|edge|file explorer|explorer|powershell|terminal)(?:\s+app)?$/i;
const CONTROLS = /[\u0000-\u001f\u007f]/;

export function stripCompassWakeWord(raw:string):string {
  return raw.trim().replace(/^(?:(?:hey|hi|okay|ok)\s+)?(?:compass|jarvis)\b[\s,.:;!?-]*/i,'').trim();
}
export function interpretJarvisPersonalCommand(raw:string,now:Date=new Date()):PersonalIntent|null {
  const text=stripCompassWakeWord(raw);
  if(!text||text.length>500||CONTROLS.test(text))return null;
  const command=text.toLowerCase().replace(/[.!?]+$/g,'').trim();
  if(/^(?:time|current time|what time is it|tell me the time)$/.test(command)){
    return {kind:'answer',text:'It is '+new Intl.DateTimeFormat('en-ZA',{hour:'numeric',minute:'2-digit'}).format(now)+
      ' according to this device clock.'};
  }
  if(/^(?:date|today date|today.s date|what is the date)$/.test(command)){
    return {kind:'answer',text:'Today is '+new Intl.DateTimeFormat('en-ZA',{
      weekday:'long',day:'numeric',month:'long',year:'numeric'
    }).format(now)+' according to this device clock.'};
  }
  const site=/^(?:open|show)\s+(youtube|google|spotify|github|whatsapp)(?:\s+(?:web|website))?$/.exec(command);
  if(site){
    const item=SITES[site[1]];
    return {kind:'link',text:'Choose the link to open '+item.label+'. I have not opened a website automatically.',label:'Open '+item.label,url:item.url};
  }
  const search=/^search for\s+(.+)$/i.exec(text);
  if(search){
    const query=search[1].trim();
    if(!query||query.length>150 || CONTROLS.test(query))
      return {kind:'answer',text:'Please use a shorter search, up to 150 characters.'};
    return {kind:'link',text:'Choose the link to search the web for “'+query+'”. No search was sent until you open it.',
      label:'Search Google',url:'https://www.google.com/search?'+new URLSearchParams({q:query}).toString()};
  }
  if(/^(?:news|global news|latest news|headlines)$/.test(command)){
    return {kind:'link',text:'Open a news source when online. These are not locally verified current headlines.',
      label:'Open Google News',url:'https://news.google.com/'};
  }
  if(/^(?:list apps|show apps|installed apps|refresh apps)$/.test(command)||LOCAL_DESKTOP_APPS.test(command)){
    return {kind:'answer',text:'Desktop app discovery and launching are not enabled in this PWA. Compass can open its own pages; controlling Windows programs needs a separately approved local desktop companion.'};
  }
  if(/^play\s+.+/.test(command)){
    return {kind:'answer',text:'A personal music-link library is not configured in this Compass workspace. I have not played anything or accessed your device files.'};
  }
  if(/^(?:open|launch|start)\s+(?:https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(text)){
    return {kind:'answer',text:'For safety, Compass only offers verified website shortcuts here. Open other web addresses directly in your browser.'};
  }
  return null;
}
