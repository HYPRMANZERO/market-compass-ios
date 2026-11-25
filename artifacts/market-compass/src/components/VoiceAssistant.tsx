import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowRight, BrainCircuit, CircleHelp, LockKeyhole, Mic, MicOff, RefreshCw, Send, ShieldCheck, Speaker, VolumeX, WifiOff, X } from 'lucide-react';
import { interpretCompassCommand, type CompassCommandContext } from '@/lib/compassCommands';
import {interpretJarvisPersonalCommand,stripCompassWakeWord} from '@/lib/jarvisPersonalCommands';
import { privateTailnetOrigin } from '@/lib/privateTailnetUrl';
import { beginPersonalOauth, consumePersonalOauth, isValidPersonalSession, type PersonalSession } from '@/lib/personalHandoff';
import { validateDesktopAiSettings, type DesktopAiSettings } from '@/lib/desktopAiSettings';
import { parseFinancialSourceHealth, sourceLabels, statusLabels, type FinancialSourceHealth } from '@/lib/financialSourceHealth';
import { chooseSpeechVoice, sortedEnglishVoices, speakingRate, voiceFriendlyText, DEVICE_DEFAULT_VOICE, type VoicePace } from '@/lib/speechVoices';
import { queueNativeSpeech } from '@/lib/speechPlayback';
import { parseOwnerBudgetView, type OwnerBudgetView } from '@/lib/ownerBudgetView';
import OwnerBudgetPanel from '@/components/OwnerBudgetPanel';
import {
  eligibleToSendQueuedQuestion,isReadOnlyOfflineQuestion,validateQueuedQuestion,
  type QueuedReadOnlyQuestion
} from '@/lib/offlineAgentQueue';

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
type Message = { id: string; source: 'owner' | 'local' | 'ollama' | 'agent'; text: string; link?:{label:string;url:string} };
type AgentRunResult = {
  ok: true; stage: number; readOnly: true; steps: number; maxSteps: number;
  answer: string; answerSource:'private-desktop-model'; workspaceWritten: false; approvalExecutionEnabled: false;
  trace: {tool:string;label:string;status:'ok'|'unavailable';effect:'read'}[];
  results: Record<string,{available?:boolean;connected?:boolean;reason?:string}>;
  approval: null | {
    status:'draft'|'blocked';type:string;description:string;
    requiresApproval:true;executable:false;nextStep?:string;
  };
};
type SourceInventory = {
  readOnly: boolean; checkedAt: string;
  documentSources: {source:string;date:string}[];
  historicalSnapshotDate: string|null;
  savedAccountEntries: number;
  latestLocalAccountEdit: string|null;
  statements: number; transactions: number; latestStatementDate: string|null;
  emailExports: number; lunoReadOnlyKeyConfigured:boolean;
  bankOAuthConnected:boolean; bankVerifiedCurrentBalance:boolean;
  missing:string[];warnings:string[];
};
type CompactMemoryStatus = {
  enabled: boolean; exchanges:number; documents:number; archiveBytes:number;
  originalFileBytes:number; uncompressedJsonBytes:number;
  storageSavedPercent:number|null; algorithm:string;storedOn:string;modelTrained:boolean;
};
type CompactExchange = {id:string;at:string;question:string;reply:string};
type LunoStatus = {
  provider:string; connected:boolean; reason?:string; retrievedAt?:string;
  wallets?:{asset:string;balance:number;reserved:number;available:number;currencyUnit:string}[];
};

