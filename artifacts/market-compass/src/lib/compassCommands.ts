/**
 * Deterministic, local-first commands for the voice assistant.
 * Never mutates financial records and never moves money or places trades.
 */
export type CompassCommandContext = {
  currency: string;
  accounts: { name: string; balance: string; apr: string; minimumPayment: string }[];
  monthlyExtra: string;
  privateBudget?: { monthlyIncome: string; monthlyEssentials: string; liquidFunds: string; reserveTarget: string } | null;
  marketCache?: { symbol: string; currency: string; candles?: { date: string; close: number }[] } | null;
  draftCount: number;
};
export type CompassCommandResult = {
  type: 'answer' | 'navigate' | 'unknown';
  reply: string;
  needsHistoricalSources?: boolean;
  destination?: '/' | '/markets' | '/debt' | '/drafts' | '/assistant';
};

function currency(value: number, code: string): string {
  try { return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(value); }
  catch { return `${code} ${value.toFixed(2)}`; }
}
const number = (value: string) => value?.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function interpretCompassCommand(raw: string, ctx: CompassCommandContext): CompassCommandResult {
  const q = raw.toLowerCase().trim().replace(/[?!.,]/g, '').replace(/\s+/g,' ');
  if (q.length < 1 || q.length > 500) return { type: 'unknown', reply: 'Please ask a question of up to 500 characters.' };

  // No purchase, transfer or trading instruction is treated as a command.
  if (/\b(send|transfer|pay|settle|withdraw|purchase|buy|sell|trade|execute|place an order|place a trade)\b/.test(q)
    && /\b(bank|money|funds|account|debt|loan|card|stock|crypto|shares|bitcoin|rand|dollar|order|trade|me|my|to)\b/.test(q)) {
    return { type:'answer', reply:'I cannot transfer money, pay creditors, place trades or access your bank. I can show your debt plan and help you prepare a payment request for your own review.' };
  }
  const navigations: { regex: RegExp; to: CompassCommandResult['destination']; response: string }[] = [
    { regex: /^(?:open|show|go to|take me to|navigate to|view)\s+(?:my\s+)?(?:debt|debts|debt plan|debt payoff|loan|loans)(?:\s+page)?$/, to: '/debt', response: 'Opening Debt Plan.' },
    { regex: /^(?:open|show|go to|take me to|navigate to|view)\s+(?:my\s+)?(?:markets|market|market research|prices)(?:\s+page)?$/, to: '/markets', response: 'Opening Markets.' },
    { regex: /^(?:open|show|go to|take me to|navigate to|view)\s+(?:my\s+)?(?:drafts|orders|trade drafts)(?:\s+page)?$/, to: '/drafts', response: 'Opening your local Drafts.' },
    { regex: /^(?:open|show|go to|take me to|navigate to|view)\s+(?:my\s+)?(?:home|overview|dashboard)(?:\s+page)?$/, to: '/', response: 'Opening Home.' },
    { regex: /^(?:open|show|go to|take me to|navigate to|view)\s+(?:my\s+)?(?:assistant|ai|voice assistant)(?:\s+page)?$/, to: '/assistant', response: 'Opening the assistant.' },
  ];
  const path = navigations.find(p => p.regex.test(q));
  if (path) return { type:'navigate', destination:path.to, reply:path.response };

  if (/\b(help|what can you do|commands|how do i use you)\b/.test(q)) {
    return { type:'answer', reply:'You can ask: What is my total debt? Which debt has the highest APR? What are my minimum payments? How much extra can I afford? What market data is saved? Or say open Debt Plan, Markets, Drafts or Home. I can speak replies aloud, but never initiate payments or trades.' };
  }
  if (/\b(date|today|what day)\b/.test(q)) {
    return { type:'answer', reply:`Today is ${new Date().toLocaleDateString('en-ZA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}. Your market data may be historical.` };
  }
  const complete = ctx.accounts.filter(a=>a.name.trim() && number(a.balance)!==null && number(a.apr)!==null && number(a.minimumPayment)!==null);
  const known = complete.length === ctx.accounts.length;
  if (/\b(total debt|total balance|debt balance|how much (?:do i owe|debt)|what do i owe|owed|my debts|debt summary)\b/.test(q)) {
    if (!complete.length) return { type:'answer', needsHistoricalSources:true, reply:'I do not have any verified debt balances entered. Open Debt Plan to add accounts or import your Financial Advisor baseline, then review the amounts.' };
    if (!known) return { type:'answer', needsHistoricalSources:true, reply:'Some of your accounts have missing values. Finish those entries in Debt Plan so the total is not misleading.' };
    const total = complete.reduce((a,b)=>a+Number(b.balance),0);
    return { type:'answer', reply:`Your entered debt balance is ${currency(total,ctx.currency)} across ${complete.length} ${complete.length===1?'account':'accounts'}. These are values you entered, not independently verified bank balances.` };
  }
  if (/\b(highest (?:interest|apr|rate)|most expensive debt|which debt first|avalanche)\b/.test(q)) {
    const sorted = complete.filter(a=>Number(a.balance)>0).sort((a,b)=>Number(b.apr)-Number(a.apr));
    if (!sorted.length || !known) return { type:'answer', needsHistoricalSources:true, reply:'Enter and review each current debt balance and annual interest rate in Debt Plan first.' };
    return { type:'answer', reply:`Based on your entries, ${sorted[0].name} has the highest listed annual rate, ${Number(sorted[0].apr).toFixed(2)} percent. An avalanche plan considers that debt first for affordable extra payments, after minimums and essentials. Confirm lender terms before acting.` };
  }
  if (/\b(minimum (?:payments|repayments|instalments|installments)|monthly debt payments|debt minimums)\b/.test(q)) {
    if (!complete.length || !known) return { type:'answer', needsHistoricalSources:true, reply:'Add the current minimum monthly payment for each account in Debt Plan.' };
    const total = complete.reduce((a,b)=>a+Number(b.minimumPayment),0);
    return { type:'answer', reply:`Your entered minimum payments total ${currency(total,ctx.currency)} per month. These are your entries, not bank-confirmed due amounts.` };
  }
  if (/\b(extra|surplus|afford|headroom|cash flow|cashflow|budget)\b/.test(q)) {
    const b=ctx.privateBudget;
    if (!b || !known || !complete.length || [b.monthlyIncome,b.monthlyEssentials,b.liquidFunds,b.reserveTarget].some(x=>number(x)===null)) {
      return { type:'answer', needsHistoricalSources:true, reply:'To estimate extra repayment capacity, open Debt Plan and enter current income, essential spending, available liquid funds and reserve target. Review the figures before relying on them.' };
    }
    const minimums=complete.reduce((sum,a)=>sum+Number(a.minimumPayment),0);
    const headroom=Number(b.monthlyIncome)-Number(b.monthlyEssentials)-minimums;
    const shortfall=Math.max(0,Number(b.reserveTarget)-Number(b.liquidFunds));
    if (headroom < 0) return {type:'answer',reply:`Based on your unverified entries, monthly income falls short of essentials and minimums by ${currency(-headroom,ctx.currency)}. I cannot recommend extra repayments. Review cashflow and contact creditors if necessary.`};
    return { type:'answer', reply:`After entered essential expenses and debt minimums, your estimated recurring headroom is ${currency(headroom,ctx.currency)} per month. ${shortfall>0?`Your cash reserve is short by ${currency(shortfall,ctx.currency)}, so protect liquidity first.`:'Your entered cash reserve target is met.'} This is a budget illustration, not confirmed bank funds or a payment instruction.` };
  }
  if (/\b(market|markets|price|prices|bitcoin|ethereum|solana|candle|quote|ticker|crypto)\b/.test(q)) {
    const market=ctx.marketCache;
    const last=market?.candles?.at(-1);
    if (!market || !last) return { type:'answer', reply:'No saved market candles are available. Open Markets when connected to fetch historical data. I cannot invent a live price.' };
    const day=new Date(last.date);
    const formatted = Number.isNaN(day.getTime()) ? last.date : day.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
    return { type:'answer', reply:`Your last saved ${market.symbol} closing candle is ${currency(last.close,market.currency)} on ${formatted} UTC. This is historical market data, not a live or executable quote.` };
  }
  if (/\b(draft|drafts|pending orders)\b/.test(q)) return {type:'answer',reply:`You have ${ctx.draftCount} locally saved trade ${ctx.draftCount===1?'draft':'drafts'}. These cannot execute trades or move funds.`};
  return { type:'unknown', reply:'I could not match that to an offline command. Try asking about your debt balance, debt interest, affordable surplus, saved markets, or say open a page. For a general discussion, connect your private desktop Ollama service in Assistant settings.' };
}
