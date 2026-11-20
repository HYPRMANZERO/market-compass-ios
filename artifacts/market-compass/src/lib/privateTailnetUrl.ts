/** Only private Tailnet HTTPS URLs or the current owner's same-origin Access app. */
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
    // Only the current exact HTTPS origin is eligible; arbitrary tunnel URLs
    // cannot be saved into the public GitHub Pages edition.
    if (typeof window === 'undefined' || window.location.protocol !== 'https:' ||
        window.location.hostname.endsWith('.github.io') ||
        window.location.hostname.endsWith('.ts.net') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        url.origin !== window.location.origin) return null;
    return url.origin;
  } catch { return null; }
}
