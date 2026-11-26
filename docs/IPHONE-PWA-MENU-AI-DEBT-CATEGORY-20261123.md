# iPhone PWA test release — 23 November 2026

## Source and acceptance
- Source branch: feature/consented-batch-documents-and-crypto-refresh-20261122.
- Released **only** to HYPRBOX's authenticated ngrok same-origin PWA; no change to the original GitHub Pages main PWA or either browser vault.
- Deployment candidate: `artifacts/market-compass/dist/candidate-20261123-iphone-menu-ai-debt-sort`.
- Static rollback snapshot: `artifacts/market-compass/dist/public-before-finance-ux-20261123-154825`.
- Automated tests: 240/240 passing; TypeScript passed; candidate Vite production build passed.
- Offline shell: 36 public assets in precache including verified Absa circular brand SVG.
- Synthetic Edge/Chromium browser gate: passed iPhone-size menu, login, scroll, document, PDF password, vault and isolated-origin restore checks. Measured menu 444.5px high, bottom anchored, zero excess scrolling at 390px-wide viewport.
- Live gateway verification: current index, service worker and Absa asset SHA-256 match candidate; ngrok and Ollama are still running; direct unauthorized loopback request with expected host returns HTTP 403. Real iPhone Safari manual test remains necessary.

## Implemented
- Replaced blank/hidden Ionic quick-action breakpoint menu with a body portal, screen-safe backdrop, content-height panel and scroll lock.
- Debt tab of Spend Activity now presents the same saved debt-account balance total and account breakdown as Home, explicitly **not** claiming these are recorded repayment transactions or live bank balances.
- AI page has a compact Ollama health indicator, larger independently scrollable conversation, and horizontally swipeable collapsed tools for voice, memory, financial sources, suggested questions and protected desktop connection.
- Absa bank tile uses the circular current logo SVG, cached offline. Other bank cards unchanged.
- Added owner-reviewed **Re-sort saved transactions** in Spend Activity: deterministic suggestions from existing saved descriptions, individually selectable and approved as one batch; no refetch, no re-upload, no new duplicate transactions, and no date/amount/ID rewrites. Ambiguous debits remain unchanged.

## Existing document intake and limits
- Existing local PDF (selectable text), CSV, JSON and TXT parser retains source dates, reporting periods, debt reference balances, direction and review approval. Source dates are used directly; no owner date re-entry for valid dated transactions. Approved document rows map to stable ledger IDs and are deduplicated.
- The vault persists **bounded, masked excerpts**, not full original document bytes. The new re-sort works on previously saved/approved transaction descriptions without re-upload. Re-extracting source text absent from those excerpts still requires re-selecting the original file; scanned/image-only PDFs without selectable text are not OCR processed.
- Missing bank sync, bank-verified balances and historical unrecorded repayments are not filled by inference. No external transaction, bank connection or order execution is added.

## iPhone follow-up
Open the existing ngrok PWA shortcut after normal refresh; verify Menu, AI header/chat/tools, Spend > Activity > Debt and Re-sort saved transactions. Keep the existing encrypted vault and backup. Do **not** clear Safari data or reinstall to force updates.
