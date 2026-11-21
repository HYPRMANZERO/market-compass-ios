import { privateTailnetOrigin } from './privateTailnetUrl.ts';
import type { VoicePace } from './speechVoices.ts';

export type DesktopAiSettings = {
  url: string;
  token: string;
  enabled: boolean;
  shareFinancialContext: boolean;
  speakReplies: boolean;
  /** Optional voice controls, persisted only in the encrypted PWA vault. */
  voiceURI?: string;
  voicePace?: VoicePace;
};

export const DEFAULT_DESKTOP_AI: DesktopAiSettings = {
  url: '',
  token: '',
  enabled: false,
  shareFinancialContext: false,
  speakReplies: false,
  voiceURI: '',
  voicePace: 'natural',
};

/** Only a well-formed HTTPS tailnet address and an independent long token can be enabled. */
export function validateDesktopAiSettings(value: DesktopAiSettings): DesktopAiSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid private AI settings.');
  const url = privateTailnetOrigin(value.url);
  if (typeof value.token !== 'string' || value.token.length < 48 || value.token.length > 512) {
    throw Error('Enter the separate 48+ character desktop AI token.');
  }
  if (!url) throw Error('Enter a permitted private HTTPS Tailscale Serve address (*.ts.net), or this app\'s exact approved HTTPS origin.');
  return {
    url: url + '/', token: value.token,
    enabled: value.enabled === true,
    shareFinancialContext: value.shareFinancialContext === true,
    speakReplies: value.speakReplies === true,
    voiceURI: typeof value.voiceURI==='string' && value.voiceURI.length<=200 &&
      !/[\u0000-\u001f<>]/.test(value.voiceURI) ? value.voiceURI : '',
    voicePace: value.voicePace==='calm' || value.voicePace==='brisk' ? value.voicePace : 'natural',
  };
}

export function hasSavedDesktopAi(value: DesktopAiSettings | null | undefined): boolean {
  return Boolean(value?.enabled && value.token?.length >= 48 && privateTailnetOrigin(value.url));
}
