# Market Compass — living product, Vault22/22seven comparison and release parity guide

Updated 22 November 2026. Describes the shared code intended for the original GitHub Pages PWA (main) and the private HTTPS ngrok PWA (feature/ios-safari-launch-2026-11-26). Features from the document-intake development PR are not live on either origin until explicitly deployed and verified.

## Product north star

Build a private, trustworthy financial cockpit that can consolidate user-approved income, spending, debts, savings and dated market references; explain trade-offs, detect gaps, and provide an evidence-grounded, reviewable 30/60/90-day path forward. The owner explicitly approves changes; the assistant never invents bank verification, account balances, or loan decisions.

## Vault22 / 22seven reference and gaps

The earlier comparison identified the established 22seven-style experience as stronger in **live account aggregation, holistic income/expense monitoring, categorization, debt and investment oversight, reconciliation and operational maturity**. Market Compass's current differentiator is privacy-first local encryption, optional private Ollama inference on HYPRBOX, transparent source freshness, and read-only Agent traces. Do not describe Market Compass as functionally equivalent to connected 22seven until independent provider-authorized feeds and full reconciliation are proven. No use of their logos or copying their proprietary design assets.

User expectation: real imported documents become **reviewable structured data**, not inert file badges; the user can move approved transactions into the Spend ledger, then see accurately dated totals and an explainable financial guideline. The development importer supports multiple selected files and **bounded, redacted excerpts** (up to 300 retained recognised lines per document and 100 saved summaries). A PDF has a 64 MiB local memory-safety ceiling, extracted text is bounded, and the PDF page loop has no fixed page-count cap. This is not unlimited complete bank-statement extraction or automatic opening/closing-balance reconciliation. Standard Bank-style five-column layouts have a dedicated parser, but other multi-column layouts and scanned image PDFs still need source verification or a separate trusted local OCR/extraction component.

## Mobile-first visual system (both PWAs)

- Keep the shared React, Tailwind and accessible primitives; use Ionic-inspired native-style spacing and progressive disclosure, **not** an untested framework rewrite.
- Preserve desktop navigation. On iPhone, favor persistent familiar tabs, legible headers, minimum ~44px targets, safe-area breathing room, top-level summary cards, short explanations, and secondary details collapsed.
- Spend becomes three focused sections: **Documents** (import/review/approve), **Activity** (dated salary-cycle entries), and **Plan** (evidence coverage, missing facts and provisional 30/60/90-day steps). Avoid stacking every import form, ledger, advisor and legal note in one page.
- Each transaction maintains currency, date, amount, direction/category, source provenance, and review state. Show recorded-vs-verified and historical-vs-live differences near figures.
- Design for iPhone 11 width and VoiceOver. Keep text readable, form input >=16px for iOS zoom prevention, and avoid using only color for statuses.
- Important source-state and safety information must remain discoverable, even when secondary panels are collapsed.

## Source-to-plan data contract

1. **Consented local import**: The user explicitly selects one or several CSV/TXT/transaction JSON/selectable-text PDFs via Files. A password-protected PDF can request a one-time password after detection, and the temporary input is cleared after use. Never save passwords or original PDF bytes to the encrypted vault or upload to HYPRBOX/GitHub. Safari cannot silently scan the entire iPhone, its mailboxes or files while closed. Desktop Chromium can request an explicit selected-folder read grant; session-only inventory checks are bounded and require a separate owner decision to import a file.
2. **Extract and review**: show detected category, account label, source rows, amounts, dates, masked identifiers and warnings. Imported payslip gross/net pay, PAYE, receipt totals and statement debit rows are historical evidence, not verified cashflow. PDF text order may be inaccurate. Owners review each selected file and approve or skip it. Exact, non-truncated duplicate summaries are blocked; truncated sources and partially overlapping months still require manual reconciliation.
3. **Owner-confirmed Spend posting**: a saved excerpt does not automatically affect totals. Each selected source line requires explicit date, classification and category, and a final confirmation. Use stable source-line IDs to refuse duplicate retries. The action updates only this device's encrypted expense ledger; it does not change current bank balance or lender principal.
4. **Dated ledger**: salary cycle is 26th–25th. Trends and income-expense calculations reflect approved entries in the selected cycle, **not** a synchronized bank feed. Do not confuse a missing entry with R0.
5. **Local guideline**: 30/60/90-day suggested steps use owner-confirmed entered fields. Unknown or unverified fields remain visibly incomplete. No autonomous execution.
6. **Ollama / Agent handoff**: private HYPRBOX bridge receives only owner-approved bounded context when explicitly enabled. A manually reviewed <=500-character planning brief can be copied into the read-only Agent. The iPhone vault is NOT auto-synced to HYPRBOX; do not claim the Agent has read original PDFs.

## Product/security parity policy

Both PWAs share the same React finance/document workflow, local financial safety controls, voice UI, and market components. **Only connection transport is intentionally separate**:
- Private ngrok edition: protected same-origin gateway and bearer token, HYPRBOX local bridge, edge verification, site-specific vault.
- Original GitHub Pages edition: public static files and **strict Tailscale *.ts.net private AI origin**. Never bundle the ngrok edge proof, server secrets, or privileged loopback routes. Original's Tailscale connection is an explicit deferred acceptance gate.
- Browser vaults on the two origins are independent. Move data only through owner-initiated encrypted backup/export and restore. Never merge, reset, or silently migrate device vaults.

Crypto price panels display provider, timestamp, ZAR/USD and limitations. The development branch removes a hardcoded 90-second manual-refresh lockout but still coalesces in-flight requests, polls automatically at five-minute intervals, and respects external provider 429/rate limits. Market quotes are NOT balances, holdings, executable trade prices or authenticated JSE feeds.

## Mandatory release acceptance

- Green typechecks, production builds, CI, synthetic bank-statement and PDF-password tests, import queue/duplicate/cancellation tests, iPhone shell and offline cache tests. A passing desktop or CI suite cannot substitute for actual iPhone Safari acceptance.
- For every financial document: manual confirmation of source rows, total and direction **before** relying on calculated figures. Wrong, truncated or missing entries block reconciliation; do not silently sum incomplete documents.
- Verify iPhone multi-select -> individual password/review/skip -> workspace acknowledgment -> confirmed encrypted vault auto-save/backup -> approved Spend entry -> current/historical salary cycle selection -> updated local summary -> 30/60/90-day guide -> owner-reviewed Agent brief on both PWAs. Historical source-only figures remain separate from posted Spend totals.
- Preserve previous deployed assets, protected gateway and the encrypted vault; never clear Safari storage or restart HYPRBOX without explicit safe release control.
- Check actual iPhone HTTPS behavior after each deployment. CI passing does not mean a user's iPhone downloaded the updated service-worker cache.
- Do not declare launch-ready while owner-reported source totals are mismatched or the agent misstates financial freshness.

## Deferred scope

Real bank/credit-card aggregation, external email/OAuth grants, iOS background file scanning, robust cross-source bank-statement reconciliation, unbounded streaming PDF extraction and OCR, cross-origin vault sync, Tailscale live original PWA, and automated trading/payment execution are **not** implemented or authorized by this document. See `docs/CONSENTED-DOCUMENT-INTAKE-20261122.md` and `docs/IMPORT-HARDENING-ACCEPTANCE-20261122.md` for the current permissions and acceptance matrix.
