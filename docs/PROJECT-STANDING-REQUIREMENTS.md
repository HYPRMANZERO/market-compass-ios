# Market Compass standing requirements: Financial Pulse, Compass AI and P0–P3 priorities

**Approved 2026-11-25. Permanent requirements for new project chats.** This file is a specification, NOT a release-status assertion. The shared planning page is [Market Compass Engineering Guidebook](https://chatgpt.com/space/page_6b013cdccf7c81919d71b2b230725d1a). Private deployment/architecture details live in the private repository's `docs/MARKET-COMPASS-GUIDEBOOK.md`.

## Editions (invariant)

- **Compass Personal:** the original installable PWA, an everyday assistant **and all finance features**.
- **Compass Financial Advisor:** protected/ngrok PWA, finance-specific assistant tools only.
- The editions share private Compass inference, but the protected gateway and tools must enforce the profile split, not just frontend feature flags. Shared non-restricted features must behave identically.

## Requirement 2: Compass Financial Pulse

**Outcome:** show a daily, provenance-backed picture of salary-cycle money and the next action worth taking.

- Preserve the 26th-to-25th salary cycle, ZAR default and correct Gregorian boundaries; provide user-configurable currency/cycle in future expansion.
- Use only **approved** ledger entries, known due dates and verified, dated balance evidence. Record facts without guessing imported classifications.
- Clearly distinguish posted income, posted expenses, debt payments and transfers. **A recorded difference is never itself a verified balance or spendable cash.**
- Due obligations need an approved amount, source, due date and settled/pending state. Never subtract a settled payment twice from a balance already reflecting it.
- The safe-to-spend estimate requires **fresh verified balance, complete approved commitment coverage, explicit safety buffer and valid unambiguous records**. Otherwise return **unknown/null** with explanatory warnings, not R0 or an invented total.
- Present evidence/quality states: confirmed, unverified, stale and missing. Show as-of date, salary cycle and originating record identifiers; do not use unapproved document excerpts as transactions.
- Allow review and owner corrections through existing approval flow. Preserve offline, read-only last-known snapshots with timestamps. No payments, investment execution, silent document posting or storage mutation.
- Acceptance: integer-cent arithmetic, boundary/leap date, missing/future/stale balance, duplicate, overdue and ambiguity tests; physical iPhone acceptance for the eventual UI.

**Implementation status at first addition:** pure read-only `financialPulseForecast.ts` calculation module plus synthetic tests in an isolated branch. UI and live inference integration are **not yet implemented**.

## Requirement 3: Compass AI trustworthy evidence architecture

- Answer-generation remains on authorized HYPRBOX local inference; external tools can supply read-only facts, never an undisclosed remote model answering instead.
- Ground financial claims in dated, approved ledger transactions/documents with source and as-of references. Say when information is missing rather than guessing.
- Move calculations (cash flow, budgets, debt projections and affordability) into deterministic, independently testable functions. Let the model explain calculations, not invent them.
- Use separate opt-in memory scopes for personal vs finance records, mask sensitive data, avoid copying passwords/tokens into prompts.
- Agent actions are read-only by default. Owner must preview and explicitly approve any writes to financial records, documents, orders, settings or permissions. Support idempotency, rollback/recovery and an audit trail.
- Evaluate factual grounding, parser dates, sign classification, uncertainty, permission boundaries, error recovery and failure modes with synthetic data before rollout.
- Be precise about model provenance and licenses: local independent operation does not imply training original model weights.

## Requirement 4: Engineering priorities

**P0: non-negotiable reliability and financial integrity.** Repair iPhone keyboard/scroll/viewport issues; offline shell; encryption/export/restore; import review and duplicate/date detection; accurate totals; protected backend and deployment checks. No automatic ledger writes, destructive storage resets or silent service changes.

**P1: differentiated product value.** Financial Pulse; source-grounded Compass explanations; verified calculations; recurring-spend detection; proactive payday guidance; latency/render-performance improvements and streaming.

**P2: permissioned integrations.** Official consent-based read-only Standard Bank connection first (subject to provider approval), optional Personal device discovery, multi-document scanning under user-granted access, onboarding and sync.

**P3: defer.** Unproven large-model upgrades, autonomous trading and new product surface area before reliability and retention.

### Release and performance gates

1. Validate local typed build, full Node tests, synthetic browser gate (three repetitions where required), source-data invariants and protected offline worker.
2. Stage on protected **Financial Advisor** edition first, preserving old static build; prove gateway protection and finance-only profile.
3. Promote identical shared code to **Personal** only after acceptance and verify the **actual live GitHub Pages assets**; test the installed iPhone PWA separately. Never claim hardware verification from synthetic tests.
4. Track error-free sessions, record integrity (zero unexpected writes), import-review precision, time to first AI token, smooth scrolling, 4-week retention and backup-restoration success.
5. Keep source and package caches on **D:**, retain C: compatibility links only as needed, and do not move encrypted user vaults casually.

## Approved implementation sequence

1. Verify migration and PWA/AI continuity.
2. Implement/test read-only Financial Pulse facts and provenance quality.
3. Integrate a responsive Pulse home card fed by **approved** records, with missing-balance state obvious.
4. Expose the deterministic summary as a read-only private Compass AI tool with evidence references.
5. Expand authorized recurring detection, bank feeds and opt-in personal/device services after P0 gates.

**For every future chat:** read this file and the current private guidebook, distinguish planned/staged/live, preserve edition split and encrypted data, then choose the highest-priority incomplete acceptance criterion.