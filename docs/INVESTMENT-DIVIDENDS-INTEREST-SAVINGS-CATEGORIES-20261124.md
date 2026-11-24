# Investment, dividends, interest and savings categories (24 November 2026)

This finance feature is shared identically by **Compass Personal** and **Compass Financial Advisor**. It is an offline deterministic, region-aware classifier with optional owner-approved corrections. **No broker, bank or stock exchange is connected.** It cannot execute trades, measure actual portfolio returns, infer tax liability, or import statements without owner action.

## Four categories and financial meaning

| Category | Movement | Examples | Do not claim |
| --- | --- | --- | --- |
| **Investments / brokerage funding** (`investments`) | **Transfer** when investing your own money, including explicit platform funding and confirmed share/ETF buys | EasyEquities deposit; SatrixNOW ETF purchase; Sygnia investment contribution; IBKR brokerage funding; JSE share purchase (through a broker) | Not a stock gain or an investment statement balance |
| **Savings / deposits** (`savings`) | **Transfer** into or out of a savings account | Salary-cycle allocation to savings pocket, emergency fund transfer, savings withdrawal | Not spending, not income earned, not a guaranteed savings balance |
| **Dividends received** (`dividends`) | **Income** when a cash dividend / ETF distribution was credited | Dividend received, cash dividend payment, ETF distribution credited | Not dividend declaration, accrual, pending payment or DRIP reinvestment |
| **Interest earned** (`interest`) | **Income** when interest was credited | Savings interest earned, bank interest credit, bond coupon received | Not interest charged, loan cost or interest accrual |

Separately: **dividend withholding tax** is `taxes` (outgoing); **trading, custody and brokerage fees** are `fees`; **interest charged** is `fees` (outgoing). Keep an ambiguous bank/rail reference `Unsorted` or `Other` rather than inventing a platform purchase or payout. Platform names by themselves are insufficient.

## Regional platform vocabulary (not live connections)

Commonly used, explicit funding/payments can be recognized when paired with an investment action. South Africa: **EasyEquities**, **SatrixNOW**, **Sygnia Alchemy/Direct Investment**, **Allan Gray Investment**, **ABSA Stockbrokers**, **FNB Share Investor**, **Standard Bank Stockbroking**, **Shyft Shares** and **10X Investments**. Global platforms and country-specific packs include **Interactive Brokers/IBKR**, **eToro**, **Saxo**, **Trading 212**, **Fidelity Investments**, **Charles Schwab**, **Vanguard Brokerage**, **Robinhood Brokerage**, **Hargreaves Lansdown**, **AJ Bell**, **Wealthsimple Trade**, **Questrade**, **CommSec**, **Sharesies**, **Zerodha**, **Groww** and more. Region is taken from the owner's existing country setting, not guessed from transaction currency or a surname.

- **JSE** is a stock exchange, not a brokerage account. An isolated `JSE` reference is not proof of a securities purchase.
- **Shyft** can also be an FX wallet. `SHYFT TOP UP` is **not** automatically an investment; require share/ETF/stock trading context.
- **EasyEquities deposits** require an account-specific EFT reference; do not identify the underlying investment from the bank transfer alone.
- **Fidelity Life Insurance** must remain insurance and never become a Fidelity brokerage transaction.
- Payment networks (ACH, SEPA, PayShap, Pix, SWIFT) and generic `EFT` are **not** investment categories.
- **Accrued interest, pending/declared dividends, reinvested distributions, refunds, fees and withdrawals** must not be double counted as cash income.

## What the user sees

**Spend > Activity > Review uncategorized payments** scans saved local entries and proposes category and movement-type changes. All amounts, dates, original descriptions, source provenance and currencies remain untouched unless an explicit owner approval updates only `kind` and `category`. Review pages remain paginated and can be resumed.

The **Spend salary-cycle dashboard** now separately displays **Income sources** (Salary, Other income, Dividends received, Interest earned) and **Savings and investment movements** (Savings, Investments, Card loads, other transfers), excluding transfers from living expenses. These are recorded movements, not bank balances, realized profits or portfolio valuations.

**Financial document review** may prepare candidates for explicitly credited dividends/interest and dated savings/investment transfers, but still requires the source date, direction, reviewability and **manual posting approval**; it does not convert a pending dividend into a bank credit.

## Source terminology verified on 24 November 2026

- [EasyEquities: what reference must I use when making a deposit?](https://support.easyequities.co.za/support/solutions/articles/13000009242-what-reference-must-i-use-when-making-a-deposit-)
- [EasyEquities: dividends and when received](https://support.easyequities.co.za/support/solutions/articles/13000064288-what-are-dividends-and-how-when-do-i-get-them-)
- [EasyEquities: dividend payout / DRIP preferences](https://support.easyequities.co.za/support/solutions/articles/13000079082-dividend-payout-preferences)
- [JSE: How to invest via authorized broker](https://www.jse.co.za/learn-to-invest)
- [JSE: Exchange-traded funds and possible distributions](https://www.jse.co.za/learn-how-to-invest/exchange-traded-funds-etfs)
- [Interactive Brokers: activity statements include interest and dividends](https://www.interactivebrokers.com/support/faq/content/find-transaction-trade-history-27290344)
- [Interactive Brokers: dividend accrual versus posted cash](https://www.interactivebrokers.com/support/faq/content/will-dividend-paid-27286131)

## Launch acceptance

Do not clear Safari data or overwrite encrypted exports. After deployment in each edition, import **synthetic** or previously owner-approved entries and test: (1) EasyEquities EFT deposit is a proposed investment transfer; (2) dividend credited and savings interest credited are income categories; (3) transfer to savings is not an expense; (4) brokerage/interest charges remain fees; (5) dividend accrual/DRIP pending records remain unresolved; (6) Next/Previous page approval and manual decisions work; (7) both dashboard breakdowns display accurately; (8) no source amounts or dates change. Physical iPhone acceptance remains owner-only.
