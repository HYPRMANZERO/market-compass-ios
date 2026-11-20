import { type ChangeEvent, type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { parseCandleCsv } from '@/lib/candles';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useInterpretLocalCommand } from '@workspace/api-client-react';
import DebtPaymentHandoff from '@/components/DebtPaymentHandoff';
import DebtAdvisor, { emptyPrivateBudget, type FinancialBaseline, type PrivateBudget } from '@/components/DebtAdvisor';
import OzowMerchantGateway, { type MerchantRequestRecord } from '@/components/OzowMerchantGateway';
import { CURRENCIES, REGIONS, detectRegion, regionDefaultCurrency, selectedRegion } from '@/lib/regions';
import { calculateLocalDebtPlan } from '@/lib/localDebtPlan';
import { fetchPublicCandles, type CandleRange, type PublicVenue } from '@/lib/publicMarkets';
import HistoricalCandleChart, { utcCandleDate } from '@/components/HistoricalCandleChart';
import { localTechnicalReading, localSmaBacktest } from '@/lib/localIndicators';
import type { AssistantCommand, BacktestResult, Candle, DebtPlan, MarketAnalysis, MarketSeries } from '@workspace/api-client-react';
import {
  Activity, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, ChevronDown,
  CircleAlert, CircleHelp, Clock3, Compass, Database, FileClock, Gauge, Landmark, ListChecks,
  LoaderCircle, Menu, Plus, Search, ShieldCheck, Trash2, TrendingUp, Upload, WalletCards, X,
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
type WorkspaceData = { drafts: Draft[]; accounts: DebtAccount[]; monthlyExtra: string; emergencyReserve: string; currency: string; region: string; currencyReviewRequired: boolean; financialBaseline: FinancialBaseline | null; privateBudget: PrivateBudget; merchantRequests: MerchantRequestRecord[]; marketCache: MarketSeries | null; marketRange: CandleRange | null; analysisCache: MarketAnalysis | null; queue: QueuedCommand[] };
const initialRegion = detectRegion();
const defaultData: WorkspaceData = { drafts: [], accounts: [], monthlyExtra: '', emergencyReserve: '', currency: regionDefaultCurrency(initialRegion), region: initialRegion, currencyReviewRequired: false, financialBaseline: null, privateBudget: emptyPrivateBudget, merchantRequests: [], marketCache: null, marketRange: null, analysisCache: null, queue: [] };

function readLegacyWorkspace(): WorkspaceData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...defaultData, ...JSON.parse(raw) } : defaultData;
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
      setEnabled(false); setData({ ...defaultData, ...restored }); setPassword(entered); setHasVault(true);
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
      setData({ ...defaultData, ...restored }); setHasVault(true); setPassword(entered);
      setSavedAt(incoming.updatedAt); setLastRecord(incoming); setGeneration((n) => n + 1);
      localStorage.removeItem(STORE_KEY); setHasLegacy(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return { data, setData, password, initializing, hasVault, hasLegacy, error, savedAt, saving, compressionInfo: compressionSummary(lastRecord), backupSettings, setSchedule, backupMessage, dailyBackupPending, unlock, create, lock, exportBackup, importBackup };
}

function VaultScreen({ vault }: { vault: ReturnType<typeof useWorkspaceVault> }) {
  const [entered, setEntered] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  return <main className="min-h-[100dvh] bg-background px-5 py-12 text-foreground">
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm">
      <div className="mb-4 flex items-center gap-3"><ShieldCheck className="text-primary" size={29} /><h1 className="serif text-3xl">Market Compass Vault</h1></div>
      <p className="text-sm leading-6 text-muted-foreground">Your local workspace uses adaptive gzip compression (only when smaller) followed by AES-256-GCM encryption. It is stored on this device, not on a hosting server.</p>
      <p className="mt-3 text-xs text-muted-foreground">Your password is never saved. If it is lost, your data cannot be recovered without a backup and its password.</p>
      {vault.hasLegacy && !vault.hasVault && <p className="mt-4 rounded-lg bg-muted p-3 text-xs">Existing unencrypted workspace data was detected. Creating a vault will migrate it and remove the old localStorage entry after the encrypted save succeeds.</p>}
      {vault.error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{vault.error}</p>}
      {vault.initializing ? <p className="mt-6">Opening local storage…</p> : <>
        <label className="mt-6 block text-xs font-semibold" htmlFor="vault-password">{vault.hasVault ? 'Vault password' : 'Create a password (12+ characters)'}</label>
        <input id="vault-password" type="password" autoComplete="off" className="mt-2 w-full rounded-lg border border-input bg-background p-3" value={entered} onChange={(e) => setEntered(e.target.value)} />
        <button disabled={busy || !entered} className="mt-4 w-full rounded-lg bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-40" onClick={() => run(() => vault.hasVault ? vault.unlock(entered) : vault.create(entered))}>{busy ? 'Working…' : vault.hasVault ? 'Unlock workspace' : 'Create encrypted workspace'}</button>
        <label className="mt-6 block text-xs font-semibold">Restore an encrypted backup</label>
        <input aria-label="Import encrypted vault backup" type="file" accept=".json,application/json" className="mt-2 w-full text-xs" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void run(() => vault.importBackup(file, entered)); e.currentTarget.value = ''; }} />
        <p className="mt-2 text-xs text-muted-foreground">Enter the backup's password above before importing. Import replaces the vault on this device.</p>
      </>}
    </div>
  </main>;
}

