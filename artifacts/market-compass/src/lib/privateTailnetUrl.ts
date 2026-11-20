/**
 * Approved desktop AI origins:
 * 1. HTTPS Tailscale Serve host under .ts.net, unchanged.
 * 2. THIS application's HTTPS origin when hosted privately through the
 *    same-origin Cloudflare Access gateway. Never accept a third-party URL.
 * Public GitHub Pages remains limited to Tailscale Serve for remote AI.
 */
export function privateTailnetOrigin(raw: string): string | null {
  try {
    const entered=raw.trim();
    if(!entered)return null;
    const bare=/^(?:[a-z0-9-]+\.)+[a-z0-9-]+\/?$/i.test(entered);
    const url=new URL(bare?'https://'+entered:entered);
    if(url.protocol!=='https:'||url.username||url.password||url.port||
       url.pathname!=='/'||url.search||url.hash)return null;
    const labels=url.hostname.split('.');
    if(labels.some(label=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))return null;
    if(url.hostname.endsWith('.ts.net') && labels.length>=3)return url.origin;
    // Same-origin only; no cross-origin Access redirects/cookies or arbitrary public proxies.
    if(typeof window!=='undefined'&&window.location.protocol==='https:'&&
       window.location.hostname!=='hyprmanzero.github.io'&&
       window.location.hostname!=='localhost'&&
       url.origin===window.location.origin)return url.origin;
    return null;
  } catch {return null;}
}
