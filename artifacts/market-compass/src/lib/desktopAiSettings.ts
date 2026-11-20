import { privateTailnetOrigin } from '@/lib/privateTailnetUrl';

export type DesktopAiSettings = {
  url: string;
  token: string;
  enabled: boolean;
  shareFinancialContext: boolean;
  speakReplies: boolean;
};

export const DEFAULT_DESKTOP_AI: DesktopAiSettings = {
  url: '',
  token: '',
  enabled: false,
  shareFinancialContext: false,
  speakReplies: false,
};

/** Only a well-formed HTTPS tailnet address and an independent long token can be enabled. */
export function validateDesktopAiSettings(value: DesktopAiSettings): DesktopAiSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid private AI settings.');
  const url = privateTailnetOrigin(value.url);
  if (typeof value.token !== 'string' || value.token.length < 48 || value.token.length > 512) {
    throw Error('Enter the separate 48+ character desktop AI token.');
  }
  if (!url) throw Error('Enter your private HTTPS Tailscale Serve address (ending in .ts.net).');
  return {
    url: url + '/', token: value.token,
    enabled: value.enabled === true,
    shareFinancialContext: value.shareFinancialContext === true,
    speakReplies: value.speakReplies === true,
  };
}

export function hasSavedDesktopAi(value: DesktopAiSettings | null | undefined): boolean {
  return Boolean(value?.enabled && value.token?.length >= 48 && privateTailnetOrigin(value.url));
}
