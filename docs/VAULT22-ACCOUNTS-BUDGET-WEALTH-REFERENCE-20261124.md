# Market Compass reference update — 24 November 2026

Owner-provided screenshots of Vault22 Accounts, Budget and Wealth were used as navigation references. No accounts, numeric balances, performance graphs or integration claims were copied as real Compass data.

## Shared UI additions
- Accounts (/banks): collapsible Bank, Investments, Rewards, Cryptocurrency and Credit & Vehicle Finance groups. Removed the transaction-to-debt-account assignment prompt from Home and Spend. Manual liability records remain in Debt Plan.
- Bank/investment directory: existing South African banks plus Luno, EasyEquities, Coinbase, Kraken, SatrixNOW, Sygnia, Old Mutual and Standard Bank investments. Zero live accounts are connected. The directory has no key entry or trading actions. Secure read-only connectors will require separately approved HYPRBOX implementations.
- Wealth readiness: deliberately no net-worth graph until dated, reconcilable asset and liability valuations exist. The entered liability subtotal remains unverified and does not establish net worth.
- Budget detail: four screenshot-reference groups, Bank Fees, Utilities, Debt and Communications. Owner can set optional detailed budgets; a partial recorded historical average appears only with relevant activity in two completed salary cycles. Missing budgets remain unknown, never assumed zero.
- Entries: existing main category IDs and previous transactions are untouched. Owner-selected optional subcategory tags never silently backfill historical payment data. Broad-category totals remain visible.
- Saved transaction review: clearer full-width mobile header/button, repeatable scan and manual approval. Financial planning reacts to saved category progress but does not silently change budget, debt APR, reserve or cash assumptions.
- Restricted document importer: protected allowed category list remains unchanged until a separate staging parity review. Dated dividend/interest credits can be recorded after explicit approval as income/unsorted and investment funding debits as transfer/other. Owner can then review exact categories in the saved transaction categorizer.

## Release requirements
Physical iPhone Safari checks, encrypted backup/restore, financial accuracy, authenticated Finance gateway, model readiness, rollback and the existing protected-document CI gate must pass before deployment to both PWAs. No banking credential, invented history, mock portfolio or commercial integration is part of this release.

## References
Owner screenshots of Vault22 account groupings, budget categories, and wealth history. EasyEquities transaction history: https://support.easyequities.co.za/support/solutions/articles/5000642097-how-do-i-get-a-report-of-my-transaction-history- . Kraken API documentation: https://docs.kraken.com/api/docs/rest-api/get-api-key-info . Coinbase Exchange product-specific API: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getaccount .
