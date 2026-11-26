# Market Compass — owner premium and public-release data boundary

Updated: 2026-11-23. Owner product instruction. This document governs future work and release acceptance; it does not authorize deleting data or deploying a new build.

## Editions and ownership
- **Original GitHub Pages PWA** (`https://hyprmanzero.github.io/market-compass-ios/`): owner's **personal premium edition**. Preserve its existing encrypted vault, historic approved records, premium capabilities, settings, offline support and export/restore. Do not overwrite its vault from the test edition or migrate/reset it without the owner's explicit request and verified backup.
- **HYPRBOX authenticated ngrok PWA**: current **testing edition and basis of the future public product**. During development it may contain the owner's consented test data, but no user data is part of the distributable app. The future public release must give *each person* a clean, independent vault and their own document/transaction review lifecycle. An ngrok testing origin is not itself proof of public launch readiness.
- Keep shared UI, parser, approved ledger and security improvements aligned, with deliberately separate edition configuration, entitlements and transport. Test against the actual origin and edition label; do not mistake apparent feature parity for vault-data parity.

## Data and balance semantics
- The GitHub Pages and ngrok origins have separate encrypted browser storage and may legitimately show different entered debts, statement evidence and Spend ledgers. A zero displayed on one origin **does not** prove a zero debt; distinguish `Not recorded` / `No approved data` from an entered monetary zero.
- Never silently cross-origin synchronize, copy, merge, reset or delete owner records. If owner requests matching historical data, offer **owner-initiated encrypted export/import** with destination preview, source provenance, duplicate detection, explicit consent and verified post-import totals. Preserve a rollback backup.
- Categorization of imported statement lines (e.g. rent, petrol, fees, debit orders) is a **proposed classification** with traceable evidence and confidence; amount/date/direction must come from the document, not inferred from a category. Ambiguous debits remain reviewable and unposted until confirmed. Reclassification must not fabricate new transactions or modify lender balances.
- Menu and account interactions must work on iPhone Safari/PWA, including Ionic modal visibility and scrolling; do not rely only on desktop visual tests.

## Public product first-run contract
1. Install/open the public edition with a **new origin/profile**: zero inherited owner accounts, documents, debts, transactions, logs, auth tokens, encryption keys or settings. Display empty/not-recorded states, not seeded real balances.
2. New user creates/unlocks **their own encrypted vault**; all uploaded documents are selected deliberately by that user and processed under their own consent. Preview extracted account, period, dates, signed amounts, references and classification proposals; user approves recording, without re-entering dates already reliably extracted. Flag unresolved dates instead of inventing them.
3. Post only records explicitly approved by that user. Retain source provenance and deduplication. Support encrypted export/recovery and meaningful failure states.
4. If any backend stores per-user information, enforce **authenticated tenant/user isolation server-side**, with row- and object-level authorization, separate encryption context and tests proving no cross-account access. Frontend edition flags alone are not security controls.
5. Never embed owner/test documents, derived excerpts, balances, cached API responses, screenshots, private ngrok gateway tokens, Tailscale keys, privileged endpoints, or Ollama credentials in public bundles, service-worker caches, sample fixtures, demo payloads or runtime configuration. Use invented synthetic test data only. Existing private HYPRBOX Ollama stays private; public AI access needs its own separately approved secure architecture.
6. Do not clear the owner's current test vault as a side effect of building the public release. Before any public launch, inventory and explicitly scrub owner-derived records from deployment artifacts, backend test stores, logs, caches, demo seeds, backups and staging data according to a reviewed removal plan. Fresh-user empty-state verification is mandatory.
7. Public release requires a separate launch/security checklist, accessibility and mobile Safari acceptance, data-isolation tests, safe rollback, and clear privacy/disclosure terms. No live banking connection should be implied unless an authorized provider integration is actually operating.

## Current blockers and explicit non-goals
- Distinct balances between PWAs need source-by-source reconciliation; **not** forced equality.
- The iPhone menu popup and statement categorization require tested corrections, not cosmetic labels.
- The current owner ngrok testing vault is not a public-user seed. No deletion, bulk transfer, cross-origin sync, plan switch, or public launch is authorized by this document.
