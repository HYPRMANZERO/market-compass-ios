# Ionic-first PWA rollout — 23 November 2026

## Delivered
- Both the private authenticated HYPRBOX/ngrok PWA and original GitHub Pages PWA now render an Ionic-first shared React app shell with Ionic app/header/toolbar/footer, quick-action modal, shared cards and Ionic segmented Spend navigation. Existing Wouter routes, account/debt planning, markets, document intake, local AI and encrypted vault models are retained.
- Spend Activity uses compact Ionic summary cards, a segmented transaction filter, and document-review access as its ordinary UI, with category portfolio, salary-cycle history, income allocation and manual ledger below. The old opt-in preview controls are removed from the main Spend page.
- iOS standalone header receives safe-area padding once at its outer header, with toolbar padding reset to avoid double insets; footer is padded for home indicator. Ionic card CSS constrains amounts, headings and chips without clipping.
- Private: original protected static promotion succeeded. Previous static rollback: `artifacts/market-compass/dist/public-before-finance-ux-20261123-131644`. Candidate/live index hashes matched, service-worker placeholder removal and Ionic shell CSS precache verified.
- Public: PR #72 passed all three GitHub workflows, was merged to main as `0f27a02b5637276c1e596eb92c2319f613098fb0`, and Pages Actions build+deploy succeeded in run `45163971554`. Public live assets were checked over HTTPS: main Ionic root, no old Try Ionic toggle text, lazy Spend overview chunk, safe-area stylesheet and prepared service worker.
- Public previous release is preserved in `backup/pages-before-ionic-first-shell-20261123` at commit `efb9999a75c7443aadab94a3c4789bbd797bb853`.
- Private tests: 229/229; public tests: 221/221. Both TypeScript, isolated production Vite builds and synthetic Chromium browser release gates passed.

## Important boundaries
- This is an Ionic UI migration of shared shell and major finance surfaces, **not yet a 100% conversion of every legacy nested component**. Debt planning forms, charts, assistant internals and complex document review retain existing React/Tailwind implementations inside Ionic surfaces pending incremental migration.
- Physical iPhone Safari and Home Screen safe-area validation must still be completed using masked screenshots. Chromium tests cannot verify status-bar overlays or native file-picker behavior.
- Zero account, document or Spend counts on one PWA can mean that PWA origin/home-screen storage has a separate encrypted vault. Static release does not copy or delete another origin's records.
- Do not clear Safari website data or uninstall the old PWA to force updates. Create and verify encrypted JSON backup before any storage migration.
- Protected finance-core PR #70 stays draft; deeper bank-statement issuer review, source-date classification and duplicate handling need finance staging parity, not bypassing gate.
- Official bank integration, email OAuth, native signed APK/IPA and background device-wide scanning are NOT delivered by this UI release.
