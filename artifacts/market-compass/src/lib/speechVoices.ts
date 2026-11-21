/**
 * Browser-native speech settings. Audio is synthesized by the user's device;
 * no reply text is sent to a new TTS service.
 */
export type VoicePace = 'natural' | 'calm' | 'brisk';
/** Deliberate selection: leave utterance.voice unset and let iOS choose. */
export const DEVICE_DEFAULT_VOICE = '__device_default__';

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const locale = voice.lang.toLowerCase();
  let score = voice.localService ? 4 : 0;
  if (/enhanced|premium|natural|neural/.test(name)) score += 80;
  if (/\b(samantha|karen|daniel|serena|moira|ava|allison|kate|stephanie|oliver|victoria)\b/.test(name)) score += 35;
  if (locale === 'en-za') score += 22;
  else if (locale === 'en-gb') score += 20;
  else if (locale === 'en-au') score += 18;
  else if (locale.startsWith('en')) score += 12;
  if (/eloquence|novelty|robot|fred|whisper|hysterical|bells|trinoids|cellos|boing|bubbles|zarvox|bad news|good news|bahh|organ|pipe|junior|albert|wobble/.test(name)) score -= 100;
  return score;
}

export function sortedEnglishVoices(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices]
    .filter(v => /^en(?:-|$)/i.test(v.lang))
    .sort((a,b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}

export function chooseSpeechVoice(voices: readonly SpeechSynthesisVoice[], preferredURI=''): SpeechSynthesisVoice | null {
  // Safari controls whether its system default and downloaded voices are exposed.
  // Explicit device-default mode must not be overridden by the first English voice.
  if (preferredURI===DEVICE_DEFAULT_VOICE) return null;
  const available=sortedEnglishVoices(voices);
  return available.find(voice => voice.voiceURI === preferredURI) || available[0] || null;
}

export function speakingRate(pace: VoicePace | undefined): number {
  switch (pace) {
    case 'calm': return 0.92;
    case 'brisk': return 1.05;
    default: return 1.0;
  }
}

function spokenRand(value: string): string {
  const amount=Number(value.replace(/,/g,''));
  if(!Number.isFinite(amount) || amount<0 || amount>1e11) return value+' rand';
  const totalCents=Math.round(amount*100);
  const whole=Math.floor(totalCents/100);
  const cents=totalCents%100;
  return whole.toLocaleString('en-ZA')+' rand'+(cents?' and '+cents+' cents':'');
}

export function voiceFriendlyText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, 'a reference link')
    .replace(/[*#_\u0060]/g,'')
    .replace(/\bAPR\b/g,'annual interest rate')
    .replace(/\bZAR\s*(\d[\d,]*(?:\.\d+)?)/g,(_match,amount:string)=>spokenRand(amount))
    .replace(/\bBTC\b/g,'Bitcoin')
    .replace(/\bETH\b/g,'Ethereum')
    .replace(/\bUSD\b/g,'US dollars')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,1200);
}
