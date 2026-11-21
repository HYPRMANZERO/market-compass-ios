# Market Compass financial source contract and two-edition release policy

**Status:** Implemented as a review-only parsing contract in the November 2026 release candidates. Real bank OAuth/API integrations and App Store distribution have **not** been implemented by this document.

## Edition roles

- **Original owner PWA:** `main` → GitHub Pages at `https://hyprmanzero.github.io/market-compass-ios/`. This is an owner-use **installation**, not a privately hosted website; static files are publicly accessible. The unlocked financial workspace and encrypted vault reside on the owner's device, not in public source code. New changes must be validated and backed up before promotion.
- **Commercial/public-release testing PWA:** `feature/ios-safari-launch-2026-11-26` → owner-authenticated HYPRBOX/ngrok staging route, with a distinct device/browser vault. This is a testing channel, **not yet an App Store or publicly available commercial release**. No production user credentials or real-account data belong in synthetic public tests.
- Different Safari/Home Screen origins and storage containers are **not synchronized automatically**. Never clear either storage origin or replace a vault to make the interfaces look aligned. Vault migration requires explicit, verified encrypted backup and restore.

## Shared financial-source rules

The following modules must be **identical** in owner and staging editions, enforced by owner PR CI:

`vehicleFinance.ts`, `documentIntelligence.ts`, `bankStatementParser.ts`, `standardBankPdfLayout.ts`, `financialSourceNormalizer.ts`, `localFinanceDocs.ts`, `localPdfText.ts`, `reviewedDocumentLedger.ts`.

1. PDF selectable text, CSV, TXT and supported transaction JSON are *source adapters*; later official **read-only** bank API responses may be a different adapter with the same normalization and validation output.
2. For every accepted transaction retain source date (not import date), signed transaction amount, bank/institution, masked account label, description, source type, currency, origin status and **pending owner approval**. Running balance is a separate historical observation, **not a second transaction**.
3. Separate source balance, settlement quotation, original amount financed, instalment schedule, interest-rate quotation and net-pay reference from **completed, dated transactions**. Never use a loan quote or running balance to generate a repayment or imply verified cash.
4. If dates/column meanings are ambiguous, reject or mark rows as unresolved; do not guess amounts, debit versus credit, missing months, duplicates, bank verification or current balances. Source sign conventions are provider-specific. Deduplication hints do not imply two equal fees are duplicate payments.
5. Mask account numbers, South African ID numbers, email addresses, phone numbers and identifiers in retained excerpts. This is a defence-in-depth rule and must be tested with synthetic examples; client-side regex masking is **not a comprehensive data-loss-prevention guarantee**. Full source PDFs and temporary PDF passwords remain local and are not saved by the current importer.
6. Document-derived historical evidence may update the **evidence dashboard** after review/save, but only an explicit, individually approved transaction may update the **Spend ledger and salary-cycle totals**. An owner-confirmed **current account** entry in Debt Plan must be distinguished from an older statement figure.
7. All AI-generated reasoning in the private Assistant must use the authenticated HYPRBOX Ollama path. Deterministic local parsing is not itself AI; no other model should silently take over financial document interpretation. Optional Ollama enrichment would require an explicit, data-minimising consent flow and separate validation.
8. This phase has a **64 MiB per-PDF browser-memory safeguard** and bounded encrypted excerpt retention; it removes the former fixed 12-page limit, **not all device or storage limits**. Scanned/image-only PDFs require a future offline OCR workflow.

## Future official bank integration

Do not put bank client secrets, OAuth tokens or refresh tokens into public GitHub Pages assets. Integrate each financial institution only using official permitted authentication and read-only scopes, through an authorised secure backend or supported on-device flow. Providers must expose provenance, permission scopes, observed timestamps, explicit currency, transaction posting status and masked account handles. Revoke access without affecting saved reviewed history. No payment, trade or transfer execution is implied.

The `financialSourceNormalizer.ts` contract already accepts externally supplied, explicitly read-only candidate rows; **it does not retrieve, authorise or synchronize bank feeds**.

## Release promotion and acceptance

- Test PDF imports (including dated two-digit-year PayShap fees and five-column Standard Bank exports), CSV, statement balances, and loan contracts with **synthetic** fixtures.
- Test source-date correctness, signed debits, deposits, running-balance separation, repeated fees, masking, duplicate review and original PDF preservation.
- Require both Linux and Windows build/TypeScript checks and the core-source parity check.
- Export and verify an encrypted backup **from the original owner's installation** before merging to `main`, because `main` automatically deploys GitHub Pages.
- After owner staging validation, promote only the tested core and relevant owner-safe UI, not private gateway secrets or unreleased experimental public tests.
- Manual iPhone acceptance verifies that imported evidence appears in the same origin's unlocked vault, while unapproved statement rows never inflate financial totals.
