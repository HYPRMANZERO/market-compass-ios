import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Copy, Landmark, LoaderCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';

export type MerchantRequestRecord = {
  localId: string;
  paymentId: string;
  checkoutUrl: string;
  reference: string;
  amountZar: number;
  environment: 'staging' | 'production';
  providerStatus: string;
  verifiedPaid: boolean;
  createdAt: string;
  expiresAt: string;
  lastCheckedAt?: string;
};

type Props = {
  currency: string;
  region: string;
  records: MerchantRequestRecord[];
  onCreate: (record: MerchantRequestRecord) => void;
  onUpdate: (localId: string, fields: Partial<MerchantRequestRecord>) => void;
};
type WorkerHealth = { ok: boolean; configured: boolean; acceptingRequests: boolean; environment: 'staging' | 'production' };
type CreateResult = {
  ok: boolean; paymentId: string; checkoutUrl: string; expiresAt: string; amountZar: number;
  environment: 'staging' | 'production'; paymentStatus: string;
};
type StatusResult = {
  ok: boolean; paymentStatus: string; verifiedPaid: boolean; checkedAt: string; environment: 'staging' | 'production';
  message: string;
};
function safeWorkerUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !url.hostname.endsWith('.workers.dev') || url.hostname === 'workers.dev' ||
      (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}
