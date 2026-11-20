import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validatePaymentInput, approvedOzowLink } from './index.mjs';

const origin = 'https://hyprmanzero.github.io';
const requestId = '497f6eca-6276-4993-bfeb-53cbbbba6f08';
const paymentId = '33857766-f29a-4a3a-a37e-66db3c42e439';
const secret = '0123456789abcdefghijklmnopqrstuvwxyzABCDEF';
const env = {
  MC_ALLOWED_ORIGIN: origin,
  MC_OPERATOR_PASSPHRASE: secret,
  OZOW_CLIENT_ID: 'testing-id',
  OZOW_CLIENT_SECRET: 'testing-secret',
  OZOW_SITE_CODE: 'SITE-TEST',
  PAYMENTS_ENABLED: 'true',
  OZOW_ENV: 'staging',
  MC_RETURN_URL: origin + '/market-compass-ios/',
  MC_MAX_ZAR: '5000',
};

test('ZAR payment request validation rejects invalid or excessive amounts', () => {
  assert.deepEqual(validatePaymentInput({ requestId, amountZar: 150.2, reference: 'Payment 2026' }), { requestId, amountZar: 150.2, reference: 'Payment 2026' });
  assert.throws(() => validatePaymentInput({ requestId, amountZar: -1, reference: 'X' }), /Amount/);
  assert.throws(() => validatePaymentInput({ requestId, amountZar: 5000.01, reference: 'X' }, 5000), /Amount/);
  assert.throws(() => validatePaymentInput({ requestId, amountZar: 1.001, reference: 'X' }), /decimal/);
  assert.throws(() => validatePaymentInput({ requestId: 'bad', amountZar: 10, reference: 'X' }), /UUID/);
  assert.throws(() => validatePaymentInput({ requestId, amountZar: 10, reference: '<bad>' }), /Reference/);
});
test('checkout links require HTTPS Ozow domain', () => {
  assert.equal(approvedOzowLink('https://pay.ozow.com/abc'), 'https://pay.ozow.com/abc');
  for (const candidate of ['http://pay.ozow.com/x','https://ozow.com.evil.example/x','https://evil.example/x','javascript:alert(1)']) assert.equal(approvedOzowLink(candidate), null);
});
test('rejects other Origins and disables unconfigured live requests', async () => {
  const request = new Request('https://mc-gateway.example/health', { headers: { Origin: 'https://bad.example' } });
  const rejected = await handler.fetch(request, env);
  assert.equal(rejected.status, 403);
  const disabledEnv = { ...env, PAYMENTS_ENABLED: 'false' };
  const health = await handler.fetch(new Request('https://mc-gateway.example/health', { headers: { Origin: origin } }), disabledEnv);
  assert.equal((await health.json()).acceptingRequests, false);
  const productionLocked = { ...env, OZOW_ENV: 'production' };
  const locked = await handler.fetch(new Request('https://mc-gateway.example/api/payments/create', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer ' + secret } }), productionLocked);
  assert.equal(locked.status, 503);
});
test('requires operator authentication for payment creation', async () => {
  const res = await handler.fetch(new Request('https://mc-gateway.example/api/payments/create', {
    method: 'POST', headers: { Origin: origin, Authorization: 'Bearer incorrect-value' },
    body: JSON.stringify({ requestId, amountZar: 25, reference: 'Loan' })
  }), env);
  assert.equal(res.status, 401);
});
test('creates a staging link with stable idempotency key and verifies via provider transactions', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async request => {
    calls.push(request);
    const url = new URL(request.url);
    if (url.pathname.endsWith('/token')) return Response.json({ access_token: 'staging-access-token-123456' });
    if (url.pathname.endsWith('/transactions')) return Response.json({ results: [{ id: 'some-transaction', status: 'Successful' }] });
    if (request.method === 'POST' && url.pathname.endsWith('/payments')) return Response.json({ id: paymentId, status: 'Created', redirectUrl: 'https://pay.ozow.com/' + paymentId + '/secure' }, { status: 201 });
    if (url.pathname.endsWith('/payments/' + paymentId)) return Response.json({ id: paymentId, status: 'Created' });
    throw new Error('Unexpected mock request ' + request.url);
  };
  try {
    const create = await handler.fetch(new Request('https://mc-gateway.example/api/payments/create', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
      body: JSON.stringify({ requestId, amountZar: 99.5, reference: 'Debt payment' })
    }), env);
    const created = await create.json();
    assert.equal(create.status, 201);
    assert.equal(created.paymentId, paymentId);
    assert.equal(created.verifiedPaid, false);
    assert.match(created.checkoutUrl, /^https:\/\/pay\.ozow\.com\//);
    const apiCall = calls.find(c => c.url.endsWith('/payments') && c.method === 'POST');
    assert.equal(apiCall.headers.get('Idempotency-Key'), requestId);
    const body = await apiCall.json();
    assert.deepEqual(body.amount, { currency: 'ZAR', value: 99.5 });
    const status = await handler.fetch(new Request('https://mc-gateway.example/api/payments/' + paymentId + '/status', {
      headers: { Origin: origin, Authorization: 'Bearer ' + secret }
    }), env);
    const verified = await status.json();
    assert.equal(status.status, 200);
    assert.equal(verified.paymentStatus, 'Successful');
    assert.equal(verified.verifiedPaid, true);
    assert.match(verified.message, /NOT proof/);
  } finally { globalThis.fetch = originalFetch; }
});
