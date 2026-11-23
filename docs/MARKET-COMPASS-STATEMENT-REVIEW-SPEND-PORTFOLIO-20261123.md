# Market Compass · Document review, issuer identification and Spend portfolio
Updated: 23 November 2026

## User-reported evidence and requirement
On iPhone, a historical bank statement with 300 extracted lines showed source dates spanning 20 April–26 June 2026 and historical spending totals in 26th–25th salary cycles, but no corresponding Spend activity. The importer identified the issuer/account incorrectly as “ABSA account.” The full-height document modal placed Close near the blurred status/header region. Keep the banking-style account action popup and account cards. Add an EasyEquities-style, category-drilldown view of purchases in Spend. Preserve separate private gateway and GitHub Pages vaults and verify each PWA three times.

## Implemented
- Document modal: centered over the PWA, max 78dvh on mobile (82dvh on wider screens); header stays with the close control; long document content scrolls inside the modal.
- Parsing: classify the issuer from document heading/identity text only, excluding filenames, owner-supplied labels and bank names in transaction/beneficiary lines. Detect explicit cheque/current/savings/other account type when present; mark unrecognized issuer as unknown rather than inventing a bank.
- Before approval: editable document title, issuer and account-type controls. Existing saved document records have an Edit identity control; edits preserve source ID and posted transaction linkage and do not change dates/amounts.
- One explicit review approval both saves the bounded encrypted document evidence and records safely recognized source-dated, direction-labelled transactions. It preserves individual source transaction dates, category suggestions, and distinct imported-line IDs, preventing re-posting of the same line.
- Old saved statements: a per-document shortcut offers to approve eligible dated rows without re-uploading or entering dates manually. Undated rows, ambiguous credits, contract terms, balances and rates are not posted; statement period never invents payment dates.
- Spend Activity: category-based purchase portfolio, expandable category transactions, source/account filter and salary-cycle filter, recorded spending/income/debt totals. Internal transfers are excluded; source figures are not treated as bank-verified balances. Prior account menu and other sections remain available.
- Evidence review inbox copy distinguishes approved rows from unreviewed historical excerpts.

## Privacy and reliability boundaries
- The original Safari PWA and the public GitHub Pages PWA each have a separate local encrypted browser vault. No cross-origin synchronization, reset, overwrite, remote raw-document upload or account balance reconciliation was added.
- Source documents are parsed locally. OCR for image-only scans, unrestricted retained line counts, automatic full-iPhone/email scanning and official read-only bank consent integrations are not delivered by this change.
- Source evidence may be truncated (e.g. 300 retained lines) even if a multipage original PDF is parsed. Display of an extracted aggregate is not confirmation of a complete statement.
- Overlapping statements and manually entered payments still need duplicate review across different document IDs; a stable line ID only prevents re-import from the same saved document.
- The local approval action is a data-recording permission, not authorization to move money or execute orders.

## Verification before promotion
- Private source TypeScript compilation and three complete regression passes: 212 passing tests each run.
- Public source TypeScript compilation and three complete regression passes: 213 passing tests each run.
- Separate optimized production candidates built with the /market-compass-ios/ base path; generated service worker precache and responsive CSS verified.
- Three disposable Chromium iPhone-sized browser checks per candidate covering synthetic document import, vault creation, lock/unlock, encrypted backup/restore, account menu, navigation, and password-protected PDF handling.
- Physical iPhone Safari visibility, Safari file picker behavior on the installed PWAs, and any existing user's encrypted-vault recovery must be verified on each real origin independently; synthetic browser checks do not establish those.
- Any static private-gateway promotion must use the isolated candidate and safe copy script with full static rollback; never build into active gateway pwaDist.
- Public GitHub Pages deployment is controlled by main and pages.yml. This feature branch is substantially ahead of main, so do not fast-forward/merge it wholesale without explicit parity and rollback review.

## Owner validation
1. Export the encrypted vault from each PWA and retain both independent backup files before updating.
2. Open a saved historical statement in Spend > Documents. Correct its title/issuer/type if needed, and approve the eligible source-dated rows once; do not re-upload the same statement merely to reflect Spend.
3. Go to Spend > Activity > Your spending portfolio. Choose the relevant 26th–25th salary cycle and expand a category; confirm purchases by their original statement dates.
4. Verify account menu behavior and reopen import popup in iPhone Safari. Confirm the Close button stays below the blurred top header, and check the distinct vaults are still present.

## Verified private gateway promotion (23 November 2026)
- Private source commit `423a456` pushed to `feature/consented-batch-documents-and-crypto-refresh-20261122`.
- Authenticated HYPRBOX static promotion completed from isolated candidate `MarketCompass/ReleaseCandidates/finance-ux-20261123/private` using `scripts/promote-private-pwa.ps1` with static rollback.
- Previous static bundle SHA-256: `FE6979D57773A9B595BA07662743C21F0A1DB2C7180C03CF23168EB9579CBE72`.
- New index SHA-256 matched candidate: `DC4ADDA00C65F4836EC3725567089C3F56DD8E34FB765C8A9A9A974D41552D07`.
- Saved static rollback: `artifacts/market-compass/dist/public-before-finance-ux-20261123-111735`.
- Protected loopback gateway confirmed HTTP 200 with expected HTML, JavaScript, CSS and PDF worker MIME types after promotion. Public HTTPS ngrok on physical iPhone and native Safari file-picker/vault validation remain outstanding.
- Public GitHub Pages not deployed by this private static promotion; proposed changes tracked in draft PR #70 pending a separate review.


## Historical salary-cycle portfolio navigation (23 November 2026)
- Spend > Activity > Spending portfolio now displays the six most recent approved ZAR salary cycles as tap-to-filter summary bars.
- 26th–25th cycle totals aggregate recorded expenses and debt repayments. Income is shown separately; transfers are not counted as spending.
- Account/source selection restricts the same historical summary data before grouping.
- Extracted but unapproved PDF/CSV evidence never enters this view.
- Regression coverage: `tests/spending-portfolio-history.test.mjs` includes historical cycle dates, distinct transaction types, unsupported currency, invalid dates, and filter behavior.
- Official bank connections, actual bank balances, email ingestion, native iOS packaging, and scanning all device files remain separate consented integrations and are **not** enabled by this portfolio UI.