type ConnectionStatus = 'not-configured' | 'paused' | 'checking' | 'connected' | 'offline';
type Props = {
  context: CompassCommandContext;
  onNavigate: (path: string) => void;
  onImportDocuments?: () => void;
  settings: DesktopAiSettings;
  onSettingsChange: (settings: DesktopAiSettings) => void;
  queuedReadOnlyQuestions: QueuedReadOnlyQuestion[];
  onQueueReadOnlyQuestion:(question:string)=>QueuedReadOnlyQuestion;
  onRemoveQueuedReadOnlyQuestion:(id:string)=>void;
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

export default function VoiceAssistant({
  context,onNavigate,onImportDocuments,settings,onSettingsChange,
  queuedReadOnlyQuestions,onQueueReadOnlyQuestion,onRemoveQueuedReadOnlyQuestion
}: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', source: 'local',
    text: 'Welcome back. I can help with your saved debt plan, affordable surplus and market history. Ask a question or tap one of the suggestions below.'
  }]);
  const [query, setQuery] = useState('');
  const [recognitionSupported] = useState(micAvailable);
  const [speakingSupported] = useState(voiceAvailable);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [voicePreviewStatus,setVoicePreviewStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [host, setHost] = useState(settings.url || (typeof window !== 'undefined' ? privateTailnetOrigin(window.location.origin) || '' : ''));
  // Owner-only ngrok app: suggest the current same origin, never any cross-site address.
  const protectedSameOrigin = typeof window !== 'undefined' &&
    /^[a-z0-9-]+\.ngrok-free\.(?:dev|app)$/.test(window.location.hostname)
      ? privateTailnetOrigin(window.location.origin) : null;
  const publicPagesEdition = typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
  // Disabled by default: requires the separately audited ngrok owner-OAuth
  // path exception and server-side, scoped Personal bearer exchange.
  const personalPilotEnabled=publicPagesEdition && import.meta.env.VITE_PERSONAL_HANDOFF_ENABLED==='true' && Boolean(import.meta.env.VITE_PERSONAL_APPROVED_HOST);
  const [personalSession,setPersonalSession]=useState<PersonalSession|null>(null);
  const [personalConnectHost,setPersonalConnectHost]=useState('');
  const [personalConnectError,setPersonalConnectError]=useState('');
  const [personalShareFinancialContext,setPersonalShareFinancialContext]=useState(false);
  // Explicit, reversible owner-only trial; the default private agent remains unchanged.
  const ownerPreviewModel = Boolean(protectedSameOrigin) && typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('compassAI') === 'qwen35-4b';
  const [secret, setSecret] = useState(settings.token);
  const [shareDocumentFacts,setShareDocumentFacts]=useState(false);
  const [shareFinancialContext, setShareFinancialContext] = useState(settings.shareFinancialContext);
  const [connection, setConnection] = useState<ConnectionStatus>('not-configured');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [activeModel,setActiveModel]=useState('');
  const [busy, setBusy] = useState(false);
  const agentMode = true; // Model-backed read-only agent always active.
  const [lastAgent, setLastAgent] = useState<AgentRunResult | null>(null);
  const [sourceInventory, setSourceInventory] = useState<SourceInventory | null>(null);
  const [ownerBudget, setOwnerBudget] = useState<OwnerBudgetView | null>(null);
  const [ownerBudgetAvailable, setOwnerBudgetAvailable] = useState(false);
  const [sourceHealth, setSourceHealth] = useState<FinancialSourceHealth | null>(null);
  const [luno, setLuno] = useState<LunoStatus | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceRefresh, setSourceRefresh] = useState(0);
  const [memoryInfo, setMemoryInfo] = useState<CompactMemoryStatus | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState('');
  const microphone = useRef<BrowserRecognition | null>(null);
  // Safari may release a short utterance before playback unless we hold a ref.
  const speechUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const messageSerial = useRef(0);
  const probeSerial = useRef(0);
  const sendRef = useRef<(text: string) => void>(() => {});
  const personalConnected=personalPilotEnabled && isValidPersonalSession(personalSession);
  const connected = (settings.enabled && connection === 'connected') || personalConnected;
  const add = (source: Message['source'], text: string, link?:Message['link']) => setMessages(old => [...old, {
    id: crypto.randomUUID(), source, text, ...(link?{link}:{}),
  }].slice(-35));

  useEffect(()=>{
    if(!personalPilotEnabled)return;
    let live=true;
    void consumePersonalOauth(import.meta.env.VITE_PERSONAL_APPROVED_HOST).then(session=>{
      if(live && session){setPersonalSession(session);setPersonalConnectError('');}
    }).catch(e=>{if(live)setPersonalConnectError(explainError(e));});
    return ()=>{live=false;};
  },[personalPilotEnabled]);

  // The encrypted vault is the ONLY persistence layer. Never use localStorage,
  // URL params, cookies or browser autofill for the bearer token.
  useEffect(() => {
    setHost(settings.url || (privateTailnetOrigin(window.location.origin) || ''));
    setSecret(settings.token);
    setShareFinancialContext(settings.shareFinancialContext);
  }, [settings.url, settings.token, settings.shareFinancialContext]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  useEffect(() => {
    if (!speakingSupported) return;
    const synth=window.speechSynthesis;
    const refresh=()=>setAvailableVoices(sortedEnglishVoices(synth.getVoices()));
    const whenVisible=()=>{ if(document.visibilityState==='visible') refresh(); };
    refresh();
    synth.addEventListener('voiceschanged',refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',whenVisible);
    return ()=>{
      synth.removeEventListener('voiceschanged',refresh);
      window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',whenVisible);
    };
  }, [speakingSupported]);

  useEffect(() => () => {
    probeSerial.current++;
    messageSerial.current++;
    try { microphone.current?.abort(); } catch { /* Recognition already stopped. */ }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // Reconnect after every vault unlock, and on visibility/network changes.
  // A failed connection does not discard or disable the encrypted settings.
  useEffect(() => {
    if (publicPagesEdition) {
      setConnection('paused');
      setConnectionMessage('Private Compass AI is not available on the unauthenticated public edition.');
      return;
    }
    if (!settings.enabled) {
      setConnection(settings.url ? 'paused' : 'not-configured');
      setConnectionMessage('');
      return;
    }
    const url = protectedSameOrigin || privateTailnetOrigin(settings.url);
    if (!url || settings.token.length < 48) {
      setConnection('offline');
      setConnectionMessage('Saved desktop details are incomplete. Edit and save the connection below.');
      return;
    }
    let active = true;
    let current: AbortController | null = null;
    let checking = false;
    async function check() {
      // A visibility or online event can arrive while a previous probe is
      // still pending. Never start a second request that cancels the first.
      if (!active || checking) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnection('offline');
        setConnectionMessage('This device is offline. Saved settings will reconnect when the network returns.');
        return;
      }
      checking = true;
      const id = ++probeSerial.current;
      const controller = new AbortController();
      current = controller;
      const timer = window.setTimeout(() => controller.abort(), 15000);
      // Keep an established connection usable while performing a background
      // health check. Flipping 'connected' -> 'checking' previously unmounted
      // the source reader and aborted valid /api/sources and /api/balances
      // requests in Firefox (NS_BINDING_ABORTED).
      setConnection(previous => previous === 'connected' ? previous : 'checking');
      try {
        const response = await fetch(url + (ownerPreviewModel ? '/api/session/preview' : '/api/session'), {
          method: 'GET', mode: 'cors', credentials: (protectedSameOrigin || privateTailnetOrigin(settings.url)) === window.location.origin ? 'same-origin' : 'omit', cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${settings.token}` },
        });
        const payload: unknown = await response.json();
        if (response.status === 401) throw Error('Saved desktop access token was rejected. Re-enter the current desktop token and save.');
        if (response.status === 429) {
          // The server is busy/rate-limited, not necessarily disconnected.
          // Keep the previously validated session and retry on the next
          // scheduled check rather than aborting all source requests.
          if (active && probeSerial.current === id) {
            setConnection(previous => previous === 'connected' ? previous : 'offline');
            setConnectionMessage('Desktop status checks are temporarily rate-limited. Connection will be rechecked automatically.');
          }
          return;
        }
        if (!response.ok || !payload || typeof payload !== 'object' ||
            !('authorized' in payload) || payload.authorized !== true)
          throw Error('The desktop AI service is not responding as an authorized session.');
        if (!('modelAvailable' in payload) || payload.modelAvailable !== true) {
          const why = 'reason' in payload && typeof payload.reason === 'string'
            ? payload.reason : 'The configured Compass model is not available.';
          throw Error(why);
        }
        if (!active || probeSerial.current !== id) return;
        const reportedModel='model' in payload && typeof payload.model==='string' && /^[a-z0-9.:-]{1,80}$/i.test(payload.model)?payload.model:'';
        setActiveModel(reportedModel);
        setConnection('connected');
        setConnectionMessage(`Private desktop AI connected${reportedModel?` (${reportedModel})`:''}. Reconnection is automatic while the app is open and unlocked.`);
      } catch (err) {
        if (!active || probeSerial.current !== id || controller.signal.aborted && !navigator.onLine) return;
        setConnection('offline');
        setConnectionMessage(`Auto-reconnect pending: ${explainError(err)}. Offline commands still work.`);
      } finally {
        checking = false;
        window.clearTimeout(timer);
      }
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
  }, [settings.enabled, settings.url, settings.token, reconnectNonce, protectedSameOrigin, publicPagesEdition, ownerPreviewModel]);

  // Sensitive source data stays on the private desktop. The UI fetches only
  // a brief inventory and a GET-only Luno balance, never raw emails or statements.
  useEffect(() => {
    if (!connected) {
      // Preserve the last retrieved status for reference while disconnected.
      // On reconnection, the endpoints are queried again with fresh data.
      setSourceLoading(false);
      setOwnerBudget(null);
      setOwnerBudgetAvailable(false);
      return;
    }
    const origin = protectedSameOrigin || privateTailnetOrigin(settings.url);
    if (!origin) return;
    // Avoid showing a private snapshot from a previously connected host/token.
    setOwnerBudget(null);
    setOwnerBudgetAvailable(false);
    let active = true;
    let inFlight = false;
    const controllers = new Set<AbortController>();
    const request = async (path: string) => {
      const controller = new AbortController();
      controllers.add(controller);
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(origin + path, {
          mode: 'cors', credentials: (protectedSameOrigin || privateTailnetOrigin(settings.url)) === window.location.origin ? 'same-origin' : 'omit', cache: 'no-store', signal: controller.signal,
          headers: { Authorization: `Bearer ${settings.token}` }
        });
        if (!response.ok) throw Error('The desktop source service returned HTTP ' + response.status);
        return await response.json() as Record<string, unknown>;
      } finally { clearTimeout(timer); controllers.delete(controller); }
    };
    const refresh = async () => {
      if (!active || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      setSourceLoading(true);
      try {
        // A slow/unavailable provider must never hide the independent
        // document inventory. Always settle both requests and display
        // the specific endpoint that failed.
        const [inventoryResult, balanceResult, budgetResult] = await Promise.allSettled([
          request('/api/sources'), request('/api/balances'), request('/api/owner-budget')
        ]);
        if (!active) return;
        const errors: string[] = [];
        if (inventoryResult.status === 'fulfilled') {
          const sources = inventoryResult.value;
          if (sources.ok === true && sources.inventory && typeof sources.inventory === 'object') {
            setSourceInventory(sources.inventory as SourceInventory);
            // Older desktop bridges have no health field: show inventory but
            // never infer freshness or bank connectivity from that omission.
            setSourceHealth(parseFinancialSourceHealth(sources.health));
          } else {
            errors.push('Financial documents: invalid source inventory response.');
          }
        } else {
          errors.push('Financial documents: ' + explainError(inventoryResult.reason));
        }
        if (balanceResult.status === 'fulfilled') {
          const balances = balanceResult.value;
          if (balances.ok === true && balances.source && typeof balances.source === 'object') {
            setLuno(balances.source as LunoStatus);
          } else {
            errors.push('Luno: invalid wallet status response.');
          }
        } else {
          errors.push('Luno: ' + explainError(balanceResult.reason));
        }
        if (budgetResult.status === 'fulfilled') {
          const response=budgetResult.value;
          if (response.ok===true && response.readOnly===true &&
              response.bankVerified===false && response.browserVaultSynchronized===false &&
              Object.prototype.hasOwnProperty.call(response,'ownerBudget')) {
            const view=response.ownerBudget===null ? null : parseOwnerBudgetView(response.ownerBudget);
            if (response.ownerBudget===null || view) {
              setOwnerBudget(view);
              setOwnerBudgetAvailable(true);
            } else {
              setOwnerBudget(null);setOwnerBudgetAvailable(false);
              errors.push('Shared budget: invalid read-only response.');
            }
          } else {
            errors.push('Shared budget: unavailable or old bridge version.');
          }
        } else {
          errors.push('Shared budget: '+explainError(budgetResult.reason));
        }
        setSourceError(errors.length
          ? 'Private source refresh was incomplete. ' + errors.join(' ') + ' Offline planning still works.'
          : '');
      } catch (error) {
        if (active) setSourceError('Private source refresh failed unexpectedly: ' + explainError(error));
      } finally { inFlight = false; if (active) setSourceLoading(false); }
    };
    void refresh();
    const interval=window.setInterval(() => {void refresh();},5*60*1000);
    const resume=() => { if(document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange',resume);
    return () => {
      active=false; controllers.forEach(x=>x.abort()); window.clearInterval(interval);
      document.removeEventListener('visibilitychange',resume);
    };
  }, [connected, settings.url, settings.token, sourceRefresh, protectedSameOrigin]);

  async function readCompactMemory(loadHistory = false) {
    if (!connected) return;
    const origin = protectedSameOrigin || privateTailnetOrigin(settings.url);
    if (!origin) return;
    setMemoryBusy(true);
    try {
      const response = await fetch(origin + '/api/memory', {
        method: 'GET', mode: 'cors', credentials: (protectedSameOrigin || privateTailnetOrigin(settings.url)) === window.location.origin ? 'same-origin' : 'omit', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + settings.token },
      });
      if (!response.ok) throw Error('Desktop memory returned HTTP ' + response.status);
      const body = await response.json() as { ok?: boolean; stats?: CompactMemoryStatus; recent?: CompactExchange[] };
      if (body.ok !== true || !body.stats || !Array.isArray(body.recent)) throw Error('Invalid desktop memory response.');
      setMemoryInfo(body.stats);
      setMemoryError('');
      if (loadHistory) {
        const history = body.recent.flatMap(entry => [
          {id:'memory-'+entry.id+'-question', source:'owner' as const, text:entry.question},
          {id:'memory-'+entry.id+'-reply', source:'ollama' as const, text:entry.reply},
        ]);
        setMessages([{
          id:'welcome', source:'local' as const, text:'Your saved private desktop conversations are available below.',
        }, ...history].slice(-45));
        setStatus('Loaded saved desktop AI history. Your encrypted vault stays on HYPRBOX.');
      }
    } catch (error) {
      setMemoryError('Compact Vault unavailable: ' + explainError(error) + '. Update and restart HYPRBOX if necessary.');
    } finally { setMemoryBusy(false); }
  }

  async function changeCompactMemory(method: 'POST' | 'DELETE') {
    if (!connected) return;
    if (method === 'DELETE' && !window.confirm(
      'Permanently clear the encrypted desktop conversation history AND archived documents? Your original financial source files will not be deleted.'
    )) return;
    const origin = protectedSameOrigin || privateTailnetOrigin(settings.url);
    if (!origin) return;
    setMemoryBusy(true);
    try {
      const response = await fetch(origin + (method === 'POST' ? '/api/memory/archive' : '/api/memory'), {
        method, mode:'cors', credentials: (protectedSameOrigin || privateTailnetOrigin(settings.url)) === window.location.origin ? 'same-origin' : 'omit', cache:'no-store',
        headers: { Authorization: 'Bearer ' + settings.token },
      });
      if (!response.ok) throw Error('Desktop memory operation returned HTTP ' + response.status);
      const body = await response.json() as {ok?:boolean;stats?:CompactMemoryStatus;archived?:{added:number;unchanged:number;documents:number;warnings:string[]}};
      if (body.ok !== true) throw Error('The desktop did not confirm the operation.');
      setMemoryError('');
      if (body.stats) setMemoryInfo(body.stats);
      setStatus(method === 'POST'
        ? 'Encrypted file archive updated: ' + (body.archived?.added ?? 0) + ' added or updated; ' +
          (body.archived?.unchanged ?? 0) + ' unchanged. Only permitted local files are included.'
        : 'Encrypted desktop memory and document archive cleared.');
      if (method === 'DELETE') setMessages([]);
    } catch (error) { setMemoryError(explainError(error)); }
    finally { setMemoryBusy(false); }
  }

  useEffect(() => {
    if (!connected) { setMemoryInfo(null); return; }
    // Read-only snapshot when a user unlocks and connects. No polling of history.
    void readCompactMemory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, settings.url, settings.token]);

  function speak(answer: string, preview=false) {
    if ((!settings.speakReplies && !preview) || !voiceAvailable()) {
      if(preview)setVoicePreviewStatus('This browser does not offer speech playback.');
      return;
    }
    try {
      const synth=window.speechSynthesis;
      const utterance=new SpeechSynthesisUtterance(voiceFriendlyText(answer));
      const best=chooseSpeechVoice(synth.getVoices(),settings.voiceURI);
      if(settings.voiceURI===DEVICE_DEFAULT_VOICE){
        // Let iOS choose the system default and its own locale.
      }else if(best){utterance.voice=best;utterance.lang=best.lang;}
      else utterance.lang='en-ZA';
      utterance.rate=speakingRate(settings.voicePace);
      utterance.pitch=1;
      speechUtterance.current=utterance;
      if(preview)setVoicePreviewStatus('Starting iPhone voice preview…');
      utterance.onstart=()=>{
        if(preview)setVoicePreviewStatus('Playing native iPhone voice'+
          (utterance.voice?' · '+utterance.voice.name:' · system default')+'.');
      };
      utterance.onend=()=>{
        if(speechUtterance.current===utterance)speechUtterance.current=null;
        if(preview)setVoicePreviewStatus('Preview finished. Select another listed voice if the sound was too robotic.');
      };
      utterance.onerror=(event)=>{
        if(speechUtterance.current===utterance)speechUtterance.current=null;
        const code=typeof event.error==='string'?event.error:'unavailable';
        if(preview)setVoicePreviewStatus('iPhone preview failed ('+code+
          '). Try Use iPhone system default voice, then Preview this voice again.');
        else setStatus('Safari speech playback failed ('+code+'). The written response remains available.');
      };
      // Unlike cancel-then-speak, this does not cancel an already-idle iOS
      // speech queue just before a user-triggered short preview.
      queueNativeSpeech(synth,utterance);
    } catch {
      if(preview)setVoicePreviewStatus('Native iPhone preview is unavailable. The reply text is still accessible.');
      else setStatus('Audio playback is unavailable; the reply is still available as text.');
    }
  }

  function saveConnection(urlOverride?: string) {
    setFormError('');
    try {
      const saved = validateDesktopAiSettings({
        ...settings,
        url: urlOverride ?? host, token: secret, enabled: true, shareFinancialContext,
        speakReplies: settings.speakReplies,
      });
      onSettingsChange(saved);
      setHost(saved.url);
      setSecret(saved.token);
      setReconnectNonce(n => n + 1);
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
      ...settings, url: '', token: '', enabled: false, shareFinancialContext: false,
      speakReplies: settings.speakReplies,
    });
    setHost(''); setSecret(''); setShareFinancialContext(false);
    setConnection('not-configured'); setConnectionMessage('');
    setStatus('Saved desktop connection forgotten. Existing encrypted backups may still contain earlier settings.');
  }

  async function askDesktop(prompt: string, id: number, queuedId?:string) {
    const url = personalConnected && personalSession ? personalSession.origin :
      (protectedSameOrigin || privateTailnetOrigin(settings.url));
    if (!url || (!personalConnected && !settings.token) || !connected) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 105000); // Qwen 4B on HYPRBOX can require a cold CPU load.
    try {
      const validAccount = (a: CompassCommandContext['accounts'][number]) =>
        a.name.trim().length > 0 && [a.balance, a.apr, a.minimumPayment].every(v =>
          typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0);
      // Sharing financial context is opt-in AND relevant-topic-only. A greeting or
      // unrelated question must not transmit salary, account or spending figures.
      const wantsFinancialContext = /\b(debts?|loans?|credit\s*cards?|budgets?|spend(?:ing)?|expenses?|salary|salaries|hourly|earnings?|hours?\s*worked|pay\s*rate|income|cash\s*flow|savings?|afford|repayments?|luno|wallets?|balances?|bank(?:ing)?|accounts?|transactions?|investments?|markets?|financial|finances?|my\s*plan|my\s*situation)\b/i.test(prompt);
      const wantsDocuments=/\b(?:documents?|statements?|payslips?|invoices?|instalments?|quotations?)\b/i.test(prompt);
      const sharePrivateFacts=personalConnected?personalShareFinancialContext:settings.shareFinancialContext;
      const includeFacts=sharePrivateFacts&&shareDocumentFacts&&wantsDocuments;
      const documentFacts=includeFacts?(context.localFinanceDocuments??[]).slice().sort((a,b)=>b.importedAt.localeCompare(a.importedAt))
        .flatMap(doc=>(doc.accountProfile?.facts??[]).slice(0,4).map(fact=>({
          category:doc.accountProfile!.category,field:fact.field,amount:fact.amount,
          asOf:fact.asOf,ratePercent:fact.ratePercent
        }))).slice(0,12):undefined;
      const summary = sharePrivateFacts && (wantsFinancialContext||includeFacts) ? {
        currency: context.currency,
        accounts: context.accounts.filter(validAccount).slice(0, 30).map(a => ({
          name: a.name.slice(0,60), balance: Number(a.balance),
          apr: Number(a.apr), minimumPayment: Number(a.minimumPayment)
        })),
        monthlyIncome: context.privateBudget?.monthlyIncome ?? '',
        monthlyEssentials: context.privateBudget?.monthlyEssentials ?? '',
        liquidFunds: context.privateBudget?.liquidFunds ?? '',
        reserveTarget: context.privateBudget?.reserveTarget ?? '',
        expenseSummary: context.expenseSummary,
        documentFacts,
      } : undefined;
      const useAgent = agentMode; // Every AI reply comes from the authenticated private Compass model, with read-only agent safety.
      const personalPath=useAgent?'/api/personal/agent/run':'/api/personal/chat';
      const desktopPath=useAgent?(ownerPreviewModel?'/api/agent/preview':'/api/agent/run'):'/api/chat';
      const response = await fetch(url + (personalConnected?personalPath:desktopPath), {
        method: 'POST', mode: 'cors', credentials: !personalConnected && (protectedSameOrigin || privateTailnetOrigin(settings.url)) === window.location.origin ? 'same-origin' : 'omit', cache: 'no-store',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${personalConnected?personalSession!.token:settings.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, financialContext: summary }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw Error(`Desktop AI returned HTTP ${response.status}. Check the local service and model.`);
      if (!payload || typeof payload !== 'object') throw Error('Desktop AI returned an invalid response.');
      if (messageSerial.current !== id) return;
      if (useAgent) {
        if (!('answer' in payload) || typeof payload.answer !== 'string' ||
          !('readOnly' in payload) || payload.readOnly !== true ||
          !('approvalExecutionEnabled' in payload) || payload.approvalExecutionEnabled !== false ||
          !('workspaceWritten' in payload) || payload.workspaceWritten !== false ||
          !('answerSource' in payload) || payload.answerSource !== 'private-desktop-model' ||
          !('trace' in payload) || !Array.isArray(payload.trace)) {
          throw Error('Desktop agent did not confirm a read-only response.');
        }
        const agentResult = payload as AgentRunResult;
        setLastAgent(agentResult);
        add('agent', agentResult.answer.slice(0,1600)); speak(agentResult.answer);
        setStatus(`Compass AI · read-only agent: ${agentResult.steps}/${agentResult.maxSteps} tool checks. No financial records changed or actions executed.`);
      } else {
        if (!('reply' in payload) || typeof payload.reply !== 'string' ||
          !('answerSource' in payload) || payload.answerSource !== 'private-desktop-model')
          throw Error('Desktop did not confirm an model-generated chat response.');
        const reply = payload.reply.slice(0,1800);
        const answerSource = 'answerSource' in payload && typeof payload.answerSource === 'string'
          ? payload.answerSource : 'private-desktop-model';
        add(answerSource === 'private-desktop-model' ? 'ollama' : 'local', reply); speak(reply);
        setStatus(answerSource === 'private-desktop-model'
          ? 'Answered by your desktop Compass model. Independently verify financial claims.'
          : answerSource === 'private-assistant-shortcut'
            ? 'Market Compass answered your greeting locally without accessing financial records.'
            : answerSource === 'official-luno-api'
              ? 'Read-only Luno source checked. Balances require verified, current API data.'
              : 'Answered by a private, read-only assistant function.');
      }
      // Only retire a pending offline question after the authenticated bridge
      // has returned a strictly validated successful read-only response.
      if (queuedId) onRemoveQueuedReadOnlyQuestion(queuedId);
    } catch (error) {
      if (messageSerial.current !== id) return;
      if(personalConnected){setPersonalSession(null);setPersonalConnectError('The private Personal session ended. Reconnect with owner OAuth.');}
      else{setConnection('offline');setConnectionMessage(`Desktop unavailable: ${explainError(error)}. Reconnection will be retried automatically.`);}
      add('local', 'Compass AI is unavailable. Read-only questions can be saved locally for your approval and sent when the private gateway reconnects.');
    } finally { window.clearTimeout(timer); if (messageSerial.current === id) setBusy(false); }
  }

  function submit(raw: string) {
    const question = raw.trim();
    if (!question || question.length > 500 || busy) return;
    const id = ++messageSerial.current;
    setQuery(''); setStatus('');
    add('owner', question);
    setLastAgent(null);
    // Jarvis's browser-safe shortcuts are deterministic and never invoke
    // server-side desktop actions. The user must explicitly tap an external link.
    const personal = interpretJarvisPersonalCommand(question);
    if(personal){
      add('local', personal.text,personal.kind==='link'?{url:personal.url,label:personal.label}:undefined);
      speak(personal.text);
      return;
    }
    const cleanQuestion=stripCompassWakeWord(question);
    const result = interpretCompassCommand(cleanQuestion, context);
    // Safeguards and navigation remain local, but a private Luno balance must
    // not be confused with a historical cryptocurrency market candle.
    // Navigation and non-negotiable payment/trading refusals remain local even
    // with Agent mode enabled: a model must never override these guards.
    const localSafetyRefusal = result.type === 'answer' &&
      result.reply.startsWith('I cannot transfer money');
    // Device-local navigation and fixed safety refusals do not need model inference.
    // Any financial explanation must come from the authenticated private Compass model, not a local AI substitute.
    if (result.type === 'navigate' || localSafetyRefusal) {
      add('local',result.reply);
      if(result.destination)onNavigate(result.destination);
      return;
    }
    if (!connected) {
      if(isReadOnlyOfflineQuestion(question)){
        try{
          onQueueReadOnlyQuestion(question);
          const saved='Read-only question placed in your unlocked iPhone workspace. Check that the encrypted vault auto-save finishes. It will NOT contact HYPRBOX until the phone reconnects and you tap Send now. Safari cannot deliver requests while truly offline.';
          add('local',saved);setStatus('Queued locally · not sent or scheduled.');speak(saved);
        }catch(e){
          const msg=e instanceof Error?e.message:'Could not queue this request.';
          add('local',msg);setStatus(msg);
        }
      }else{
        const msg='Offline, I can only queue short read-only questions. I cannot execute, schedule, or queue actions that change money, files or devices. Try “Review my budget” or “Explain my debts”.';
        add('local',msg);setStatus(msg);
      }
      return;
    }
    setBusy(true);
    void askDesktop(question, id);
  }
  sendRef.current = submit;

  function sendPendingQuestion(item:QueuedReadOnlyQuestion){
    if(busy||!connected||!eligibleToSendQueuedQuestion(item)){
      setStatus('A queued question can be sent only while the private HYPRBOX connection is live and the question is under seven days old.');
      return;
    }
    if(!window.confirm('Send this saved read-only question to your authenticated HYPRBOX agent now? It cannot make payments, run commands, edit records or control devices.'))return;
    const id=++messageSerial.current;
    setLastAgent(null);setBusy(true);add('owner',item.question);
    void askDesktop(item.question,id,item.id);
  }
  const reviewedQueue=queuedReadOnlyQuestions.map(validateQueuedQuestion)
    .filter((x):x is QueuedReadOnlyQuestion=>x!==null);

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

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!busy && query.trim()) submit(query);
  }

  return <div className="mc-assistant min-w-0 max-w-full space-y-3" data-testid="voice-assistant">
    <section className="flex min-h-[56px] items-center justify-between gap-2 rounded-[16px] bg-[hsl(165,24%,20%)] px-3 py-2 text-white" aria-label="Compass AI model connection">
      <span className="flex min-w-0 items-center gap-2 text-[14px] font-bold"><BrainCircuit size={20} className="shrink-0 text-[hsl(43,65%,74%)]"/> Compass AI</span>
      <span role="status" aria-live="polite" className="ml-auto flex min-w-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold" title={connectionMessage||"Private Compass model connection status"}>
        <span className={connected?"h-2 w-2 shrink-0 rounded-full bg-emerald-400":connection==="checking"?"h-2 w-2 shrink-0 rounded-full bg-amber-300":"h-2 w-2 shrink-0 rounded-full bg-white/50"} aria-hidden="true"/>
        {connected?(activeModel==='qwen3.5:4b'?(ownerPreviewModel?'Compass preview':'Compass connected'):'Compass connected'):connection==="checking"?'Connecting Compass':publicPagesEdition && !personalConnected?'Owner link needed':settings.enabled?(ownerPreviewModel?'Compass preview offline':'Compass offline'):'Compass not connected'}
      </span>
      <button type="button" aria-label={settings.speakReplies?"Turn off spoken replies":"Turn on spoken replies"} aria-pressed={settings.speakReplies}
        onClick={()=>{if(!speakingSupported)return;if(settings.speakReplies)window.speechSynthesis.cancel();onSettingsChange({...settings,speakReplies:!settings.speakReplies});}}
        disabled={!speakingSupported} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-transparent disabled:opacity-40">
        {settings.speakReplies?<Speaker size={18}/>:<VolumeX size={18}/>}</button>
    </section>

    <section className="mc-chat-panel flex min-h-[min(55dvh,500px)] flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-sm sm:min-h-[min(64dvh,650px)]" aria-label="AI chat interface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold">Conversation</h2>
        <button type="button" className="text-[11px] font-semibold text-muted-foreground" onClick={() => {
          setMessages([]); setLastAgent(null); setStatus('Conversation cleared from page memory.');
        }}><X size={14} className="mr-1 inline"/>Clear</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex min-h-8 items-center gap-2 text-[12px] font-semibold" aria-label="Read-only agent mode always active">
          <ShieldCheck size={15} className="text-primary" aria-hidden="true"/> Agent mode on
          <span className="text-[10px] font-normal text-muted-foreground">Compass · 3 read-only tools max</span>
        </span>
        <details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer">Safety</summary>
          <p className="max-w-[330px] py-2 leading-5">Tools only review sources. No trading, banking or payment changes. Sharing iPhone vault entries requires separate permission in settings.</p>
        </details>
      </div>
      <div className="mc-chat-log min-h-[min(27dvh,250px)] max-h-[min(48dvh,540px)] flex-1 space-y-2.5 overflow-y-auto p-3 sm:min-h-[min(40dvh,340px)] sm:max-h-[min(62dvh,650px)] sm:p-4" role="log" aria-live="polite" aria-label="AI conversation">
        {messages.length===0 && !busy && <p className="rounded-xl bg-muted/55 px-3 py-3 text-[12px] leading-5 text-muted-foreground">Conversation cleared. Ask a new question below.</p>}
        {messages.map(message => <div key={message.id} className={`flex ${message.source === 'owner' ? 'justify-end' : 'justify-start'}`}>
          <div className={`mc-chat-bubble max-w-[90%] break-words rounded-[16px] px-3.5 py-2.5 text-[13px] leading-[1.6] sm:max-w-[85%] ${message.source === 'owner' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted/70 text-foreground'}`}>
            {message.source === 'ollama' && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Compass</span>}
            {message.source === 'agent' && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Compass · Read-only agent</span>}
            {message.text}
            {message.link && <a href={message.link.url} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-10 items-center rounded-xl border border-primary/35 bg-background px-3 py-2 text-[12px] font-semibold text-primary underline-offset-4 hover:underline"
              aria-label={message.link.label}>{message.link.label}</a>}
          </div>
        </div>)}
        {busy && <div className="rounded-[16px] bg-muted/75 px-4 py-3 text-[12px]">{agentMode ? 'Checking approved read-only agent tools…' : 'Waiting for Compass…'}</div>}
        <div ref={bottom}/>
      </div>
      {reviewedQueue.length>0 && <section className="mx-3 mb-3 rounded-xl border border-border bg-muted/40 p-3" aria-label="Encrypted offline agent questions">
        <h3 className="text-[12px] font-bold">Offline questions · {reviewedQueue.length} pending</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Saved in this iPhone's encrypted vault. No remote job has been created.
          Reconnect through the authorised private gateway, then explicitly review and send.
          Safari cannot guarantee background delivery when closed or without internet.
        </p>
        <div className="mt-3 space-y-2">
          {reviewedQueue.map(item=><div key={item.id} className="rounded-lg border border-border bg-background p-3">
            <p className="break-words text-[12px]">{item.question}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Queued {new Date(item.createdAt).toLocaleString('en-ZA')} ·
              {eligibleToSendQueuedQuestion(item)?' awaiting manual send':' expired, not sendable'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={!connected||busy||!eligibleToSendQueuedQuestion(item)}
                onClick={()=>sendPendingQuestion(item)}
                className="min-h-10 rounded-lg border border-border px-3 text-[12px] font-semibold disabled:opacity-40">
                Send now · read-only
              </button>
              <button type="button"
                onClick={()=>{if(window.confirm('Remove this unsent offline question from this encrypted workspace?'))onRemoveQueuedReadOnlyQuestion(item.id);}}
                className="min-h-10 rounded-lg border border-border px-3 text-[12px] font-semibold">
                Remove
              </button>
            </div>
          </div>)}
        </div>
      </section>}
      {lastAgent && (
        <section className="mx-3 mb-3 rounded-xl border border-border bg-muted/35 p-3" aria-label="Agent execution trace">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12px] font-bold">Agent read-only tool trace</h3>
            <span className="text-[11px] text-muted-foreground">{lastAgent.steps}/{lastAgent.maxSteps} checks</span>
          </div>
          {lastAgent.trace.length ? <ul className="mt-2 space-y-2 text-[11px] text-muted-foreground">
            {lastAgent.trace.map((item,index)=><li key={item.tool+index}>
              <span>{item.label} · {item.status === 'ok' ? 'Read only' : 'No verified data available'}</span>
              {item.status !== 'ok' && typeof lastAgent.results?.[item.tool]?.reason === 'string' && (
                <p className="mt-1 text-[11px] leading-5">{lastAgent.results[item.tool].reason}</p>
              )}
            </li>)}
          </ul> : <p className="mt-2 text-[11px] text-muted-foreground">No private financial tool was accessed. This request only created a review draft.</p>}
          {lastAgent.approval && <div className="mt-3 rounded-lg border border-border bg-background p-3 text-[12px]">
            <strong>{lastAgent.approval.status === 'blocked' ? 'Execution blocked' : 'Action proposal · review only'}</strong>
            <p className="mt-1 leading-5">{lastAgent.approval.description}</p>
            {lastAgent.approval.nextStep && <p className="mt-1 text-muted-foreground">{lastAgent.approval.nextStep}</p>}
            <p className="mt-2 font-semibold text-muted-foreground">Not approved, not scheduled, not saved. No execution capability in Stage 1.</p>
          </div>}
          <p className="mt-2 text-[11px] text-muted-foreground">
            No workspace writes, trades, transfers or payments are available. Source figures may be historical or manually entered.
          </p>
        </section>
      )}
      <div className="border-t border-border p-3">
        <form className="mc-assistant-composer grid grid-cols-[minmax(0,1fr)_44px_44px] items-end gap-2" onSubmit={event => { event.preventDefault(); submit(query); }}>
          <label className="min-w-0 flex-1"><span className="sr-only">Ask Market Compass</span>
            <textarea value={query} rows={2} maxLength={500} enterKeyHint="send" placeholder={publicPagesEdition ? "Ask Compass about anything, including finances." : "Ask about debt or your budget…"} onChange={e=>setQuery(e.target.value)} onKeyDown={handleComposerKeyDown}
              aria-describedby="mc-composer-hint" className="mc-composer-input max-h-28 min-h-[64px] w-full resize-y rounded-[15px] border border-input bg-background px-3 py-2.5 text-[16px] leading-[1.45] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"/>
          </label>
          <button type="button" onClick={toggleMic} disabled={!recognitionSupported || busy} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak a question'}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-white disabled:opacity-30 ${listening ? 'animate-pulse bg-[hsl(5,60%,47%)]' : 'bg-[hsl(165,24%,25%)]'}`}>
            {listening ? <MicOff size={22}/> : <Mic size={23}/>}
          </button>
          <button type="submit" disabled={!query.trim() || busy} aria-label="Send question"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[hsl(43,65%,73%)] text-[hsl(165,26%,19%)] disabled:opacity-40"><Send size={19}/></button>
        </form>
        <p id="mc-composer-hint" className="mt-2 text-[10px] leading-4 text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
        {!recognitionSupported && <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Use the iPhone keyboard microphone to dictate.</p>}
        {status && <p role="status" className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px] leading-5 text-muted-foreground">{status}</p>}
      </div>
    </section>

    <div className="mc-assistant-dock flex min-w-0 w-full flex-col items-stretch gap-3 pb-2" aria-label="AI tools and connections">


    <details className="mc-assistant-dock-card rounded-[20px] border border-border bg-card p-3 shadow-sm" aria-label="Encrypted desktop conversation memory"><summary className="cursor-pointer text-[13px] font-bold">Private memory</summary>
    <section className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-[14px] font-bold leading-5">Compact Vault · private memory</h2>
        <button type="button" className="min-h-10 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-40"
          disabled={!connected || memoryBusy} onClick={() => void readCompactMemory(false)}>
          <RefreshCw size={14} className="mr-1 inline"/> Refresh
        </button>
      </div>
      {memoryInfo?.enabled ? <div className="mt-3 text-[12px] leading-5 text-muted-foreground">
        <p><strong className="text-foreground">{memoryInfo.exchanges}</strong> saved conversations · <strong className="text-foreground">{memoryInfo.documents}</strong> archived files</p>
        <p>{memoryInfo.algorithm}. Encrypted archive: {(memoryInfo.archiveBytes / 1024).toFixed(1)} KB.</p>
        {memoryInfo.storageSavedPercent !== null && <p>Measured reduction versus stored JSON: {memoryInfo.storageSavedPercent}% (varies by contents).</p>}
        <p className="mt-1">The AI retrieves relevant history and documents. This does not retrain Qwen's model weights.</p>
      </div> : <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
        {connected ? 'Checking encrypted desktop memory. Update and restart HYPRBOX if unavailable.' : 'Connect your private desktop to access conversation memory.'}
      </p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!connected || memoryBusy || !memoryInfo?.enabled}
          onClick={() => void readCompactMemory(true)} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-40">
          Load saved conversations
        </button>
        <button type="button" disabled={!connected || memoryBusy || !memoryInfo?.enabled}
          onClick={() => void changeCompactMemory('POST')} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-40">
          Archive desktop files securely
        </button>
        <button type="button" disabled={!connected || memoryBusy || !memoryInfo?.enabled}
          onClick={() => void changeCompactMemory('DELETE')} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold text-destructive disabled:opacity-40">
          Forget stored history &amp; archive
        </button>
      </div>
      {memoryBusy && <p className="mt-2 text-[11px] text-muted-foreground">Processing encrypted desktop memory…</p>}
      {memoryError && <p role="status" className="mt-2 text-[11px] text-muted-foreground">{memoryError}</p>}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        For general topics, try: "search public info about compound interest." This searches public Wikipedia references only and sends no private financial context.
      </p>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Offline read-only questions stay in this iPhone's encrypted vault until you review and send them after reconnection. Only successful desktop AI conversations are stored on HYPRBOX.
        Archiving permitted local files is a separate action. Keys remain protected by Windows DPAPI.
        Compression is measured; no fixed ratio is guaranteed.
      </p>
    </section></details>

    <details className="mc-assistant-dock-card rounded-[20px] border border-border bg-card p-3 shadow-sm" aria-label="Private financial sources"><summary className="cursor-pointer text-[13px] font-bold">Financial sources</summary>
    <section className="mt-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold">My connected financial sources</h2>
        <button type="button" onClick={() => setSourceRefresh(n => n + 1)} disabled={!connected || sourceLoading}
          className="flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-[12px] font-semibold disabled:opacity-40">
          <RefreshCw size={15}/> Refresh
        </button>
      </div>
      <details className="mt-3 rounded-xl border border-border bg-muted/35 px-3 py-3" aria-label="Bank connectivity and consent status">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-[12px] font-semibold">
          <span>Bank connections</span>
          <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            {sourceInventory?.bankOAuthConnected ? 'Authorization reported · verify scope' : 'Not connected'}
          </span>
        </summary>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Direct bank feeds are not activated in this release. Partner-approved, account-scoped,
          read-only consent is required before transactions can be retrieved. No banking passwords
          or payment permissions should be entered into this app.
        </p>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Planned: provider approval, consent expiry and revocation, dated sync, duplicate checks,
          and explicit review before saving transactions. Missing bank data is unknown, not R0.
        </p>
        <button type="button" onClick={()=>onImportDocuments ? onImportDocuments() : onNavigate('/expenses')}
          className="mt-3 min-h-11 rounded-xl border border-border bg-background px-3 text-[12px] font-semibold">
          Import a statement now <ArrowRight size={13} className="ml-1 inline"/>
        </button>
      </details>
      {sourceLoading && <p className="mt-3 text-[12px] text-muted-foreground">Reading the private source inventory…</p>}
      <OwnerBudgetPanel view={ownerBudget} connected={connected} available={ownerBudgetAvailable}/>
      {sourceHealth ? <div className="mt-3 rounded-xl border border-border p-3" aria-label="Financial source freshness">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold">Source freshness · read only</h3>
          <span className="text-[11px] text-muted-foreground">Checked {sourceHealth.checkedAt.slice(0,16).replace('T',' ')} UTC</span>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          These are dated local records, not live bank feeds or verified spendable cash.
          {connected ? ' Source metadata was refreshed from HYPRBOX.' : ' HYPRBOX is offline; this is the last retrieved snapshot.'}
        </p>
        <ul className="mt-3 space-y-2">
          {sourceHealth.sources.map(source => <li key={source.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
            <span className="text-[12px] font-medium">{sourceLabels[source.id]}</span>
            <span className="text-[11px] font-semibold">{statusLabels[source.status]}</span>
            <span className="w-full text-[11px] text-muted-foreground">
              {source.recordCount} {source.recordCount===1 ? 'record' : 'records'}
              {' · '}Recorded {source.lastRecordedAt || 'date unavailable'}
              {source.ageDays !== null ? ' · '+source.ageDays+' days ago' : ''}
              {' · Not bank-verified'}
            </span>
          </li>)}
        </ul>
        {sourceHealth.warningCount>0 && <p className="mt-2 text-[11px] text-muted-foreground">
          {sourceHealth.warningCount} local import warnings; review source files on HYPRBOX.
        </p>}
        <p className="mt-3 text-[11px] font-medium">Live bank connections: not configured.</p>
      </div> : sourceInventory ? <p className="mt-3 text-[11px] text-muted-foreground">
        This bridge has not supplied the source-freshness report yet. Inventory counts below are not evidence of current balances.
      </p> : null}

      {sourceInventory&&<p className="mt-3 rounded-xl border border-border bg-muted/35 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        The counts below describe HYPRBOX desktop source folders only. This iPhone's encrypted vault is separate: it contains {context.accounts.length} entered debt account(s) and {context.localFinanceDocuments?.length??0} saved document(s). A missing desktop source does not mean your phone records are missing. No automatic syncing occurs.
      </p>}
      {sourceInventory ? <div className="mt-3 space-y-2 text-[12px]">
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Financial Advisor documents</span><strong>{sourceInventory.documentSources.length} local files</strong></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Historic baseline</span><strong>{sourceInventory.historicalSnapshotDate ?? 'Not found'}</strong></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Accounts entered on desktop</span><strong>{sourceInventory.savedAccountEntries} · unverified</strong></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Imported bank statements</span><strong>{sourceInventory.statements} files · {sourceInventory.transactions} entries</strong></div>
        {sourceInventory.latestStatementDate && <p className="text-[11px] text-muted-foreground">Latest imported statement transaction: {sourceInventory.latestStatementDate}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Exported financial emails</span><strong>{sourceInventory.emailExports} messages</strong></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Direct bank authorization</span><strong>{sourceInventory.bankOAuthConnected ? 'Authorized provider' : 'Not connected'}</strong></div>
        {sourceInventory.missing.length>0 && <details className="rounded-xl bg-muted/70 p-3">
          <summary className="cursor-pointer text-[12px] font-semibold">Missing data sources ({sourceInventory.missing.length})</summary>
          <div className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">{sourceInventory.missing.map(item=><p key={item}>{item}</p>)}</div>
        </details>}
        {sourceInventory.warnings.length>0 && <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-[12px] font-semibold">Source import warnings ({sourceInventory.warnings.length})</summary>
          <div className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">{sourceInventory.warnings.slice(0,8).map((w,i)=><p key={i}>{w}</p>)}</div>
        </details>}
      </div> : !connected ? <p className="mt-3 text-[12px] leading-5 text-muted-foreground">The desktop must be connected to show which records it has. Local commands remain available offline.</p>
        : <p className="mt-3 text-[12px] leading-5 text-muted-foreground">No source inventory has been received yet.</p>}
      {luno && <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2 text-[12px]"><strong>Luno · official read-only API</strong>
          <span className="text-[11px] text-muted-foreground">{luno.connected ? 'Read-only linked' : 'Not linked'}</span></div>
        {luno.connected && luno.wallets ? <div className="mt-2 space-y-1 text-[12px]">
          {luno.wallets.length===0 ? <p>No wallet assets reported by Luno.</p> :
            luno.wallets.map((w,i)=><div key={i} className="flex justify-between gap-2"><span>{w.asset}</span><strong>{w.available.toLocaleString(undefined,{maximumFractionDigits:8})} {w.currencyUnit} available</strong></div>)}
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Fetched {luno.retrievedAt || 'recently'} · Native asset quantities, not rand valuations. No trades or transfers.</p>
        </div> : <p className="mt-2 text-[11px] text-muted-foreground">{luno.reason || 'To link, configure an official read-only key on your desktop.'}</p>}
      </div>}
      {sourceError && <p role="status" className="mt-3 text-[11px] leading-5 text-muted-foreground">{sourceError}</p>}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Statements and exported emails are read only from your private desktop. To connect a bank account directly, use an approved bank-data provider; never enter your banking password or full card information here. Historical documents are not live balances.</p>
    </section></details>

    <details className="mc-assistant-dock-card rounded-[20px] border border-border bg-card p-3 shadow-sm"><summary className="cursor-pointer text-[13px] font-bold">Suggested questions</summary>
    <section className="mt-2">
      <h2 className="text-[13px] font-semibold">Try asking</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {ideas.map(idea => <button key={idea} type="button" onClick={()=>submit(idea)} disabled={busy}
          className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-left text-[12px] font-medium disabled:opacity-40">
          {idea}<ArrowRight size={13} className="ml-1 inline"/>
        </button>)}
      </div>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={15} className="mt-0.5 shrink-0"/>Offline answers use your unlocked vault. Conversation messages are only held in page memory. Bank figures are not independently verified.</p>
    </section></details>

    <details className="mc-assistant-dock-card rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold"><LockKeyhole size={17} className="text-primary"/> Compass AI · saved connection
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
      {personalPilotEnabled && <div className="mt-3 space-y-2 rounded-xl border border-border p-3 text-xs">
        <strong>Compass Personal · private HYPRBOX connection</strong>
        <p className="leading-5 text-muted-foreground">Use the existing owner-protected ngrok website for a 15-minute Personal session. No backend key is saved in this public app.</p>
        <label className="block">Protected HTTPS website
          <input type="url" value={personalConnectHost} onChange={e=>setPersonalConnectHost(e.target.value)}
            placeholder="https://your-domain.ngrok-free.dev/"
            className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-base"/>
        </label>
        <button type="button" disabled={personalConnected} onClick={()=>{setPersonalConnectError('');void beginPersonalOauth(personalConnectHost,import.meta.env.VITE_PERSONAL_APPROVED_HOST).catch(e=>setPersonalConnectError(explainError(e)));}}
          className="min-h-11 w-full rounded-xl bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-50">
          {personalConnected?'Personal connected':'Continue with protected owner sign-in'}
        </button>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={personalShareFinancialContext} onChange={e=>setPersonalShareFinancialContext(e.target.checked)}/>
          Share my approved financial summary with Personal only when I ask a relevant finance question
        </label>
        {personalConnectError&&<p role="alert" className="text-destructive">{personalConnectError}</p>}
      </div>}
      {publicPagesEdition && !personalPilotEnabled && (
        <p role="note" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] leading-5">
          <strong>This Home Screen icon is the public GitHub Pages edition ({window.location.hostname}).</strong>
          {' '}It cannot connect directly to the protected ngrok AI; this cross-site connection is blocked to keep the token and financial data private.
          On iPhone, open the Google-protected ngrok address in Safari, sign in, and choose Share → Add to Home Screen.
          Keep this original icon and export its encrypted backup before restoring on the private app.
        </p>
      )}
      {protectedSameOrigin && (
        <p role="note" className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-[12px] leading-5">
          You are on the protected website: <strong>{window.location.hostname}</strong>.
          {' '}Your iPhone uses this authenticated gateway for private Compass AI even when a Tailscale host is saved for separately authorised desktop devices.
          {privateTailnetOrigin(host) !== protectedSameOrigin && ' Tap “Use this protected website for AI” below to save the correct address without changing your token.'}
        </p>
      )}
      <label className="mt-4 block text-[12px] font-semibold">Private AI HTTPS URL (Tailscale or this protected website)
        <input type="url" value={host} onChange={e=>setHost(e.target.value)}
          onBlur={() => {const url=privateTailnetOrigin(host); if(url)setHost(url+'/');}}
          placeholder="https://your-private-host.example.com/"
          className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal"/>
      </label>
      {protectedSameOrigin && privateTailnetOrigin(host) !== protectedSameOrigin && (
        <button type="button" onClick={() => saveConnection(protectedSameOrigin)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-[12px] font-semibold text-primary">
          <ShieldCheck size={16}/> Use this protected website for AI
        </button>
      )}
      <label className="mt-3 block text-[12px] font-semibold">Desktop AI token · encrypted in vault
        <input type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}
          placeholder="Paste the separate 48+ character desktop token"
          className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal"/>
      </label>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-[12px]">
        <input type="checkbox" checked={shareFinancialContext} onChange={e=>setShareFinancialContext(e.target.checked)}/>
        Share entered financial figures with my own desktop when asking open-ended questions
      </label>
      {settings.shareFinancialContext&&<label className="mt-2 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={shareDocumentFacts} onChange={e=>setShareDocumentFacts(e.target.checked)}/>
        Include historical document figures when I ask about my documents this session
      </label>}
      <button type="button" onClick={() => saveConnection()}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground">
        <RefreshCw size={17}/> Save &amp; reconnect automatically
      </button>
      {formError && <p role="alert" className="mt-2 rounded-lg bg-destructive/10 p-3 text-[12px] text-destructive">{formError}</p>}
      {settings.enabled ? <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setReconnectNonce(n => n + 1)} className="col-span-2 min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold"><RefreshCw size={14} className="mr-1 inline"/> Check connection now</button>
        <button type="button" onClick={pauseConnection} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">Pause connection</button>
        <button type="button" onClick={forgetConnection} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">Forget credentials</button>
      </div> : settings.url ? <button type="button" onClick={()=>onSettingsChange({...settings, enabled:true})} className="mt-2 min-h-11 w-full rounded-xl border border-border px-3 text-[12px] font-semibold">Resume automatic connection</button> : null}
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
        <CircleHelp size={14} className="mt-0.5 shrink-0"/>
        Your separate AI token is stored in the password-encrypted workspace and included in encrypted backups. It is not sent to GitHub or kept in plaintext localStorage. Unlocking is still required; a browser cannot run the standalone model or continuously listen in the background when closed.
      </p>
    </details>
    </div>
  </div>;
}
