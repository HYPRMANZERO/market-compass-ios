import { privateTailnetOrigin } from './privateTailnetUrl.ts';

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
  if (!url) {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
      throw Error('This Home Screen icon runs the public GitHub Pages edition. For security it cannot send your AI token to the private ngrok site. Open your Google-protected ngrok website directly in iPhone Safari, then Share → Add to Home Screen. Keep the original icon and encrypted backup until migration is verified.');
    }
    if (typeof window !== 'undefined' && /^[a-z0-9-]+\\.ngrok-free\\.(dev|app)$/.test(window.location.hostname)) {
      throw Error('Use the exact private website you are currently on: ' + window.location.origin + '/ (no /market-compass-ios/assistant path).');
    }
    throw Error('Enter a permitted private HTTPS address: a configured .ts.net endpoint or the exact website origin currently hosting this protected app.');
  }
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