const navItems = [
  { href: '/', label: 'Overview', icon: Compass },
  { href: '/markets', label: 'Markets', icon: Activity },
  { href: '/debt', label: 'Debt plan', icon: Landmark },
  { href: '/drafts', label: 'Drafts', icon: FileClock },
  { href: '/assistant', label: 'Local assistant', icon: CircleHelp },
];

function InstallHelp() {
  const [show, setShow] = useState(false);
  const [details, setDetails] = useState(false);
  const [prompt, setPrompt] = useState<Event | null>(null);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setShow(!standalone && !sessionStorage.getItem('mc-install-dismissed'));
    const listener = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', listener);
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  if (!show) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return <div className="border-b border-border bg-muted/50 px-5 py-3 text-[12px]">
    <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
      <span>Install Market Compass on your phone's Home Screen.</span>
      <div className="flex items-center gap-3">
        {ios ? <button className="font-semibold text-primary underline" onClick={() => setDetails(!details)}>iPhone instructions</button> : prompt ? <button className="font-semibold text-primary underline" onClick={async () => { await (prompt as Event & { prompt?: () => Promise<void> }).prompt?.(); setPrompt(null); }}>Install</button> : <span className="text-muted-foreground">Use browser installation menu</span>}
        <button aria-label="Dismiss install guide" onClick={() => { sessionStorage.setItem('mc-install-dismissed', '1'); setShow(false); }}>Dismiss</button>
      </div>
    </div>
    {details && <p className="mx-auto mt-2 max-w-[1440px]">Open in Safari, tap Share, select Add to Home Screen, then tap Add.</p>}
  </div>;
}

function AppShell({ children, pending }: { children: ReactNode; pending: number }) {
  const [path] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className={`${mobileOpen ? 'fixed inset-0 z-40 flex' : 'hidden'} bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col`}>
        <div className="flex h-full w-[270px] flex-col border-r border-sidebar-border px-5 py-6 lg:w-auto">
          <div className="flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Compass size={21} strokeWidth={1.8} /></span>
              <span><span className="serif block text-[21px] leading-none">Market Compass</span><span className="mt-1 block text-[10px] uppercase tracking-[.19em] text-sidebar-foreground/55">Personal workspace</span></span>
            </Link>
            <button aria-label="Close menu" className="rounded-md p-2 lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button>
          </div>
          <div className="mt-11 px-3 text-[10px] font-semibold uppercase tracking-[.22em] text-sidebar-foreground/40">Your workspace</div>
          <nav className="mt-3 space-y-1" aria-label="Main navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition-colors ${path === href ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
                <Icon size={17} strokeWidth={1.7} /><span className="flex-1">{label}</span>
                {label === 'Drafts' && pending > 0 && <span className="mono rounded-full bg-sidebar-primary px-2 py-0.5 text-[10px] font-medium text-sidebar-primary-foreground">{pending}</span>}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-sidebar-foreground"><ShieldCheck size={15} className="text-sidebar-primary" /> Deliberate by design</div>
            <p className="mt-2 text-[11px] leading-[1.65] text-sidebar-foreground/55">No trades are placed here. Market readings may be delayed; calculations use only the details you enter.</p>
          </div>
          <div className="mt-5 flex items-center justify-between px-1 text-[10px] text-sidebar-foreground/40"><span>MARKET COMPASS</span><span className="mono">LOCAL / 01</span></div>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-label="Dismiss navigation" onClick={() => setMobileOpen(false)} />}
      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[65px] items-center justify-between border-b border-border/80 bg-background/95 px-5 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
            <div className="text-[11px] uppercase tracking-[.16em] text-muted-foreground">Personal finance &amp; markets</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(158,31%,42%)]" /> Offline-first workspace</div>
        </header>
        <InstallHelp />
        <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-8 sm:px-8 lg:px-11 lg:pt-10">{children}</div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, trailing }: { eyebrow: string; title: string; description: string; trailing?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end"><div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">{eyebrow}</div><h1 className="serif text-[36px] leading-[1.05] tracking-[-.025em] sm:text-[42px]">{title}</h1><p className="mt-3 max-w-[620px] text-[13px] leading-6 text-muted-foreground">{description}</p></div>{trailing}</div>;
}

