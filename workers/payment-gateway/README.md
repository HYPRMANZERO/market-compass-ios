# Market Compass — South African merchant payment gateway (Ozow One API)

This folder provides an **optional** server-side gateway for Ozow-hosted **incoming merchant payments**. It is **not** a bank login, a service that can debit another person's bank account, or a way to repay an unrelated bank/creditor automatically.

## Why a separate Worker?

GitHub Pages runs static browser code. Ozow's OAuth client secret must **never** be placed in the PWA, `VITE_*` variables, public GitHub code, URL query strings, or the local encrypted vault. This Worker exchanges the secret for an Ozow access token **on the server**, then creates a provider-hosted payment request and returns the provider-supplied HTTPS checkout URL.

Customer payment occurs on the Ozow-hosted page. Ozow can offer **PayShap Request**, subject to approval/enablement on your merchant account. A PayShap request is initiated and approved through supported banks via Ozow; a payment **link** alone does not send a bank notification. No payment is considered successful until a transaction status of `Successful` is returned by Ozow.

**Receiving money as a merchant is different from paying a lender.** To pay a loan or credit card, continue to use the creditor's approved repayment methods and independently verify bank statements. Incoming money in your merchant account is not a creditor repayment.

## Prerequisites

- A registered Ozow merchant account, an Ozow site code, and **One API** client ID/client secret with the `payments` scope.
- Ozow **staging credentials** for payment testing (ask your Ozow account manager/support; production calls can transfer real funds).
- A Cloudflare Workers account. Cloudflare Workers Free has usage limits; Ozow transaction fees, eligibility rules, and merchant onboarding are separate.
- A random, high-entropy **32+ character operator passphrase** different from your Market Compass vault password.
- The Market Compass PWA origin (default: `https://hyprmanzero.github.io`).

Official resources:
- [Ozow merchant quick start](https://hub.ozow.com/getting-started/quick-start/)
- [Ozow One API payment request](https://hub.ozow.com/api-reference/one-api/post-payments/)
- [Ozow hosted checkout and PayShap Request activation](https://hub.ozow.com/integration-methods/apis/money-in/hosted-checkout/)
- [Ozow transaction status](https://hub.ozow.com/api-reference/one-api/get-payments-id-transactions/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## 1. Run offline tests (no bank requests)

From the project root on Node.js 24:

```powershell
node --test workers/payment-gateway/gateway.test.mjs
```

Tests mock Ozow and verify amount limits, checkout URL allowlisting, origin rules, disabled live requests, operator authentication, the idempotency key and transaction-status interpretation. **Tests do not send real payments.**

## 2. Deploy a disabled Worker

From Windows PowerShell:

```powershell
cd C:\Users\<Windows-user>\market-compass-ios\workers\payment-gateway
npx wrangler login
npx wrangler deploy
```

The default `wrangler.toml` has:

```toml
OZOW_ENV = "staging"
PAYMENTS_ENABLED = "false"
ALLOW_LIVE_PAYMENTS = "false"
MC_ALLOWED_ORIGIN = "https://hyprmanzero.github.io"
MC_RETURN_URL = "https://hyprmanzero.github.io/market-compass-ios/"
MC_MAX_ZAR = "5000"
```

**None of these are credentials.** The gateway remains disabled. Copy the `https://...workers.dev` Worker URL returned by Wrangler.

## 3. Set staging secrets privately

Run each command in the Worker directory and enter the value when prompted. Never paste these values in chat or commit them.

```powershell
npx wrangler secret put OZOW_CLIENT_ID
npx wrangler secret put OZOW_CLIENT_SECRET
npx wrangler secret put OZOW_SITE_CODE
npx wrangler secret put MC_OPERATOR_PASSPHRASE
```

Use the staging client and site provided by Ozow. `MC_OPERATOR_PASSPHRASE` must be at least 32 characters. Keep this **separate** from the AES-vault password.

In Cloudflare, configure additional abuse protection and monitor the gateway before production. This example uses one operator passphrase and strict origin checks; it is suitable for a **single-owner staging integration**, **not** a multi-tenant public payment service.

## 4. Enable staging requests explicitly

In `wrangler.toml` change only `PAYMENTS_ENABLED = "true"`, leave `OZOW_ENV = "staging"` and `ALLOW_LIVE_PAYMENTS = "false"`. Then:

```powershell
npx wrangler deploy
```

Inside Market Compass on your iPhone, open **Debt plan → Merchant API requests (advanced)**. Enter **your own** `workers.dev` URL and the separately configured operator passphrase (not saved to the vault). Test connection, then create a small **staging** payment request. You can view, copy or share the returned Ozow-hosted checkout URL.

The saved request's ID, amount, reference and verification result remain in the locally encrypted workspace; the operator passphrase and Ozow API credentials are not stored in the vault. The Worker is stateless; the stable UUID provided by the app is passed to Ozow as an `Idempotency-Key` on creation. Retries after an uncertain result **must use the same UUID** to avoid duplicate requests. Review the Ozow merchant dashboard if a network timeout occurs before issuing a new request.

## 5. Verify the actual provider status

Tap **Verify with Ozow** on a saved request.

- `Created`, `Incomplete`, `Pending` or `Expired` are **not** payment confirmations.
- Only a `Successful` transaction returned by Ozow's authenticated `GET /payments/{id}/transactions` is interpreted as a successful **merchant pay-in**.
- A successful merchant pay-in does **not** automatically reduce any debt in Market Compass; paying a creditor is a separate action.

The gateway deliberately uses authenticated **server-side polling** instead of accepting unauthenticated webhooks. It does not automatically process any webhook or trigger a payout. This keeps the initial surface small. For a production payment operation, add verified webhooks, durable idempotency/audit records, dedicated operator authentication, quotas, and reconciliation before automating any downstream actions.

## 6. Production requires separate approval

Do **not** turn on production mode until:
1. Ozow has verified your merchant account, approved your intended use, issued production credentials, and enabled the required payment methods (ask specifically about PayShap Request).
2. Staging tests (successful, declined, expired, retries and offline) pass.
3. Security and financial reconciliation are reviewed.

Live mode is guarded by **both** `OZOW_ENV = "production"` and `ALLOW_LIVE_PAYMENTS = "true"` plus `PAYMENTS_ENABLED = "true"`. Those are intentionally **not enabled** in the repository. Deploying production credentials/flags can initiate real financial transactions and may incur provider fees.

## HTTP contract (for your own Worker only)

- `GET /health`: read-only configuration check (from the allowed PWA origin).
- `POST /api/payments/create`: with `Authorization: Bearer <operator passphrase>`, JSON `{ "requestId": "UUID", "amountZar": 120.50, "reference": "Invoice 25" }`. Returns provider `paymentId`, `checkoutUrl`, `expiresAt`, `paymentStatus`. Only ZAR, R1–R5000 by default.
- `GET /api/payments/{paymentId}/status`: authenticated request; returns `verifiedPaid` only if Ozow reports a `Successful` transaction.

No phone number, bank account credentials, one-time bank passwords, payment card details or personal ID documents are required by this integration.

## Provider limitations

The configured provider-hosted flow does not automatically push a PayShap Request to a named bank or phone number. PayShap Request becomes available **inside Ozow checkout** only if Ozow enables it. For direct bank-notification RTP, a separate approved merchant RTP integration (e.g. Stitch or a bank's Merchant Request to Pay API) is required. The static PWA must never generate bank approvals itself.
