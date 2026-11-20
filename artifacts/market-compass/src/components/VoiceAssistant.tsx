import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BrainCircuit, CircleHelp, LockKeyhole, Mic, MicOff, Send, ShieldCheck, Speaker, VolumeX, WifiOff, X } from 'lucide-react';
import { interpretCompassCommand, type CompassCommandContext } from '@/lib/compassCommands';

type RecognitionResult = { 0: { transcript: string }; isFinal: boolean };
type RecognitionEvent = { results: ArrayLike<RecognitionResult>; resultIndex: number };
type RecognitionError = { error: string; message?: string };
type BrowserRecognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecognitionWindow = Window & {
  webkitSpeechRecognition?: new () => BrowserRecognition;
  SpeechRecognition?: new () => BrowserRecognition;
};
type Message = { id: string; source: 'owner' | 'local' | 'ollama'; text: string; at: string };
type Props = { context: CompassCommandContext; onNavigate: (path: string) => void };
const ideas = ['What is my total debt?', 'Which debt has the highest APR?', 'How much extra can I afford?', 'What market data is saved?', 'Open Debt Plan'];

function privateUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) return null;
    if (!u.hostname.endsWith('.ts.net')) return null;
    return u.origin;
  } catch { return null; }
}
function speechAvailable() {
  if (typeof window === 'undefined') return false;
  const win = window as RecognitionWindow;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}
