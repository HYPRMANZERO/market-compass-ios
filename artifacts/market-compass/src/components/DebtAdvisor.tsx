import { useState } from 'react';
import { BrainCircuit, FileUp, ShieldCheck, WifiOff } from 'lucide-react';
import type { DebtPlan } from '@workspace/api-client-react';

export type FinancialBaseline = {
  schema: 'market-compass-financial-baseline-v1';
  source: string; sourceDate: string; exportedAt: string; currency: 'ZAR'; verifiedCurrent: false;
  accounts: {name: string; balance: number; apr: number; minimumPayment: number}[];
  monthlyIncome: number | null; monthlyExpenses: number | null; caution: string;
};
export type PrivateBudget = { monthlyIncome: string; monthlyEssentials: string; liquidFunds: string; reserveTarget: string; ownerNotes: string; verifiedAt: string };
export const emptyPrivateBudget: PrivateBudget = { monthlyIncome: '', monthlyEssentials: '', liquidFunds: '', reserveTarget: '', ownerNotes: '', verifiedAt: '' };

export function validateBaseline(raw: unknown): FinancialBaseline {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Unsupported financial baseline file.');
  const x = raw as Record<string, unknown>;
  if (x.schema !== 'market-compass-financial-baseline-v1' || x.currency !== 'ZAR' || x.verifiedCurrent !== false || !Array.isArray(x.accounts) || x.accounts.length < 1 || x.accounts.length > 30) throw Error('Expected an unconfirmed ZAR Financial Advisor baseline export.');
  const accounts = x.accounts.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw Error('Invalid debt row');
    const a = entry as Record<string, unknown>;
    if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80 ||
        ![a.balance, a.apr, a.minimumPayment].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e11) || Number(a.apr) > 200) throw Error('Invalid debt amount or interest rate');
    return { name: a.name, balance: Number(a.balance), apr: Number(a.apr), minimumPayment: Number(a.minimumPayment) };
  });
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e11 ? v : null;
  return {
    schema: 'market-compass-financial-baseline-v1',
    source: typeof x.source === 'string' ? x.source.slice(0, 240) : 'Financial Advisor export',
    sourceDate: typeof x.sourceDate === 'string' ? x.sourceDate.slice(0, 60) : 'Unknown',
    exportedAt: typeof x.exportedAt === 'string' ? x.exportedAt.slice(0, 40) : '',
    verifiedCurrent: false, currency: 'ZAR', accounts,
    monthlyIncome: finite(x.monthlyIncome), monthlyExpenses: finite(x.monthlyExpenses),
    caution: typeof x.caution === 'string' ? x.caution.slice(0, 500) : 'Historical data. Confirm all balances.'
  };
}
type Account = { id: string; name: string; balance: string; apr: string; minimumPayment: string };
type Advisory = { summary: string; actions: string[]; risks: string[]; questions: string[]; mode: 'offline' | 'ollama' };
const format = (v: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
function validNumber(v: string) { return v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0; }
/** Guaranteed available without a network, but NOT a trained language model. */
export function offlineAdvice(accounts: Account[], budget: PrivateBudget, extra: number, plan: DebtPlan | null): Advisory {
  const income = Number(budget.monthlyIncome), essential = Number(budget.monthlyEssentials);
  const liquid = Number(budget.liquidFunds), reserve = Number(budget.reserveTarget);
  const minimums = accounts.reduce((sum,a) => sum + Number(a.minimumPayment), 0);
  const maxRecurringExtra = Math.max(0, income - essential - minimums);
  const reserveShortfall = Math.max(0, reserve - liquid);
  const candidates = accounts.map(a => ({...a, aprNum: Number(a.apr), balanceNum: Number(a.balance)}))
    .filter(a => a.balanceNum > 0).sort((a,b) => b.aprNum - a.aprNum);
  const risks: string[] = [];
  const actions: string[] = ['Confirm contractual minimum payments and due dates directly with each creditor.'];
  if (reserveShortfall > 0) { risks.push('The cash reserve is below the stated target. Do not treat all liquid funds as expendable.'); actions.push(`Reserve target shortfall: ${format(reserveShortfall)}. Protect essential bills and build the buffer first.`); }
  if (extra > maxRecurringExtra) risks.push(`Requested extra repayment ${format(extra)} exceeds the recurring budget headroom ${format(maxRecurringExtra)}; do not authorize that payment from this plan.`);
  if (candidates[0]) actions.push(`Highest estimated APR: ${candidates[0].name} (${candidates[0].aprNum.toFixed(2)}%). Consider directing an affordable extra repayment here only after minimums, essentials and reserve needs.`);
  if (!plan) risks.push('Compare payoff paths locally before evaluating payoff times.');
  if (plan && plan.scenarios.some(x => !x.amortized)) risks.push('At least one projected repayment scenario does not clear all debts under current assumptions.');
  const affordableExtra = Math.min(extra, maxRecurringExtra);
  if (affordableExtra > 0 && reserveShortfall === 0) actions.push(`Budget-constrained extra repayment: up to ${format(affordableExtra)} monthly, subject to actual available funds and lender terms.`);
  if (!risks.length) risks.push('Forecasts assume fixed interest rates and do not account for unexpected expenses, new borrowing or creditor fees.');
  return {
    mode: 'offline',
    summary: `Offline rules-based debt review. Income ${format(income)}, essentials ${format(essential)}, debt minimums ${format(minimums)}, maximum recurring extra ${format(maxRecurringExtra)}. No payment has been made.`,
    actions, risks, questions: ['Are these amounts confirmed from current statements?', 'Is your selected reserve target sufficient for upcoming bills?']
  };
}
function serverUrl(input: string) {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) return null;
    // Only explicitly configured private Tailscale hostnames; no public tunnels.
    if (!u.hostname.endsWith('.ts.net')) return null;
    return u.origin;
  } catch { return null; }
}
type Props = {
  accounts: Account[]; currency: string; baseline: FinancialBaseline | null; budget: PrivateBudget;
  onBudgetChange: (v: PrivateBudget) => void; onImport: (v: FinancialBaseline) => void;
  monthlyExtra: string; plan: DebtPlan | null;
};
export default function DebtAdvisor({ accounts, currency, baseline, budget, onBudgetChange, onImport, monthlyExtra, plan }: Props) {
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [answer, setAnswer] = useState<Advisory | null>(null);
  const [running, setRunning] = useState(false);
  const ready = currency === 'ZAR' && accounts.length > 0 &&
    accounts.every(a => a.name.trim() && validNumber(a.balance) && validNumber(a.apr) && validNumber(a.minimumPayment)) &&
    [budget.monthlyIncome, budget.monthlyEssentials, budget.liquidFunds, budget.reserveTarget, monthlyExtra || '0'].every(validNumber);
  const value = (key: keyof PrivateBudget, text: string) => { onBudgetChange({ ...budget, [key]: text, verifiedAt: '' }); setConfirmed(false); setAnswer(null); };
  async function importBaseline(file: File) {
    if (file.size > 100000) { setNotice('Only small private baseline exports are accepted (under 100 KB).'); return; }
    try {
      const parsed = validateBaseline(JSON.parse(await file.text()));
      if (!window.confirm(`Import historical data from ${parsed.sourceDate}? It may be outdated. You will review balances before any calculations. No current data will be assumed.`)) return;
      onImport(parsed); setConfirmed(false); setAnswer(null);
      setNotice('Historical baseline imported to your unlocked workspace. Review all balances and cash inputs; no values were verified current.');
    } catch(e) { setNotice(e instanceof Error ? e.message : 'Could not import baseline'); }
  }
  const field = (label: string, key: keyof PrivateBudget) => <label className="block text-[11px] font-medium">{label}
    <input className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[12px]" type="number" min="0" step="0.01" inputMode="decimal" value={budget[key]} onChange={e => value(key, e.target.value)} placeholder="Enter current confirmed amount" />
  </label>;
  function prepareOffline() {
    if (!ready || !confirmed) { setNotice('Confirm current debt balances and enter income, essentials, liquid funds, and reserve first.'); return; }
    setAnswer(offlineAdvice(accounts, budget, Number(monthlyExtra || 0), plan));
    setNotice('This offline output uses deterministic rules, not Ollama or a trained prediction model.');
  }
  async function askOllama() {
    if (!ready || !confirmed || !serverUrl(endpoint) || token.length < 48 || running) {
      setNotice('Confirm current amounts and enter a private Tailscale HTTPS server and 48+ character AI token.'); return;
    }
    setRunning(true); setNotice('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 125000);
    try {
      const response = await fetch(serverUrl(endpoint)! + '/api/advice', {
        method: 'POST', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'debt_advice', currency: 'ZAR', confirmedCurrent: true,
          accounts: accounts.map(a => ({ name: a.name, balance: Number(a.balance), apr: Number(a.apr), minimumPayment: Number(a.minimumPayment) })),
          monthlyIncome: Number(budget.monthlyIncome), monthlyEssentials: Number(budget.monthlyEssentials),
          liquidFunds: Number(budget.liquidFunds), reserveTarget: Number(budget.reserveTarget),
          proposedExtra: Number(monthlyExtra || 0), ownerNotes: budget.ownerNotes,
          deterministicPlan: plan ? { scenarios: plan.scenarios, totalPrincipal: plan.totalPrincipal } : null
        })
      });
      if (!response.ok) throw Error(`Private Ollama server returned ${response.status}.`);
      const payload = await response.json() as { ok: boolean; narrative?: Omit<Advisory, 'mode'> };
      if (!payload.ok || !payload.narrative || !Array.isArray(payload.narrative.actions)) throw Error('Private AI returned an invalid response.');
      setAnswer({ ...payload.narrative, mode: 'ollama' });
      setNotice('Ollama advisory received. This is narrative advice, not a payment authorization or verified forecast.');
    } catch(e) {
      setNotice(`Ollama unavailable: ${e instanceof Error ? e.message : 'Network error'}. Your offline planner remains available.`);
    } finally { clearTimeout(timer); setRunning(false); }
  }
  return <section className="rounded-xl border border-border bg-card">
    <div className="border-b border-border p-5">
      <h2 className="flex items-center gap-2 font-semibold"><BrainCircuit size={18} className="text-primary"/>Private Debt AI & offline guidance</h2>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Available on iPhone, laptop and desktop offline. Desktop Ollama is optional and only available over your private connection. No bank logins, automated transfers, trading or cloud AI subscriptions.</p>
    </div>
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2 text-[11px]"><span className="rounded bg-muted px-2 py-1"><WifiOff size={13} className="mr-1 inline"/>Offline rules included</span><span className="rounded bg-muted px-2 py-1">Ollama runs on your PC</span><span className="rounded bg-muted px-2 py-1">No autonomous payments</span></div>
      <label className="block rounded-lg border border-border p-3 text-[11px]">
        <span className="flex items-center gap-2 font-semibold"><FileUp size={15}/>Import Financial Advisor baseline (optional)</span>
        <p className="my-2 text-muted-foreground">Choose the JSON export from your private financial-advisor repo. Data goes into the unlocked encrypted vault only; the original dates stay marked historical.</p>
        <input type="file" accept=".json,application/json" className="max-w-full text-[11px]" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void importBaseline(file); }}/>
      </label>
      {baseline && <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-[11px]">Imported historical baseline: <strong>{baseline.sourceDate}</strong>. {baseline.accounts.length} debt entries. <strong>Not confirmed current.</strong> Existing debt accounts require your review before replacement or planning.</p>}
      {currency !== 'ZAR' && <p className="text-[11px] text-destructive">The original Financial Advisor baseline is ZAR. Select ZAR for this private AI context; do not combine currencies without a verified conversion.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {field('Current monthly income (ZAR)', 'monthlyIncome')}
        {field('Current essential monthly spending, excluding debt minimums (ZAR)', 'monthlyEssentials')}
        {field('Liquid funds available today (ZAR)', 'liquidFunds')}
        {field('Emergency reserve target (ZAR)', 'reserveTarget')}
      </div>
      <label className="block text-[11px] font-medium">Optional planning notes (no passwords or account numbers)
        <textarea value={budget.ownerNotes} maxLength={600} rows={2} onChange={e => value('ownerNotes', e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-[12px]" placeholder="Upcoming bills, income uncertainty, lender constraints"/>
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-5">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1"/>
        <span>I checked the current account balances, minimum payments, interest estimates and available cash. These are my own confirmed inputs, not the old Financial Advisor snapshot.</span>
      </label>
      <button type="button" className="rounded-lg bg-primary px-4 py-2.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-40" onClick={prepareOffline} disabled={!ready || !confirmed}>Generate offline debt guidance</button>
      <details className="border-t border-border pt-4"><summary className="cursor-pointer text-[12px] font-semibold">Use desktop/laptop Ollama securely (optional)</summary>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Only connect to your own HTTPS Tailscale Serve hostname. The token stays in this page's memory and is not saved in the encrypted workspace. Only press Ask Ollama when you want these financial inputs sent to your own private desktop.</p>
        <label className="mt-3 block text-[11px]">Private HTTPS server URL <input type="url" className="mt-1 h-10 w-full rounded border border-input bg-background px-3 text-[12px]" value={endpoint} placeholder="https://your-desktop.your-tailnet.ts.net/" onChange={e => setEndpoint(e.target.value)}/></label>
        <label className="mt-3 block text-[11px]">Separate AI access token (48+ characters) <input type="password" autoComplete="off" className="mt-1 h-10 w-full rounded border border-input bg-background px-3 text-[12px]" value={token} onChange={e => setToken(e.target.value)}/></label>
        <button type="button" onClick={() => { void askOllama(); }} disabled={!ready || !confirmed || !serverUrl(endpoint) || token.length < 48 || running} className="mt-3 rounded-lg border border-border bg-background px-4 py-2.5 text-[12px] font-semibold disabled:opacity-40">{running ? 'Awaiting private Ollama…' : 'Ask self-hosted Ollama'}</button>
        <button type="button" className="ml-2 mt-3 rounded-lg border border-border px-3 py-2 text-[11px]" onClick={() => {setToken('');setEndpoint('');}}>Disconnect</button>
      </details>
      {notice && <p role="status" className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-5">{notice}</p>}
      {answer && <div className="rounded-lg border border-border p-4 text-[12px] leading-6">
        <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck size={15}/>{answer.mode === 'ollama' ? 'Private Ollama explanation' : 'Offline deterministic guidance'}</div>
        <p>{answer.summary}</p>
        <h3 className="mt-3 font-semibold">Suggested next steps (review manually)</h3>
        <ul className="list-disc pl-5">{answer.actions.map((x,i) => <li key={i}>{x}</li>)}</ul>
        <h3 className="mt-3 flex items-center gap-2 font-semibold"><CircleAlert size={14}/>Risks and uncertainties</h3>
        <ul className="list-disc pl-5">{answer.risks.map((x,i) => <li key={i}>{x}</li>)}</ul>
        {answer.questions.length > 0 && <><h3 className="mt-3 font-semibold">What to verify</h3><ul className="list-disc pl-5">{answer.questions.map((x,i) => <li key={i}>{x}</li>)}</ul></>}
        <p className="mt-3 text-[11px] text-muted-foreground">This generated text cannot move money, initiate a loan or alter your accounts. Independently verify figures and instructions.</p>
      </div>}
    </div>
  </section>;
}
