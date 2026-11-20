/**
 * Validate a private AI origin. Prefer a .ts.net Tailscale Serve URL.
 * On an Access-protected Cloudflare-hosted copy of Market Compass, the
 * gateway lives at the same HTTPS origin as the web app. This deliberately
 * does NOT permit entering arbitrary public AI endpoints from GitHub Pages.
 */
export function privateTailnetOrigin(raw: string): string | null {
  try {
    const entered = raw.trim();
    if (!entered) return null;
    const bareHostname = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+\/?$/i.test(entered);
    const url = new URL(bareHostname ? `https://${entered}` : entered);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.pathname !== '/' || url.search || url.hash) return null;
    if (url.hostname.endsWith('.ts.net')) {
      const prefix = url.hostname.slice(0, -'.ts.net'.length);
      if (!prefix || prefix.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return null;
      return url.origin;
    }
    // Cloudflare Access-hosted deployment: browser credentials stay first-party.
    // Never weaken the GitHub Pages copy to accept an arbitrary public tunnel.
    if (typeof window !== 'undefined' &&
        url.origin === window.location.origin &&
        !/\.github\.io$/i.test(url.hostname) &&
        !/^(localhost|127\.0\.0\.1)$/i.test(url.hostname) &&
        url.hostname.includes('.')) return url.origin;
    return null;
  } catch { return null; }
}
