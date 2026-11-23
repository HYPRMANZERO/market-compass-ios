# Market Compass — public Bootstrap release candidate and two-PWA rollout

Updated: 23 November 2026.

## Why two release branches

The original GitHub Pages PWA publishes **only** commits merged to `main` using `.github/workflows/pages.yml`. The separate private HYPRBOX/ngrok edition is served from the preconfigured authenticated gateway and keeps Ollama on loopback. Both share a visual design, but their live origins, vaults, deployment triggers and AI transport are **not interchangeable**.

The private Bootstrap layout is already incorporated in `feature/consented-batch-documents-and-crypto-refresh-20261122` through PRs #57 and #58. Public `main` has meanwhile evolved independently (including additional document and market functionality). This candidate deliberately ports **only the Bootstrap grid/design and the existing public app's layout wiring** onto latest public `main`. Do **not** merge the full private feature branch into public `main` to deliver a visual update.

## Public candidate implementation

- Locally bundled Bootstrap 5.3.9 *grid CSS* and MIT licence, with Tailwind still owning inputs, auth, vault and functional UI. No Bootstrap JavaScript/CDN/network permission changes.
- Wallet-style private summary; owner-reviewed document/Spend counts; Accounts, Documents and Ask Compass shortcuts; account-by-account collapsible cards showing manually entered balance, APR and minimum payment; status text explicitly says not bank connected; historical-only market snapshot; six-tab safe-area navigation.
- Mobile account names are masked using the pre-existing `maskDocumentPII`, without changing encrypted record contents or creating bank authentication.
- Move the existing collapsed Vault & Settings accordion below route content, preserving the top-right shield shortcut. No new `localStorage`, IndexedDB schema migration or vault clearing.
- Preserve all unrelated functionality already on public main. This PR is not an official bank feed, scanned PDF OCR, private Ollama route or cross-origin sync.

## Automated evidence

- Public-only HYPRBOX branch: 171 synthetic Node tests passed, zero failed.
- TypeScript typecheck and Vite production build passed with `BASE_PATH=/market-compass-ios/`.
- Offline service-worker app shell generated; same private/mobile finance CSS classes in build.
- `scripts/bootstrap-ui-smoke.mjs` launches a **separate disposable Edge/Chromium browser profile** on random loopback-only port. It creates a synthetic encrypted workspace, checks a true 390px mobile viewport, computed 3-column Bootstrap grid, six tabs, no horizontal overflow and a manually entered account card with PII-masked name, APR and balance. No owner financial data, gateway credentials, ngrok or live public origin are used.
- `.github/workflows/validate-public-bootstrap.yml` validates pull requests before merge; the existing Pages workflow also tests the Bootstrap shell before automatic publish on `main`.

## Release sequence: NOT completed

1. **Do not publish yet.** Current automated release audit on HYPRBOX returned 17 PASS, 0 BLOCKED, `launchReady=false` and **eight manual acceptance items outstanding**.
2. On the real iPhone, export a **current encrypted vault backup from each separate existing PWA origin**, explicitly Save to Files, verify the downloaded files are nonempty and accessible, and ensure the owner knows both vault passwords. Do not enter passwords in chat or store them in Git.
3. With disposable *test origins* and fabricated data, verify physical iPhone Safari import, wrong/correct PDF password, per-file save/skip, source dates and debit/credit, Vault Last saved, lock/unlock and encrypted export/restore.
4. Only after public acceptance, merge the **UI-only public PR** into `main` (which automatically triggers `pages.yml`). Verify GitHub Pages build, service-worker update, display and existing encrypted workspace on its unchanged URL. Never delete site storage.
5. For the private edition, stage the matching authenticated-subpath PWA bundle separately. Verify no direct/public Ollama, strict gateway/OAuth access, successful protected PDF worker/CSS/JS content types, existing owner login, voice Agent inference and no vault changes. Preserve previous private static directory for rollback.
6. Promote private static files **only after backup-first Safari acceptance**, keeping the existing ngrok HTTPS origin and protected gateway. Verify iPhone Home Screen reload/locked vault, latest account layout, imported documents, and private Ollama on HYPRBOX.
7. If a release check fails, restore the previous **static assets only**. Never roll back IndexedDB by clearing browser storage; retain encrypted backup files and current Safari origins.

## Product roadmap beyond UI

Consent-based official bank integrations, email OAuth access, locally permissioned high-volume document/receipt/OCR scanning, correct source-level reconciliation, unified ledger, source freshness and real-device launch evidence are separate functional workstreams. Do not describe public GitHub Pages as connected to the private ngrok gateway; its approved AI origin is independently restricted.
