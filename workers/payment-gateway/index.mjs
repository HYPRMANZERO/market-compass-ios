/**
 * Market Compass — owner-controlled Ozow One API bridge.
 * Staging is the default, payment creation is disabled until explicitly enabled.
 * No bank logins, PayShap identifiers, credit cards, or merchant credentials pass through GitHub Pages.
 * See README.md for setup, security boundaries and merchant onboarding.
 */
const URLS = Object.freeze({
  staging: 'https://stagingone.ozow.com/v1',
  production: 'https://one.ozow.com/v1',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

function response(data, status = 200, origin = '') {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function error(message, status, origin) {
  return response({ ok: false, error: message }, status, origin);
}
async function sameSecret(provided, expected) {
  if (typeof expected !== 'string' || expected.length < 32 || !provided || provided.length > 256) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}
function isConfigured(env) {
  return !!(env.OZOW_CLIENT_ID && env.OZOW_CLIENT_SECRET && env.OZOW_SITE_CODE
    && env.MC_OPERATOR_PASSPHRASE?.length >= 32 && env.MC_ALLOWED_ORIGIN?.startsWith('https://'));
}
function enabled(env) {
  return env.PAYMENTS_ENABLED === 'true' && (env.OZOW_ENV !== 'production' || env.ALLOW_LIVE_PAYMENTS === 'true');
}

export function validatePaymentInput(input, maxAmount = 10000) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid payment request.');
  if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) throw new Error('A stable UUID requestId is required.');
  if (typeof input.amountZar !== 'number' || !Number.isFinite(input.amountZar)) throw new Error('Enter a valid amount in ZAR.');
  const cents = Math.round(input.amountZar * 100);
  if (Math.abs(input.amountZar * 100 - cents) > 1e-6 || cents < 100 || cents > maxAmount * 100) {
    throw new Error(`Amount must be between R1 and R${maxAmount} with at most two decimal places.`);
  }
  const ref = typeof input.reference === 'string' ? input.reference.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(ref)) throw new Error('Reference must be 1–40 plain-text letters, numbers, spaces, underscores or hyphens.');
  return { requestId: input.requestId.toLowerCase(), amountZar: cents / 100, reference: ref };
}

