# Market Compass — import hardening & release acceptance

Updated: 2026-11-22. Isolated branch: `feature/import-hardening-isolated-20261122`.
Base: `feature/consented-batch-documents-and-crypto-refresh-20261122` (PR #52).

## Scope completed in this hardening branch

1. **Duplicate suppression without raw document storage.** The encrypted summary store checks equal recognised category, provider, format, semantic roles, dated amount rows and masked labels before accepting a second identical, non-truncated source. Different pay dates are distinct. Truncated exports are not blocked on matching excerpts because their unseen pages/rows could differ. No raw file bytes, paths, bank credentials or unsalted hashes are stored for deduplication.
2. **Legacy imported evidence.** The monthly historical preview excludes exact repeated, non-truncated saved summaries and discloses how many were omitted. This does not establish that partly overlapping monthly bank statements, duplicate receipt items and payslip/bank credits are reconciled. Those figures remain separately labelled as historical, unverified document evidence.
3. **Sequential import reliability.** The review flow checks duplicate/capacity constraints before requesting a save, holds the current preview until the parent unlocked workspace acknowledges its record ID, and prohibits skipping/cancelling/reselecting while a save is pending. The save confirmation **does not** mean an encrypted disk flush or backup has happened; owners must confirm Last saved and export a backup.
4. **Selected-folder read permissions.** Scanning remains desktop-only and explicit. A scan can be aborted when the selected folder changes, monitoring stops, or the import page unmounts. Candidate collection is capped at 120 while the app is open, separate from the existing max 3000 inventory entries; when truncated the user must choose a narrower folder. No file bytes are read until the owner selects a candidate to review. Browser permission revocation must still be managed via the browser's site settings.
5. **Password handling.** The existing PDF.js one-time password remains a transient input, cleared after reading. Unmount aborts in-flight reads and clears queued File object references where possible. The browser does not promise instant zeroization of immutable strings.

## Must verify on actual devices before any release

- Back up each existing PWA vault using Vault & Settings, confirm its export, and keep the old Safari origin intact. **Never** clear site data or merge origin storage automatically.
- iPhone Safari: select 2–4 fabricated CSV/PDF files. Confirm exactly one preview at a time, correct account category, source dates, amount direction, visible truncation warnings, and Save/Skip/Cancel controls.
- iPhone Safari: select a known synthetic password-protected PDF without a password. Confirm one-time prompt, incorrect-password retry, successful password entry and password field cleared. The original file and password must never reach HYPRBOX or a third-party service.
- iPhone Safari: save a document, then attempt an identical renamed export. It must disclose a duplicate and leave previously saved excerpts intact; selecting a distinct month must still work.
- iPhone Safari: during an in-flight save, verify that new file selection and cancel/skip cannot replace the pending preview. After the record appears, confirm vault Last saved, lock/unlock and encrypted backup/restore on a separate test origin.
- Desktop Chromium: grant read access to a deliberately small test folder with mixed eligible/non-eligible files. Check discovery without file-content reads, abort by stopping monitoring, expiry handling and rescans when the tab regains focus. A large folder should report a truncated inventory, not claim a complete scan.
- Both PWAs: run imported document -> reviewed dated Spend line -> salary-cycle history -> Home evidence -> Debt Plan candidate review. Distinguish missing/unknown values from zero and source statements from verified live bank data.
- Markets: manually refresh quotes twice; the obsolete fixed 90-second toast must be absent. Provider 429 and authentic timestamps remain handled honestly.
- Confirm online/offline routing and Ollama inference stay under the pre-existing private HYPRBOX authenticated gateway; no direct Internet-exposed Ollama and no implicit financial-file upload.

## Not yet implemented

iOS persistent background file scanning, email OAuth and permissions, official bank/aggregator read-only feeds, OCR for image/scanned PDF, Word/Excel extraction, full-document streaming without memory ceilings, automatic cross-source reconciliation, and actual iPhone acceptance evidence. No live production deployment is authorised by this document.

## CI / code checks

Run `node --test tests/*.test.mjs`, `tsc --noEmit` and `vite build` in the iOS PWA workspace. The new `tests/import-hardening.test.mjs` covers exact repeat imports, differing dated pay, truncated-source caution, same-amount different providers, bounded scans and cancellation. It uses invented values only.
