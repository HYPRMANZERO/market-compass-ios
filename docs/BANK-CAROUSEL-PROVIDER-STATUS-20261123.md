# Market Compass: Bank carousel and safe connection states (23 November 2026)

## Navigation and UX
- Mobile footer contains exactly **Home, Markets, AI, Menu**. Debt planning, Spend history, Drafts, Add account, document import, and vault/backup are accessed through Menu; routes and data remain intact.
- Ionic Menu must expose visible, scrollable action tiles, not just an open backdrop.
- The **Choose your bank** carousel appears on Home and on `/banks`, reachable through Menu. It is horizontally swipeable with bank icons, accessible names, selection state, and a selected-provider options panel.
- Bank selection is a **local UI choice**, not an authenticated account connection. Import statement opens the existing document importer. The app must not claim that a balance is live or that a statement is bank-verified.
- `Add debt record manually` creates only the existing debt-planning record; it must not be represented as a checking/savings account link.

## Bank directory (South Africa)
Standard Bank, Absa, FNB, Nedbank, Capitec, Discovery Bank, GoTyme Bank, Bank Zero, Mukuru, African Bank and Investec.

- **GoTyme Bank** is the current brand formerly known as TymeBank (official bank news: https://gotyme.co.za/personal/media/newsroom-landing/tymebank-becomes-gotyme-bank; government name-change notice: https://www.gov.za/documents/notices/banks-act-change-name-tyme-bank-limited-gotyme-bank-limited-27-feb-2026).
- **Mukuru Account & Card** is displayed as Mukuru, with a separate explanation of its Bank Zero–Mukuru relationship; it is *not* silently merged with the Bank Zero choice (https://www.mukuru.com/sa/services/mukuru-account-card/).
- Local licensed bank listings should be cross-checked with the SARB / Banking Association of South Africa before adding or removing institutions: https://www.resbank.co.za/en/home/what-we-do/Deposit-insurance/member-banks0 and https://banking.org.za/about-us/member-banks/.
- Brand icons were captured as local site-favicon assets for an offline PWA. These are identification graphics, not claims of provider partnership or approved official wordmarks. Review current official logo files and applicable brand guidelines before a general-public launch.

## Integration state and release controls
- **All displayed providers: selection and statement import only.** No live read-only bank feed, consent token, direct debit, payments, bank API session, or credential capture has been implemented by this change.
- Future direct connections require documented provider support, a consented authorization path, bank/provider-specific security controls, expiry/revocation, and positive proof of a successful connection. Do not collect online-banking passwords.
- Documents still require user approval before any extracted financial row becomes a trusted financial record. Selecting a carousel card does not approve, edit, or duplicate records.
- Original GitHub Pages PWA is **owner premium**; HYPRBOX/ngrok is the separate **test/public-candidate** environment. No automatic cross-origin vault synchronization, no personal test data or management credentials in distributable public builds.
- This UI release remains on a development branch until production compilation, automated regression tests, synthetic mobile browser acceptance, real iPhone Safari/PWA scrolling/overlay checks, and release review are complete.

## Verification
- 23 Nov 2026: app TypeScript check passed after building shared libraries; production Vite build passed; 229 Node regression tests passed; synthetic Chromium browser release gate passed with the four-tab bar, visibly rendered menu tiles, horizontally scrollable carousel and bank selection. These checks are **not** proof of iPhone Safari rendering or live bank integration.
