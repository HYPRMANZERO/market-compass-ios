# Market Compass desktop/mobile financial overview parity — 2026-11-23

The mobile Home card and desktop Home card use the same FinancialSpaceHero component. Both receive the unlocked local workspace's currency, account count and sum of account balances. No amounts are hardcoded or copied between browsers or PWA origins. If no accounts exist, the card asks the owner to add an account instead of presenting a fabricated zero balance.

On mobile, the hero's View accounts button opens the existing account actions dialog. On desktop, it navigates to /debt, the account editor. Desktop sidebar and top header each include a Menu trigger, wired to the existing scroll-safe quick-action portal; no new /menu route or account/database mutation was added.

The original Pages PWA also uses the same four mobile tabs (Home, Markets, AI, Menu). Debt, Spend, Drafts, bank documents and Vault & backup remain available via the shared Menu, while the desktop sidebar retains direct links to those pages.

**Security/data:** These are UI-only changes. Distinct browser origins retain distinct encrypted vaults. No user records, backups or private credentials were read, migrated or uploaded. The authenticated private desktop Qwen 3.5 4B and gateway isolation remain unchanged. The GitHub Pages edition remains a static PWA; it does not bundle Ollama or the desktop token.

**Verification:** Typecheck, full Node tests, production Vite build, offline service worker and isolated Chromium browser release gates with synthetic account data. Browser test explicitly checks that phone/desktop hero values agree, both desktop menu buttons work, View accounts navigates to the debt editor, and return to phone layout remains usable. The automated browser is not physical iPhone Safari; request an owner spot-check before calling the UX release fully accepted.

**Rollback:** Private ngrok static site has a timestamped pre-promotion copy under artifacts/market-compass/dist/. GitHub Pages can be reverted to the prior main commit if a regression appears. Never reset an encrypted IndexedDB vault as part of UI rollback.

**Next launch gates:** Actual iPhone and laptop acceptance; financial document parsing/OCR for scanned PDFs; consented bank-data-provider integration; accurate merchant categorization with explicit review; source timestamps and unavailable-data handling for market guidance. Do not claim these providers or OCR are live until tested.
