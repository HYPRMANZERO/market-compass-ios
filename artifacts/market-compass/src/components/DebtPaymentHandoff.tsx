import { useState } from 'react';
import { ArrowUpRight, Check, Copy, CreditCard, Landmark, Send, ShieldCheck } from 'lucide-react';

type Account = { id: string; name: string; balance: string };
type Mode = 'pay' | 'request';
type Method = 'bank' | 'paypal' | 'hosted';

const PAYPAL_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'JPY', 'SGD', 'CHF'
]);
// These are public information pages, not login endpoints and not bank API integrations.
const BANK_GUIDES: { id: string; name: string; url: string }[] = [
  { id: 'absa', name: 'Absa', url: 'https://www.absa.co.za/self-service/digital-banking-services/digital-ways-to-pay/payshap-request/' },
  { id: 'capitec', name: 'Capitec', url: 'https://www.capitecbank.co.za/were-here-to-help/faqs/' },
  { id: 'fnb', name: 'FNB', url: 'https://www.fnb.co.za/ways-to-bank/digital/fnb-pay.html' },
  { id: 'nedbank', name: 'Nedbank', url: 'https://personal.nedbank.co.za/bank/digital-banking/needs/payments/payshap/payshap-request-faqs.html' },
  { id: 'standard', name: 'Standard Bank', url: 'https://www.standardbank.co.za/southafrica/business/products-and-services/ways-to-bank/innovative-payment-solution/payshap-for-business' },
  { id: 'discovery', name: 'Discovery Bank', url: 'https://www.discovery.co.za/bank/info-and-tips-payments' },
  { id: 'gotyme', name: 'GoTyme Bank', url: 'https://gotyme.co.za/personal/help/faqs/payshap-faqs' },
];
const ALLOWED_HOSTED_DOMAINS = new Set([
  'paypal.com', 'www.paypal.com', 'paypal.me', 'www.paypal.me', 'pay.yoco.com'
]);

function format(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}
function verifiedHostedLink(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !ALLOWED_HOSTED_DOMAINS.has(u.hostname.toLowerCase())) return null;
    if (!u.pathname || u.pathname === '/') return null;
    return u.toString();
  } catch { return null; }
}
function paypalMeLink(handle: string, amount: number, currency: string): string | null {
  if (!PAYPAL_CURRENCIES.has(currency) || !/^[a-zA-Z0-9]{1,20}$/.test(handle.trim()) || !Number.isFinite(amount) || amount <= 0) return null;
  const digits = currency === 'JPY' ? '0' : '2';
  // PayPal.Me documents /username/25USD as an amount-specific request format.
  return `https://www.paypal.me/${encodeURIComponent(handle.trim())}/${amount.toFixed(Number(digits))}${currency}`;
}
function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Payment preparation and explicit provider handoff. No credentials, tokens,
 * payment card details, banking app deep links or embedded payment fields.
 * Nothing is automatically sent and no payment outcome is assumed.
 */