function Panel({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return <section className={`rounded-xl border border-border bg-card ${className}`}>{(title || action) && <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-[12px] font-semibold tracking-[.01em]">{title}</h2>{action}</div>}<div>{children}</div></section>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Search; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-[205px] flex-col items-center justify-center px-6 py-9 text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Icon size={19} strokeWidth={1.6} /></span><h3 className="mt-4 text-[13px] font-semibold">{title}</h3><p className="mt-1 max-w-[330px] text-[12px] leading-5 text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function ActionButton({ children, onClick, type = 'button', variant = 'primary', disabled = false }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'quiet' | 'danger'; disabled?: boolean }) {
  const variantClass = variant === 'primary' ? 'bg-primary text-primary-foreground hover:opacity-90' : variant === 'danger' ? 'border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10' : 'border border-border bg-card text-foreground hover:bg-muted';
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}>{children}</button>;
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

function Overview({ data }: { data: WorkspaceData }) {
  const openDrafts = data.drafts.filter((draft) => draft.status === 'pending').length;
  const debtTotal = data.accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
  const feed = data.marketCache;
  return <>
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
        {feed ? <div className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mono text-[20px] font-medium">{feed.symbol}</div><div className="mt-1 text-[11px] text-muted-foreground">Source: {feed.source || 'Not specified'} · {feed.currency}</div></div><StatusTag tone="warn">Saved local copy</StatusTag></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground"><span>{feed.candles.length} candle records · not live</span><span>Latest completed day {utcCandleDate(feed.asOf)} UTC</span></div>{feed.notice && <p className="mt-3 rounded-lg bg-muted/70 px-3 py-2 text-[11px] leading-5 text-muted-foreground">{feed.notice}</p>}</div> : <EmptyState icon={Database} title="No market feed selected" description="Choose a ticker on the markets page to request provider data. No prices are filled in until then." action={<Link href="/markets" className="text-[11px] font-semibold text-primary">Choose a ticker <ArrowRight className="ml-1 inline" size={13} /></Link>} />}
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
  const activeSeries = series ?? (localCached ? data.marketCache : null);
  const activeAnalysis = analysis ?? (localCached && data.analysisCache?.symbol === activeSeries?.symbol ? data.analysisCache : null);
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
    <PageIntro eyebrow="Observe before interpreting" title="Markets" description="Import real daily crypto candles from public exchange APIs; calculate local indicators on your device. JSE/other markets require an authorized CSV feed." trailing={<div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Database size={14} /> Public exchange candles</div>} />
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
        <div className="flex items-center gap-3"><span className={`grid h-8 w-8 place-items-center rounded-full ${localCached ? 'bg-[hsl(38,45%,80%)]' : 'bg-muted'}`}>{localCached ? <Clock3 size={15} /> : <Database size={15} />}</span><div><div className="text-[11px] font-semibold">{localCached ? 'Showing saved copy · may be out of date' : 'Completed historical daily candles · not a live quote'}</div><div className="mt-1 text-[10px] text-muted-foreground">Source: {activeSeries.source} · Latest completed day: {utcCandleDate(activeSeries.asOf)} (UTC){localCached ? ' · saved in this browser' : ''}</div></div></div>
        <div className="text-[10px] text-muted-foreground sm:text-right"><div>{loadedRange ? ({ '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year' } as const)[loadedRange] : 'Imported / saved window'} · {activeSeries.candles.length} candles · {activeSeries.currency}</div><div className="mt-1">Actual dates: {utcCandleDate(activeSeries.candles[0]?.date)} – {utcCandleDate(activeSeries.candles.at(-1)?.date)} (UTC)</div></div>
      </div>
      {activeSeries.notice && <div className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-[11px] leading-5 text-muted-foreground">{activeSeries.notice}</div>}
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
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-muted-foreground">{label}</span><input type={type} step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring/30" /></label>;
}

function Debt({ data, setData }: { data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>> }) {
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const accounts = data.accounts;
  const update = (id: string, key: keyof Omit<DebtAccount, 'id'>, value: string) => setData((old) => ({ ...old, accounts: old.accounts.map((account) => account.id === id ? { ...account, [key]: value } : account) }));
  const addAccount = () => setData((old) => ({ ...old, accounts: [...old.accounts, { id: crypto.randomUUID(), name: '', balance: '', apr: '', minimumPayment: '' }] }));
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
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <div className="space-y-4">
        <Panel title="Your accounts" action={<span className="mono text-[10px] text-muted-foreground">{accounts.length} / 50</span>}>
          {accounts.length ? <div className="divide-y divide-border">
            {accounts.map((account, index) => <div key={account.id} className="p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><span className="mono text-[10px] text-muted-foreground">ACCOUNT {String(index + 1).padStart(2, '0')}</span><button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Remove ${account.name || 'account'}`} onClick={() => removeAccount(account.id)}><Trash2 size={15} /></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Account name" value={account.name} onChange={(v) => update(account.id, 'name', v)} placeholder="e.g. Card" /><Field label="Balance" value={account.balance} onChange={(v) => update(account.id, 'balance', v)} type="number" min="0" step="0.01" placeholder="0.00" /><Field label="APR (%)" value={account.apr} onChange={(v) => update(account.id, 'apr', v)} type="number" min="0" step="0.01" placeholder="0.00" /><Field label="Minimum / month" value={account.minimumPayment} onChange={(v) => update(account.id, 'minimumPayment', v)} type="number" min="0" step="0.01" placeholder="0.00" /></div></div>)}
          </div> : <EmptyState icon={WalletCards} title="No debt accounts yet" description="Start with the balances, rates, and minimum payments you know. You can adjust these at any time." />}
          <div className="border-t border-border p-4"><button type="button" disabled={accounts.length >= 50} onClick={addAccount} className="inline-flex items-center gap-2 text-[11px] font-semibold text-primary disabled:opacity-40"><Plus size={15} /> Add an account</button></div>
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
    {data.drafts.length ? <div className="space-y-3">{data.drafts.map((draft) => <Panel key={draft.id} className="overflow-hidden"><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className="flex min-w-[180px] items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${draft.side === 'buy' ? 'bg-[hsl(155,30%,90%)] text-[hsl(158,36%,29%)]' : 'bg-[hsl(5,48%,92%)] text-[hsl(4,52%,41%)]'}`}>{draft.side === 'buy' ? <ArrowUpRight size={19} /> : <ArrowDownRight size={19} />}</span><div><div className="mono text-[15px] font-medium">{draft.symbol}</div><div className="text-[10px] capitalize text-muted-foreground">{draft.side} · {draft.quantity} units</div></div></div><div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3"><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Limit price</div><div className="mono mt-1 text-[12px]">{money(draft.limitPrice)}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Created</div><div className="mt-1 text-[11px]">{formatTime(draft.createdAt)}</div></div><div><div className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Status</div><div className="mt-1"><StatusTag tone={draft.status === 'approved' ? 'good' : draft.status === 'rejected' ? 'bad' : 'warn'}>{draft.status}</StatusTag></div></div></div><div className="flex flex-wrap items-center gap-2 lg:justify-end">{draft.status === 'pending' && <><ActionButton onClick={() => setStatus(draft, 'approved')}><Check size={14} /> Approve locally</ActionButton><ActionButton variant="quiet" onClick={() => setStatus(draft, 'rejected')}><X size={14} /> Reject</ActionButton></>}{draft.status !== 'pending' && <ActionButton variant="quiet" onClick={() => setStatus(draft, 'pending')}>Reopen</ActionButton>}<button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => remove(draft)} aria-label={`Delete ${draft.symbol} draft`}><Trash2 size={15} /></button></div></div>{draft.rationale && <div className="border-t border-border bg-muted/30 px-5 py-3 text-[10px] leading-5 text-muted-foreground"><span className="mr-2 font-semibold text-foreground">Rationale</span>{draft.rationale}</div>}</Panel>)}</div> : <Panel><EmptyState icon={FileClock} title="No drafts saved" description="Create an explicitly local draft from a market view, or wait until you have a real provider price to reference." action={<Link href="/markets" className="text-[11px] font-semibold text-primary">Go to markets <ArrowRight size={13} className="ml-1 inline" /></Link>} /></Panel>}
  </>;
}

function Assistant({ data, setData }: { data: WorkspaceData; setData: Dispatch<SetStateAction<WorkspaceData>> }) {
  const [text, setText] = useState('');
  const [reply, setReply] = useState<AssistantCommand | null>(null);
  const interpret = useInterpretLocalCommand();
  const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setReply(null);
    if (!text.trim()) return;
    interpret.mutate({ data: { text: text.trim() } }, { onSuccess: (command) => {
      setReply(command);
      setData((old) => ({ ...old, queue: [{ ...command, id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString(), originalText: text.trim() }, ...old.queue] }));
      setText('');
    }, onError: () => setError('The local command could not be interpreted right now. Your text has not been queued; try again.') });
  };
  const remove = (id: string) => setData((old) => ({ ...old, queue: old.queue.filter((item) => item.id !== id) }));
  return <>
    <PageIntro eyebrow="Supported commands only" title="Local assistant" description="A small command interpreter for market lookups and debt summaries. No generative replies, trading, or voice controls." trailing={<StatusTag tone="good">No AI service</StatusTag>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(290px,.9fr)]">
      <div className="space-y-4">
        <Panel title="Ask a supported question" action={<span className="text-[10px] text-muted-foreground">Up to 500 characters</span>}>
          <form onSubmit={submit} className="p-5"><label className="block"><span className="sr-only">Command</span><textarea data-testid="input-assistant-command" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={4} placeholder={'Try “help”, “summarize my debt”, or “analyze MSFT”'} className="w-full resize-y rounded-lg border border-input bg-background p-3 text-[12px] leading-5 outline-none focus:ring-2 focus:ring-ring/30" /></label><div className="mt-3 flex items-center justify-between gap-3"><span className="mono text-[10px] text-muted-foreground">{text.length} / 500</span><ActionButton type="submit" disabled={!text.trim() || interpret.isPending}>{interpret.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <ArrowRight size={14} />}{interpret.isPending ? 'Interpreting' : 'Interpret command'}</ActionButton></div></form>
        </Panel>
        {error && <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-[11px] leading-5 text-destructive">{error}</div>}
        {reply && <Panel title="Interpreter response" action={<StatusTag tone={reply.requiresNetwork ? 'warn' : 'good'}>{reply.requiresNetwork ? 'Network-dependent' : 'Local'}</StatusTag>}><div className="p-5"><div className="mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">{reply.kind.replaceAll('_', ' ')}{reply.symbol ? ` · ${reply.symbol}` : ''}</div><p className="mt-3 text-[13px] leading-6">{reply.reply}</p><div className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-[10px] leading-5 text-muted-foreground">Added to your local pending queue. Instructions are not executed and are never treated as trades.</div></div></Panel>}
      </div>
      <div className="space-y-4">
        <Panel title="What it can understand"><div className="divide-y divide-border">{[{ title: 'Help', example: 'help', detail: 'Lists supported command types.' }, { title: 'Debt summary', example: 'summarize my debt', detail: 'Uses your saved local debt details.' }, { title: 'Symbol analysis', example: 'analyze MSFT', detail: 'May need a network request to fetch market data.' }].map((item) => <div key={item.title} className="flex gap-3 px-5 py-4"><span className="mono mt-0.5 text-[9px] text-muted-foreground">/</span><div className="flex-1"><div className="text-[11px] font-semibold">{item.title}</div><div className="mono mt-1 text-[10px] text-primary">{item.example}</div><p className="mt-1 text-[10px] leading-5 text-muted-foreground">{item.detail}</p></div><button className="self-start rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Use example: ${item.example}`} onClick={() => setText(item.example)}><Plus size={13} /></button></div>)}</div></Panel>
        <div className="rounded-xl border border-border bg-primary p-5 text-primary-foreground"><div className="flex items-center gap-2 text-[11px] font-semibold"><ShieldCheck size={15} /> A queue, not an automation</div><p className="mt-2 text-[10px] leading-5 text-primary-foreground/70">Interpreted commands remain visibly pending for your reference. The assistant cannot place, approve, or execute trades.</p></div>
      </div>
    </div>
    <Panel className="mt-5" title="Pending local instructions" action={<span className="mono text-[10px] text-muted-foreground">{data.queue.length} queued</span>}>
      {data.queue.length ? <div className="divide-y divide-border">{data.queue.map((item) => <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Clock3 size={15} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold">{item.originalText}</span><StatusTag tone="warn">pending · not processed</StatusTag></div><p className="mt-1 text-[10px] text-muted-foreground">{item.kind.replaceAll('_', ' ')}{item.symbol ? ` · ${item.symbol}` : ''} · {formatTime(item.createdAt)}</p></div><button onClick={() => remove(item.id)} className="self-end rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive sm:self-auto" aria-label="Remove queued instruction"><Trash2 size={15} /></button></div>)}</div> : <EmptyState icon={ListChecks} title="Queue is clear" description="Interpreted commands you submit will appear here and stay pending until removed." />}
    </Panel>
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
  return <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-[11px] leading-5 text-amber-900 sm:px-8 lg:px-10" role="status">
    <strong>Local-first edition:</strong> This GitHub Pages installation stores your encrypted workspace on this device.
    Live market feeds, remote analysis and broker connections need a separate API and are unavailable on GitHub Pages alone.
  </div>;
}

function BackupControls({ vault }: { vault: ReturnType<typeof useWorkspaceVault> }) {
  const [open, setOpen] = useState(false);
  const settings = vault.backupSettings;
  return <section className="border-b border-border bg-muted/40 px-5 py-3 text-xs sm:px-8 lg:px-10" aria-label="Encrypted local backups">
    <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
      <span className="text-muted-foreground">Encrypted local vault · {vault.saving ? 'Saving…' : vault.savedAt ? `Saved ${new Date(vault.savedAt).toLocaleTimeString()}` : 'Ready'} · {vault.compressionInfo}</span>
      <div className="flex flex-wrap gap-3">
        <button disabled={vault.saving || !vault.savedAt} className="font-semibold text-primary disabled:opacity-40" onClick={() => void vault.exportBackup()}>Save encrypted backup to Files</button>
        <button className="font-semibold text-primary" onClick={() => setOpen(value => !value)}>Daily backup settings</button>
        <button className="font-semibold text-primary" onClick={() => { void vault.exportBackup().then(saved => { if (saved) vault.lock(); }); }}>Backup & lock</button>
      </div>
      {vault.dailyBackupPending && <p className="w-full font-semibold text-primary" role="status">Daily backup is ready. Tap “Save encrypted backup to Files” and select Save to Files in the iPhone share sheet.</p>}
      {vault.backupMessage && <p role="status" className="w-full text-muted-foreground">{vault.backupMessage}</p>}
      {vault.error && <p role="alert" className="w-full text-destructive">{vault.error}</p>}
    </div>
    {open && <div className="mx-auto mt-3 flex max-w-[1440px] flex-wrap items-center gap-4 rounded-lg border border-border bg-background p-3">
      <label className="flex items-center gap-2"><input aria-label="Enable daily encrypted backups" type="checkbox" checked={settings.enabled} onChange={e => vault.setSchedule({ ...settings, enabled: e.target.checked })}/>Prepare an encrypted backup daily</label>
      <label className="flex items-center gap-2">Local time <input aria-label="Daily backup time" type="time" value={settings.time} onChange={e => vault.setSchedule({ ...settings, time: e.target.value })} className="rounded border border-input bg-background p-1"/></label>
      <p className="w-full text-muted-foreground">When Market Compass is open and unlocked at or after this time, it creates an encrypted local daily snapshot (up to seven retained). On iPhone, saving to the Files app requires you to tap the export button and choose Save to Files. Closing the app pauses this schedule; it resumes on next unlock.</p>
      {settings.lastSnapshotDate && <p className="text-muted-foreground">Most recent daily snapshot: {settings.lastSnapshotDate}</p>}
    </div>}
  </section>;
}

function UnlockedRouter({ vault }: { vault: ReturnType<typeof useWorkspaceVault> }) {
  const { data, setData } = vault;
  const pending = data.drafts.filter((draft) => draft.status === 'pending').length;
  return <RoutedErrorBoundary><AppShell pending={pending}><OfflineOnlyBanner /><BackupControls vault={vault} /><Switch>
    <Route path="/"><Overview data={data} /></Route>
    <Route path="/markets"><Markets data={data} setData={setData} /></Route>
    <Route path="/debt"><Debt data={data} setData={setData} /></Route>
    <Route path="/drafts"><Drafts data={data} setData={setData} /></Route>
    <Route path="/assistant"><Assistant data={data} setData={setData} /></Route>
    <Route component={NotFound} />
  </Switch></AppShell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