function safeOzowUrl(input: string) {
  try {
    const u = new URL(input);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      (u.hostname === 'ozow.com' || u.hostname.endsWith('.ozow.com')) ? u.toString() : null;
  } catch { return null; }
}
async function gatewayJson<T>(url: string, operatorSecret: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${operatorSecret}`);
  if (options?.body) headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, {
      ...options, method: options?.method ?? 'GET', headers, signal: controller.signal,
      mode: 'cors', credentials: 'omit', cache: 'no-store'
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const error = typeof result === 'object' && result !== null && 'error' in result ? String(result.error) : `Gateway returned HTTP ${response.status}`;
      throw new Error(error);
    }
    return result as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Gateway request timed out. Check the provider dashboard before retrying with the same request ID.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}
function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'ZAR' }).format(amount);
}
export default function OzowMerchantGateway({ currency, region, records, onCreate, onUpdate }: Props) {
  const [url, setUrl] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState('');
  const [message, setMessage] = useState('');
  const api = safeWorkerUrl(url);
  const ready = region === 'ZA' && currency === 'ZAR';
  const amountNum = Number(amount);
  const validAmount = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum >= 1 && amountNum <= 5000 && Math.abs(amountNum * 100 - Math.round(amountNum * 100)) < 1e-6;
  const validReference = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(reference.trim());
  const operatorReady = api && passphrase.length >= 32;

  async function checkHealth() {
    if (!api) { setMessage('Enter your own HTTPS *.workers.dev gateway URL first.'); return; }
    setBusy(true); setMessage('');
    try {
      const r = await fetch(`${api}/health`, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
      const result = await r.json() as WorkerHealth;
      if (!r.ok || !result.ok) throw new Error('Could not reach the Market Compass gateway.');
      setHealth(result);
      setMessage(result.acceptingRequests ? `Gateway ready (${result.environment}).` : 'Gateway is reachable but payment creation is disabled or the Ozow merchant credentials are not configured.');
    } catch (e) { setHealth(null); setMessage(e instanceof Error ? e.message : 'Gateway connectivity failed.'); }
    finally { setBusy(false); }
  }
  async function createRequest() {
    if (!ready || !operatorReady || !validAmount || !validReference || busy) {
      setMessage('Choose South Africa/ZAR and enter your own gateway URL, operator passphrase, valid amount and reference.');
      return;
    }
    const currentId = requestId;
    setBusy(true); setMessage('');
    try {
      const result = await gatewayJson<CreateResult>(`${api}/api/payments/create`, passphrase, {
        method: 'POST', body: JSON.stringify({ requestId: currentId, amountZar: amountNum, reference: reference.trim() })
      });
      if (!result.ok || !safeOzowUrl(result.checkoutUrl) || !result.paymentId) throw new Error('Provider did not return a safe verified checkout link.');
      const record: MerchantRequestRecord = {
        localId: currentId, paymentId: result.paymentId, checkoutUrl: result.checkoutUrl,
        reference: reference.trim(), amountZar: result.amountZar, environment: result.environment,
        providerStatus: result.paymentStatus, verifiedPaid: false,
        createdAt: new Date().toISOString(), expiresAt: result.expiresAt,
      };
      onCreate(record);
      setRequestId(crypto.randomUUID());
      setAmount(''); setReference('');
      setMessage(`Ozow ${result.environment === 'staging' ? 'test' : 'merchant'} link created. It has NOT been paid or sent to a bank. Share it with the intended payer; the provider handles any bank approval.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment request not created. Check the provider dashboard.');
      // Keep requestId unchanged after errors to avoid duplicate requests on retry.
    } finally { setBusy(false); }
  }
  async function verifyStatus(record: MerchantRequestRecord) {
    if (!operatorReady || checking) { setMessage('Enter your gateway URL and operator secret to check provider status.'); return; }
    setChecking(record.localId); setMessage('');
    try {
      const r = await gatewayJson<StatusResult>(`${api}/api/payments/${encodeURIComponent(record.paymentId)}/status`, passphrase);
      onUpdate(record.localId, {
        providerStatus: r.paymentStatus, verifiedPaid: !!r.verifiedPaid,
        lastCheckedAt: r.checkedAt,
      });
      setMessage(r.message);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not verify with Ozow.'); }
    finally { setChecking(''); }
  }
  async function copyLink(record: MerchantRequestRecord) {
    const checkout = safeOzowUrl(record.checkoutUrl);
    if (!checkout) { setMessage('Stored checkout URL is invalid.'); return; }
    try { await navigator.clipboard.writeText(checkout); setMessage('Checkout link copied. No payment has been made or confirmed.'); }
    catch { setMessage('Unable to copy. Open the provider link and share it from there.'); }
  }
  async function shareLink(record: MerchantRequestRecord) {
    const checkout = safeOzowUrl(record.checkoutUrl);
    if (!checkout || !navigator.share) { await copyLink(record); return; }
    try {
      await navigator.share({ title: 'Ozow payment link', text: `Please review this ZAR ${record.amountZar.toFixed(2)} request on Ozow. Reference: ${record.reference}. Only approve if you recognise the recipient.`, url: checkout });
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Share unavailable. Copy the link instead.'); }
  }
  return <section className="rounded-xl border border-border bg-card">
    <details>
      <summary className="cursor-pointer border-b border-border px-5 py-4 text-[13px] font-semibold">Merchant API requests (advanced) · Ozow / PayShap-ready</summary>
      <div className="space-y-4 p-5">
        <div className="flex gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
          <p>This is for <strong>collecting money into your own approved Ozow merchant account</strong>. It cannot pay an unrelated lender, debit a debtor, or send a bank push without provider approval. PayShap Request is available only if Ozow enables it on your merchant account. Merchant API keys stay in your private Cloudflare Worker; this panel never stores the separate operator passphrase.</p>
        </div>
        {!ready && <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-[11px]">The merchant gateway accepts only South African ZAR requests. Choose South Africa and ZAR in the debt plan above.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] font-medium">Your Cloudflare Worker URL
            <input type="url" placeholder="https://your-own-gateway.your-account.workers.dev" value={url}
              onChange={e => { setUrl(e.target.value); setHealth(null); }}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[11px]" />
          </label>
          <label className="block text-[11px] font-medium">Gateway operator passphrase (not saved)
            <input type="password" autoComplete="off" placeholder="Separate 32+ character secret" value={passphrase}
              onChange={e => setPassphrase(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[11px]" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { void checkHealth(); }} disabled={busy || !api} className="rounded-lg border border-border px-4 py-2.5 text-[11px] font-semibold disabled:opacity-40">
            <RefreshCw size={14} className="mr-2 inline"/>Test connection
          </button>
          <button type="button" onClick={() => { setUrl(''); setPassphrase(''); setHealth(null); }} className="rounded-lg border border-border px-4 py-2.5 text-[11px] font-semibold">Disconnect</button>
        </div>
        {health && <p role="status" className="text-[11px] text-muted-foreground">Gateway: {health.acceptingRequests ? 'ready' : 'not configured / creation disabled'} · Environment: <strong>{health.environment}</strong>. Staging payments are tests, not live bank requests.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] font-medium">Incoming payment amount · ZAR
            <input type="number" min="1" max="5000" step="0.01" inputMode="decimal" value={amount}
              onChange={e => { setAmount(e.target.value); setRequestId(crypto.randomUUID()); }} placeholder="150.00"
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px]" />
          </label>
          <label className="block text-[11px] font-medium">Reference · up to 40 characters
            <input value={reference} maxLength={40}
              onChange={e => { setReference(e.target.value); setRequestId(crypto.randomUUID()); }} placeholder="Membership fee"
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px]" />
          </label>
        </div>
        <button type="button" onClick={() => { void createRequest(); }} disabled={!ready || !operatorReady || !validAmount || !validReference || busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
          {busy ? <LoaderCircle size={14} className="animate-spin"/> : <Landmark size={14}/>}Create provider payment link
        </button>
        <p className="text-[10px] text-muted-foreground">A merchant account and credentials are required. The payment link is generated at Ozow, not fabricated by Market Compass. A bank request is initiated only when a supported payer chooses an enabled method and approves inside their bank.</p>
        {message && <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-[11px] leading-5" role="status">{message}</p>}
        {!!records.length && <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-[12px] font-semibold">Saved merchant requests · encrypted on this device</h3>
          {records.slice(0, 20).map(record => {
            const url = safeOzowUrl(record.checkoutUrl);
            return <div key={record.localId} className="rounded-lg border border-border p-3 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{record.reference} · {formatMoney(record.amountZar)}</div>
                <span className="rounded-md bg-muted px-2 py-1 text-[10px]">{record.environment === 'staging' ? 'SANDBOX' : 'LIVE'} · {record.providerStatus}</span></div>
              <div className="mt-1 text-[10px] text-muted-foreground">Created {new Date(record.createdAt).toLocaleString()} · Expires {new Date(record.expiresAt).toLocaleString()}</div>
              {record.verifiedPaid && <div className="mt-2 flex items-start gap-2 text-[11px]"><CheckCircle2 size={15} className="shrink-0 text-primary"/>Ozow confirms a successful incoming merchant payment. This is not a creditor debt repayment.</div>}
              {!record.verifiedPaid && <p className="mt-2 text-[10px] text-muted-foreground">Not confirmed paid. Opening checkout or returning to this app is not payment verification.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {url && <a href={url} target="_blank" rel="noopener noreferrer" className="min-h-10 rounded-md border border-border px-3 py-2 font-semibold">Open Ozow <ArrowUpRight size={13} className="ml-1 inline"/></a>}
                <button type="button" disabled={!url} className="min-h-10 min-h-10 rounded-md border border-border px-3 py-2 font-semibold disabled:opacity-40" onClick={() => { void copyLink(record); }}><Copy size={13} className="mr-1 inline"/>Copy link</button>
                <button type="button" disabled={!url} className="min-h-10 min-h-10 rounded-md border border-border px-3 py-2 font-semibold disabled:opacity-40" onClick={() => { void shareLink(record); }}><Send size={13} className="mr-1 inline"/>Share</button>
                <button type="button" disabled={!operatorReady || !!checking} className="min-h-10 min-h-10 rounded-md border border-border px-3 py-2 font-semibold disabled:opacity-40" onClick={() => { void verifyStatus(record); }}>
                  {checking === record.localId ? <LoaderCircle size={13} className="mr-1 inline animate-spin"/> : <RefreshCw size={13} className="mr-1 inline"/>}Verify with Ozow
                </button>
              </div>
              {record.lastCheckedAt && <p className="mt-2 text-[10px] text-muted-foreground">Last verified with provider: {new Date(record.lastCheckedAt).toLocaleString()}</p>}
            </div>;
          })}
        </div>}
      </div>
    </details>
  </section>;
}
