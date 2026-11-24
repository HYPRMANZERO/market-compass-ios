# Compass Personal + Financial Advisor: offline development tranche (24 November 2026)

## Edition ownership and deployment
- Original GitHub Pages PWA: VITE_MC_EDITION=personal, full finance workspace and general assistant. No token, private URL or model in public assets.
- Protected finance PWA: VITE_MC_EDITION=finance into separate staging directory, then guarded private promotion when HYPRBOX is on. Its Vite branding plugin changes title and manifest, but server checks enforce finance scope regardless.
- A hostname fallback remains for previously installed ngrok copies. It is visual only and cannot grant permissions.

## Personal tools available offline
Daily work-plan drafts, message drafting and explicit copy, .ics calendar export (manual import), user-selected document import, and prompts for research/coding via the authenticated private model. The tools never send email, add live calendar entries, scan files or automatically execute OS actions. Draft previews exist only in the current page session. Personal tasks and optional due dates are stored in the existing password-encrypted browser vault, without a separate plaintext task cache. Task due dates are labels, not automatic reminders.

## Integration contract
Calendar, mail, tasks, files and research need separate consent scopes and reviewed provider adapters. Server-side Personal action preparation is non-executable. Never interpret model text as a tool, permission or approval. No payment or trading execution.

## Original iPhone private AI route
GitHub Pages cannot directly access the ngrok Finance gateway. Design a separate owner-authenticated Personal HTTPS gateway with its own hostname, edge identity, distinct high-entropy proof, exact-origin browser policy and a **separate Personal browser token**. The private gateway exchanges that token for its localhost operator token. Do not reuse the Finance proof or backend bearer in the Personal PWA, and never embed any secret in public JavaScript. This route is NOT deployed; Safari OAuth/preflight and physical iPhone testing must be validated on HYPRBOX. Browser encrypted vaults remain separate.

## Release gates
CI runs Node tests, TypeScript and two separate Vite builds. The Personal UI is exercised by a synthetic Windows Edge account/chat/task smoke test, while CI stores a separate Finance release artifact for controlled installation. The Finance artifact is staged for owner-reviewed deployment, never auto-published. Existing held financial-processing PRs remain on review hold.

## Requires HYPRBOX online
Local Qwen inference, private-source reads, authenticated live gateway smoke tests, physical iPhone acceptance, bank OAuth, OS automation and power-cycle recovery remain unverified.