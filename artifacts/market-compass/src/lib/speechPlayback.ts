/** Safari-friendly, browser-native TTS queue control.
 * Cancelling an *idle* iOS speechSynth before calling speak() can race and
 * swallow short user-initiated previews. Hold utterance refs in the component.
 * No network request, remote TTS, or alternate AI model is used.
 */
export type MinimalSpeechEngine=Pick<SpeechSynthesis,
  'speaking'|'pending'|'paused'|'cancel'|'speak'|'resume'>;

export function queueNativeSpeech(engine:MinimalSpeechEngine,
    utterance:SpeechSynthesisUtterance):void{
  if(engine.speaking||engine.pending)engine.cancel();
  engine.speak(utterance);
  if(engine.paused)engine.resume();
}
