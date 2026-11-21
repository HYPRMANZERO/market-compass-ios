# Market Compass — living product, Vault22/22seven comparison and release parity guide

Updated 21 November 2026. Applies to both the original GitHub Pages PWA (main) and the private HTTPS ngrok PWA (feature/ios-safari-launch-2026-11-26).

## Product north star

Build a private, trustworthy financial cockpit that can consolidate user-approved income, spending, debts, savings and dated market references; explain trade-offs, detect gaps, and provide an evidence-grounded, reviewable 30/60/90-day path forward. The owner explicitly approves changes; the assistant never invents bank verification, account balances, or loan decisions.

## Vault22 / 22seven reference and gaps

The earlier comparison identified the established 22seven-style experience as stronger in **live account aggregation, holistic income/expense monitoring, categorization, debt and investment oversight, reconciliation and operational maturity**. Market Compass's current differentiator is privacy-first local encryption, optional private Ollama inference on HYPRBOX, transparent source freshness, and read-only Agent traces. Do not describe Market Compass as functionally equivalent to connected 22seven until independent provider-authorized feeds and full reconciliation are proven. No use of their logos or copying their proprietary design assets.

User expectation: real imported documents become **reviewable structured data**, not inert file badges; the user can move approved transactions into the Spend ledger, then see accurately dated totals and an explainable financial guideline. Current import captures **bounded excerpts** only (up to 60 recognized lines). It is not a complete bank statement and is **not automatically reconciled** to opening/closing balances. Scanned and multi-column PDFs remain a limitation; require source-vs-extracted review.

## Mobile-first visual system (both PWAs)

- Keep the shared React, Tailwind and accessible primitives; use Ionic-inspired native-style spacing and progressive disclosure, **not** an untested framework rewrite.
- Preserve desktop navigation. On iPhone, favor persistent familiar tabs, legible headers, minimum ~44px targets, safe-area breathing room, top-level summary cards, short explanations, and secondary details collapsed.
- Spend becomes three focused sections: **Documents** (import/review/approve), **Activity** (dated salary-cycle entries), and **Plan** (evidence coverage, missing facts and provisional 30/60/90-day steps). Avoid stacking every import form, ledger, advisor and legal note in one page.
- Each transaction maintains currency, date, amount, direction/category, source provenance, and review state. Show recorded-vs-verified and historical-vs-live differences near figures.
- Design for iPhone 11 width and VoiceOver. Keep text readable, form input >=16px for iOS zoom prevention, and avoid using only color for statuses.
- Important source-state and safety information must remain discoverable, even when secondary panels are collapsed.

## Source-to-plan data contract

1. **Local import**: CSV/TXT/JSON or selectable-text PDF. Password-protected PDFs decrypt only inside Safari; one-time password input clears immediately after file selection. Never save passwords or original PDF bytes to the encrypted vault or upload to HYPRBOX/GitHub.
2. **Extract and review**: show detected rows, amounts, dates, masks and warnings. PDF text order may be inaccurate. Owner verifies source details before approving.
3. **Owner-confirmed Spend posting**: a saved excerpt does not automatically affect totals. Each selected source line requires explicit date, classification and category, and a final confirmation. Use stable source-line IDs to refuse duplicate retries. The action updates only this device's encrypted expense ledger; it does not change current bank balance or lender principal.
4. **Dated ledger**: salary cycle is 26th–25th. Trends and income-expense calculations reflect approved entries in the selected cycle, **not** a synchronized bank feed. Do not confuse a missing entry with R0.
5. **Local guideline**: 30/60/90-day suggested steps use owner-confirmed entered fields. Unknown or unverified fields remain visibly incomplete. No autonomous execution.
6. **Ollama / Agent handoff**: private HYPRBOX bridge receives only owner-approved bounded context when explicitly enabled. A manually reviewed <=500-character planning brief can be copied into the read-only Agent. The iPhone vault is NOT auto-synced to HYPRBOX; do not claim the Agent has read original PDFs.

## Product/security parity policy

Both PWAs share the same React finance/document workflow, local financial safety controls, voice UI, and market components. **Only connection transport is intentionally separate**:
- Private ngrok edition: protected same-origin gateway and bearer token, HYPRBOX local bridge, edge verification, site-specific vault.
- Original GitHub Pages edition: public static files and **strict Tailscale *.ts.net private AI origin**. Never bundle the ngrok edge proof, server secrets, or privileged loopback routes. Original's Tailscale connection is an explicit deferred acceptance gate.
- Browser vaults on the two origins are independent. Move data only through owner-initiated encrypted backup/export and restore. Never merge, reset, or silently migrate device vaults.

Crypto price panels display provider, timestamp, ZAR/USD and limitations. Market quotes are NOT balances, holdings, executable trade prices or authenticated JSE feeds.

## Mandatory release acceptance

- Green typechecks, local synthetic statement/password PDF tests, source-label and duplicate tests, iPhone shell and offline cache tests.
- For every financial document: manual confirmation of source rows, total and direction **before** relying on calculated figures. Wrong, truncated or missing entries block reconciliation; do not silently sum incomplete documents.
- Verify import -> approved Spend entry -> current/historical salary cycle selection -> updated local summary -> 30/60/90-day guide -> owner-reviewed Agent brief on both PWAs.
- Preserve previous deployed assets, protected gateway and the encrypted vault; never clear Safari storage or restart HYPRBOX without explicit safe release control.
- Check actual iPhone HTTPS behavior after each deployment. CI passing does not mean a user's iPhone downloaded the updated service-worker cache.
- Do not declare launch-ready while owner-reported source totals are mismatched or the agent misstates financial freshness.

## Deferred scope

Real bank/credit-card aggregation, robust bank-statement reconciliation, source-provider authorization, complete PDF table extraction and OCR, cross-origin vault sync, Tailscale live original PWA, and automated trading/payment execution are **not** implemented or authorized by this document.
