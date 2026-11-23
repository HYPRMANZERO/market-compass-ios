# Market Compass release snapshot — 23 November 2026

## Verified releases

- **Original public PWA**: GitHub Pages deployed successfully at https://hyprmanzero.github.io/market-compass-ios/ from main commit `efb9999a75c7443aadab94a3c4789bbd797bb853` (PR #71).
- Public Pages workflow run `45158553935`: build SUCCESS; deploy SUCCESS. Live index, Ionic page, compiled script, service worker, Ionic precache, and spending-cycle text were verified over HTTPS after deployment.
- Public release is deliberately **UI-only** relative to the protected financial core in main. The login has a >=48px password field and Assistant voice/send controls with 48px targets.
- **Private authenticated HYPRBOX/ngrok PWA**: historical salary-cycle portfolio promoted using the protected static promotion script. Candidate/live index hashes matched, service worker had no template tokens and Ionic preview was present.
- Private previous static rollback directory: `artifacts/market-compass/dist/public-before-finance-ux-20261123-122650`.
- The previous public mainline is preserved in the branch `backup/public-pages-before-ionic-20261123` pointing to `0cb24504f17a6688958f599b06edb68f9e10590b`.
- Both source trees with complete private finance improvements passed 229/229 Node tests; the public UI-only worktree passed 221/221 Node tests and local synthetic Chromium/Windows smoke.
- Capacitor Android project was rebuilt and synchronized from the latest private branch, including the historical Spend component. No Android APK or iOS IPA has been produced.

## Remaining security/launch gates

1. **Draft PR #70** retains the deeper source-issuer classification, account-type persistence, safer source-date enforcement, and cross-source transaction duplicate protection. GitHub's protected finance-core staging parity check fails for this PR; do not merge it or bypass the gate. These advanced changes are not live on the original public PWA.
2. The two PWAs have distinct encrypted browser vaults. Updating static code does not merge them. Never clear Safari site data as part of refresh. Confirm each origin's encrypted JSON export and on-device lock/unlock.
3. Physical Safari (including Home Screen PWA safe areas, document picker, encrypted PDF password and Files export) remains unverified by synthetic Chromium tests.
4. Official read-only bank data via consented provider OAuth remains unconnected. Do not claim live balances or ask users for banking passwords. Provider contracts, OAuth, disclosure and account reconciliation are separate work.
5. The PWA cannot silently scan arbitrary iPhone files, email or other apps. Use browser file picker/folder grants, and separate explicit email OAuth if implemented.
6. Native Android requires a local JDK/Android SDK and signing to produce an APK/AAB. Native iOS requires macOS/Xcode, Apple signing and lifted device installation restrictions; Capacitor iOS origins have their own vault.
7. Continue improving large-file/page handling, document classification confidence, merchant categorization and account-level transaction linkage using synthetic evidence before real-data acceptance.

## User-visible features to check

- Original public PWA: Spend > Activity > Spending portfolio, expand purchases by category, select salary-cycle history; Try Ionic design (sample-only) and Try Ionic (approved local ledger).
- Private PWA: compact uploader and editable statement identity, approved historical Spend handoff and cross-source repetition review, original account popup and Ionic comparison.
- All financial figures remain owner-reviewed and potentially incomplete, not verified bank balances.
