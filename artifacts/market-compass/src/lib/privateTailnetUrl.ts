/**
 * Strictly allow only private HTTPS Tailscale Serve hostnames.
 * Accept a bare "computer.tailnet.ts.net" hostname for mobile-friendly input,
 * but never silently upgrade an explicitly typed insecure URL.
 * Do not accept paths, credentials, query strings, ports or public tunnels.
 */
export function privateTailnetOrigin(raw: string): string | null {
  try {
    const entered = raw.trim();
    if (!entered) return null;
    const bareHostname = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+\/?$/i.test(entered);
    const url = new URL(bareHostname ? `https://${entered}` : entered);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.pathname !== '/' || url.search || url.hash ||
        !url.hostname.endsWith('.ts.net')) return null;
    // Do not accept a naked ts.net domain, an IP address or a malformed hostname.
    const prefix = url.hostname.slice(0, -'.ts.net'.length);
    if (!prefix || prefix.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return null;
    return url.origin;
  } catch { return null; }
}
