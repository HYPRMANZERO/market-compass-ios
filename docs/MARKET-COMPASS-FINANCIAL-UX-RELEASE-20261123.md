# Market Compass financial UX and source-dated approval release — 23 November 2026

## Scope
- Banking-style expandable account cards with masked account labels, manual APR/minimum and up to five explicitly linked, owner-approved transactions per account.
- Mobile quick-menu action sheet: accounts, add account, direct document picker, Spend, markets, read-only orders, Ask Compass, vault backup.
- Spend activity income-allocation ring and category percentages. The ring represents **approved outflows**, while individual category percentages use only **recorded income** from the currently selected salary cycle. Missing income is unknown, not zero. No current bank balance is inferred.
- Manual transaction-to-account linking; no inference that a transaction belongs to an account from its merchant description.
- Consented multi-document review grouped by import month, and recurring outflow observations only after approval across multiple salary cycles.
- CSV debit/credit columns take precedence, and conflicting debit/credit columns are discarded. The original public parser preserves explicit signed generic amount directions; the protected parser remains more conservative about generic bank-specific sign conventions. These differences require separate financial-core reconciliation.
- Source-dated review with DD MMM YY bank date recognition and read-only transaction dates; reporting periods never create payment dates. The protected edition persists explicit reporting period/as-of metadata and locks posted dates at its ledger boundary. The original GitHub Pages edition preserves its approved public financial-core parser and computes date coverage only from already extracted dated lines. Full reporting-header/as-of persistence and backend date-lock parity require a separate reviewed financial-core reconciliation.
- Prepared classification of source-labelled dated debits and explicit income credits, with a single owner approval to record the selected batch. Refunds and unclear source directions remain manual, reference balances cannot be posted.
- Cleaner Ollama prerequisite explanation, separate desktop source inventory notice and manual order-draft readiness status.
- Existing encryption boundaries unchanged: local browser vaults stay origin-scoped, no automatic vault sync, no new AI provider, no trade execution or direct bank feed.

## Automated quality evidence
- TypeScript project typecheck passed.
- 205 tests passed in each of three full Node test runs.
- An isolated release-candidate GitHub Pages build and offline service worker were produced at BASE_PATH=/market-compass-ios/.
- Three actual Chromium mobile-emulation release-gate passes on each release candidate; synthetic vault creation, encrypted document import, local proof of lock/unlock, wrong-password rejection, export fallback and cross-origin synthetic encrypted-vault restore tested.
- Tests use fabricated documents and temporary loopback origins; no customer's original PWA, real encrypted backup, trusted Safari gesture or HYPRBOX gateway credentials are exercised by those release tests.
- CI configuration now runs the full regression suite before static publication and in the Safari launch branch validation workflow.

## Unresolved gates and product limits
- Physical iPhone Safari restore in the **original** PWA and actual Save to Files have not been established. A dashboard showing zero records does not prove an imported encrypted backup was restored to that origin. Never clear website data.
- HYPRBOX assistant and Ollama checks must remain authenticated private gateway-only. No Ollama public binding.
- Official read-only bank consent integrations require a real provider contract, account scopes, revocation/expiry, transaction mapping and duplicate reconciliation; not active in this release. Order drafts are non-executable research notes.
- Files with image-only scanned pages require a separate offline text extractor. Bank statements with missing per-transaction dates must remain unposted, even when their statement period is known.
- The browser gate is synthetic desktop Chromium, not a claim of Safari native acceptance or commercial launch readiness.
- After deployment, validate both origins independently and verify the original vault recovery with the owner's user-driven backup flow.

## Rollback
GitHub Pages: deploy an earlier proven commit through the existing pages.yml workflow.
Private static gateway: preserve a copy of the full previous static tree outside the active public directory before promotion. Publish new hashed assets before index.html and service worker, keep older hashed assets for already open tabs and do not mutate the gateway settings, protected ports, tokens or user browser storage.
