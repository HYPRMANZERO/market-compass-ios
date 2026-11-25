/**
 * A tiny, foreground-only service worker metadata check keeps an installed
 * Safari PWA fresh without polling APIs, markets or protected financial data.
 */
export const PWA_RESUME_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function shouldCheckPwaOnResume(
  lastCheck: number,
  now: number,
  visible: boolean,
  online: boolean
): boolean {
  if (!visible || !online || !Number.isFinite(now)) return false;
  return !Number.isFinite(lastCheck) || lastCheck <= 0 ||
    now < lastCheck || now - lastCheck >= PWA_RESUME_CHECK_INTERVAL_MS;
}
