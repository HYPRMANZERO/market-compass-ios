# Market Compass: regional saved-transaction review

Implemented for **Compass Personal** and **Compass Financial Advisor** using the same finance code. The owner's encrypted browser vault and region selection are authoritative for the current device; neither edition silently syncs historical data to the other.

## What changed

- Spend > Activity shows an explicit **Scan saved payments** action. The deterministic scan runs over saved and approved ledger entries only. It is offline and needs neither Qwen tokens nor bank connections.
- Each scan counts checked entries, suggested corrections and unresolved entries. The review queue provides **Suggested** and **Needs your decision** tabs, **Previous / Next** pagination (eight entries per page), individually checked suggestions, and page-scoped approval. Manual review is available for every unresolved item with compatible categories.
- The categorizer follows the existing owner-selected country (27 available regions), not the payment currency. The current Debt Plan > Monthly guardrails country selector sets a default planning currency but **never converts any existing amount**. Each saved review row displays its original currency. A global financial-language pack supplements country-specific merchants and translated descriptions for each configured region. Unsupported regions use global terminology only. No classifier can guarantee recognition of every merchant or financial reference; a missed or disputed reference remains unresolved.
- The region-aware category suggestions now cover all three intake paths: previously saved Spend records, manually entered payments and owner-reviewed document excerpts (including prepared source-dated reviews). Supports explicit terminology for bank fees, subscriptions, housing, fuel, groceries, health, insurance, tax, education, childcare, personal loans, vehicle finance, credit-card repayments, own-account transfers, ATM cash withdrawals and more. Adds income-allocation categories including dining, pets, shopping, entertainment, travel and business expenses. Payment-rail identifiers (ACH, Bacs, SEPA, SWIFT, UPI, Pix, PayNow, PayShap) are **not** spending categories.
- Source-period document groups now distinguish real source coverage dates from the date the file was imported. Neither can substitute for a missing transaction date.

## Safety contract

The scan never changes records by itself. Suggestions are local, deterministic explanations and require a user click before the encrypted ledger changes. Exact transaction IDs, dates, recorded timestamps, amounts, currency, notes and source provenance remain unchanged. Movement-kind changes (e.g. payment to debt repayment or transfer) are conspicuously labelled and can change totals **only after explicit approval**. A linked debt record with balance evidence cannot have its kind changed by the categorizer. Already categorized entries are skipped, even if a new heuristic would predict something different; manual edits retain precedence. Refunds, pending/declined operations and ambiguous bank terms are not inferred as successful payments.

## Acceptance checklist

1. Open either PWA; unlock its local encrypted workspace.
2. Check the country under **Debt Plan > Monthly guardrails**. Changing it currently also updates the planning-currency default and requires confirming existing amounts; **it does not convert old records**. The scan always displays each saved entry's actual currency.
3. Open **Spend > Activity > Review uncategorized payments** and press **Scan saved payments**.
4. Check descriptions, category suggestions and proposed movement-kind changes. Use Previous / Next to review additional records. Approve only checked items on the current page; the remaining queue is retained.
5. Switch to **Needs your decision** to select categories for ambiguous references. These records are not automatically guessed.
6. Return to Home > Monthly review and Spend > spending portfolio to confirm the approved category distribution changed without altering original transaction amounts.
7. Repeat in the other PWA if you have separately imported its data; the two browser vaults do **not** sync automatically.

## Verification

The release uses TypeScript checks, complete Node regression tests, region/rail false-positive coverage, paging tests, dashboard unsorted-total preservation, existing source-date tests, and separate Personal and Finance production builds with offline manifests. An isolated 390px Edge/Chromium browser test exercises ten synthetic Spend entries, pagination, page-scoped approval and manual unresolved sorting **in both editions**, with no real financial data or production vault access. Physical iPhone Safari acceptance and any real account data remain owner-verified steps; no private statement data is needed by CI.