export default function DebtPaymentHandoff({ accounts, currency, region }: { accounts: Account[]; currency: string; region: string }) {
  const [mode, setMode] = useState<Mode>('pay');
  const [method, setMethod] = useState<Method>(region === 'ZA' && currency === 'ZAR' ? 'bank' : 'paypal');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [bank, setBank] = useState('absa');
  const [paypalHandle, setPaypalHandle] = useState('');
  const [hostedUrl, setHostedUrl] = useState('');
  const [message, setMessage] = useState('');

  const amountNum = Number(amount);
  const validAmount = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 1e9;
  const selectedAccount = accounts.find(a => a.id === accountId);
  const zaBankRequest = region === 'ZA' && currency === 'ZAR';
  const paypalSupported = PAYPAL_CURRENCIES.has(currency);
  const paypalUrl = validAmount ? paypalMeLink(paypalHandle, amountNum, currency) : null;
  const validHosted = verifiedHostedLink(hostedUrl);
  const bankGuide = BANK_GUIDES.find(b => b.id === bank) ?? BANK_GUIDES[0];
  const amountText = validAmount ? format(amountNum, currency) : `[amount in ${currency}]`;
  const counterpartyName = counterparty.trim() || (mode === 'pay' ? selectedAccount?.name?.trim() || 'the creditor' : 'the payer');
  const topic = reference.trim().slice(0, 120) || selectedAccount?.name?.trim() || 'agreed payment';
  const paypalNote = paypalSupported ? 'This link is PayPal-hosted. The recipient must verify the PayPal payee, amount, currency and any applicable fees before authorizing.' : `${currency} is not a standard PayPal payment currency; no automatic currency conversion has been performed.`;
  const bankText = mode === 'pay'
    ? `Please send me a PayShap Request through your participating South African bank app for ${amountText} (reference: ${topic}). I will review and approve it inside my own bank app. This message does not authorize or initiate a payment.`
    : `Please pay ${amountText} for ${topic}. I will send a genuine PayShap Request through my participating South African banking app for you to review and approve there. This message alone is not a bank-generated payment request.`;
  const paypalText = mode === 'pay'
    ? `I plan to pay ${amountText} toward ${topic}. Please verify that this PayPal.Me account belongs to ${counterpartyName} before paying: ${paypalUrl || '[verified creditor PayPal link required]'}.`
    : `Payment request for ${amountText} toward ${topic}. PayPal.Me: ${paypalUrl || '[PayPal.Me link required]'}. Please verify the name, amount and currency on PayPal before paying.`;
  const hostedText = mode === 'pay'
    ? `I intend to pay ${amountText} toward ${topic}. I will only use a verified payment link from the creditor and approve payment at the provider's hosted checkout: ${validHosted ?? '[provider-hosted link required]'}.`
    : `Payment request for ${amountText} toward ${topic}. Secure hosted payment page: ${validHosted ?? '[provider-hosted payment link required]'}. Please verify the payee and amount before paying.`;
  const requestText = method === 'bank' ? bankText : method === 'paypal' ? paypalText : hostedText;
  const shareable = validAmount && (method === 'bank' ? zaBankRequest : method === 'paypal' ? !!paypalUrl : !!validHosted);

  async function copyText() {
    if (!shareable) { setMessage('Enter a valid amount and complete the selected payment method first.'); return; }
    try {
      await navigator.clipboard.writeText(requestText);
      setMessage('Payment instructions copied. No request has been sent to a bank or provider.');
    } catch { setMessage('Clipboard unavailable in this browser. Use the Share option or select the message text manually.'); }
  }
  async function shareText() {
    if (!shareable) { setMessage('Enter a valid amount and complete the selected payment method first.'); return; }
    if (!navigator.share) { await copyText(); return; }
    try {
      await navigator.share({ title: 'Payment instructions', text: requestText });
      setMessage('Share sheet closed. Verify in the destination app whether your message was delivered. No payment is confirmed.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessage('Unable to open the share sheet; use Copy instructions instead.');
    }
  }

  const selectStyle = 'mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-[12px] text-foreground';
  const labelStyle = 'text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground';
  const actionStyle = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-[12px] font-semibold hover:bg-muted disabled:opacity-40';
  return <section className="rounded-xl border border-border bg-card">
    <div className="border-b border-border p-5">
      <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-primary"/><h2 className="serif text-[21px]">Payment options & requests</h2></div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">No direct bank login, card collection, stored payment credentials or automatic debit. Prepare instructions, then complete payment through a trusted bank or payment provider. Payments are not verified by Market Compass.</p>
    </div>
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Payment direction">
        <button type="button" onClick={() => { setMode('pay'); setMessage(''); }} className={`rounded-lg px-4 py-2 text-[12px] font-semibold ${mode === 'pay' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}>Pay an existing debt</button>
        <button type="button" onClick={() => { setMode('request'); setMessage(''); }} className={`rounded-lg px-4 py-2 text-[12px] font-semibold ${mode === 'request' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background'}`}>Request money from someone</button>
      </div>
      {mode === 'pay' && <label className="block"><span className={labelStyle}>Debt to pay (optional)</span>
        <select className={selectStyle} value={accountId} onChange={e => setAccountId(e.target.value)}>
          <option value="">Choose from your saved debts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name || 'Unnamed debt'} {a.balance ? `· ${format(Number(a.balance), currency)}` : ''}</option>)}
        </select>
      </label>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={labelStyle}>Amount ({currency})</span><input type="number" min="0.01" max="1000000000" step={currency === 'JPY' ? '1' : '0.01'} inputMode="decimal" className={selectStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"/></label>
        <label className="block"><span className={labelStyle}>{mode === 'pay' ? 'Creditor / lender label (optional)' : 'Payer label (optional)'}</span><input className={selectStyle} maxLength={80} value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder={mode === 'pay' ? 'Lender or creditor' : 'Person or business'}/></label>
      </div>
      <label className="block"><span className={labelStyle}>Payment reference</span><input className={selectStyle} maxLength={120} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. November loan instalment"/></label>
      <label className="block"><span className={labelStyle}>Payment channel</span>
        <select className={selectStyle} value={method} onChange={e => { setMethod(e.target.value as Method); setMessage(''); }}>
          <option value="bank">PayShap Request · South African banks</option>
          <option value="paypal">PayPal.Me · hosted payment</option>
          <option value="hosted">PayPal invoice or Yoco payment link</option>
        </select>
      </label>
      {method === 'bank' && <div className="rounded-lg border border-border bg-muted/45 p-4 text-[11px] leading-5">
        <div className="mb-2 flex items-center gap-2 font-semibold"><Landmark size={15}/>PayShap Request — bank approval</div>
        {zaBankRequest ? <>
          <p>{mode === 'pay' ? 'A creditor must initiate the genuine PayShap Request from a participating bank or approved provider. You can ask them using the instructions below, then approve the request only inside your own bank app.' : 'Create the actual PayShap Request inside your own participating banking app. Sharing text from Market Compass does not transmit it to a bank.'}</p>
          <label className="mt-3 block"><span className={labelStyle}>View a bank’s official PayShap instructions</span><select className={selectStyle} value={bank} onChange={e => setBank(e.target.value)}>{BANK_GUIDES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <button type="button" className={`${actionStyle} mt-3`} onClick={() => openExternal(bankGuide.url)}>Open official bank instructions <ArrowUpRight size={14}/></button>
        </> : <p>PayShap Request is for domestic South African ZAR payments. Choose South Africa and ZAR in the debt plan to see the instructions. No foreign-currency request is generated.</p>}
      </div>}
      {method === 'paypal' && <div className="rounded-lg border border-border bg-muted/45 p-4 text-[11px] leading-5">
        <div className="mb-2 flex items-center gap-2 font-semibold"><CreditCard size={15}/>PayPal.Me payment handoff</div>
        <label className="block"><span className={labelStyle}>{mode === 'pay' ? 'Creditor’s verified PayPal.Me username' : 'Your own PayPal.Me username'}</span><input className={selectStyle} value={paypalHandle} onChange={e => setPaypalHandle(e.target.value)} maxLength={20} placeholder="PayPalMeUsername"/></label>
        {!paypalSupported ? <p className="mt-2 text-amber-700">PayPal does not list {currency} as a standard payment currency for PayPal payments. This app will not guess a conversion. Use a different supported transaction currency agreed by both parties or choose a local bank request.</p> : <p className="mt-2">Use only an account you have verified. {paypalNote}</p>}
        {paypalUrl && <div className="mt-2 break-all rounded bg-background p-2 font-mono text-[10px]">{paypalUrl}</div>}
        <button type="button" className={`${actionStyle} mt-3`} disabled={!paypalUrl} onClick={() => { if (paypalUrl) openExternal(paypalUrl); }}>Review on PayPal <ArrowUpRight size={14}/></button>
        <p className="mt-2 text-muted-foreground">Entering a username does not connect your PayPal account. Payments and receipts are confirmed by PayPal, not Market Compass.</p>
      </div>}
      {method === 'hosted' && <div className="rounded-lg border border-border bg-muted/45 p-4 text-[11px] leading-5">
        <div className="mb-2 font-semibold">Provider-hosted payment link</div>
        <p>{mode === 'pay' ? 'Paste the creditor’s authentic PayPal invoice or Yoco checkout link. Verify the creditor identity and amount at checkout.' : 'Create a payment link in your own verified PayPal Business or Yoco account, then paste it here before sharing.'}</p>
        <label className="mt-3 block"><span className={labelStyle}>Verified hosted checkout URL</span><input type="url" inputMode="url" className={selectStyle} value={hostedUrl} onChange={e => setHostedUrl(e.target.value)} placeholder="https://pay.yoco.com/…"/></label>
        {hostedUrl && !validHosted && <p className="mt-2 text-amber-700">Only HTTPS URLs hosted directly on paypal.com, paypal.me or pay.yoco.com are accepted. This does not prove the payee is trustworthy.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={actionStyle} disabled={!validHosted} onClick={() => { if (validHosted) openExternal(validHosted); }}>Open hosted checkout <ArrowUpRight size={14}/></button>
          <button type="button" className={actionStyle} onClick={() => openExternal('https://www.yoco.com/za/payment-link/')}>Yoco payment links <ArrowUpRight size={14}/></button>
          <button type="button" className={actionStyle} onClick={() => openExternal('https://www.paypal.com/za/business/accept-payments/invoice')}>PayPal invoicing <ArrowUpRight size={14}/></button>
        </div>
        <p className="mt-2 text-muted-foreground">Yoco online transactions use ZAR. Hosted links may have their own amount and currency; this app cannot verify either.</p>
      </div>}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className={labelStyle}>Payment instruction preview · not sent</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-6">{requestText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={actionStyle} onClick={() => { void copyText(); }} disabled={!shareable}><Copy size={14}/>Copy instructions</button>
          <button type="button" className={actionStyle} onClick={() => { void shareText(); }} disabled={!shareable}><Send size={14}/>Share instructions</button>
        </div>
        {message && <p role="status" className="mt-2 text-[11px] text-muted-foreground"><Check size={13} className="mr-1 inline"/>{message}</p>}
      </div>
      <p className="text-[10px] leading-5 text-muted-foreground">Market Compass never marks a debt as paid just because a link was opened or a message shared. Confirm the transaction at your bank or payment provider and update your debt balance manually.</p>
    </div>
  </section>;
}
