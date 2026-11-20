import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BrainCircuit, CircleHelp, LockKeyhole, Mic, MicOff, RefreshCw, Send, ShieldCheck, Speaker, VolumeX, WifiOff, X } from 'lucide-react';
import { interpretCompassCommand, type CompassCommandContext } from '@/lib/compassCommands';
import { privateTailnetOrigin } from '@/lib/privateTailnetUrl';
import { validateDesktopAiSettings, type DesktopAiSettings } from '@/lib/desktopAiSettings';

type RecognitionResult = { 0: { transcript: string }; isFinal: boolean };
type RecognitionEvent = { results: ArrayLike<RecognitionResult>; resultIndex: number };
type RecognitionError = { error: string };
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
type Message = { id: string; source: 'owner' | 'local' | 'ollama'; text: string };
type ConnectionStatus = 'not-configured' | 'paused' | 'checking' | 'connected' | 'offline';
type Props = {
  context: CompassCommandContext;
  onNavigate: (path: string) => void;
  settings: DesktopAiSettings;
  onSettingsChange: (settings: DesktopAiSettings) => void;
};
const ideas = [
  'What is my total debt?',
  'Which debt has the highest APR?',
  'How much extra can I afford?',
  'What market data is saved?',
  'Open Debt Plan',
];
const micAvailable = () => typeof window !== 'undefined' && Boolean((window as RecognitionWindow).SpeechRecognition || (window as RecognitionWindow).webkitSpeechRecognition);
const voiceAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const explainError = (error: unknown) => error instanceof Error ? error.message : 'The private desktop is unreachable.';

