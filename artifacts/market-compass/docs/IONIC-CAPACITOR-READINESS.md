# Market Compass — public Ionic UI-only release

This branch adds opt-in Ionic React visual comparisons and a historical spending portfolio to the original GitHub Pages PWA, using the existing approved source-dated Spend ledger on main.

The finance parser, document intelligence, validation, and reviewed-ledger source files stay exactly as on main. No new classification, bank connection, OCR or transaction-posting permission is introduced. Feature PR #70 retains separate financial-core changes pending protected staging parity.

- **Try Ionic design** opens a synthetic-only Ionic React page for bank-like account cards, actions and categories.
- **Try Ionic** inside Spend Activity shows Ionic-style transaction summaries from the same approved local entries. The original layout remains available.
- The Spending Portfolio has expandable categories and a 26th–25th six-cycle historical timeline; transfers and unapproved document excerpts are excluded.
- Native Capacitor config targets local dist/native, with no gateway or private token bundled. A native binary still needs platform SDKs, signing and privacy review.
- This static UI update neither clears nor migrates existing encrypted vaults. Safari/PWA origins remain separate.
- Browser acceptance is synthetic; verify device-specific Safari interactions and preserve encrypted JSON exports.

## Ionic-first shell and iPhone safe-area redesign (23 November 2026)
- React web application now mounts inside `IonApp`, with `IonHeader`/`IonToolbar` for the phone header and `IonFooter` for the existing six Wouter route links. `IonTabBar` was intentionally not used outside Ionic's own tabs router because it hid the existing links.
- `IonModal` hosts the quick menu and account-actions sheet; the banking overview and reusable panels use Ionic cards; existing account details remain expandable and privacy masked.
- Spend now uses `IonSegment` navigation, the real-data `IonicSpendPreview` as the default Activity view, and the original historical spending portfolio with Ionic category accordions; no sample iframe is required to use the application.
- `ionic-shell.css` resets Ionic's additional safe-area offset in the toolbar, paints an opaque green header, hides the old fixed header pseudo-layer, and reserves room for the iOS home indicator at the bottom.
- When no approved transactions exist in the active encrypted vault, Spend displays **Not recorded** instead of a misleading R0.00 total. Other PWA origins may have different encrypted vaults.
- Protected finance parsing, bank access, permissions and vault crypto are unchanged by this design work. No automatic cross-origin vault migration.
- Synthetic private/public Chromium browser release gates pass; additional source-level assertions cover primary Ionic shell, safe areas, and retained finance integrations. Physical iPhone Safari acceptance is still needed before claiming the status-bar overlap is fixed on device.
