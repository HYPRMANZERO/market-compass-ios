import { type ChangeEvent, type Dispatch, type FormEvent, type ReactNode, type SetStateAction, lazy, Suspense, useEffect, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IonApp, IonHeader, IonToolbar, IonFooter, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSegment, IonSegmentButton, IonLabel } from '@ionic/react';
import { ErrorBoundary } from '@/components/error-boundary';
import { parseCandleCsv } from '@/lib/candles';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import VoiceAssistant from '@/components/VoiceAssistant';
import PersonalTaskBoard from '@/components/PersonalTaskBoard';
import { normalizePersonalTasks, type PersonalTask } from '@/lib/personalTasks';
import { currentAssistantEdition } from '@/lib/assistantEdition';
import SavedCategoryReview from '@/components/SavedCategoryReview';
import {applySavedCategoryChanges,allowedSavedCategory} from '@/lib/savedCategoryReview';
import {expenseCategoryNeedsSorting} from '@/lib/monthlyExpenses';
import {maskDocumentPII} from '@/lib/documentIntelligence';
import OwnerBudgetDraftEditor from '@/components/OwnerBudgetDraftEditor';
import LocalFinanceFiles from '@/components/LocalFinanceFiles';
import AccountEvidenceReview from '@/components/AccountEvidenceReview';
import HomeFinancialEvidence from '@/components/HomeFinancialEvidence';
import HistoricalRecurringInsights from '@/components/HistoricalRecurringInsights';
import FinancialReadinessChecklist from '@/components/FinancialReadinessChecklist';
import LiveCryptoQuotes from '@/components/LiveCryptoQuotes';
import SolanaTrackingBar from '@/components/SolanaTrackingBar';
import {
  addLocalFinanceDocument,removeLocalFinanceDocument,
  type LocalFinanceDocument
} from '@/lib/localFinanceDocs';
import { summarizeOwnerBudgetDraft, type OwnerBudgetDraft } from '@/lib/ownerBudgetDraft';
import { enqueueOfflineQuestion, removeOfflineQuestion, type QueuedReadOnlyQuestion } from '@/lib/offlineAgentQueue';
import { DEFAULT_DESKTOP_AI, type DesktopAiSettings } from '@/lib/desktopAiSettings';
import type { CompassCommandContext } from '@/lib/compassCommands';
import DebtPaymentHandoff from '@/components/DebtPaymentHandoff';
import MobileOverview from '@/components/MobileOverview';
import FinancialSpaceHero from '@/components/FinancialSpaceHero';
import BankCarousel from '@/components/BankCarousel';
import FinancialPulse from '@/components/FinancialPulse';
import AccountTransactionHistory from '@/components/AccountTransactionHistory';
import IncomeAllocation from '@/components/IncomeAllocation';
import MonthlyExpenses from '@/components/MonthlyExpenses';
import SpendingPortfolio from '@/components/SpendingPortfolio';
const IonicSpendPreview=lazy(()=>import('@/components/IonicSpendPreview'));
import { DEFAULT_EXPENSE_SETTINGS, type ExpenseEntry, type ExpenseSettings, cycleAnalysis, salaryCycle, cycleCashflowCutIdeas } from '@/lib/monthlyExpenses';
import DebtAdvisor, { emptyPrivateBudget, type FinancialBaseline, type PrivateBudget } from '@/components/DebtAdvisor';
import OzowMerchantGateway, { type MerchantRequestRecord } from '@/components/OzowMerchantGateway';
import { CURRENCIES, REGIONS, regionDefaultCurrency, selectedRegion } from '@/lib/regions';
import { approximateLocalValue, fetchFxReference, fxKey, type FxReference } from '@/lib/fxRates';
import { calculateLocalDebtPlan } from '@/lib/localDebtPlan';
import { fetchPublicCandles, type CandleRange, type PublicVenue } from '@/lib/publicMarkets';
import HistoricalCandleChart, { utcCandleDate } from '@/components/HistoricalCandleChart';
import { localTechnicalReading, localSmaBacktest } from '@/lib/localIndicators';
import { localMarketResearch } from '@/lib/marketResearch';
import type { AssistantCommand, BacktestResult, Candle, DebtPlan, MarketAnalysis, MarketSeries } from '@workspace/api-client-react';
import {
  Activity, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, ChevronDown,
  CircleAlert, CircleHelp, Clock3, Compass, Database, FileClock, Gauge, Landmark, ListChecks,
  LoaderCircle, Menu, Plus, ReceiptText, Search, ShieldCheck, Trash2, TrendingUp, Upload, WalletCards, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { encryptWorkspace, decryptWorkspace, readVault, writeVault, shareVaultToFiles, storeDailySnapshot, validateRecord, compressionSummary, type EncryptedRecord } from '@/lib/localVault';
import { backupDue, localDate, loadDailyBackupSettings, persistDailyBackupSettings, type DailyBackupSettings } from '@/lib/dailyBackup';

const queryClient = new QueryClient();
const STORE_KEY = 'market-compass-workspace-v1';
type DraftStatus = 'pending' | 'approved' | 'rejected';
type Draft = { id: string; symbol: string; side: 'buy' | 'sell'; quantity: number; limitPrice: number; rationale: string; status: DraftStatus; createdAt: string };
type DebtAccount = { id: string; name: string; balance: string; apr: string; minimumPayment: string };
type QueuedCommand = AssistantCommand & { id: string; status: 'pending'; createdAt: string; originalText: string };
type WorkspaceData = { desktopAi: DesktopAiSettings; personalTasks: PersonalTask[]; ownerBudgetDraft: OwnerBudgetDraft | null; localFinanceDocuments: LocalFinanceDocument[]; offlineAgentQuestions: QueuedReadOnlyQuestion[]; expenseEntries: ExpenseEntry[]; expenseSettings: ExpenseSettings; drafts: Draft[]; accounts: DebtAccount[]; monthlyExtra: string; emergencyReserve: string; currency: string; region: string; currencyReviewRequired: boolean; financialBaseline: FinancialBaseline | null; privateBudget: PrivateBudget; merchantRequests: MerchantRequestRecord[]; fxRates: Record<string, FxReference>; marketCache: MarketSeries | null; solanaSeries: MarketSeries | null; marketRange: CandleRange | null; analysisCache: MarketAnalysis | null; queue: QueuedCommand[] };
// The owner is in South Africa. Locale tags like en-US are not evidence of physical region.
// All new installations start in ZAR; the user can change country and currency explicitly.
const initialRegion = 'ZA';
const defaultData: WorkspaceData = { desktopAi: DEFAULT_DESKTOP_AI, personalTasks: [], ownerBudgetDraft: null, localFinanceDocuments: [], offlineAgentQuestions: [], expenseEntries: [], expenseSettings: DEFAULT_EXPENSE_SETTINGS, drafts: [], accounts: [], monthlyExtra: '', emergencyReserve: '', currency: regionDefaultCurrency(initialRegion), region: initialRegion, currencyReviewRequired: false, financialBaseline: null, privateBudget: emptyPrivateBudget, merchantRequests: [], fxRates: {}, marketCache: null, solanaSeries: null, marketRange: null, analysisCache: null, queue: [] };

function readLegacyWorkspace(): WorkspaceData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw)return defaultData;
    const parsed=JSON.parse(raw);
    return {...defaultData,...parsed,personalTasks:normalizePersonalTasks(parsed?.personalTasks)};
  } catch { return defaultData; }
}
function useWorkspaceVault() {
  const [data, setData] = useState<WorkspaceData>(defaultData);
  const [password, setPassword] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [hasVault, setHasVault] = useState(false);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [lastRecord, setLastRecord] = useState<EncryptedRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [backupSettings, setBackupSettings] = useState<DailyBackupSettings>(loadDailyBackupSettings);
  const [backupMessage, setBackupMessage] = useState('');
  const [dailyBackupPending, setDailyBackupPending] = useState(() => { const settings = loadDailyBackupSettings(); return settings.enabled && settings.lastSnapshotDate === localDate() && settings.lastExportRequestedAt.slice(0, 10) !== localDate(); });
  const snapshotRunning = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const passwordRef = useRef(password);
  passwordRef.current = password;

  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [generation, setGeneration] = useState(0);
  const [revision, setRevision] = useState(0);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    readVault().then((stored) => { if (!active) return; setHasVault(!!stored); setHasLegacy(!!localStorage.getItem(STORE_KEY)); setInitializing(false); }).catch((e) => { if (!active) return; setError(String(e)); setInitializing(false); });
    return () => { active = false; };
  }, []);
  const unlock = async (entered: string) => {
    setError('');
    try {
      const stored = await readVault();
      if (!stored) throw new Error('There is no encrypted vault yet. Create one below.');
      const restored = await decryptWorkspace<WorkspaceData>(stored, entered);
      if (!restored || !Array.isArray(restored.drafts) || !Array.isArray(restored.accounts) || !Array.isArray(restored.queue)) throw new Error('Vault contains an invalid workspace.');
      setEnabled(false); setData({ ...defaultData, ...restored, personalTasks: normalizePersonalTasks(restored.personalTasks) }); setPassword(entered); setHasVault(true);
      setSavedAt(stored.updatedAt); setLastRecord(stored); setGeneration((n) => n + 1);
      // The saved vault is authoritative. Never restore old plaintext over it.
      localStorage.removeItem(STORE_KEY);
      setHasLegacy(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const create = async (entered: string) => {
    if (entered.length < 12) { setError('Choose a password of at least 12 characters.'); return; }
    setError('');
    try {
      if (await readVault()) throw new Error('An existing vault must be unlocked or imported, not overwritten.');
      const initial = readLegacyWorkspace();
      const record = await encryptWorkspace(initial, entered);
      await writeVault(record);
      setEnabled(false); setData(initial); setPassword(entered); setHasVault(true);
      setSavedAt(record.updatedAt); setLastRecord(record); setGeneration((n) => n + 1);
      localStorage.removeItem(STORE_KEY); setHasLegacy(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const lock = () => { setEnabled(false); setPassword(null); setData(defaultData); setGeneration((n) => n + 1); setRevision(0); };
  // Debounced, serialized saves. The active generation is invalidated on lock/unlock.
  useEffect(() => {
    if (!enabled || !password) return;
    let cancelled = false;
    setSaving(true);
    const t = window.setTimeout(async () => {
      try {
        const record = await encryptWorkspace(data, password);
        if (cancelled) return;
        // Serialize IndexedDB commits so an older auto-save cannot land after a newer one.
        const next = writeQueue.current.catch(() => {}).then(async () => {
          if (cancelled) return;
          await writeVault(record);
        });
        writeQueue.current = next;
        await next;
        if (!cancelled) { setSavedAt(record.updatedAt); setLastRecord(record); setError(''); }
      } catch (e) { if (!cancelled) setError(`Auto-save failed: ${e instanceof Error ? e.message : String(e)}. Export a backup.`); }
      finally { if (!cancelled) setSaving(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [data, password, enabled, generation, revision]);
  // Enables saving only after the restored workspace has rendered, so default data
  // can never overwrite an existing encrypted vault before unlock.
  useEffect(() => { if (password) setEnabled(true); }, [password, generation]);
  const setSchedule = (next: DailyBackupSettings) => {
    setBackupSettings(next); persistDailyBackupSettings(next);
    setDailyBackupPending(next.enabled && next.lastSnapshotDate === localDate() && next.lastExportRequestedAt.slice(0, 10) !== localDate());
    setBackupMessage(next.enabled ? `Daily encrypted snapshots scheduled for ${next.time} (while the app is open).` : 'Daily snapshots disabled.');
  };
  // Daily scheduler only runs while the PWA is open AND unlocked. Browser background
  // execution and silent writes to iOS Files are not supported.
  useEffect(() => {
    if (!password) return;
    let disposed = false;
    const check = async () => {
      const settings = loadDailyBackupSettings();
      if (!backupDue(settings) || snapshotRunning.current || !passwordRef.current) return;
      snapshotRunning.current = true;
      try {
        const snapshot = dataRef.current;
        const record = await encryptWorkspace(snapshot, passwordRef.current);
        if (disposed) return;
        // Run behind pending auto-saves and serialize against future saves.
        const operation = writeQueue.current.catch(() => {}).then(async () => {
          if (disposed) return;
          await writeVault(record);
          await storeDailySnapshot(record, localDate());
        });
        writeQueue.current = operation;
        await operation;
        if (disposed) return;
        if (disposed) return;
        const updated = { ...settings, lastSnapshotDate: localDate() };
        persistDailyBackupSettings(updated); setBackupSettings(updated);
        setDailyBackupPending(true);
        setBackupMessage('Daily encrypted backup prepared locally. Tap Save to Files to export it.');
        setSavedAt(record.updatedAt); setLastRecord(record);
      } catch (e) {
        if (!disposed) setError(`Scheduled backup failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally { snapshotRunning.current = false; }
    };
    void check();
    const interval = window.setInterval(() => { void check(); }, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { disposed = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [password, backupSettings.enabled, backupSettings.time]);
  const exportBackup = async (): Promise<boolean> => {
    if (!password || !lastRecord) return false;
    if (saving) { setBackupMessage('Please wait for the encrypted auto-save to finish before exporting.'); return false; }
    try {
      // Safari's navigator.share requires direct user activation. Call it before
      // any await, using the already-encrypted latest saved record.
      const result = await shareVaultToFiles(lastRecord);
      if (result === 'cancelled') { setBackupMessage('Export cancelled. The encrypted vault remains stored on this device.'); return false; }
      setBackupMessage(result === 'shared' ? 'Share sheet completed. Verify the backup exists in the Files app.' : 'Encrypted backup downloaded; save it to Files if prompted.');
      const updated = { ...backupSettings, lastExportRequestedAt: new Date().toISOString() };
      persistDailyBackupSettings(updated); setBackupSettings(updated);
      setDailyBackupPending(false);
      return true;
    } catch (e) { setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`); return false; }
  };
  const importBackup = async (file: File, entered: string) => {
    setError('');
    try {
      if (await readVault() && !window.confirm('Replace the existing local vault with this backup? Export your current vault first.')) return;
      if (file.size > 30 * 1024 * 1024) throw new Error('This backup exceeds the 30 MB import limit.');
      const incoming: unknown = JSON.parse(await file.text()); validateRecord(incoming);
      const restored = await decryptWorkspace<WorkspaceData>(incoming, entered);
      if (!restored || !Array.isArray(restored.drafts) || !Array.isArray(restored.accounts) || !Array.isArray(restored.queue)) throw new Error('Backup is not a Market Compass workspace.');
      setEnabled(false);
      await writeVault(incoming);
      setData({ ...defaultData, ...restored, personalTasks: normalizePersonalTasks(restored.personalTasks) }); setHasVault(true); setPassword(entered);
      setSavedAt(incoming.updatedAt); setLastRecord(incoming); setGeneration((n) => n + 1);
      localStorage.removeItem(STORE_KEY); setHasLegacy(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return { data, setData, password, initializing, hasVault, hasLegacy, error, savedAt, saving, compressionInfo: compressionSummary(lastRecord), backupSettings, setSchedule, backupMessage, dailyBackupPending, unlock, create, lock, exportBackup, importBackup };
}

function VaultScreen({ vault }: { vault: ReturnType<typeof useWorkspaceVault> }) {
  const isStandalone=typeof window!=='undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & {standalone?:boolean}).standalone===true);
  const [entered, setEntered] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  return <main className="mc-vault-entry flex min-h-[100dvh] flex-col bg-[hsl(165,24%,19%)] px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))] text-white sm:justify-center">
    <div className="mx-auto w-full max-w-[390px]">
      <div className="mb-4 flex items-center gap-3 px-1">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(43,65%,73%)] text-[hsl(165,24%,19%)]"><Compass size={22}/></span>
        <div><h1 className="serif text-[22px] leading-tight">Market Compass</h1><p className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-white/65">{isFinanceEdition()?'Your private financial advisor':'Your personal AI + financial workspace'}</p></div>
      </div>
      <div className="rounded-[22px] bg-[hsl(44,33%,99%)] p-4 text-foreground shadow-[0_16px_44px_rgba(0,0,0,.12)] sm:p-6">
        <div className="mb-3 flex items-center gap-2"><ShieldCheck className="shrink-0 text-primary" size={20}/><h2 className="text-[19px] font-bold leading-snug">{vault.hasVault ? 'Unlock your workspace' : 'Create your private vault'}</h2></div>
        <p className="text-[12px] leading-[1.6] text-muted-foreground">Your debt plans, markets and notes are encrypted on this device. No bank login required.</p>
        <details className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">{isStandalone?'Home Screen app':'Safari browser tab'} · Vault & privacy information</summary>
          <p role="note" className="mt-2 leading-[1.6]">
            Current session: <strong>{isStandalone?'iPhone Home Screen app':'Safari browser tab'}</strong>.
            Browser tabs, Home Screen apps and different HTTPS addresses can have separate encrypted vaults.
            If your password works elsewhere, open the original session where your documents were saved.
            Do not clear website data or overwrite either vault.
          </p>
        </details>
        {!vault.hasVault && <details className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-[11px]">
          <summary className="cursor-pointer font-semibold text-foreground">Already have a vault? Restore it instead</summary>
          <p role="note" className="mt-2 leading-[1.6] text-muted-foreground">
            Already using Market Compass on another website address or device? Keep your original app and encrypted vault intact. First export an encrypted backup from that app, then select <strong>Restore from encrypted backup</strong> below. Creating a new vault here does not transfer your saved expenses, debts, or Assistant settings.
          </p>
        </details>}
        {vault.hasLegacy && !vault.hasVault && <p className="mt-3 rounded-xl bg-muted p-3 text-[11px] leading-[1.6]">Older unencrypted workspace detected. Creating a vault will encrypt it and remove the old local copy once saved.</p>}
        {vault.error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-[12px] text-destructive">{vault.error}</p>}
        {vault.initializing ? <p className="mt-4 text-[12px]">Opening your encrypted storage…</p> : <>
          <label className="mt-4 block text-[12px] font-semibold" htmlFor="vault-password">{vault.hasVault ? 'Vault password' : 'Choose a password (12+ characters)'}</label>
          <input id="vault-password" type="password" autoComplete="off" value={entered} onChange={e => setEntered(e.target.value)}
            className="mt-2 h-12 min-h-12 w-full rounded-xl border border-input bg-background px-3.5 text-[16px]" style={{minHeight:48}} placeholder="Enter your private password" />
          <button type="button" disabled={busy || !entered} onClick={() => { void run(() => vault.hasVault ? vault.unlock(entered) : vault.create(entered)); }}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[13px] font-bold text-primary-foreground disabled:opacity-40">
            <ShieldCheck size={17}/>{busy ? 'Opening…' : vault.hasVault ? 'Unlock Market Compass' : 'Create encrypted workspace'}
          </button>
          <details className="mt-4 rounded-xl border border-border bg-muted/30 px-3 py-3 text-[12px]">
            <summary className="cursor-pointer font-semibold">Restore from encrypted backup</summary>
            <p className="mt-2 leading-5 text-muted-foreground">Enter the backup password above. Restoring replaces the saved vault on this device.</p>
            <input aria-label="Import encrypted vault backup" type="file" accept=".json,application/json" disabled={busy}
              className="mt-3 w-full max-w-full text-[12px]" onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => vault.importBackup(file, entered)); e.currentTarget.value=''; }} />
          </details>
        </>}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] text-white/70"><ShieldCheck size={13}/> Encrypted on your device · Offline-ready</div>
      <p className="mt-1.5 text-center text-[10px] leading-4 text-white/60">Keep your password and exported encrypted backup safe.</p>
    </div>
  </main>;
}

// Product edition is selected at build time where available. Server privileges are independent.
const isFinanceEdition = () => currentAssistantEdition() === 'finance';

const navItems = [
  { href: '/', label: 'Overview', icon: Compass },
  { href: '/markets', label: 'Markets', icon: Activity },
  { href: '/debt', label: 'Debt plan', icon: Landmark },
  { href: '/expenses', label: 'Expenses', icon: ReceiptText },
  { href: '/drafts', label: 'Drafts', icon: FileClock },
  { href: '/assistant', label: 'Local assistant', icon: CircleHelp },
];

function InstallHelp() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt?: () => Promise<void> }) | null>(null);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setVisible(!installed && !localStorage.getItem('mc-install-dismissed-v3'));
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt?: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);
  if (!visible || (!ios && !installPrompt)) return null;
  return <section className="mx-4 mt-3 rounded-2xl border border-[hsl(39,30%,80%)] bg-[hsl(43,48%,92%)] p-3 sm:mx-6 lg:mx-10 lg:max-w-lg" aria-label="Install Market Compass">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Compass size={19}/></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold">Make it an app on your Home Screen</div>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{ios ? 'Open this page in Safari and choose Share → Add to Home Screen to launch it without the browser toolbar.' : 'Install Market Compass from your browser to open it as a standalone app.'}</p>
        {ios ? <button type="button" onClick={() => setDetails(!details)} className="mt-2 min-h-9 text-[12px] font-bold text-primary underline underline-offset-2">{details ? 'Hide steps' : 'Show iPhone steps'}</button> :
          <button type="button" onClick={() => { void installPrompt?.prompt?.(); setInstallPrompt(null); }} className="mt-2 min-h-9 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground">Install app</button>}
      </div>
      <button type="button" onClick={() => { localStorage.setItem('mc-install-dismissed-v3','1'); setVisible(false); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground" aria-label="Dismiss install instructions"><X size={18}/></button>
    </div>
    {details && <p className="mt-2 rounded-lg bg-white/60 p-3 text-[12px] leading-5">1. Open the link in Safari. 2. Tap the Share icon. 3. Scroll to <strong>Add to Home Screen</strong>. 4. Tap Add, then open Market Compass from the new icon.</p>}
  </section>;
}

function AppShell({ children, pending, currency, onImportDocuments, onAddAccount }: {
  children: ReactNode;pending:number;currency:string;onImportDocuments:()=>void;onAddAccount:()=>void;
}) {
  const [menuOpen,setMenuOpen]=useState(false);
  const [path,navigate] = useLocation();
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const active = navItems.find((item) => item.href === path) ?? navItems[0];
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  // iOS standalone PWAs can restore the previous tab's scroll offset after
  // React has already switched routes. Reset once now and once after paint.
  // This prevents the first hero/card from opening beneath the sticky header.
  useEffect(() => {
    const reset = () => window.scrollTo(0, 0);
    reset();
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, [path]);
  useEffect(() => {
    if(!menuOpen)return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false);};
    document.documentElement.classList.add('mc-menu-open');
    document.body.classList.add('mc-menu-open');
    window.addEventListener('keydown',key);
    return ()=>{document.documentElement.classList.remove('mc-menu-open');document.body.classList.remove('mc-menu-open');window.removeEventListener('keydown',key);};
  },[menuOpen]);
  const openSettings = () => {
    const el = document.getElementById('mc-backup-controls') as HTMLDetailsElement | null;
    if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  return <div className="min-h-[100dvh] bg-background text-foreground lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <aside className="hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col" aria-label="Desktop navigation">
      <div className="flex h-full w-full flex-col border-r border-sidebar-border px-5 py-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Compass size={21} strokeWidth={1.8}/></span>
          <span><span className="serif block text-[21px] leading-none">Market Compass</span><span className="mt-1 block text-[10px] uppercase tracking-[.19em] text-sidebar-foreground/55">{isFinanceEdition()?'Financial advisor':'Personal + finance'}</span></span>
        </Link>
        <div className="mt-11 px-3 text-[10px] font-semibold uppercase tracking-[.22em] text-sidebar-foreground/40">Your workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Desktop main navigation">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}
            data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition-colors ${path === href ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
            <Icon size={17} strokeWidth={1.7}/><span className="flex-1">{label}</span>
            {label === 'Drafts' && pending > 0 && <span className="mono rounded-full bg-sidebar-primary px-2 py-0.5 text-[10px] text-sidebar-primary-foreground">{pending}</span>}
          </Link>)}
        </nav>
        <button type="button" data-testid="desktop-nav-menu" aria-label="Open Market Compass menu"
          aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 text-left text-[13px] font-semibold text-sidebar-foreground hover:bg-sidebar-accent">
          <Menu size={17} strokeWidth={1.8}/><span className="flex-1">Menu</span>
          {pending>0&&<span className="mono rounded-full bg-sidebar-primary px-2 py-0.5 text-[10px] text-sidebar-primary-foreground">{pending}</span>}
        </button>

        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold"><ShieldCheck size={15} className="text-sidebar-primary"/> Deliberate by design</div>
          <p className="mt-2 text-[11px] leading-[1.65] text-sidebar-foreground/55">Your workspace stays on this device. Payments and trades always require separate approval.</p>
        </div>
        <div className="mt-5 flex items-center justify-between px-1 text-[10px] text-sidebar-foreground/40"><span>MARKET COMPASS</span><span className="mono">LOCAL / 01</span></div>
      </div>
    </aside>

    <main className="min-w-0">
      <IonHeader className="mc-mobile-header sticky top-0 z-30 lg:hidden" role="banner">
        <IonToolbar className="mc-ionic-toolbar">
        <div className="flex min-h-[49px] items-center gap-3">
          <Link href="/" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[hsl(43,65%,73%)] text-[hsl(165,24%,19%)]" aria-label="Go to Market Compass home"><Compass size={23} strokeWidth={1.8}/></Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold leading-5">{isFinanceEdition()?'Compass Financial':'Compass Personal'}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/70">
              <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-[hsl(150,65%,70%)]' : 'bg-[hsl(43,65%,73%)]'}`}/>
              <span>{online ? 'iPhone online' : 'iPhone offline'} · {active.label} · {currency}</span>
            </div>
          </div>

        </div>
        </IonToolbar>
      </IonHeader>
      <header className="sticky top-0 z-20 hidden h-[65px] items-center justify-between border-b border-border/80 bg-background/95 px-10 backdrop-blur lg:flex">
        <div className="text-[11px] uppercase tracking-[.16em] text-muted-foreground">{isFinanceEdition()?'Financial advisor & markets':'Personal AI + finances'}</div>
        <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-[hsl(158,31%,42%)]' : 'bg-amber-500'}`}/>{online ? 'Connected' : 'Offline'} · Local vault</div>
          <button type="button" data-testid="desktop-header-menu" aria-label="Open Market Compass menu"
            aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-muted">
            <Menu size={17}/>Menu
          </button>
        </div>
      </header>
      <InstallHelp/>
      {menuOpen && createPortal(
        <div className="mc-quick-menu-layer fixed inset-0 z-[110] flex items-end justify-center bg-black/45" role="presentation" onClick={()=>setMenuOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Market Compass quick menu" className="mc-quick-menu-panel w-full max-w-[560px] overflow-y-auto rounded-t-[26px] bg-card px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3 text-foreground shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-border" aria-hidden="true"/>
            <div className="flex items-center justify-between gap-3"><h2 className="text-[17px] font-bold">Market Compass menu</h2><button type="button" onClick={()=>setMenuOpen(false)} aria-label="Close Market Compass menu" className="grid h-11 w-11 place-items-center rounded-xl border border-border"><X size={19}/></button></div>
            <p className="mb-3 mt-1 text-[11px] text-muted-foreground">Choose an action without searching through tabs.</p>
            <div className="grid grid-cols-2 gap-2">
              {([{label:'View accounts & debt',href:'/debt',icon:Landmark},{label:'Markets',href:'/markets',icon:Activity},{label:'Spend history',href:'/expenses',icon:ReceiptText},{label:'Orders & drafts',href:'/drafts',icon:FileClock},{label:'Link a bank',href:'/banks',icon:WalletCards},{label:'Ask Compass',href:'/assistant',icon:CircleHelp}] as const).map(item=><button type="button" key={item.href} onClick={()=>{setMenuOpen(false);navigate(item.href);}} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-[12px] font-semibold"><item.icon size={18} className="shrink-0 text-primary"/>{item.label}</button>)}
              <button type="button" onClick={()=>{setMenuOpen(false);onAddAccount();}} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-[12px] font-semibold"><Plus size={18} className="shrink-0 text-primary"/>Add account</button>
              <button type="button" onClick={()=>{setMenuOpen(false);onImportDocuments();}} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-[12px] font-semibold"><Upload size={18} className="shrink-0 text-primary"/>Import document</button>
              <button type="button" onClick={()=>{setMenuOpen(false);navigate("/");window.requestAnimationFrame(openSettings);}} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-[12px] font-semibold"><ShieldCheck size={18} className="shrink-0 text-primary"/>Vault &amp; backup</button>
            </div>
          </section>
        </div>,document.body)}
      <div className="mc-mobile-content mx-auto min-w-0 max-w-[1440px] px-4 pt-4 sm:px-7 lg:px-11 lg:pb-16 lg:pt-9">{children}</div>
    </main>
    <IonFooter className="mc-ionic-footer lg:hidden">
      <nav aria-label="Mobile app tabs" className="mc-mobile-tabbar fixed inset-x-0 bottom-0 z-40 lg:hidden">
       <div className="mx-auto grid max-w-[550px] grid-cols-4 gap-1">
         {navItems.filter(item => ['/', '/markets', '/assistant'].includes(item.href)).map(({ href, label, icon: Icon }) => {
           const selected = href === path;
           const short = label === 'Overview' ? 'Home' : label === 'Local assistant' ? 'AI' : label;
           return <Link key={href} href={href} aria-current={selected ? 'page' : undefined} aria-label={label}
             data-testid={`mobile-nav-${href === '/' ? 'home' : href.slice(1)}`}
             className={`mc-tab-link relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-center transition-colors active:bg-[hsl(165,20%,91%)] ${selected ? 'bg-[hsl(165,20%,91%)] text-[hsl(165,26%,20%)]' : 'text-muted-foreground'}`}>
             <Icon size={21} strokeWidth={selected ? 2.3 : 1.8}/>
             <span className="text-[10px] font-semibold leading-none">{short}</span>
           </Link>;
         })}
         <button type="button" data-testid="mobile-nav-menu" aria-label="Open Market Compass menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}
           className={`mc-tab-link relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-center transition-colors ${menuOpen || !['/','/markets','/assistant'].includes(path) ? 'bg-[hsl(165,20%,91%)] text-[hsl(165,26%,20%)]' : 'text-muted-foreground'}`}>
           <Menu size={21} strokeWidth={2}/>
           <span className="text-[10px] font-semibold leading-none">Menu</span>
           {pending > 0 && <span className="absolute right-3 top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[hsl(43,65%,68%)] px-0.5 text-[9px] font-bold text-[hsl(165,24%,20%)]">{pending > 99 ? '99+' : pending}</span>}
         </button>
</div>
      </nav>
    </IonFooter>
  </div>;
}

function PageIntro({ eyebrow, title, description, trailing }: { eyebrow: string; title: string; description: string; trailing?: ReactNode }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 border-b border-border pb-5 sm:mb-8 sm:gap-5 sm:pb-7 sm:flex-row sm:items-end">
    <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground sm:mb-3">{eyebrow}</div>
      <h1 className="serif text-[30px] leading-[1.08] tracking-[-.025em] sm:text-[42px]">{title}</h1>
      <p className="mt-2 max-w-[620px] text-[13px] leading-6 text-muted-foreground sm:mt-3">{description}</p>
    </div>
    {trailing && <div className="flex items-center">{trailing}</div>}
  </div>;
}

function Panel({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return <IonCard className={`mc-ui-panel mc-ionic-surface min-w-0 overflow-hidden rounded-[22px] border border-border bg-card shadow-sm ${className}`}>
    {(title || action) && <IonCardHeader className="mc-ionic-panel-head">
      <IonCardTitle className="text-[13px] font-semibold tracking-[.01em]">{title}</IonCardTitle>{action}
    </IonCardHeader>}
    <IonCardContent className="mc-ionic-panel-content">{children}</IonCardContent>
  </IonCard>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Search; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-[165px] flex-col items-center justify-center px-5 py-6 text-center sm:min-h-[205px] sm:py-9"><span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Icon size={19} strokeWidth={1.6} /></span><h3 className="mt-3 text-[13px] font-semibold">{title}</h3><p className="mt-1 max-w-[330px] text-[12px] leading-5 text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function ActionButton({ children, onClick, type = 'button', variant = 'primary', disabled = false }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'quiet' | 'danger'; disabled?: boolean }) {
  const variantClass = variant === 'primary' ? 'bg-primary text-primary-foreground hover:opacity-90' : variant === 'danger' ? 'border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10' : 'border border-border bg-card text-foreground hover:bg-muted';
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-opacity active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}>{children}</button>;
}

function StatusTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const tones = { neutral: 'bg-muted text-muted-foreground', good: 'bg-[hsl(155,30%,90%)] text-[hsl(158,36%,29%)]', warn: 'bg-[hsl(42,56%,89%)] text-[hsl(34,52%,34%)]', bad: 'bg-[hsl(5,48%,92%)] text-[hsl(4,52%,41%)]' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tones[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{children}</span>;
}

function formatTime(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function money(value: number, currency = 'USD') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); } catch { return `${currency} ${value.toFixed(2)}`; }
}
function num(value: string) { return value.trim() === '' ? NaN : Number(value); }

function Overview({ data, setData, onImportDocuments, onRecoverVault, onAddAccount }: {
  data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>>;
  onImportDocuments:()=>void; onRecoverVault:()=>void; onAddAccount:()=>void;
}) {
  const [,navigate] = useLocation();
  const openDrafts = data.drafts.filter((draft) => draft.status === 'pending').length;
  const debtTotal = data.accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
  const feed = data.marketCache;
  const docs=Array.isArray(data.localFinanceDocuments)?data.localFinanceDocuments:[];
  const entries=Array.isArray(data.expenseEntries)?data.expenseEntries:[];
  return <>
    {!isFinanceEdition() && <Link href="/assistant" aria-label="Open Compass Personal AI assistant" className="mb-5 flex items-center gap-3 rounded-[20px] border border-primary/20 bg-primary/5 px-4 py-4 shadow-sm">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Compass size={20}/></span>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">Ask Compass Personal</span><span className="mt-1 block text-[12px] leading-5 text-muted-foreground">Your everyday assistant and complete finance workspace. Ask, research, write, plan and review finances with approved private tools.</span></span>
      <ArrowRight size={18} className="shrink-0 text-primary"/>
    </Link>}
    <div className="mb-5 lg:hidden">
      <MobileOverview currency={data.currency} totalDebt={debtTotal}
        accountsCount={data.accounts.length} accounts={data.accounts}
        documentsCount={docs.length} approvedEntryCount={entries.length}
        entries={entries} documents={docs} expenseSettings={data.expenseSettings??DEFAULT_EXPENSE_SETTINGS}
        currencyReviewRequired={data.currencyReviewRequired}
        pendingDrafts={openDrafts} market={feed}
        onImportDocuments={onImportDocuments} onRecoverVault={onRecoverVault} onAddAccount={onAddAccount}
        fxQuote={feed ? data.fxRates?.[fxKey(feed.currency,data.currency)] ?? null : null} />
    </div>
    <div className="mb-5 hidden lg:block" data-testid="desktop-financial-overview">
      <FinancialSpaceHero currency={data.currency} totalDebt={debtTotal} accountsCount={data.accounts.length}
        onViewAccounts={()=>navigate('/debt')}/>
    </div>
    <details id="mc-home-upload" className="mc-app-upload mb-4 rounded-[22px] border border-border bg-card p-3 shadow-sm sm:p-4">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 text-[13px] font-semibold">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Upload size={20}/></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Upload financial documents</span>
          <span className="mt-1 block text-[11px] font-normal leading-5 text-muted-foreground">
            Choose from iPhone Files · {docs.length} document(s) in this encrypted vault
          </span>
        </span>
        <ChevronDown size={19} className="shrink-0 text-muted-foreground"/>
      </summary>
      <div className="mt-3 border-t border-border pt-4">
        <p className="mb-3 text-[12px] leading-5 text-muted-foreground">
          Review dated PDF, CSV, TXT and transaction JSON evidence locally.
          Only approved transaction rows update your salary-cycle ledger.
        </p>
        <LocalFinanceFiles documents={docs}
          onAdd={document=>setData(old=>({
            ...old,localFinanceDocuments:addLocalFinanceDocument(old.localFinanceDocuments??[],document)
          }))}
          onRemove={id=>setData(old=>({
            ...old,localFinanceDocuments:removeLocalFinanceDocument(old.localFinanceDocuments??[],id)
          }))}
          ledgerEntries={entries}
          currency={data.currency}
          currencyReviewRequired={data.currencyReviewRequired}
          onApplyEntries={approved=>setData(old=>({...old,expenseEntries:approved}))}
        />
      </div>
    </details>
    <div className="mb-5 hidden lg:block"><FinancialPulse entries={entries} documents={docs}
      currency={data.currency} settings={data.expenseSettings??DEFAULT_EXPENSE_SETTINGS}/></div>
    <HomeFinancialEvidence documents={data.localFinanceDocuments??[]} entries={data.expenseEntries??[]}
      settings={data.expenseSettings??DEFAULT_EXPENSE_SETTINGS} accounts={data.accounts??[]}
      budget={data.privateBudget??emptyPrivateBudget} currency={data.currency}/>
    <AccountTransactionHistory accounts={data.accounts} entries={entries} currency={data.currency}
      onAssign={(id,accountId)=>setData(old=>old.accounts.some(account=>account.id===accountId)?{
        ...old,expenseEntries:old.expenseEntries.map(entry=>entry.id===id?{...entry,debtAccountId:accountId}:entry)
      }:old)}/>
    <AccountEvidenceReview documents={docs} existingAccounts={data.accounts}
      currency={data.currency}
      onCreate={account=>setData(old=>({...old,accounts:[
        ...old.accounts,{...account,id:crypto.randomUUID()}
      ]}))}/>
    <HistoricalRecurringInsights documents={docs} entries={entries} currency={data.currency}/>
    <div className="hidden lg:block">
    <PageIntro eyebrow="A clearer view, at your pace" title="Your compass" description="A quiet place to see what is known, what is estimated, and what still needs your attention." trailing={<div className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-[11px] text-muted-foreground"><span className="mono mr-2 text-foreground">TODAY</span>{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>} />
    <div className="grid gap-4 md:grid-cols-3">
      <div className="relative overflow-hidden rounded-xl bg-primary px-5 py-5 text-primary-foreground md:col-span-2 md:px-7 md:py-6">
        <div className="absolute -right-6 -top-10 h-44 w-44 rounded-full border border-primary-foreground/10" /><div className="absolute -right-1 top-1 h-32 w-32 rounded-full border border-primary-foreground/10" />
        <div className="relative flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[.19em] text-primary-foreground/65">A measured approach</div><h2 className="serif mt-4 max-w-[540px] text-[28px] leading-[1.15] sm:text-[35px]">Good decisions begin with knowing what you don’t know.</h2><p className="mt-3 max-w-[480px] text-[12px] leading-5 text-primary-foreground/70">Signals are context, not certainty. Your plans stay yours until you choose to change them.</p></div><ArrowLeftRight className="hidden text-primary-foreground/50 sm:block" size={22} /></div>
        <div className="relative mt-7 flex flex-wrap items-center gap-3"><Link href="/markets" className="inline-flex items-center gap-2 rounded-lg bg-primary-foreground px-4 py-2.5 text-[11px] font-semibold text-primary">Explore market data <ArrowRight size={14} /></Link><Link href="/debt" className="text-[11px] font-medium text-primary-foreground/75 underline decoration-primary-foreground/30 underline-offset-4">Review debt plan</Link></div>
      </div>
      <Panel className="flex flex-col justify-between p-5">
        <div><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">Saved debt balances</span><WalletCards size={17} className="text-muted-foreground" /></div>{data.accounts.length ? <><div className="serif mt-5 text-[30px]">{money(debtTotal, data.currency)}</div><div className="mt-1 text-[11px] text-muted-foreground">{data.accounts.length} {data.accounts.length === 1 ? 'account' : 'accounts'} saved locally</div></> : <div className="mt-8"><div className="serif text-[23px]">Nothing entered yet</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Your balances stay private in this browser.</p></div>}</div>
        <Link href="/debt" className="mt-6 flex items-center justify-between border-t border-border pt-4 text-[11px] font-semibold"><span>{data.accounts.length ? 'Open payoff planner' : 'Add your accounts'}</span><ArrowRight size={15} /></Link>
      </Panel>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <Panel title="Market feed" action={<Link href="/markets" className="text-[11px] font-semibold text-primary">Open markets <ArrowRight className="ml-1 inline" size={13} /></Link>}>
        {feed ? <div className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mono text-[20px] font-medium">{feed.symbol}</div><div className="mt-1 text-[11px] text-muted-foreground">Source: {feed.source || 'Not specified'} · {feed.currency}</div></div><StatusTag tone="warn">Saved local copy</StatusTag></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground"><span>{feed.candles.length} candle records · not live</span><span>Last saved candle {utcCandleDate(feed.candles.at(-1)?.date ?? feed.asOf)} UTC</span></div>{feed.notice && feed.asOf?.slice(0,10) === feed.candles.at(-1)?.date.slice(0,10)
          && <p className="mt-3 rounded-lg bg-muted/70 px-3 py-2 text-[11px] leading-5 text-muted-foreground">{feed.notice}</p>}</div> : <EmptyState icon={Database} title="No market feed selected" description="Choose a ticker on the markets page to request provider data. No prices are filled in until then." action={<Link href="/markets" className="text-[11px] font-semibold text-primary">Choose a ticker <ArrowRight className="ml-1 inline" size={13} /></Link>} />}
      </Panel>
      <Panel title="Local items needing a look">
        <div className="divide-y divide-border">
          <Link href="/drafts" className="flex items-center gap-3 px-5 py-4 hover:bg-muted/40"><span className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><FileClock size={16} /></span><span className="flex-1"><span className="block text-[12px] font-semibold">Order drafts</span><span className="mt-1 block text-[10px] text-muted-foreground">{openDrafts ? 'Waiting for your review' : 'No drafts awaiting review'}</span></span><span className="mono text-[15px]">{openDrafts}</span></Link>
          <Link href="/assistant" className="flex items-center gap-3 px-5 py-4 hover:bg-muted/40"><span className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><ListChecks size={16} /></span><span className="flex-1"><span className="block text-[12px] font-semibold">Assistant queue</span><span className="mt-1 block text-[10px] text-muted-foreground">Local instructions are never trades</span></span><span className="mono text-[15px]">{data.queue.length}</span></Link>
        </div>
      </Panel>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      {[{ n: '01', title: 'Observe', text: 'Market data can be delayed, incomplete, or revised.' }, { n: '02', title: 'Compare', text: 'Debt scenarios are deterministic, based only on your inputs.' }, { n: '03', title: 'Decide', text: 'Nothing here sends an order or moves money.' }].map((item) => <div key={item.n} className="flex gap-4 border-t border-border pt-4"><span className="mono text-[10px] text-muted-foreground">{item.n}</span><div><div className="text-[12px] font-semibold">{item.title}</div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.text}</p></div></div>)}
    </div>
    </div>
  </>;
}


function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="border-t border-border py-4"><div className="text-[10px] uppercase tracking-[.13em] text-muted-foreground">{label}</div><div className="mono mt-2 text-[18px]">{value}</div>{note && <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>}</div>;
}

function Markets({ data, setData }: { data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>> }) {
  const [symbol, setSymbol] = useState(data.marketCache && /Kraken|Coinbase/i.test(data.marketCache.source) ? data.marketCache.symbol.replace(/USD$/, '') : '');
  const [range, setRange] = useState<CandleRange>(data.marketRange ?? '6m');
  const [loadedRange, setLoadedRange] = useState<CandleRange | null>(data.marketRange);
  const [series, setSeries] = useState<MarketSeries | null>(null);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [localCached, setLocalCached] = useState(Boolean(data.marketCache));
  const [notice, setNotice] = useState('');
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [fastWindow, setFastWindow] = useState('10');
  const [slowWindow, setSlowWindow] = useState('30');
  const [feeBps, setFeeBps] = useState('10');
  const [venue, setVenue] = useState<PublicVenue>('auto');
  const [fetching, setFetching] = useState(false);
  const [candlesError, setCandlesError] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const requestSerial = useRef(0);
  const [fxError, setFxError] = useState('');
  const activeSeries = series ?? (localCached ? data.marketCache : null);
  const fxPair = activeSeries && activeSeries.currency !== data.currency ? fxKey(activeSeries.currency, data.currency) : '';
  const fxQuote = fxPair ? data.fxRates?.[fxPair] ?? null : null;
  useEffect(() => {
    const base = activeSeries?.currency;
    const local = data.currency;
    if (!base || base === local || !navigator.onLine) return;
    if (fxQuote && Number.isFinite(Date.parse(fxQuote.fetchedAt)) &&
      Date.now() - Date.parse(fxQuote.fetchedAt) < 24 * 60 * 60 * 1000) return;
    const controller = new AbortController();
    setFxError('');
    void fetchFxReference(base, local, controller.signal)
      .then(rate => setData(old => ({...old,fxRates:{...(old.fxRates ?? {}),[fxKey(base,local)]:rate}})))
      .catch(error => { if (!controller.signal.aborted) setFxError(error instanceof Error ? error.message : 'Reference FX rate unavailable.'); });
    return () => controller.abort();
  }, [activeSeries?.currency, data.currency, fxQuote?.fetchedAt, setData]);
  const activeAnalysis = analysis ?? (localCached && data.analysisCache?.symbol === activeSeries?.symbol ? data.analysisCache : null);
  const lastSavedCandleDate = activeSeries?.candles?.at(-1)?.date ?? activeSeries?.asOf;
  const marketCacheDateMismatch = Boolean(activeSeries?.asOf && lastSavedCandleDate &&
    activeSeries.asOf.slice(0, 10) !== lastSavedCandleDate.slice(0, 10));
  async function loadMarket(normalized: string, requestedRange: CandleRange, requestedVenue: PublicVenue) {
    if (!normalized) return;
    const token = ++requestSerial.current;
    setFetching(true); setCandlesError(false);
    setSeries(null); setAnalysis(null); setLocalCached(false); setNotice(''); setBacktest(null);
    try {
      const result = await fetchPublicCandles(normalized, requestedRange, requestedVenue);
      if (token !== requestSerial.current) return; // Discard stale overlapping lookback requests.
      const evaluated = localTechnicalReading(result.symbol, result.candles);
      setSeries(result); setAnalysis(evaluated); setLoadedRange(requestedRange);
      setData((old) => ({ ...old, marketCache: result, marketRange: requestedRange, analysisCache: evaluated }));
    } catch (error) {
      if (token !== requestSerial.current) return;
      setCandlesError(true);
      setNotice(error instanceof Error ? error.message : 'The market provider could not be reached.');
      if (data.marketCache && data.marketCache.symbol.replace(/USD$/, '') === normalized.replace(/USD$/, '')) {
        setLocalCached(true); setLoadedRange(data.marketRange ?? null);
      }
    } finally { if (token === requestSerial.current) setFetching(false); }
  }
  function requestMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadMarket(symbol.trim().toUpperCase(), range, venue);
  }
  function selectRange(next: CandleRange) {
    setRange(next);
    if (symbol.trim() && (series || fetching || activeSeries)) void loadMarket(symbol.trim().toUpperCase(), next, venue);
  }
  function selectVenue(next: PublicVenue) {
    setVenue(next);
    if (symbol.trim() && (series || fetching || activeSeries)) void loadMarket(symbol.trim().toUpperCase(), range, next);
  }
  const price = activeAnalysis?.lastPrice ?? activeSeries?.candles.at(-1)?.close;
  const addDraft = () => {
    if (!activeSeries || !price) return;
    const draft: Draft = { id: crypto.randomUUID(), symbol: activeSeries.symbol, side: 'buy', quantity: 1, limitPrice: price, rationale: 'Created from the last provider candle. Review before approval.', status: 'pending', createdAt: new Date().toISOString() };
    setData((old) => ({ ...old, drafts: [draft, ...old.drafts] }));
  };
  const analysisError = false;
  const research = activeSeries && activeSeries.candles.length >= 10 ? localMarketResearch(activeSeries.candles) : null;

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    ++requestSerial.current; setFetching(false);
    setNotice(''); setAnalysis(null); setBacktest(null); setLocalCached(false); setCandlesError(false);
    try {
      const parsed = parseCandleCsv(await file.text());
      const imported: MarketSeries = {
        symbol: (file.name.replace(/\.csv$/i, '').trim().toUpperCase() || 'CSV').slice(0, 24),
        source: `CSV import · ${file.name}`,
        currency: /(?:\.JO|\.JSE|JSE)/i.test(file.name) ? 'ZAR' : 'USD',
        asOf: parsed.candles.at(-1)!.date,
        delayed: true,
        candles: parsed.candles,
        notice: `Imported ${parsed.candles.length} historical candles from ${file.name}. Currency inferred from filename only (ZAR for JSE, otherwise USD); verify your file's currency and JSE price units (often cents). No exchange feed has been verified for imported data.${parsed.skipped ? ` ${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} skipped.` : ''}`,
      };
      setSeries(imported); setLoadedRange(null);
      setData((old) => ({ ...old, marketCache: imported, marketRange: null }));
      const evaluated = localTechnicalReading(imported.symbol, imported.candles);
      setAnalysis(evaluated);
      setData((old) => ({ ...old, analysisCache: evaluated }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That file could not be read as a candle CSV.');
    }
  }

  const runBacktest = () => {
    if (!activeSeries) return;
    const fast = Number(fastWindow);
    const slow = Number(slowWindow);
    const fee = Number(feeBps);
    if (!Number.isFinite(fast) || !Number.isFinite(slow) || fast < 2) { setNotice('The fast window must be a number of at least 2.'); return; }
    if (slow <= fast) { setNotice('The slow window must be larger than the fast window.'); return; }
    if (activeSeries.candles.length <= slow + 1) { setNotice(`This series has ${activeSeries.candles.length} candles; the slow window of ${slow} needs more than ${slow + 1}.`); return; }
    setNotice('');
    setBacktesting(true);
    try { setBacktest(localSmaBacktest(activeSeries.candles, fast, slow, fee)); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Backtest could not be calculated.'); }
    finally { setBacktesting(false); }
  };
  return <>
    <PageIntro eyebrow="Observe before interpreting" title="Markets" description="View provider-sourced cryptocurrency quotes and analyse completed spot candles. JSE shares and other markets require authorized data feeds." trailing={<div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Database size={14} /> Read-only market research</div>} />
    <SolanaTrackingBar cachedSeries={data.solanaSeries}
      privateEnabled={data.desktopAi.enabled} privateUrl={data.desktopAi.url}
      privateToken={data.desktopAi.token} preferZar={data.currency!=='USD'}
      onCache={solanaSeries=>setData(old=>({...old,solanaSeries}))}
      onSaveDraft={info=>{
        const draft:Draft={id:crypto.randomUUID(),symbol:'SOLUSD',side:'buy',
          quantity:info.quantity,limitPrice:info.limitPrice,rationale:info.rationale,
          status:'pending',createdAt:new Date().toISOString()};
        setData(old=>({...old,drafts:[draft,...old.drafts]}));
      }}
    />
    <LiveCryptoQuotes currency={data.currency} privateToken={data.desktopAi.token} privateEnabled={data.desktopAi.enabled} />
    <Panel className="mb-5">
      <form data-market-form onSubmit={requestMarket} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
        <label className="flex-1"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Crypto spot pair</span><input data-testid="input-market-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BTC, ETH, SOL or BTCUSD" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring/30" /></label>
        <label className="sm:w-36"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Data source</span><select value={venue} onChange={(e) => selectVenue(e.target.value as PublicVenue)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[12px]"><option value="auto">Auto</option><option value="kraken">Kraken</option><option value="coinbase">Coinbase</option></select></label>
        <label className="sm:w-40"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Lookback</span><span className="relative block"><select data-testid="select-market-range" value={range} onChange={(e) => selectRange(e.target.value as CandleRange)} className="h-11 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-8 text-[12px] outline-none focus:ring-2 focus:ring-ring/30"><option value="1m">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option><option value="1y">1 year</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" /></span></label>
        <ActionButton type="submit" disabled={!symbol.trim() || fetching}>{fetching ? <LoaderCircle className="animate-spin" size={15} /> : <Search size={15} />}{fetching ? 'Loading data' : 'Request data'}</ActionButton>
      </form>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5"><span className="text-[11px] text-muted-foreground">Try:</span>{['BTC','ETH','SOL','XRP','ADA'].map(item => <button key={item} type="button" className="rounded-md border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-muted" onClick={() => setSymbol(item)}>{item}</button>)}<span className="text-[10px] text-muted-foreground">Daily completed spot candles · changing lookback or exchange refreshes automatically · not live quotes</span></div>
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Upload size={15} /></span>
        <p className="flex-1 text-[11px] leading-5 text-muted-foreground">For JSE shares, stocks, ETFs, licensed data feeds or offline use, import an authorized CSV with columns <span className="mono text-foreground">date,open,high,low,close[,volume]</span>. Check currency, units and licensing.</p>
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-[12px] font-semibold hover:bg-muted">
          <Upload size={14} />Import CSV
          <input type="file" accept=".csv,text/csv" className="hidden" data-testid="input-market-csv" onChange={importCsv} />
        </label>
      </div>
    </Panel>
    {notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-4 py-3 text-[11px] leading-5"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14} /></button></div>}
    {fetching && <Panel className="mb-5"><div className="animate-pulse p-5"><div className="h-4 w-32 rounded bg-muted" /><div className="mt-5 h-52 rounded-lg bg-muted/70" /><div className="mt-4 grid grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-14 rounded bg-muted" />)}</div></div></Panel>}
    {candlesError && !activeSeries && <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 text-destructive" size={18} /><div className="flex-1"><div className="text-[13px] font-semibold">Market data could not be retrieved</div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Check the ticker and connection, then try again. No figures are shown unless returned by the provider.</p></div><button className="text-[11px] font-semibold text-primary" onClick={(e) => { e.preventDefault(); const form = document.querySelector<HTMLFormElement>('[data-market-form]'); form?.requestSubmit(); }}>Retry</button></div></div>}
    {!activeSeries && !fetching && !candlesError && <Panel><EmptyState icon={TrendingUp} title="Start with an actual data request" description="Enter a ticker to retrieve candle data. Market Compass does not use sample prices or simulated balances." /></Panel>}
    {activeSeries && !fetching && <>
      <div className={`mb-4 flex flex-col justify-between gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${localCached ? 'border-[hsl(38,45%,72%)] bg-[hsl(42,56%,91%)]' : 'border-border bg-card'}`}>
        <div className="flex items-center gap-3"><span className={`grid h-8 w-8 place-items-center rounded-full ${localCached ? 'bg-[hsl(38,45%,80%)]' : 'bg-muted'}`}>{localCached ? <Clock3 size={15} /> : <Database size={15} />}</span><div><div className="text-[11px] font-semibold">{localCached ? 'Showing saved copy · may be out of date' : 'Completed historical daily candles · not a live quote'}</div><div className="mt-1 text-[10px] text-muted-foreground">Source: {activeSeries.source} · Latest saved candle: {utcCandleDate(lastSavedCandleDate)} (UTC){localCached ? ' · saved in this browser' : ''}</div></div></div>
        <div className="text-[10px] text-muted-foreground sm:text-right"><div>{loadedRange ? ({ '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year' } as const)[loadedRange] : 'Imported / saved window'} · {activeSeries.candles.length} candles · {activeSeries.currency}</div><div className="mt-1">Actual dates: {utcCandleDate(activeSeries.candles[0]?.date)} – {utcCandleDate(activeSeries.candles.at(-1)?.date)} (UTC)</div></div>
      </div>
      {marketCacheDateMismatch && <div className="mb-4 rounded-xl border border-[hsl(38,45%,72%)] bg-[hsl(42,56%,91%)] px-4 py-3 text-[12px] leading-5">
        The saved feed contains inconsistent timestamps: its earlier source label does not match the last stored candle. The chart shows the dates on its candles. Request fresh provider data to reconcile the feed before relying on analysis.
      </div>}
      {activeSeries.notice && !marketCacheDateMismatch && <div className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-[11px] leading-5 text-muted-foreground">{activeSeries.notice}</div>}
      {activeSeries.currency !== data.currency && <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><span className="text-[12px] font-bold">Approximate price in {data.currency}</span><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">{data.currency}</span></div>
        {fxQuote && typeof price === 'number' && approximateLocalValue(price,activeSeries.currency,data.currency,fxQuote)!==null
          ? <>
            <div className="mt-2 text-[27px] font-bold">{money(approximateLocalValue(price,activeSeries.currency,data.currency,fxQuote)!,data.currency)}</div>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Original closing price: {money(price,activeSeries.currency)}. FX reference: 1 {activeSeries.currency} = {fxQuote.rate.toFixed(5)} {data.currency} on {fxQuote.rateDate}. {fxQuote.source} public daily reference data; not a bank or executable FX quote.</p>
          </> :
          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{fxError || 'Fetching public daily currency reference rate. An internet connection is needed the first time; the last verified rate will then be kept in your encrypted workspace.'}</p>}
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">The chart, indicators and all earlier candles remain in {activeSeries.currency}. This is a snapshot conversion of the latest saved close, not a historical currency-adjusted backtest.</p>
      </div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(270px,.8fr)]">
        <Panel title={`${activeSeries.symbol} · Candles`} action={<span className="mono text-[10px] text-muted-foreground">{loadedRange ?? 'CSV'} · {activeSeries.candles.length} days</span>}>
          {activeSeries.candles.length ? <HistoricalCandleChart candles={activeSeries.candles} currency={activeSeries.currency} /> : <EmptyState icon={Activity} title="No candles returned" description="The provider returned no candle records for this request." />}
          <div className="flex flex-wrap justify-between gap-2 border-t border-border px-5 py-3 text-[10px] text-muted-foreground"><span>OHLC candles · all {activeSeries.candles.length} loaded records charted · select a date above</span><span>Prices in {activeSeries.currency}</span></div>
        </Panel>
        <Panel title="Technical reading" action={activeAnalysis && <StatusTag tone={activeAnalysis.trend === 'up' ? 'good' : activeAnalysis.trend === 'down' ? 'bad' : 'warn'}>{activeAnalysis.trend} trend</StatusTag>}>
          {activeAnalysis ? <div className="px-5 pb-1">
            <div className="grid grid-cols-2 gap-x-5">
              <Metric label="Last price" value={money(activeAnalysis.lastPrice, activeSeries.currency)} />
              <Metric label="RSI · 14" value={activeAnalysis.rsi14 == null ? '—' : activeAnalysis.rsi14.toFixed(1)} note="Momentum measure" />
              <Metric label="SMA · 20" value={activeAnalysis.sma20 == null ? '—' : money(activeAnalysis.sma20, activeSeries.currency)} />
              <Metric label="SMA · 50" value={activeAnalysis.sma50 == null ? '—' : money(activeAnalysis.sma50, activeSeries.currency)} />
              <Metric label="ATR" value={activeAnalysis.atrPercent == null ? '—' : `${activeAnalysis.atrPercent.toFixed(2)}%`} note="Volatility estimate" />
              <Metric label="Last analyzed candle" value={utcCandleDate(activeAnalysis.asOf)} note="Completed UTC trading day" />
            </div>
            <div className="border-t border-border py-4"><div className="text-[10px] uppercase tracking-[.13em] text-muted-foreground">Fibonacci retracement levels</div>{activeAnalysis.fibonacci.length ? <div className="mt-3 space-y-2">{activeAnalysis.fibonacci.map((level) => <div key={`${level.ratio}-${level.label}`} className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{level.label} <span className="mono ml-1 text-[9px]">{level.ratio}</span></span><span className="mono">{money(level.price, activeSeries.currency)}</span></div>)}</div> : <p className="mt-2 text-[11px] text-muted-foreground">No levels provided.</p>}</div>
          </div> : analysisError ? <div className="p-5"><div className="flex gap-2 text-[12px] font-semibold"><CircleAlert size={16} className="text-destructive" /> Analysis unavailable</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Candle data is still available. Technical measures were not returned; retry the data request to recalculate.</p></div> : activeSeries.candles.length >= 5 ? <div className="p-5 text-[11px] leading-5 text-muted-foreground">Analysis will appear once the candle evaluation finishes.</div> : <EmptyState icon={Gauge} title="Not enough data to evaluate" description="At least five provider candles are needed for an analysis request." />}
        </Panel>
      </div>
      {activeAnalysis && <Panel className="mt-4" title="Model evaluation" action={<StatusTag tone={activeAnalysis.model.status === 'evaluated' ? 'good' : 'warn'}>{activeAnalysis.model.status.replace('_', ' ')}</StatusTag>}>
        <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
          <div className="p-5 md:border-r md:border-border"><div className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">Evaluation, not a forecast</div><p className="serif mt-3 text-[21px] leading-snug">{activeAnalysis.model.note}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-muted-foreground"><span>{activeAnalysis.model.observations} observations</span><span>{activeAnalysis.model.folds} folds</span><span>Target: {activeAnalysis.model.target}</span></div></div>
          <div className="grid grid-cols-2 gap-x-6 px-5 py-2"><Metric label="Balanced accuracy" value={activeAnalysis.model.balancedAccuracy == null ? '—' : `${(activeAnalysis.model.balancedAccuracy * 100).toFixed(1)}%`} note="Historical evaluation" /><Metric label="Positive probability" value={activeAnalysis.model.positiveProbability == null ? '—' : `${(activeAnalysis.model.positiveProbability * 100).toFixed(1)}%`} note="Model output, not certainty" /></div>
        </div>
        {activeAnalysis.caveats.length > 0 && <div className="border-t border-border bg-muted/35 px-5 py-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><CircleAlert size={13} /> Caveats</div><ul className="space-y-1.5">{activeAnalysis.caveats.map((caveat, i) => <li key={`${i}-${caveat}`} className="text-[11px] leading-5 text-muted-foreground">— {caveat}</li>)}</ul></div>}
      </Panel>}
      {research && <Panel className="mt-4" title="Noise, Markov & extrema research" action={<StatusTag tone="warn">historical · non-executable</StatusTag>}>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Causal Kalman filter</div>
            <div className="mono mt-2 text-[17px]">{money(research.noise.lastFiltered, activeSeries.currency)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Filtered daily close · {research.noise.filteredDirection}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Original: {money(research.noise.lastRaw, activeSeries.currency)} · smoothing lags price</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Markov holdout</div>
            <div className="mono mt-2 text-[17px]">{research.markov.accuracy === null ? 'Not enough data' : `${(research.markov.accuracy * 100).toFixed(1)}%`}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Next-state accuracy · {research.markov.observations} held-out observations</div>
            {research.markov.majorityBaselineAccuracy !== null && <div className="mt-1 text-[10px] text-muted-foreground">Simple baseline: {(research.markov.majorityBaselineAccuracy * 100).toFixed(1)}%</div>}
            {research.markov.testPeriod && <div className="mt-1 text-[10px] text-muted-foreground">Test: {research.markov.testPeriod} (UTC)</div>}
            {research.markov.nextStateFrequencies && <div className="mt-1 text-[10px] text-muted-foreground">Historical transitions from {research.markov.lastState}: ↑ {(research.markov.nextStateFrequencies.up*100).toFixed(0)}% · ↓ {(research.markov.nextStateFrequencies.down*100).toFixed(0)}% · → {(research.markov.nextStateFrequencies.flat*100).toFixed(0)}%</div>}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Confirmed extrema</div>
            <div className="mono mt-2 text-[17px]">{research.extrema.pivots} delayed pivots</div>
            {research.extrema.latest ? <div className="mt-1 text-[11px] leading-5 text-muted-foreground">Latest {research.extrema.latest.kind.replace('_',' ')} on {utcCandleDate(research.extrema.latest.date)} (UTC); first confirmable on {utcCandleDate(research.extrema.latest.confirmedAt)} (UTC).</div> : <div className="mt-1 text-[11px] text-muted-foreground">No extrema confirmed in this history.</div>}
            <div className="mt-1 text-[10px] text-muted-foreground">A pivot needs three later completed candles before it can be confirmed.</div>
          </div>
        </div>
        <details className="border-t border-border p-4 text-[11px] leading-5 text-muted-foreground">
          <summary className="cursor-pointer font-semibold">Research limitations and validation</summary>
          <p className="mt-2">Kalman estimates use only current/past data; Markov frequencies use the first 70% of observed states and report accuracy on the last 30%. Extrema are marked only when their confirmation lag has passed. None of these is a calibrated trading model or a guarantee against errors.</p>
          <ul className="mt-2 list-disc pl-5">{research.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>
        </details>
      </Panel>}
      {activeSeries && !fetching && <Panel className="mt-4" title="Window backtest" action={backtest ? <StatusTag tone={backtest.strategyReturn > backtest.benchmarkReturn ? 'good' : 'warn'}>computed</StatusTag> : <span className="mono text-[10px] text-muted-foreground">SMA crossover</span>}>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:p-5">
          <label className="sm:w-28"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Fast</span><input value={fastWindow} onChange={(event) => setFastWindow(event.target.value)} type="number" min="2" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring/30" /></label>
          <label className="sm:w-28"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Slow</span><input value={slowWindow} onChange={(event) => setSlowWindow(event.target.value)} type="number" min="3" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring/30" /></label>
          <label className="sm:w-28"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Fee (bps)</span><input value={feeBps} onChange={(event) => setFeeBps(event.target.value)} type="number" min="0" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring/30" /></label>
          <ActionButton onClick={runBacktest} disabled={backtesting}>{backtesting ? <LoaderCircle className="animate-spin" size={15} /> : <Activity size={15} />}{backtesting ? 'Replaying' : 'Run backtest'}</ActionButton>
          <p className="flex-1 text-[10px] leading-5 text-muted-foreground sm:text-right">Loaded history: {utcCandleDate(activeSeries.candles[0]?.date)} – {utcCandleDate(activeSeries.candles.at(-1)?.date)} UTC ({activeSeries.candles.length} candles). Slow SMA uses {slowWindow} warm-up days; the tested dates begin afterward. Past results are not a forecast.</p>
        </div>
        {backtest && <div className="border-b border-border bg-muted/40 px-5 py-3 text-[11px] leading-5"><strong>Backtest dates:</strong> {utcCandleDate(activeSeries.candles[backtest.slowWindow]?.date)} – {utcCandleDate(activeSeries.candles.at(-1)?.date)} (UTC). <span className="text-muted-foreground">Prior candles warm up the SMA; the buy-and-hold baseline starts {utcCandleDate(activeSeries.candles[backtest.slowWindow - 1]?.date)}.</span></div>}
        {backtest ? <div className="grid gap-0 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-x-6 px-5 py-2 md:border-r md:border-border">
            <Metric label="Strategy return" value={`${(backtest.strategyReturn * 100).toFixed(1)}%`} note={`SMA ${backtest.fastWindow}/${backtest.slowWindow}`} />
            <Metric label="Buy and hold" value={`${(backtest.benchmarkReturn * 100).toFixed(1)}%`} note="Same window, no signals" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 px-5 py-2">
            <Metric label="Max drawdown" value={`${(backtest.maxDrawdown * 100).toFixed(1)}%`} note="Strategy equity curve" />
            <Metric label="Position changes" value={String(backtest.tradeCount)} note={`${backtest.feeBps} bps per change`} />
          </div>
        </div> : <div className="p-5 text-[11px] leading-5 text-muted-foreground">Set the window lengths and run the replay. Nothing is simulated until you ask for it.</div>}
        {backtest && <div className="border-t border-border bg-muted/35 px-5 py-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><CircleAlert size={13} /> Caveats</div><ul className="space-y-1.5">{backtest.notes.map((note, index) => <li key={`${index}-${note}`} className="text-[11px] leading-5 text-muted-foreground">— {note}</li>)}</ul></div>}
      </Panel>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/45 px-4 py-3"><p className="text-[10px] leading-5 text-muted-foreground">Technical indicators describe past prices; they do not predict outcomes or constitute advice.</p><ActionButton variant="quiet" onClick={addDraft}><Plus size={14} /> Create a local order draft</ActionButton></div>
    </>}
  </>;
}

function Field({ label, value, onChange, placeholder, type = 'text', step, min }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; step?: string; min?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{label}</span><input type={type} step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring/30" /></label>;
}

function Debt({ data, setData }: { data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>> }) {
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const accounts = data.accounts;
  const update = (id: string, key: keyof Omit<DebtAccount, 'id'>, value: string) => setData((old) => ({ ...old, accounts: old.accounts.map((account) => account.id === id ? { ...account, [key]: value } : account) }));
  // The add form is a temporary draft. Opening it never creates an empty
  // persisted account; saved accounts appear in a separate collapsed list.
  const blankAccount=()=>({name:'',balance:'',apr:'',minimumPayment:''});
  const [newAccount,setNewAccount]=useState(blankAccount);
  const [accountError,setAccountError]=useState('');
  const addAccount=()=>{
    const next=newAccount;
    const fields=[next.balance,next.apr,next.minimumPayment];
    if(!next.name.trim() || fields.some(value=>value.trim()==='' || !Number.isFinite(Number(value)) || Number(value)<0) ||
       Number(next.apr)>200){
      setAccountError('Enter an account name, balance, APR (0–200), and minimum monthly payment before saving.');
      return;
    }
    if(accounts.length>=50){setAccountError('The maximum of 50 saved accounts has been reached.');return;}
    setData(old=>({...old,accounts:[...old.accounts,{id:crypto.randomUUID(),...next,name:next.name.trim()}]}));
    setNewAccount(blankAccount());
    setAccountError('');
  };
  const removeAccount = (id: string) => setData((old) => ({ ...old, accounts: old.accounts.filter((account) => account.id !== id) }));
  const hasMoneyEntered = accounts.some(a => Number(a.balance) > 0 || Number(a.minimumPayment) > 0) || Number(data.monthlyExtra) > 0 || Number(data.emergencyReserve) > 0;
  const changeCurrency = (next: string, nextRegion?: string) => {
    if (next !== data.currency && hasMoneyEntered) {
      const accept = window.confirm('Currency changes do NOT convert existing debt balances, repayments or reserves. You must review and manually enter all figures in the new currency before calculating. Continue?');
      if (!accept) return;
    }
    setData(old => ({
      ...old, region: nextRegion ?? old.region, currency: next,
      currencyReviewRequired: (next !== old.currency && hasMoneyEntered) || old.currencyReviewRequired
    }));
    setPlan(null);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErrorMessage('');
    if (data.currencyReviewRequired) { setErrorMessage('Review the amounts for your newly selected currency and confirm below before calculating.'); return; }
    if (!accounts.length) { setErrorMessage('Add at least one debt account first.'); return; }
    const valid = accounts.every(a => a.name.trim() && Number.isFinite(num(a.balance)) && num(a.balance) >= 0 && Number.isFinite(num(a.apr)) && num(a.apr) >= 0 && num(a.apr) <= 200 && Number.isFinite(num(a.minimumPayment)) && num(a.minimumPayment) >= 0);
    if (!valid) { setErrorMessage('Complete each account name, balance, APR (0–200), and minimum payment with valid non-negative numbers.'); return; }
    try {
      setPlan(calculateLocalDebtPlan({
        currency: data.currency,
        accounts: accounts.map(({ name, balance, apr, minimumPayment }) => ({
          name: name.trim(), balance: Number(balance), apr: Number(apr), minimumPayment: Number(minimumPayment)
        })),
        monthlyExtra: num(data.monthlyExtra) || 0, emergencyReserve: num(data.emergencyReserve) || 0
      }));
    } catch (e) { setPlan(null); setErrorMessage(e instanceof Error ? e.message : 'Unable to calculate the plan.'); }
  };
  const total = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  return <>
    <PageIntro eyebrow="Plan with your own numbers" title="Debt payoff" description="Build a local payoff plan and prepare secure provider payment handoffs without connecting your bank accounts. No payments are initiated from this page." trailing={<div className="flex items-center gap-2 text-[10px] text-muted-foreground"><ShieldCheck size={14} /> Encrypted device workspace</div>} />
    <FinancialReadinessChecklist data={data} />
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <div className="space-y-4">
        <Panel title="Your accounts" action={<span className="mono text-[10px] text-muted-foreground">{accounts.length} / 50 saved</span>}>
          {accounts.length ? <div className="divide-y divide-border" aria-label="Saved debt accounts">
            {accounts.map((account,index)=><details key={account.id} className="group">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{maskDocumentPII(account.name.trim())||`Incomplete saved account ${index+1}`}</strong>
                  <small className="text-[10px] text-muted-foreground">Saved account · Tap to edit</small>
                </span>
                <strong className="shrink-0 tabular-nums">{account.balance.trim()?money(Number(account.balance)||0,data.currency):'Balance missing'}</strong>
                <ChevronDown size={17} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"/>
              </summary>
              <div className="border-t border-border bg-muted/20 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Account name" value={account.name} onChange={v=>update(account.id,'name',v)} placeholder="e.g. Personal loan"/>
                  <Field label="Balance" value={account.balance} onChange={v=>update(account.id,'balance',v)} type="number" min="0" step="0.01" placeholder="0.00"/>
                  <Field label="APR (%)" value={account.apr} onChange={v=>update(account.id,'apr',v)} type="number" min="0" step="0.01" placeholder="0.00"/>
                  <Field label="Minimum / month" value={account.minimumPayment} onChange={v=>update(account.id,'minimumPayment',v)} type="number" min="0" step="0.01" placeholder="0.00"/>
                </div>
                <button type="button" onClick={()=>{if(window.confirm('Remove this saved account from the encrypted workspace? This does not delete historic transactions.'))removeAccount(account.id);}}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-destructive/30 px-3 text-[11px] font-semibold text-destructive">
                  <Trash2 size={14}/> Remove saved account
                </button>
              </div>
            </details>)}
          </div>:<EmptyState icon={WalletCards} title="No debt accounts yet" description="Add a debt account below. Nothing is saved until you tap Save account."/>}
          <div id="mc-add-debt-account" className="scroll-mt-24 border-t border-border p-4 sm:p-5" aria-label="Add a new debt account">
            <h3 className="text-[14px] font-bold">Add an account</h3>
            <p className="mb-3 mt-1 text-[11px] text-muted-foreground">This form stays blank after saving. Existing accounts stay collapsed above.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Account name" value={newAccount.name} onChange={v=>setNewAccount(old=>({...old,name:v}))} placeholder="e.g. Capfin loan"/>
              <Field label="Balance" value={newAccount.balance} onChange={v=>setNewAccount(old=>({...old,balance:v}))} type="number" min="0" step="0.01" placeholder="0.00"/>
              <Field label="APR (%)" value={newAccount.apr} onChange={v=>setNewAccount(old=>({...old,apr:v}))} type="number" min="0" step="0.01" placeholder="0.00"/>
              <Field label="Minimum / month" value={newAccount.minimumPayment} onChange={v=>setNewAccount(old=>({...old,minimumPayment:v}))} type="number" min="0" step="0.01" placeholder="0.00"/>
            </div>
            <button type="button" disabled={accounts.length>=50} onClick={addAccount}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
              <Plus size={16}/> Save account
            </button>
            {accountError&&<p role="alert" className="mt-2 text-[11px] text-destructive">{accountError}</p>}
          </div>
        </Panel>
        <Panel title="Monthly guardrails">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Extra available each month" value={data.monthlyExtra} onChange={(v) => setData((old) => ({ ...old, monthlyExtra: v }))} type="number" min="0" step="0.01" placeholder="0.00" />
            <Field label="Emergency reserve to preserve" value={data.emergencyReserve} onChange={(v) => setData((old) => ({ ...old, emergencyReserve: v }))} type="number" min="0" step="0.01" placeholder="0.00" />
            <label><span className="mb-1.5 block text-[10px] font-semibold text-muted-foreground">Country / region</span>
              <select value={selectedRegion(data.region)} onChange={e => {
                const chosen = selectedRegion(e.target.value);
                changeCurrency(regionDefaultCurrency(chosen), chosen);
              }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring/30">
                {['Africa', 'Europe', 'Americas', 'Asia & Pacific'].map(group => <optgroup key={group} label={group}>
                  {REGIONS.filter(item => item.group === group).map(item => <option key={item.code} value={item.code}>{item.country} · {item.currency}</option>)}
                </optgroup>)}
              </select>
            </label>
            <label><span className="mb-1.5 block text-[10px] font-semibold text-muted-foreground">Planning currency</span>
              <select value={data.currency} onChange={e => changeCurrency(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring/30">
                {CURRENCIES.map(item => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
              </select>
            </label>
            <div className="rounded-lg bg-muted/60 px-3 py-2.5"><div className="text-[10px] text-muted-foreground">Current entered principal</div><div className="mono mt-1.5 text-[16px]">{money(total, data.currency)}</div></div>
          </div>
        </Panel>
        <p className="rounded-lg border border-border bg-muted/45 px-4 py-3 text-[11px] leading-5 text-muted-foreground">Currency is selected using the region but can be changed independently. No automatic FX conversion is performed. Every account in a payoff comparison must be expressed in the same planning currency ({data.currency}).</p>
        {data.currencyReviewRequired && <div role="alert" className="rounded-lg border border-[hsl(38,45%,72%)] bg-[hsl(42,56%,91%)] px-4 py-3 text-[11px] leading-5">
          <p className="font-semibold">Existing amounts have not been converted.</p>
          <p>Check every debt balance, minimum payment, extra amount and reserve, then manually correct any figure that was in another currency.</p>
          <button type="button" className="mt-2 rounded-md border border-border bg-background px-3 py-2 font-semibold" onClick={() => setData(old => ({ ...old, currencyReviewRequired: false }))}>I have reviewed all amounts in {data.currency}</button>
        </div>}
        {errorMessage && <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-[11px] leading-5 text-destructive" role="alert">{errorMessage}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-[420px] text-[10px] leading-5 text-muted-foreground">Calculation uses your inputs only. Estimates may not include fees, variable APR changes, or lender-specific rules.</p><ActionButton type="submit" disabled={data.currencyReviewRequired}><ArrowLeftRight size={15} />Compare payoff paths locally</ActionButton></div>
      </div>
      <div className="space-y-4">
        <Panel title="Scenario comparison" action={plan && <StatusTag tone="good">Calculated</StatusTag>}>
          {plan ? <div className="p-5">
            <div className="mb-4 flex justify-between text-[10px] text-muted-foreground"><span>Total principal in plan</span><span className="mono text-foreground">{money(plan.totalPrincipal, plan.currency)}</span></div>
            {plan.scenarios.map((scenario) => <div key={scenario.strategy} className="mb-3 rounded-lg border border-border p-4"><div className="flex items-center justify-between"><div className="serif text-[19px] capitalize">{scenario.strategy}</div><span className="mono text-[10px] text-muted-foreground">{scenario.amortized ? `${scenario.months} months` : 'Not fully repaid'}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Total interest</div><div className="mono mt-1 text-[14px]">{money(scenario.totalInterest, plan.currency)}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Total paid</div><div className="mono mt-1 text-[14px]">{money(scenario.totalPaid, plan.currency)}</div></div></div></div>)}
            {plan.notes.map((note, i) => <p key={`${i}-${note}`} className="mt-3 text-[10px] leading-5 text-muted-foreground">{note}</p>)}
          </div> : <EmptyState icon={ArrowLeftRight} title="Two paths, one informed choice" description="Enter at least one account and calculate to see the avalanche and snowball scenarios. No outcome is estimated here in advance." />}
        </Panel>
        <div className="rounded-xl border border-border bg-[hsl(42,44%,92%)] p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 shrink-0 text-[hsl(34,52%,42%)]" size={17} /><div><div className="text-[11px] font-semibold">A calculation is not a promise</div><p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">Actual payoff timing depends on your lender’s terms, payment timing, fees, and future rates. Keep an emergency reserve that fits your situation.</p></div></div></div>
      </div>
    </form>
    <div className="mt-6">
      <DebtAdvisor accounts={accounts} currency={data.currency} baseline={data.financialBaseline ?? null}
        budget={data.privateBudget ?? emptyPrivateBudget}
        onBudgetChange={next => setData(old => ({ ...old, privateBudget: next }))}
        onImport={historical => {
          const replaceExisting = !data.accounts.length || window.confirm('You have existing debt accounts. Replace them with this historical Financial Advisor baseline? You MUST review every imported amount before computing any repayment. Choose Cancel to keep existing accounts and store the historical reference only.');
          setData(old => ({
            ...old,
            financialBaseline: historical,
            currency: replaceExisting ? 'ZAR' : old.currency,
            region: replaceExisting ? 'ZA' : old.region,
            currencyReviewRequired: replaceExisting ? true : old.currencyReviewRequired,
            accounts: replaceExisting ? historical.accounts.map(account => ({
              id: crypto.randomUUID(), name: account.name,
              balance: String(account.balance), apr: String(account.apr), minimumPayment: String(account.minimumPayment)
            })) : old.accounts
          }));
        }}
        monthlyExtra={data.monthlyExtra} plan={plan}
      />
    </div>
    <div className="mt-6"><DebtPaymentHandoff accounts={accounts} currency={data.currency} region={selectedRegion(data.region)} /></div>
    <div className="mt-4">
      <OzowMerchantGateway currency={data.currency} region={selectedRegion(data.region)}
        records={data.merchantRequests ?? []}
        onCreate={record => setData(old => ({ ...old, merchantRequests: [record, ...(old.merchantRequests ?? [])].slice(0, 30) }))}
        onUpdate={(localId, fields) => setData(old => ({
          ...old, merchantRequests: (old.merchantRequests ?? []).map(item => item.localId === localId ? { ...item, ...fields } : item)
        }))}
      />
    </div>
  </>;
}

function Drafts({ data, setData }: { data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>> }) {
  const [notice, setNotice] = useState('');
  const [lastReviewAt,setLastReviewAt]=useState('');
  const savedClose=data.marketCache?.candles?.at(-1);
  const marketEvidence=Boolean(savedClose&&Number.isFinite(savedClose.close)&&savedClose.close>0);
  const setStatus = (draft: Draft, status: DraftStatus) => {
    if (status === 'approved' && !window.confirm('Approve this local draft for your records? No order will be sent, and no trade will occur.')) return;
    setData((old) => ({ ...old, drafts: old.drafts.map((item) => item.id === draft.id ? { ...item, status } : item) }));
    setNotice(status === 'approved' ? 'Draft marked approved locally. No order was sent.' : status === 'rejected' ? 'Draft rejected locally. No order was sent.' : 'Draft restored to pending review.');
  };
  const remove = (draft: Draft) => {
    if (!window.confirm(`Delete the ${draft.symbol} ${draft.side} draft from this browser?`)) return;
    setData((old) => ({ ...old, drafts: old.drafts.filter((item) => item.id !== draft.id) }));
  };
  return <>
    <PageIntro eyebrow="Nothing leaves this workspace" title="Order drafts" description="These are personal notes for review only. Approving a draft changes its local status and never sends an order." trailing={<StatusTag>{data.drafts.filter((d) => d.status === 'pending').length} pending</StatusTag>} />
    {notice && <div role="status" className="mb-4 flex items-center justify-between rounded-lg border border-border bg-muted/60 px-4 py-3 text-[11px]"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-[hsl(38,45%,72%)] bg-[hsl(42,56%,91%)] p-4"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[hsl(34,52%,39%)]" /><p className="text-[11px] leading-5 text-[hsl(166,19%,25%)]"><strong>Local review only.</strong> “Approve” records your review in this browser. There is no brokerage connection, order submission, or automatic trading.</p></div>
    <section aria-label="Order review progress" className="mb-5 rounded-[22px] border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[14px] font-bold">Order review readiness</h2><button type="button" onClick={()=>setLastReviewAt(new Date().toISOString())} className="min-h-11 rounded-xl border border-border px-3 text-[12px] font-semibold">Check progress now</button></div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">This is an instant, local readiness check. It does not ask an AI to recommend a trade, obtain an executable broker quote, or submit an order.</p>
      <dl className="mt-3 grid gap-2 text-[12px]">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/35 p-3"><dt>Historical market evidence</dt><dd className="font-semibold">{marketEvidence?`${data.marketCache?.symbol} · ${savedClose?.date}`:'Not saved'}</dd></div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/35 p-3"><dt>Local draft proposals</dt><dd className="font-semibold">{data.drafts.length} record(s)</dd></div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/35 p-3"><dt>Executable brokerage access</dt><dd className="font-semibold">Not configured · no orders</dd></div>
      </dl>
      {lastReviewAt&&<p role="status" className="mt-2 text-[11px] text-muted-foreground">Checked {formatTime(lastReviewAt)}. {marketEvidence?'Market history is available for manual research; it is not a buy/sell signal.':'Get dated market evidence first.'} Broker onboarding remains unavailable.</p>}
      <div className="mt-3 flex flex-wrap gap-3"><Link href="/markets" className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-[12px] font-semibold">Review markets <ArrowRight size={14} className="ml-1"/></Link><Link href="/assistant" className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-[12px] font-semibold">Ask Compass to explain research <ArrowRight size={14} className="ml-1"/></Link></div>
    </section>
    {data.drafts.length ? <div className="space-y-3">{data.drafts.map((draft) => <Panel key={draft.id} className="overflow-hidden"><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className="flex min-w-[180px] items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${draft.side === 'buy' ? 'bg-[hsl(155,30%,90%)] text-[hsl(158,36%,29%)]' : 'bg-[hsl(5,48%,92%)] text-[hsl(4,52%,41%)]'}`}>{draft.side === 'buy' ? <ArrowUpRight size={19} /> : <ArrowDownRight size={19} />}</span><div><div className="mono text-[15px] font-medium">{draft.symbol}</div><div className="text-[10px] capitalize text-muted-foreground">{draft.side} · {draft.quantity} units</div></div></div><div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3"><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Limit price</div><div className="mono mt-1 text-[12px]">{money(draft.limitPrice)}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Created</div><div className="mt-1 text-[11px]">{formatTime(draft.createdAt)}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Status</div><div className="mt-1"><StatusTag tone={draft.status === 'approved' ? 'good' : draft.status === 'rejected' ? 'bad' : 'warn'}>{draft.status}</StatusTag></div></div></div><div className="flex flex-wrap items-center gap-2 lg:justify-end">{draft.status === 'pending' && <><ActionButton onClick={() => setStatus(draft, 'approved')}><Check size={14} /> Approve locally</ActionButton><ActionButton variant="quiet" onClick={() => setStatus(draft, 'rejected')}><X size={14} /> Reject</ActionButton></>}{draft.status !== 'pending' && <ActionButton variant="quiet" onClick={() => setStatus(draft, 'pending')}>Reopen</ActionButton>}<button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => remove(draft)} aria-label={`Delete ${draft.symbol} draft`}><Trash2 size={15} /></button></div></div>{draft.rationale && <div className="border-t border-border bg-muted/30 px-5 py-3 text-[10px] leading-5 text-muted-foreground"><span className="mr-2 font-semibold text-foreground">Rationale</span>{draft.rationale}</div>}</Panel>)}</div> : <Panel><EmptyState icon={FileClock} title="No drafts saved" description="Create an explicitly local draft from a market view, or wait until you have a real provider price to reference." action={<Link href="/markets" className="text-[11px] font-semibold text-primary">Go to markets <ArrowRight size={13} className="ml-1 inline" /></Link>} /></Panel>}
  </>;
}

type SpendSection='documents'|'activity'|'plan';
function ExpenseLedger({data,setData}:{data:WorkspaceData;setData:Dispatch<SetStateAction<WorkspaceData>>}){
  // A mobile-first workflow: documents and parsing first, then the dated
  // transaction ledger, then the read-only planning evidence checklist.
  const [section,setSection]=useState<SpendSection>((data.expenseEntries??[]).length?'activity':'documents');
  const docs=Array.isArray(data.localFinanceDocuments)?data.localFinanceDocuments:[];
  const ledger=Array.isArray(data.expenseEntries)?data.expenseEntries:[];
  const options=[
    {id:'documents' as const,title:'Documents',subtitle:'Import & review',count:docs.length,Icon:Upload},
    {id:'activity' as const,title:'Activity',subtitle:'Spending ledger',count:ledger.length,Icon:ReceiptText},
    {id:'plan' as const,title:'Plan',subtitle:'Next steps',count:null,Icon:ListChecks}
  ];
  return <>
    <PageIntro eyebrow="Evidence first, decisions second" title="Your finances"
      description="Start with a document, review its information, and decide what should become a transaction. Your local financial plan updates only from the records you approve."
      trailing={<StatusTag tone="warn">Owner-reviewed · not bank verified</StatusTag>} />
    <IonCard role="region" aria-label="Spend workspace" className="mc-ionic-surface mb-6 rounded-[24px] border border-border bg-card p-3 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:mb-4">
        <div>
          <h2 className="text-[14px] font-bold">Your workspace</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Three focused views. Your saved records stay in the same encrypted vault.</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Private · on device</span>
      </div>
      <nav aria-label="Spend sections">
        <IonSegment className="mc-spend-tabs" value={section}
          onIonChange={event=>{
            const next=event.detail.value;
            if(next==='documents'||next==='activity'||next==='plan')setSection(next);
          }}>
          {options.map(({id,title,subtitle,count,Icon})=><IonSegmentButton key={id} value={id}
            aria-pressed={section===id} aria-label={title} onClick={()=>setSection(id)}>
            <Icon size={18} className="mc-spend-tab-icon" aria-hidden="true"/>
            <IonLabel className="mc-spend-tab-label">{title}</IonLabel>
            <span className="mc-spend-tab-meta">{count===null?subtitle:count+' saved'}</span>
          </IonSegmentButton>)}
        </IonSegment>
      </nav>
    </IonCard>
    {section==='documents'&&ledger.length>0&&<button type="button" onClick={()=>setSection('activity')}
      className="mb-5 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[.065] px-4 py-3 text-left text-[12px] font-semibold">
      <span>{ledger.length} approved or manually recorded transaction(s) are ready in your spending portfolio.</span>
      <ArrowRight size={19} className="shrink-0" aria-hidden="true"/>
    </button>}
    <div aria-label={section==='documents'?'Document importer and reviewed files':
      section==='activity'?'Dated transactions and cash flow':'Financial readiness and planning'}
      className="min-w-0 space-y-5">
      {section==='documents'&&<>
        <div className="rounded-2xl border border-primary/15 bg-primary/[.045] px-4 py-3">
          <p className="text-[12px] font-semibold">1. Import · 2. Review · 3. Add approved lines to Spend</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            Saving an excerpt alone does not alter your ledger. Open a saved document
            and choose Review and add to Spend to classify real entries.
          </p>
        </div>
        <LocalFinanceFiles
          documents={docs}
          onAdd={document=>setData(old=>({
            ...old,localFinanceDocuments:addLocalFinanceDocument(old.localFinanceDocuments??[],document)
          }))}
          onRemove={id=>setData(old=>({
            ...old,localFinanceDocuments:removeLocalFinanceDocument(old.localFinanceDocuments??[],id)
          }))}
          ledgerEntries={ledger}
          currency={data.currency}
          region={selectedRegion(data.region)}
          currencyReviewRequired={data.currencyReviewRequired}
          onApplyEntries={approved=>setData(old=>({...old,expenseEntries:approved}))}
        />
        <AccountEvidenceReview documents={docs} existingAccounts={data.accounts}
          currency={data.currency}
          onCreate={account=>setData(old=>({...old,accounts:[
            ...old.accounts,{...account,id:crypto.randomUUID()}
          ]}))}/>
      </>}
      {section==='activity'&&<>
        <Suspense fallback={<p role="status" className="rounded-xl bg-card p-4 text-[12px]">Loading transactions…</p>}>
          <IonicSpendPreview entries={ledger} currency={data.currency} debtAccounts={data.accounts}
            onOpenDocuments={()=>setSection('documents')}/>
        </Suspense>
        <SavedCategoryReview entries={ledger} currency={data.currency} region={selectedRegion(data.region)}
          onApprove={approved=>setData(old=>({...old,expenseEntries:applySavedCategoryChanges(
            old.expenseEntries??[],approved,selectedRegion(old.region))}))}
          onManualCategorize={(entryId,category)=>setData(old=>{
            const original=(old.expenseEntries??[]).find(item=>item.id===entryId);
            if(!original||!expenseCategoryNeedsSorting(original.category)||
               !allowedSavedCategory(original.kind,category))return old;
            return {...old,expenseEntries:old.expenseEntries.map(item=>item.id===entryId?{...item,category}:item)};
          })}/>
        <SpendingPortfolio entries={ledger} documents={docs} currency={data.currency}/>
        <IncomeAllocation entries={ledger} currency={data.currency}/>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[12px] font-semibold">Transactions you have recorded or approved</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            The salary cycle runs from the 26th to the 25th. Imported entries are
            dated but not reconciled with a live bank; confirm the selected cycle.
          </p>
        </div>
        <AccountTransactionHistory accounts={data.accounts} entries={ledger} currency={data.currency}
          onAssign={(id,accountId)=>setData(old=>old.accounts.some(account=>account.id===accountId)?{
            ...old,expenseEntries:old.expenseEntries.map(entry=>entry.id===id?{...entry,debtAccountId:accountId}:entry)
          }:old)}/>
        <MonthlyExpenses
          entries={ledger}
          settings={data.expenseSettings??DEFAULT_EXPENSE_SETTINGS}
          desktopAi={data.desktopAi??DEFAULT_DESKTOP_AI}
          currency={data.currency}
          region={selectedRegion(data.region)}
          debtAccounts={data.accounts}
          onSave={(entry,syncDebtBalance)=>setData(old=>({
            ...old,
            expenseEntries:[
              ...(old.expenseEntries??[]).filter(saved=>saved.id!==entry.id),entry
            ],
            accounts:syncDebtBalance && entry.debtAccountId && entry.remainingBalance!==null && entry.remainingBalance!==undefined
              ? old.accounts.map(a=>a.id===entry.debtAccountId?{...a,balance:String(entry.remainingBalance)}:a)
              : old.accounts,
          }))}
          onDelete={id=>setData(old=>({...old,expenseEntries:(old.expenseEntries??[]).filter(e=>e.id!==id)}))}
          onSettingsChange={next=>setData(old=>({...old,expenseSettings:next}))}
        />
      </>}
      {section==='plan'&&<>
        <FinancialReadinessChecklist data={data} />
        <OwnerBudgetDraftEditor
          profile={data.ownerBudgetDraft??null}
          onSave={profile=>setData(old=>({...old,ownerBudgetDraft:profile}))}
        />
      </>}
    </div>
  </>;
}

function Assistant({ data, setData, onImportDocuments }: {
  data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>>;
  onImportDocuments:()=>void;
}) {
  const [, navigate] = useLocation();
  const context: CompassCommandContext = {
    currency: data.currency,
    ownerBudgetDraft:(()=>{
      try{return data.ownerBudgetDraft?summarizeOwnerBudgetDraft(data.ownerBudgetDraft):null;}
      catch{return null;}
    })(),
    accounts: data.accounts,
    localFinanceDocuments:Array.isArray(data.localFinanceDocuments)?data.localFinanceDocuments:[],
    monthlyExtra: data.monthlyExtra,
    privateBudget: data.privateBudget ?? emptyPrivateBudget,
    marketCache: data.marketCache,
    draftCount: data.drafts.filter(d => d.status === 'pending').length,
    expenseSummary: (() => {
      const current=salaryCycle(localDate());
      const stats=cycleAnalysis(data.expenseEntries??[],current.start,data.currency,(data.expenseSettings??DEFAULT_EXPENSE_SETTINGS).cycleBudget);
      const cutIdeas=cycleCashflowCutIdeas(data.expenseEntries??[],current.start,data.currency);
      return {cycleStart:current.start,cycleEnd:current.lastDay,income:stats.income,
        expenses:stats.expenses,debtPayments:stats.debtPayments,transfers:stats.transfers,
        recordedDifference:stats.recordedDifference,entryCount:stats.count,
        cycleLimit:stats.budget,flags:stats.flags.slice(0,4),
        unsortedCount:stats.unsortedCount,unsortedOutflow:stats.unsortedOutflow,
        illustrativeSavings:cutIdeas.totalIllustrativeSavings,
        cutIdeas:cutIdeas.ideas.slice(0,4).map(x=>({category:x.category,recorded:x.recorded,illustrativeSavings:x.illustrativeSavings,rate:x.rate})),
        categories:stats.byCategory.slice(0,6).map(v=>({category:v.label,amount:v.amount})),
        paymentMethods:stats.byPaymentMethod.slice(0,5).map(v=>({
          app:v.app.replace(/\d{6,}/g,'[masked]').slice(0,60),
          amount:v.amount,count:v.count
        }))};
    })(),
  };
  return <>
    <VoiceAssistant context={context} onNavigate={navigate} onImportDocuments={onImportDocuments} settings={data.desktopAi ?? DEFAULT_DESKTOP_AI}
      onSettingsChange={next => setData(old => ({ ...old, desktopAi: next }))}
      queuedReadOnlyQuestions={Array.isArray(data.offlineAgentQuestions)?data.offlineAgentQuestions:[]}
      onQueueReadOnlyQuestion={question=>{
        const created=enqueueOfflineQuestion(data.offlineAgentQuestions??[],question);
        setData(old=>({
          ...old,
          offlineAgentQuestions:(old.offlineAgentQuestions??[]).some(x=>x.id===created.created.id)
            ?old.offlineAgentQuestions
            :[...(old.offlineAgentQuestions??[]),created.created]
        }));
        return created.created;
      }}
      onRemoveQueuedReadOnlyQuestion={id=>setData(old=>({
        ...old,offlineAgentQuestions:removeOfflineQuestion(old.offlineAgentQuestions??[],id)
      }))} />
    {currentAssistantEdition()==='personal' && <PersonalTaskBoard tasks={Array.isArray(data.personalTasks)?data.personalTasks:[]}
      onChange={tasks=>setData(old=>({...old,personalTasks:tasks}))}/>}
    {data.queue.length > 0 && <details className="mt-4 rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-[12px] font-semibold">Earlier saved instructions · {data.queue.length}</summary>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">These records came from the original command interpreter and remain encrypted in your vault. They are not active instructions, payments or trades.</p>
      <div className="mt-3 space-y-2">{data.queue.map(item=><div key={item.id} className="flex items-start gap-2 rounded-xl border border-border p-3">
        <div className="min-w-0 flex-1"><div className="break-words text-[12px] font-medium">{item.originalText}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatTime(item.createdAt)} · Pending locally only</p></div>
        <button type="button" aria-label="Remove old instruction" onClick={() => setData(old=>({...old,queue:old.queue.filter(x=>x.id!==item.id)}))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground"><Trash2 size={16}/></button>
      </div>)}</div>
    </details>}
  </>;
}

function NotFound() {
  return <div className="mx-auto max-w-lg py-24 text-center"><div className="serif text-4xl">This path is uncharted.</div><p className="mt-3 text-sm text-muted-foreground">That page is not part of your workspace.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">Return to overview <ArrowRight size={15} /></Link></div>;
}

function Router() {
  const vault = useWorkspaceVault();
  if (!vault.password) return <VaultScreen vault={vault} />;
  return <UnlockedRouter vault={vault} />;
}
function OfflineOnlyBanner() {
  // Security and provider limitations are available under Vault & Settings.
  // Keep repetitive technical status banners off the primary mobile screens.
  return null;
}

function BackupControls({ vault }: { vault: ReturnType<typeof useWorkspaceVault> }) {
  const [dailyOpen, setDailyOpen] = useState(false);
  const settings = vault.backupSettings;
  const data = vault.data;
  const financialAmountsPresent = data.accounts.length > 0 ||
    Boolean(data.ownerBudgetDraft) ||
    data.monthlyExtra.trim() !== '' || data.emergencyReserve.trim() !== '' ||
    Boolean(data.privateBudget && [data.privateBudget.monthlyIncome, data.privateBudget.monthlyEssentials, data.privateBudget.liquidFunds].some(v => v.trim() !== ''));
  const chooseCurrency = (currency: string, region?: string) => {
    if (currency !== data.currency && financialAmountsPresent && !window.confirm('Changing currency does NOT convert any debt or cash amounts. You must review and re-enter all amounts in the selected currency before calculating. Continue?')) return;
    vault.setData(old=>({
      ...old, currency, region: region ?? old.region,
      currencyReviewRequired: old.currencyReviewRequired || (currency !== old.currency && financialAmountsPresent)
    }));
  };
  return <details id="mc-backup-controls" className="group mb-4 rounded-2xl border border-border bg-card shadow-sm lg:mb-7" aria-label="Encrypted vault and backup settings">
    <summary className="flex min-h-[55px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(165,19%,91%)] text-primary"><ShieldCheck size={18}/></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold">Encrypted vault &amp; settings</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{vault.saving ? 'Saving changes…' : vault.savedAt ? `Last saved ${new Date(vault.savedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Stored on this device'} · Offline workspace</span>
      </span>
      <ChevronDown size={18} className="text-muted-foreground transition-transform group-open:rotate-180"/>
    </summary>
    <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
      <p className="text-[12px] leading-5 text-muted-foreground">Your debt details and market history stay in this device's encrypted vault. Installing Market Compass on a second device does not automatically sync it. Back up your vault to move it safely.</p>
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between"><span className="text-[12px] font-bold">Local currency &amp; region</span><span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-bold">{data.currency}</span></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] font-semibold">Country / region
            <select value={selectedRegion(data.region)} onChange={event=>{
              const region=selectedRegion(event.target.value);
              chooseCurrency(regionDefaultCurrency(region),region);
            }} className="mt-1 block min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal">
              {['Africa','Europe','Americas','Asia & Pacific'].map(group=><optgroup label={group} key={group}>
                {REGIONS.filter(item=>item.group===group).map(item=><option key={item.code} value={item.code}>{item.country} ({item.currency})</option>)}
              </optgroup>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold">Planning currency
            <select value={data.currency} onChange={event=>chooseCurrency(event.target.value)}
              className="mt-1 block min-h-12 w-full rounded-xl border border-input bg-background px-3 text-[16px] font-normal">
              {CURRENCIES.map(item=><option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">New South African workspaces default to ZAR. Changing the label does not convert previously entered amounts. Historical market charts remain in their provider currency; an optional reference FX estimate appears under Markets.</p>
        {data.currencyReviewRequired && <p className="mt-2 font-semibold text-[11px] text-destructive">Review previously entered amounts in Debt Plan before calculating.</p>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={vault.saving || !vault.savedAt} onClick={() => { void vault.exportBackup(); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
          <ShieldCheck size={16}/> Export encrypted backup
        </button>
        <button type="button" disabled={vault.saving || !vault.savedAt} onClick={() => { void vault.exportBackup().then(saved => { if (saved) vault.lock(); }); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-[12px] font-semibold disabled:opacity-40">Backup &amp; lock app</button>
      </div>
      <button type="button" onClick={() => setDailyOpen(value => !value)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-[12px] font-semibold">
        <span>Daily backup settings</span><ChevronDown size={17} className={dailyOpen ? 'rotate-180' : ''}/>
      </button>
      {dailyOpen && <div className="space-y-3 rounded-xl bg-muted/50 p-3 text-[12px]">
        <label className="flex min-h-10 items-center gap-3">
          <input aria-label="Enable daily encrypted backups" type="checkbox" checked={settings.enabled} onChange={e => vault.setSchedule({ ...settings, enabled: e.target.checked })}/>
          Prepare an encrypted snapshot each day
        </label>
        <label className="flex items-center justify-between gap-3">Local backup time
          <input aria-label="Daily backup time" type="time" value={settings.time} onChange={e => vault.setSchedule({ ...settings, time: e.target.value })} className="min-h-11 rounded-lg border border-input bg-background px-2"/>
        </label>
        <p className="text-[11px] leading-5 text-muted-foreground">Daily snapshots are prepared only when the app is unlocked and open. iPhone exports require your tap and Save to Files. Closing the app pauses scheduling.</p>
        {settings.lastSnapshotDate && <p className="text-[11px] text-muted-foreground">Last daily snapshot: {settings.lastSnapshotDate}</p>}
      </div>}
      {vault.dailyBackupPending && <p role="status" className="text-[12px] font-semibold text-primary">An encrypted backup is ready. Tap Export and save it to Files.</p>}
      {vault.backupMessage && <p role="status" className="text-[12px] text-muted-foreground">{vault.backupMessage}</p>}
      {vault.error && <p role="alert" className="text-[12px] text-destructive">{vault.error}</p>}
      <details className="rounded-xl border border-border px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">How offline mode and payments work</summary>
        <p className="mt-2">Debt calculations and saved historical candles work without internet after you install and open the app once online. New market prices need an exchange connection. Desktop Ollama requires your private desktop to be reachable. Bank payments and merchant checkout are separate authorized provider actions, not automatic features of this PWA.</p>
        <p className="mt-2">{vault.compressionInfo}</p>
      </details>
    </div>
  </details>;
}

function UnlockedRouter({ vault }: { vault: ReturnType<typeof useWorkspaceVault> }) {
  const { data, setData } = vault;
  const [,navigate]=useLocation();
  const addAccount=()=>{
    // Navigate to the blank draft form; never create an empty vault account.
    navigate('/debt');
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>
      document.getElementById('mc-add-debt-account')?.scrollIntoView({behavior:'smooth',block:'start'})
    ));
  };
  const [importOpen,setImportOpen]=useState(false);
  const [recoveryOpen,setRecoveryOpen]=useState(false);
  const pending = data.drafts.filter((draft) => draft.status === 'pending').length;
  return <RoutedErrorBoundary><AppShell pending={pending} currency={data.currency} onImportDocuments={()=>setImportOpen(true)} onAddAccount={addAccount}><OfflineOnlyBanner /><Switch>
    <Route path="/"><Overview data={data} setData={setData} onImportDocuments={()=>setImportOpen(true)} onRecoverVault={()=>setRecoveryOpen(true)} onAddAccount={addAccount}/></Route>
    <Route path="/markets"><Markets data={data} setData={setData} /></Route>
    <Route path="/debt"><Debt data={data} setData={setData} /></Route>
    <Route path="/expenses"><ExpenseLedger data={data} setData={setData} /></Route>
    <Route path="/drafts"><Drafts data={data} setData={setData} /></Route>
    <Route path="/assistant"><Assistant data={data} setData={setData} onImportDocuments={()=>setImportOpen(true)}/></Route>
    <Route path="/banks"><div className="mx-auto max-w-2xl"><PageIntro eyebrow="Accounts" title="Choose your bank" description="Organize account documents; secure live bank connections are not enabled."/><BankCarousel desktopAi={data.desktopAi} onImportDocuments={()=>setImportOpen(true)} onAddAccount={addAccount}/></div></Route>
    <Route component={NotFound} />
  </Switch><div className="mt-8"><BackupControls vault={vault} /></div></AppShell>
    {importOpen&&<div role="presentation" className="fixed inset-0 z-[75] flex items-end justify-center bg-black/65 px-2 pt-4 pb-[calc(10px+env(safe-area-inset-bottom))] sm:items-center" onClick={()=>{if(window.confirm('Close document review? Any unsaved review progress will be discarded.'))setImportOpen(false);}}>
      <section role="dialog" aria-modal="true" aria-label="Import and review financial documents" className="flex max-h-[90dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div><h2 className="text-[16px] font-bold">Import financial documents</h2><p className="text-[11px] text-muted-foreground">Select files · review locally · approve explicitly</p></div>
          <button type="button" aria-label="Close document importer" onClick={()=>{if(window.confirm('Close document review? Any unsaved review progress will be discarded.'))setImportOpen(false);}} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border"><X size={19}/></button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
          <LocalFinanceFiles
            documents={data.localFinanceDocuments??[]}
            onAdd={document=>setData(old=>({...old,localFinanceDocuments:addLocalFinanceDocument(old.localFinanceDocuments??[],document)}))}
            onRemove={id=>setData(old=>({...old,localFinanceDocuments:removeLocalFinanceDocument(old.localFinanceDocuments??[],id)}))}
            ledgerEntries={data.expenseEntries??[]}
            currency={data.currency}
            currencyReviewRequired={data.currencyReviewRequired}
            onApplyEntries={approved=>setData(old=>({...old,expenseEntries:approved}))}
          />
        </div>
      </section>
    </div>}
    {recoveryOpen&&<div role="presentation" className="fixed inset-0 z-[75] flex items-end justify-center bg-black/65 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:items-center" onClick={()=>setRecoveryOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Encrypted vault recovery instructions" className="w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><h2 className="text-[17px] font-bold">Restore your financial records</h2><button type="button" aria-label="Close vault recovery" onClick={()=>setRecoveryOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl border border-border"><X size={18}/></button></div>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">This unlocked workspace has no saved accounts, approved Spend records or documents. Data in another PWA is not automatically copied here.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[12px] leading-5">
          <li>Keep the working PWA and its encrypted backup in Files unchanged.</li>
          <li>Export a backup of this workspace before replacing it, even if its dashboard is empty.</li>
          <li>Lock this workspace, then select “Restore from encrypted backup” on the login screen and enter that backup's password.</li>
          <li>Confirm the restored counts after unlocking. Never clear website data to force a reload.</li>
        </ol>
        <button type="button" className="mt-4 min-h-12 w-full rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground" onClick={()=>{
          setRecoveryOpen(false);
          const el=document.getElementById('mc-backup-controls') as HTMLDetailsElement|null;
          if(el){el.open=true;window.requestAnimationFrame(()=>el.scrollIntoView({behavior:'smooth',block:'start'}));}
        }}>Open backup &amp; lock controls</button>
      </section>
    </div>}
  </RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <IonApp className="mc-ionic-app"><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider></IonApp>;
}

export default App;