export default function VoiceAssistant({ context, onNavigate, settings, onSettingsChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', source: 'local',
    text: 'Welcome back. I can help with your saved debt plan, affordable surplus and market history. Ask a question or tap one of the suggestions below.'
  }]);
  const [query, setQuery] = useState('');
  const [recognitionSupported] = useState(micAvailable);
  const [speakingSupported] = useState(voiceAvailable);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [host, setHost] = useState(settings.url);
  const [secret, setSecret] = useState(settings.token);
  const [shareFinancialContext, setShareFinancialContext] = useState(settings.shareFinancialContext);
  const [connection, setConnection] = useState<ConnectionStatus>('not-configured');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const microphone = useRef<BrowserRecognition | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const messageSerial = useRef(0);
  const probeSerial = useRef(0);
  const sendRef = useRef<(text: string) => void>(() => {});
  const connected = settings.enabled && connection === 'connected';
  const add = (source: Message['source'], text: string) => setMessages(old => [...old, {
    id: crypto.randomUUID(), source, text,
  }].slice(-35));

  // The encrypted vault is the ONLY persistence layer. Never use localStorage,
  // URL params, cookies or browser autofill for the bearer token.
  useEffect(() => {
    setHost(settings.url);
    setSecret(settings.token);
    setShareFinancialContext(settings.shareFinancialContext);
  }, [settings.url, settings.token, settings.shareFinancialContext]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  useEffect(() => () => {
    probeSerial.current++;
    messageSerial.current++;
    try { microphone.current?.abort(); } catch { /* Recognition already stopped. */ }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // Reconnect after every vault unlock, and on visibility/network changes.
  // A failed connection does not discard or disable the encrypted settings.
  useEffect(() => {
    if (!settings.enabled) {
      setConnection(settings.url ? 'paused' : 'not-configured');
      setConnectionMessage('');
      return;
    }
    const url = privateTailnetOrigin(settings.url);
    if (!url || settings.token.length < 48) {
      setConnection('offline');
      setConnectionMessage('Saved desktop details are incomplete. Edit and save the connection below.');
      return;
    }
    let active = true;
    let current: AbortController | null = null;
    async function check() {
      if (!active) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnection('offline');
        setConnectionMessage('This device is offline. Saved settings will reconnect when the network returns.');
        return;
      }
      const id = ++probeSerial.current;
      current?.abort();
      const controller = new AbortController();
      current = controller;
      const timer = window.setTimeout(() => controller.abort(), 15000);
      setConnection('checking');
      setConnectionMessage('Checking your saved private desktop connection…');
      try {
        const response = await fetch(url + '/api/session', {
          method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${settings.token}` },
        });
        const payload: unknown = await response.json();
        if (response.status === 401) throw Error('Saved desktop access token was rejected. Re-enter the current desktop token and save.');
        if (!response.ok || !payload || typeof payload !== 'object' ||
            !('authorized' in payload) || payload.authorized !== true)
          throw Error('The desktop AI service is not responding as an authorized session.');
        if (!('modelAvailable' in payload) || payload.modelAvailable !== true) {
          const why = 'reason' in payload && typeof payload.reason === 'string'
            ? payload.reason : 'The configured Ollama model is not available.';
          throw Error(why);
        }
        if (!active || probeSerial.current !== id) return;
        setConnection('connected');
        setConnectionMessage('Private desktop AI connected. Reconnection is automatic while the app is open and unlocked.');
      } catch (err) {
        if (!active || probeSerial.current !== id || controller.signal.aborted && !navigator.onLine) return;
        setConnection('offline');
        setConnectionMessage(`Auto-reconnect pending: ${explainError(err)}. Offline commands still work.`);
      } finally { window.clearTimeout(timer); }
    }
    const whenVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const whenOnline = () => { void check(); };
    const whenOffline = () => { current?.abort(); setConnection('offline'); setConnectionMessage('Offline. Will reconnect automatically.'); };
    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 120_000);
    window.addEventListener('online', whenOnline);
    window.addEventListener('offline', whenOffline);
    document.addEventListener('visibilitychange', whenVisible);
    return () => {
      active = false; probeSerial.current++; current?.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', whenOnline);
      window.removeEventListener('offline', whenOffline);
      document.removeEventListener('visibilitychange', whenVisible);
    };
  }, [settings.enabled, settings.url, settings.token]);

  function speak(answer: string) {
    if (!settings.speakReplies || !voiceAvailable()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(answer.slice(0, 1000));
      utterance.lang = 'en-ZA'; utterance.rate = 0.96;
      window.speechSynthesis.speak(utterance);
    } catch { setStatus('Audio playback is unavailable; the reply is still available as text.'); }
  }

  function saveConnection() {
    setFormError('');
    try {
      const saved = validateDesktopAiSettings({
        url: host, token: secret, enabled: true, shareFinancialContext,
        speakReplies: settings.speakReplies,
      });
      onSettingsChange(saved);
      setHost(saved.url);
      setSecret(saved.token);
      setStatus('Private AI settings stored in the encrypted vault. The app will check your desktop automatically whenever you unlock it.');
    } catch (err) { setFormError(explainError(err)); }
  }

  function pauseConnection() {
    onSettingsChange({ ...settings, enabled: false });
    setConnection('paused');
    setConnectionMessage('Desktop AI paused. Your encrypted settings are retained; resume whenever you choose.');
  }

  function forgetConnection() {
    if (!window.confirm('Forget this desktop AI connection and delete its saved access token from the encrypted workspace?')) return;
    onSettingsChange({
      url: '', token: '', enabled: false, shareFinancialContext: false,
      speakReplies: settings.speakReplies,
    });
    setHost(''); setSecret(''); setShareFinancialContext(false);
    setConnection('not-configured'); setConnectionMessage('');
    setStatus('Saved desktop connection forgotten. Existing encrypted backups may still contain earlier settings.');
  }

  async function askDesktop(prompt: string, id: number) {
    const url = privateTailnetOrigin(settings.url);
    if (!url || !settings.token || !connected) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 65000);
    try {
      const validAccount = (a: CompassCommandContext['accounts'][number]) =>
        a.name.trim().length > 0 && [a.balance, a.apr, a.minimumPayment].every(v =>
          typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0);
      const summary = settings.shareFinancialContext ? {
        currency: context.currency,
        accounts: context.accounts.filter(validAccount).slice(0, 30).map(a => ({
          name: a.name.slice(0,60), balance: Number(a.balance),
          apr: Number(a.apr), minimumPayment: Number(a.minimumPayment)
        })),
        monthlyIncome: context.privateBudget?.monthlyIncome ?? '',
        monthlyEssentials: context.privateBudget?.monthlyEssentials ?? '',
        liquidFunds: context.privateBudget?.liquidFunds ?? '',
        reserveTarget: context.privateBudget?.reserveTarget ?? '',
      } : undefined;
      const response = await fetch(url + '/api/chat', {
        method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, financialContext: summary }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw Error(`Desktop AI returned HTTP ${response.status}. Check the local service and model.`);
      if (!payload || typeof payload !== 'object' || !('reply' in payload) || typeof payload.reply !== 'string')
        throw Error('Desktop AI returned an invalid response.');
      if (messageSerial.current !== id) return;
      const reply = payload.reply.slice(0,1800);
      add('ollama', reply); speak(reply);
      setStatus('Answered by your desktop Ollama model. Independently verify financial claims.');
    } catch (error) {
      if (messageSerial.current !== id) return;
      setConnection('offline');
      setConnectionMessage(`Desktop unavailable: ${explainError(error)}. Reconnection will be retried automatically.`);
      add('local', 'The desktop AI is temporarily unavailable. Offline questions about your saved debt plan and markets still work.');
    } finally { window.clearTimeout(timer); if (messageSerial.current === id) setBusy(false); }
  }

  function submit(raw: string) {
    const question = raw.trim();
    if (!question || question.length > 500 || busy) return;
    const id = ++messageSerial.current;
    setQuery(''); setStatus('');
    add('owner', question);
    const result = interpretCompassCommand(question, context);
    if (result.type !== 'unknown') {
      add('local', result.reply); speak(result.reply);
      if (result.destination) onNavigate(result.destination);
      return;
    }
    if (!connected) {
      const answer = settings.enabled
        ? 'Your saved desktop AI is not reachable at the moment. I will retry automatically while Market Compass is open and unlocked. Offline debt and market commands remain available.'
        : result.reply;
      add('local', answer); speak(answer);
      return;
    }
    setBusy(true);
    void askDesktop(question, id);
  }
  sendRef.current = submit;

  function toggleMic() {
    if (listening) { microphone.current?.stop(); setListening(false); return; }
    const win = window as RecognitionWindow;
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) { setStatus('Use the keyboard microphone or type a question.'); return; }
    try {
      if (voiceAvailable()) window.speechSynthesis.cancel();
      const recognition = new Ctor();
      recognition.lang = 'en-ZA'; recognition.interimResults = false;
      recognition.continuous = false; recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        const spoken = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim();
        if (spoken) { setQuery(spoken); sendRef.current(spoken); }
      };
      recognition.onerror = err => {
        setListening(false);
        const explanation: Record<string,string> = {
          'not-allowed': 'Microphone permission denied. Allow it in Safari settings, or use keyboard dictation.',
          'service-not-allowed': 'Browser speech services are blocked. You can dictate with the iPhone keyboard.',
          network: 'Browser speech recognition may require internet. Typed commands remain offline.',
          'no-speech': 'No speech detected; try again.',
        };
        setStatus(explanation[err.error] ?? `Speech recognition unavailable: ${err.error}`);
      };
      recognition.onend = () => { setListening(false); microphone.current = null; };
      microphone.current = recognition;
      recognition.start(); setListening(true);
      setStatus('Listening… browser speech recognition may require an external service.');
    } catch (err) { setListening(false); setStatus(explainError(err)); }
  }

  return <div className="space-y-4" data-testid="voice-assistant">
    <section className="overflow-hidden rounded-[24px] bg-[hsl(165,24%,20%)] px-5 py-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[hsl(43,65%,74%)]"><BrainCircuit size={15}/> Compass AI</div>
          <h1 className="serif mt-3 text-[30px] leading-[1.05]">Just ask.</h1>
          <p className="mt-2 max-w-[330px] text-[13px] leading-5 text-white/75">Your private finance companion on every device.</p>
        </div>
        <button type="button" aria-label={settings.speakReplies ? 'Turn off spoken replies' : 'Turn on spoken replies'} aria-pressed={settings.speakReplies}
          onClick={() => {
            if (!speakingSupported) return;
            if (settings.speakReplies) window.speechSynthesis.cancel();
            onSettingsChange({ ...settings, speakReplies: !settings.speakReplies });
          }} disabled={!speakingSupported}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 disabled:opacity-40">
          {settings.speakReplies ? <Speaker size={20}/> : <VolumeX size={20}/>}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-white/75">
        <WifiOff size={16}/> Offline commands ready
        <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1">
          {connected ? 'Ollama connected' : connection === 'checking' ? 'Connecting…' : settings.enabled ? 'Auto reconnect on' : 'Local mode'}
        </span>
      </div>
    </section>

    <section className="rounded-[20px] border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold">Conversation</h2>
        <button type="button" className="text-[11px] font-semibold text-muted-foreground" onClick={() => {
          setMessages([]); setStatus('Conversation cleared from page memory.');
        }}><X size={14} className="mr-1 inline"/>Clear</button>
      </div>
      <div className="max-h-[340px] min-h-[160px] space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="AI conversation">
        {messages.map(message => <div key={message.id} className={`flex ${message.source === 'owner' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[92%] rounded-[16px] px-4 py-3 text-[13px] leading-6 ${message.source === 'owner' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted/75 text-foreground'}`}>
            {message.source === 'ollama' && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Private desktop Ollama</span>}
            {message.text}
          </div>
        </div>)}
        {busy && <div className="rounded-[16px] bg-muted/75 px-4 py-3 text-[12px]">Waiting for desktop Ollama…</div>}
        <div ref={bottom}/>
      </div>
      <div className="border-t border-border p-3">
        <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); submit(query); }}>
          <label className="min-w-0 flex-1"><span className="sr-only">Ask Market Compass</span>
            <textarea value={query} rows={2} maxLength={500} placeholder="Ask about debt, markets or your budget…" onChange={e=>setQuery(e.target.value)}
              className="max-h-28 min-h-[54px] w-full resize-none rounded-[15px] border border-input bg-background px-3 py-3 text-[16px] leading-5"/>
          </label>
          <button type="button" onClick={toggleMic} disabled={!recognitionSupported || busy} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak a question'}
            className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] text-white disabled:opacity-30 ${listening ? 'animate-pulse bg-[hsl(5,60%,47%)]' : 'bg-[hsl(165,24%,25%)]'}`}>
            {listening ? <MicOff size={22}/> : <Mic size={23}/>}
          </button>
          <button type="submit" disabled={!query.trim() || busy} aria-label="Send question"
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] bg-[hsl(43,65%,73%)] text-[hsl(165,26%,19%)] disabled:opacity-40"><Send size={20}/></button>
        </form>
        {!recognitionSupported && <p className="mt-2 text-[11px] text-muted-foreground">Use your iPhone keyboard microphone for dictation. Offline typed questions still work.</p>}
        {status && <p role="status" className="mt-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-5 text-muted-foreground">{status}</p>}
      </div>
    </section>

    <section className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <h2 className="text-[13px] font-semibold">Try asking</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {ideas.map(idea => <button key={idea} type="button" onClick={()=>submit(idea)} disabled={busy}
          className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-left text-[12px] font-medium disabled:opacity-40">
          {idea}<ArrowRight size={13} className="ml-1 inline"/>
        </button>)}
      </div>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={15} className="mt-0.5 shrink-0"/>Offline answers use your unlocked vault. Conversation messages are only held in page memory. Bank figures are not independently verified.</p>
    </section>

    <details className="rounded-[20px] border border-border bg-card p-4 shadow-sm" open={!settings.enabled ? undefined : false}>
      <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold"><LockKeyhole size={17} className="text-primary"/> Desktop Ollama · saved connection
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{connected ? 'Connected' : settings.enabled ? 'Auto reconnect' : 'Set up once'}</span>
      </summary>
      <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
        Configure once per encrypted vault. Market Compass reconnects after unlocking, when this screen is opened, and when your iPhone comes back online. No need to re-enter the address or token each time.
      </p>
      <div role="status" className="mt-3 rounded-xl bg-muted/70 p-3 text-[12px] leading-5">
        <div className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : connection === 'checking' ? 'bg-amber-500' : 'bg-muted-foreground'}`}/>
          {connected ? 'Desktop model available' : connection === 'checking' ? 'Checking desktop…' : settings.enabled ? 'Desktop temporarily unavailable' : 'Desktop connection not active'}
        </div>
        {connectionMessage && <p className="mt-1 text-muted-foreground">{connectionMessage}</p>}
      </div>
      <label className="mt-4 block text-[12px] font-semibold">Your private Tailscale HTTPS URL
        <input type="url" value={host} onChange={e=>setHost(e.target.value)}
          onBlur={() => {const url=privateTailnetOrigin(host); if(url)setHost(url+'/');}}
          placeholder="https://desktop.your-tailnet.ts.net/"
          className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal"/>
      </label>
      <label className="mt-3 block text-[12px] font-semibold">Desktop AI token · encrypted in vault
        <input type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}
          placeholder="Paste the separate 48+ character desktop token"
          className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal"/>
      </label>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-[12px]">
        <input type="checkbox" checked={shareFinancialContext} onChange={e=>setShareFinancialContext(e.target.checked)}/>
        Share entered financial figures with my own desktop when asking open-ended questions
      </label>
      <button type="button" onClick={saveConnection}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground">
        <RefreshCw size={17}/> Save &amp; reconnect automatically
      </button>
      {formError && <p role="alert" className="mt-2 rounded-lg bg-destructive/10 p-3 text-[12px] text-destructive">{formError}</p>}
      {settings.enabled ? <div className="mt-2 flex gap-2">
        <button type="button" onClick={pauseConnection} className="min-h-11 flex-1 rounded-xl border border-border px-3 text-[12px] font-semibold">Pause connection</button>
        <button type="button" onClick={forgetConnection} className="min-h-11 flex-1 rounded-xl border border-border px-3 text-[12px] font-semibold">Forget credentials</button>
      </div> : settings.url ? <button type="button" onClick={()=>onSettingsChange({...settings, enabled:true})} className="mt-2 min-h-11 w-full rounded-xl border border-border px-3 text-[12px] font-semibold">Resume automatic connection</button> : null}
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
        <CircleHelp size={14} className="mt-0.5 shrink-0"/>
        Your separate AI token is stored in the password-encrypted workspace and included in encrypted backups. It is not sent to GitHub or kept in plaintext localStorage. Unlocking is still required; a browser cannot run Ollama or continuously listen in the background when closed.
      </p>
    </details>
  </div>;
}
