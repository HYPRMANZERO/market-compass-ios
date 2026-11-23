# Market Compass — next UI release: reviewed-evidence inbox

**23 November 2026 | Sources: public competitor product documentation and visual references**

## What we learned from comparable finance apps

| Reference | Useful interaction pattern | Safe Market Compass adaptation |
|---|---|---|
| [Vault22 / former 22seven](https://vault22.com/learn/beginner/what-happened-to-22seven/) | Accounts, spending, debt and savings in a single view, with clear linked source status | Keep the existing mobile wallet, expandable accounts and monthly review. **Never** label an imported statement running balance as an authenticated current balance |
| [Monarch Money](https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch) | Review transactions and display financial connection status | Home **Needs review** inbox counts local document excerpts awaiting human review, separately from approved Spend entries; it is not a live institution feed |
| [YNAB](https://support.ynab.com/updates-to-ynab-S1f4aRLeC) | Reconciliation and explicit approval of imported/matched transactions | Preserve the existing Spend checkbox + confirmation to post individual dated rows. A same-amount merchant line may legitimately recur, so matching appearance alone must not collapse rows |
| [Copilot Money](https://help.copilot.money/en/articles/13157382-web-faq) | Efficient transaction lists, filtering, split flows and review markers | Keep small, readable cards and selected review counts, while avoiding unearned automatic categorisation. Split/recurring rules remain a later, separately tested capability |

Reference product features, markets, access and prices may change. Market Compass is not affiliated with those brands and does not copy their protected graphics or UI assets.

## Implemented in the two shared PWA variants

- New **Needs review** Home card and collapsible per-document list built from the device's already unlocked, AES-GCM-backed workspace records. The UI uses no remote fetch, cookie, bank API, tracking, storage migration or plaintext archive.
- Dated saved excerpts are distinguished from owner-approved Spend entries, undated lines, and **nontransaction references** such as account balances, contract instalment terms and loan-rate quotations.
- Per-source progress is based on the stable `doc-<id>-<line>` index used by the existing Spend reviewer, not on amount/date/description equality. Identical actual fees in separate rows remain separate.
- Masked document labels, bounded five-document preview, secure totals, 390px layout, an explicit link to Spend for actual review, and a warning for unconfirmed workspace currency.
- The review count is a count of **potential excerpts**; it is not a count of verified payments or proof of account completeness. A document can have undated or unclassified rows that require checking against the original source.
- Zero-document state is honest: nothing imported, not zero cash or spending. No implicit bank connection, no background scan and no automatic classifications.

## Test evidence

- Five deterministic synthetic tests cover account statement date, approval IDs, nontransaction references, unknown amount, legacy PDFs, a malformed date, legitimate same-looking fees, privacy and no mutation.
- Both PWA test suites, TypeScript and production Vite builds run from distinct private desktop development worktrees, not the private gateway's active PWA directory.
- Private Chromium gate selects two synthetic files, saves one, skips one and verifies the Home inbox displays exactly one source document with unapproved candidate excerpts, without writing the Spend ledger.
- Public Chromium gate checks that a new vault has an empty inbox, a reachable Spend review link, and no 390px horizontal overflow.
- Recheck secure ngrok asset routing and iPhone Safari manually after any static promotion. Retain prior encrypted JSON Files backups for both origins. Browser test is NOT physical iPhone acceptance.

## Recommended next roadmap steps

1. Make the owner-review workflow smarter: optional merchant/category search and clear pending-versus-reviewed per-account transaction history. Never auto-post from documents or bank APIs.
2. Add user-configurable recurring bills with **manual opt-in**, evidence-backed observation labels, salary-cycle view and edit/disable before any reminder.
3. Instrument source-health dates and reversible reconciliation, including exact source references rather than amount-based deduplication.
4. Start a real read-only bank connector only after written provider/sandbox approval and per-account OAuth consent. No bank login forms or payment/write scopes in either PWA.
5. Validate browser backups by a destructive-*test-only* restore on an isolated origin, while preserving each real Safari vault and its File exports.

**Status:** UI and read-only local evidence only. No production bank integration or payment execution.
