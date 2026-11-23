# Market Compass — public Ionic UI-only release

This branch adds opt-in Ionic React visual comparisons and a historical spending portfolio to the original GitHub Pages PWA, using the existing approved source-dated Spend ledger on main.

The finance parser, document intelligence, validation, and reviewed-ledger source files stay exactly as on main. No new classification, bank connection, OCR or transaction-posting permission is introduced. Feature PR #70 retains separate financial-core changes pending protected staging parity.

- **Try Ionic design** opens a synthetic-only Ionic React page for bank-like account cards, actions and categories.
- **Try Ionic** inside Spend Activity shows Ionic-style transaction summaries from the same approved local entries. The original layout remains available.
- The Spending Portfolio has expandable categories and a 26th–25th six-cycle historical timeline; transfers and unapproved document excerpts are excluded.
- Native Capacitor config targets local dist/native, with no gateway or private token bundled. A native binary still needs platform SDKs, signing and privacy review.
- This static UI update neither clears nor migrates existing encrypted vaults. Safari/PWA origins remain separate.
- Browser acceptance is synthetic; verify device-specific Safari interactions and preserve encrypted JSON exports.