function voicesAvailable() { return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
function formatError(error: unknown) { return error instanceof Error ? error.message : 'Unable to contact the assistant.'; }

export default function VoiceAssistant({ context, onNavigate }: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'greeting', source: 'local', at: '', text: 'Welcome back. I can help you understand your saved debt plan, affordable surplus and market history without sending anything to a server. Tap a suggestion or type a question to get started.'
  }]);
  const [query, setQuery] = useState('');
  const [micSupported] = useState(speechAvailable);
  const [voiceSupported] = useState(voicesAvailable);
  const [listening, setListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [desktopUrl, setDesktopUrl] = useState('');
  const [token, setToken] = useState('');
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [desktopHealthy, setDesktopHealthy] = useState(false);
  const [testingDesktop, setTestingDesktop] = useState(false);
  const [allowFinancialContext, setAllowFinancialContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const microphone = useRef<BrowserRecognition | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const requestId = useRef(0);
  const submitRef = useRef<(text: string) => void>(() => {});
  const desktopReady = desktopEnabled && desktopHealthy && Boolean(privateUrl(desktopUrl)) && token.length >= 48;
  const add = (source: Message['source'], text: string) => setMessages(old => [...old, { id: crypto.randomUUID(), source, text, at: new Date().toISOString() }].slice(-35));

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);
  useEffect(() => () => {
    try { microphone.current?.abort(); } catch { /* speech engine already ended */ }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    requestId.current++;
  }, []);

  function speak(message: string) {
    if (!speechEnabled || !voicesAvailable()) return;
    try {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(message.slice(0, 1000));
      speech.lang = 'en-ZA';
      speech.rate = 0.96;
      speech.pitch = 1;
      window.speechSynthesis.speak(speech);
    } catch { setStatus('Spoken replies are unavailable on this device. Answers remain visible as text.'); }
  }

  async function testDesktopConnection() {
    if (desktopReady) { setDesktopEnabled(false); setDesktopHealthy(false); setStatus('Disconnected desktop Ollama. Offline commands remain available.'); return; }
    const url = privateUrl(desktopUrl);
    if (!url || token.length < 48) { setStatus('Enter your private HTTPS .ts.net address and a 48+ character access token first.'); return; }
    setTestingDesktop(true); setStatus('Checking the private AI bridge on your desktop…');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url + '/api/session', {
        mode:'cors', credentials:'omit', cache:'no-store', signal:controller.signal,
        headers:{ Authorization:`Bearer ${token}` },
      });
      const result: unknown = await res.json();
      if (res.status === 401) throw Error('The private desktop access token was rejected. Enter the MC_AI_TOKEN from the desktop server session.');
      if (!res.ok || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true ||
        !('authorized' in result) || result.authorized !== true) throw Error('Private AI bridge is offline or not authorized.');
      if (!('modelAvailable' in result) || result.modelAvailable !== true) {
        const reason = 'reason' in result && typeof result.reason === 'string' ? result.reason : 'Configured Ollama model is unavailable.';
        throw Error(reason);
      }
      setDesktopHealthy(true); setDesktopEnabled(true);
      setStatus('Private connection authenticated and local Ollama model detected. You can now send open-ended questions to your desktop AI.');
    } catch (error) {
      setDesktopHealthy(false); setDesktopEnabled(false);
      setStatus(`Unable to connect to your desktop: ${formatError(error)}. Check Node, Tailscale Serve and the iPhone Tailscale VPN. Local commands still work.`);
    } finally { window.clearTimeout(timer); setTestingDesktop(false); }
  }

  async function askDesktop(original: string, id: number) {
    const url = privateUrl(desktopUrl);
    if (!url || !token || token.length < 48) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 65000);
    try {
      const accounts = context.accounts.filter(a => a.name.trim() && Number.isFinite(Number(a.balance)));
      const summary = allowFinancialContext ? {
        currency: context.currency,
        accounts: accounts.map(a => ({ name: a.name.slice(0,60), balance: Number(a.balance), apr: Number(a.apr), minimumPayment: Number(a.minimumPayment) })),
        monthlyIncome: context.privateBudget?.monthlyIncome ?? '',
        monthlyEssentials: context.privateBudget?.monthlyEssentials ?? '',
        liquidFunds: context.privateBudget?.liquidFunds ?? '',
        reserveTarget: context.privateBudget?.reserveTarget ?? '',
      } : undefined;
      const res = await fetch(url + '/api/chat', {
        method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: original, financialContext: summary }),
      });
      const body: unknown = await res.json();
      if (!res.ok) throw Error(`Desktop AI responded with HTTP ${res.status}. Check that the private service is running.`);
      if (!body || typeof body !== 'object' || !('reply' in body) || typeof body.reply !== 'string') throw Error('Desktop AI returned an invalid response.');
      if (id !== requestId.current) return;
      const text = body.reply.slice(0, 1800);
      add('ollama', text); speak(text);
      setStatus('Response from your privately hosted Ollama model. Verify any financial claims against your saved calculations.');
    } catch (error) {
      if (id !== requestId.current) return;
      setDesktopHealthy(false); setDesktopEnabled(false);
      setStatus(`Desktop Ollama unavailable: ${formatError(error)}. Offline commands remain available.`);
      const fallback = 'Your private desktop AI could not be reached. Try an offline command, such as “What is my total debt?” or “Open Debt Plan.”';
      add('local', fallback);
    } finally { window.clearTimeout(timer); if (id === requestId.current) setBusy(false); }
  }

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500 || busy) return;
    requestId.current += 1;
    const id = requestId.current;
    setQuery(''); setStatus('');
    add('owner', trimmed);
    const command = interpretCompassCommand(trimmed, context);
    if (command.type !== 'unknown') {
      add('local', command.reply); speak(command.reply);
      if (command.destination) onNavigate(command.destination);
      return;
    }
    if (!desktopReady) {
      add('local', command.reply);
      speak(command.reply);
      setStatus(desktopEnabled ? 'The private desktop URL or access token is incomplete. Use offline commands or finish the connection settings.' : 'Offline mode: these commands do not require a running AI server.');
      return;
    }
    setBusy(true);
    void askDesktop(trimmed, id);
  }
  submitRef.current = submit;

  function toggleMic() {
    if (listening) { microphone.current?.stop(); setListening(false); return; }
    const win = window as RecognitionWindow;
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) { setStatus('Speech recognition is unavailable in this browser. Use the keyboard microphone or type your question.'); return; }
    try {
      if (voicesAvailable()) window.speechSynthesis.cancel();
      const recognition = new Ctor();
      recognition.lang = 'en-ZA'; recognition.interimResults = false; recognition.continuous = false; recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        const spoken = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim();
        if (spoken) { setQuery(spoken); submitRef.current(spoken); }
      };
      recognition.onerror = err => {
        setListening(false);
        const errors: Record<string,string> = {
          'not-allowed': 'Microphone access was denied. Allow microphone access for Market Compass in Safari settings, or use the keyboard microphone.',
          'service-not-allowed': 'Your browser blocked its speech service. Use iOS keyboard dictation or type instead.',
          'network': 'The browser speech service needs connectivity. Text commands remain available offline.',
          'no-speech': 'No speech was detected. Try again in a quiet place.',
        };
        setStatus(errors[err.error] || `Speech recognition unavailable (${err.error}). Use text or keyboard dictation.`);
      };
      recognition.onend = () => { setListening(false); microphone.current = null; };
      microphone.current = recognition;
      recognition.start(); setListening(true);
      setStatus('Listening… speak your question. Browser voice recognition may use a third-party speech service and might need internet.');
    } catch (error) {
      setListening(false);
      setStatus(`Unable to start the microphone: ${formatError(error)}. Try keyboard dictation instead.`);
    }
  }

  return <div className="space-y-4" data-testid="voice-assistant">
    <section className="overflow-hidden rounded-[24px] bg-[hsl(165,24%,20%)] px-5 py-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[hsl(43,65%,74%)]"><BrainCircuit size={15}/> Compass AI</div>
          <h1 className="serif mt-3 text-[30px] leading-[1.05]">Just ask.</h1><p className="mt-2 max-w-[330px] text-[13px] leading-5 text-white/75">Your finance companion, available without a bank connection.</p>
        </div>
        <button type="button" aria-label={speechEnabled ? 'Turn off spoken answers' : 'Turn on spoken answers'} aria-pressed={speechEnabled}
          onClick={() => { if (voiceSupported) { if (speechEnabled) window.speechSynthesis.cancel(); setSpeechEnabled(v => !v); } }}
          disabled={!voiceSupported} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 disabled:opacity-40">
          {speechEnabled ? <Speaker size={20}/> : <VolumeX size={20}/>}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-white/75"><WifiOff size={16}/> Offline commands ready <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1">{desktopReady ? 'Ollama ready' : 'Local mode'}</span></div>
    </section>

    <section className="rounded-[20px] border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-[13px] font-semibold">Conversation</h2><button type="button" className="text-[11px] font-semibold text-muted-foreground" onClick={() => { setMessages([]); setStatus('Conversation cleared from memory on this page.'); }}><X size={14} className="mr-1 inline"/>Clear</button></div>
      <div className="max-h-[340px] min-h-[160px] space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Compass assistant conversation">
        {messages.map(message => <div key={message.id} className={`flex ${message.source === 'owner' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[92%] rounded-[16px] px-4 py-3 text-[13px] leading-6 ${message.source === 'owner' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted/75 text-foreground'}`}>
            {message.source === 'ollama' && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Desktop Ollama</span>}
            {message.text}
          </div>
        </div>)}
        {busy && <div className="rounded-[16px] bg-muted/75 px-4 py-3 text-[12px]">Connecting to your desktop AI…</div>}
        <div ref={bottom}/>
      </div>
      <div className="border-t border-border p-3">
        <form onSubmit={event => { event.preventDefault(); submit(query); }} className="flex items-end gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Ask Market Compass</span>
            <textarea value={query} rows={2} maxLength={500} placeholder="Ask about your money, debts or markets…" onChange={e => setQuery(e.target.value)}
              className="max-h-28 min-h-[54px] w-full resize-none rounded-[15px] border border-input bg-background px-3 py-3 text-[16px] leading-5" />
          </label>
          <button type="button" onClick={toggleMic} disabled={!micSupported || busy} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak a question'}
            className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] text-white disabled:opacity-30 ${listening ? 'bg-[hsl(5,60%,47%)] animate-pulse' : 'bg-[hsl(165,24%,25%)]'}`}>
            {listening ? <MicOff size={22}/> : <Mic size={23}/>}
          </button>
          <button type="submit" disabled={!query.trim() || busy} aria-label="Send question" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] bg-[hsl(43,65%,73%)] text-[hsl(165,26%,19%)] disabled:opacity-40"><Send size={20}/></button>
        </form>
        {!micSupported && <p className="mt-2 text-[11px] text-muted-foreground">Your browser does not expose speech recognition. Use the microphone on your iPhone keyboard to dictate into the question box.</p>}
        {status && <p role="status" className="mt-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-5 text-muted-foreground">{status}</p>}
      </div>
    </section>

    <section className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <h2 className="text-[13px] font-semibold">Try asking</h2>
      <div className="mt-3 flex flex-wrap gap-2">{ideas.map(idea => <button key={idea} type="button" onClick={() => submit(idea)} disabled={busy}
        className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-left text-[12px] font-medium disabled:opacity-40">{idea}<ArrowRight size={13} className="ml-1 inline"/></button>)}</div>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={15} className="mt-0.5 shrink-0"/>Offline answers use your current unlocked vault. They are not verified bank records. Your conversation remains in page memory and is cleared when the page closes.</p>
    </section>

    <details className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold"><LockKeyhole size={17} className="text-primary"/> Connect private desktop Ollama <span className="ml-auto text-[11px] font-normal text-muted-foreground">{desktopReady ? 'Ollama model detected' : 'Optional'}</span></summary>
      <p className="mt-3 text-[12px] leading-5 text-muted-foreground">For open-ended questions, connect to the Financial Advisor server running on your desktop through Tailscale Serve private HTTPS. The iPhone still answers supported commands offline without it. This does not create a Siri wake word or keep the microphone active in the background.</p>
      <label className="mt-4 block text-[12px] font-semibold">Your private Tailscale HTTPS URL
        <input type="url" value={desktopUrl} onChange={e => {setDesktopUrl(e.target.value);setDesktopHealthy(false);setDesktopEnabled(false);}} placeholder="https://desktop.your-tailnet.ts.net/"
          className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal"/>
      </label>
      <label className="mt-3 block text-[12px] font-semibold">Separate AI access token (48+ characters)
        <input type="password" autoComplete="off" value={token} onChange={e => {setToken(e.target.value);setDesktopHealthy(false);setDesktopEnabled(false);}} placeholder="Private AI token, not vault password"
          className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal"/>
      </label>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-[12px]"><input type="checkbox" checked={allowFinancialContext} onChange={e => setAllowFinancialContext(e.target.checked)}/>
        Share my entered financial summary with my own desktop only when I ask Ollama
      </label>
      <button type="button" onClick={() => { void testDesktopConnection(); }} disabled={testingDesktop || (!desktopReady && (!privateUrl(desktopUrl) || token.length < 48))}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-40">
        <BrainCircuit size={17}/>{desktopReady ? 'Disconnect desktop AI' : testingDesktop ? 'Checking private bridge…' : 'Test and connect desktop AI'}
      </button>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><CircleHelp size={14} className="mt-0.5 shrink-0"/>The server and Ollama model must actually be running on your computer. Configuring a URL here does not automatically start them. The access token is only held in page memory, not saved to the vault.</p>
    </details>
  </div>;
}