async function providerJson(base, path, init) {
  const request = new Request(base + path, { ...init, signal: AbortSignal.timeout(15000) });
  let provider;
  try { provider = await fetch(request); }
  catch { throw new Error('Ozow was unreachable. Check connectivity or the merchant account setup.'); }
  let data;
  try { data = await provider.json(); }
  catch { throw new Error('Ozow returned an invalid response.'); }
  if (!provider.ok) {
    const code = typeof data?.code === 'string' ? data.code.slice(0, 60) : 'ProviderError';
    throw new Error(`Ozow request rejected (HTTP ${provider.status}, ${code}).`);
  }
  return data;
}
async function ozowToken(env, base) {
  const result = await providerJson(base, '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.OZOW_CLIENT_ID,
      client_secret: env.OZOW_CLIENT_SECRET,
      scope: 'payments',
      grant_type: 'client_credentials',
    }),
  });
  if (typeof result?.access_token !== 'string' || result.access_token.length < 10) throw new Error('Ozow did not return a valid access token.');
  return result.access_token;
}
export function approvedOzowLink(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (url.hostname === 'ozow.com' || url.hostname.endsWith('.ozow.com'))
      ? url.toString() : null;
  } catch { return null; }
}
async function handleCreate(request, env, origin, base) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 2048) return error('Request is too large.', 413, origin);
  let input;
  try {
    const text = await request.text();
    if (text.length > 2048) return error('Request is too large.', 413, origin);
    input = validatePaymentInput(JSON.parse(text), Number(env.MC_MAX_ZAR || 10000));
  } catch (e) { return error(e instanceof Error ? e.message : 'Invalid request.', 400, origin); }
  // UUID doubles as a stable idempotency key. On retries it must NEVER change.
  const idPart = input.requestId.replace(/-/g, '');
  const referenceText = input.reference.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase() || 'PAYMENT';
  const merchantReference = `MC-${referenceText}-${idPart.slice(0, 20)}`;
  const beneficiaryReference = `MC${idPart.slice(0, 16)}`;
  const accessToken = await ozowToken(env, base);
  const payload = {
    siteCode: env.OZOW_SITE_CODE,
    region: 'ZA',
    amount: { currency: 'ZAR', value: input.amountZar },
    merchantReference,
    beneficiaryReference,
    expireAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    returnUrl: env.MC_RETURN_URL || 'https://hyprmanzero.github.io/market-compass-ios/',
  };
  const result = await providerJson(base, '/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Idempotency-Key': input.requestId,
      'X-Correlation-ID': input.requestId,
    },
    body: JSON.stringify(payload),
  });
  if (!UUID.test(result?.id ?? '') || result?.status?.toLowerCase() !== 'created') {
    throw new Error('Ozow did not confirm the creation of a payment request.');
  }
  const checkoutUrl = approvedOzowLink(result.redirectUrl);
  if (!checkoutUrl) throw new Error('Ozow returned no valid HTTPS payment URL. Do not construct one manually.');
  return response({
    ok: true,
    provider: 'Ozow One API',
    environment: env.OZOW_ENV === 'production' ? 'production' : 'staging',
    paymentId: result.id,
    checkoutUrl,
    merchantReference,
    paymentStatus: 'Created',
    verifiedPaid: false,
    currency: 'ZAR',
    amountZar: input.amountZar,
    expiresAt: payload.expireAt,
  }, 201, origin);
}
async function handleStatus(paymentId, env, origin, base) {
  const accessToken = await ozowToken(env, base);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const payment = await providerJson(base, `/payments/${paymentId}`, { headers });
  const now = new Date();
  const before = new Date(now.getTime() - 90 * 86400000);
  const start = before.toISOString().slice(0, 10), end = now.toISOString().slice(0, 10);
  const transactions = await providerJson(base, `/payments/${paymentId}/transactions?fromDate=${start}&toDate=${end}&limit=50`, { headers });
  const entries = Array.isArray(transactions?.results) ? transactions.results : [];
  const verifiedPaid = entries.some(item => String(item.status).toLowerCase() === 'successful');
  const status = verifiedPaid ? 'Successful'
    : entries.some(item => String(item.status).toLowerCase() === 'pending') ? 'Pending'
    : entries.some(item => String(item.status).toLowerCase() === 'incomplete') ? 'Incomplete'
    : entries.some(item => String(item.status).toLowerCase() === 'error') ? 'Error'
    : payment?.status === 'Expired' ? 'Expired' : 'Created';
  return response({
    ok: true, provider: 'Ozow One API', environment: env.OZOW_ENV === 'production' ? 'production' : 'staging',
    paymentId, paymentStatus: status, verifiedPaid, checkedAt: new Date().toISOString(),
    message: verifiedPaid
      ? 'Ozow reports a successful merchant pay-in. This is NOT proof that a creditor or lender has received a debt repayment.'
      : 'No successful merchant pay-in confirmed yet. Never treat a return redirect as payment confirmation.',
  }, 200, origin);
}

export default {
  async fetch(request, env) {
    const configuredOrigin = env.MC_ALLOWED_ORIGIN;
    const origin = request.headers.get('Origin') || '';
    // Refuse unauthorised sites; no wildcard CORS and no credentials in static assets.
    if (!configuredOrigin || origin !== configuredOrigin) return error('Origin not permitted.', 403);
    if (request.method === 'OPTIONS') return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type',
        'Access-Control-Max-Age': '600',
        'Cache-Control': 'no-store',
        Vary: 'Origin',
      },
    });
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return response({
        ok: true,
        integration: 'ozow-one-api',
        environment: env.OZOW_ENV === 'production' ? 'production' : 'staging',
        configured: isConfigured(env),
        acceptingRequests: isConfigured(env) && enabled(env),
        merchantOnly: true,
      }, 200, origin);
    }
    if (!isConfigured(env)) return error('Gateway is not configured with an Ozow merchant account and operator secret.', 503, origin);
    if (!enabled(env)) return error('Payment creation is disabled. Configure staging first; live mode requires explicit opt-in.', 503, origin);
    const bearer = request.headers.get('Authorization') || '';
    const provided = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!(await sameSecret(provided, env.MC_OPERATOR_PASSPHRASE))) return error('Operator authorization failed.', 401, origin);
    const base = env.OZOW_ENV === 'production' ? URLS.production : URLS.staging;
    try {
      if (url.pathname === '/api/payments/create' && request.method === 'POST') {
        return await handleCreate(request, env, origin, base);
      }
      const match = url.pathname.match(/^\/api\/payments\/([0-9a-f-]{36})\/status$/i);
      if (match && UUID.test(match[1]) && request.method === 'GET') {
        return await handleStatus(match[1].toLowerCase(), env, origin, base);
      }
      return error('Not found.', 404, origin);
    } catch (e) {
      // Do not log response data or credentials from external payment APIs.
      const message = e instanceof Error ? e.message : 'Payment gateway unavailable.';
      return error(message, 502, origin);
    }
  },
};
