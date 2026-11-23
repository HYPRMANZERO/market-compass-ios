# Market Compass · Ionic React and Capacitor migration
Updated: 23 November 2026

## Architecture
- Keep the authenticated private Safari/ngrok PWA and the public GitHub Pages PWA separate, with independent encrypted browser vaults and safe static rollbacks.
- Add `@ionic/react` UI as a **separate HTML entry** (`ionic-preview.html`) with dedicated global Ionic CSS. The existing App.tsx remains the default PWA. Spend has an opt-in embedded preview, and sample numbers are never derived from the user's private vault.
- Ionic/Capacitor share Vite React source code, but Ionic CLI alone does not compile/sign an iOS IPA.
- `capacitor.config.ts` uses `dist/native` and no remote server URL. iOS and Android native WebView origins have separate storage: do **not** promise automatic data migration from the Safari PWA.

## Commands (run from artifacts/market-compass)
- `corepack pnpm run build` — regular PWA build, still controlled by BASE_PATH and MC_PWA_OUT_DIR.
- `corepack pnpm run native:build` — isolated `dist/native` bundle, base path `/`.
- `corepack pnpm exec ionic --version` — local Ionic CLI check.
- `corepack pnpm exec cap add android` — scaffold Android project if desired (requires Android SDK/Studio for APK); `cap sync android` after native:web.
- On macOS with Xcode: `corepack pnpm exec cap add ios`, then `cap sync ios` and `cap open ios`.
- iOS archive, device signing and App Store submission require suitable Apple development access, a macOS/Xcode build environment and removal of the device's installation restrictions.

## Security gates
- No native code should request blanket file, email or banking permissions. Use explicit user file picker / supported native plugins after individual consent.
- Do not embed gateway credentials, authenticated ngrok token, Tailscale secrets, Ollama endpoint, or financial data in app bundle.
- Treat first native launch as an empty vault until the owner manually restores a compatible encrypted export and verifies counts.
- The Ionic preview is entirely synthetic and interactive; it does not write to the vault or submit any transaction/order.
- Do not publish a public Pages release solely from the long-running feature branch; preserve PR/release-gate workflow.

## Additional inline Ionic comparison (23 November 2026)
- Spend > Activity provides an opt-in **Try Ionic** button in both PWA source branches; **Original UI** restores the standard spending portfolio without a data migration.
- The existing **Try Ionic design** iframe remains a separate sample-only simulation of accounts, pop-up actions and category drilling.
- Inline Ionic Spend cards and segmented filters use only the current authenticated React `expenseEntries` prop already approved for the existing ledger. This does not create or read a separate vault, does not request permissions, and does not submit a transaction.
- Inline Ionic React components are lazy-loaded to keep the original first-render bundle and CSS separate until the owner requests the preview.
- Verified both sources with TypeScript checks, all regression tests, isolated browser release gates, and production candidates under `MarketCompass/ReleaseCandidates/ionic-live-20261123/`.
- A production build is not proof of installation on iPhone. Verify both PWA origins independently and retain their encrypted exports before any public deployment. Native iOS still requires macOS/Xcode and Apple signing.

## Release note: opt-in live Ionic preview and native Android sync
- Private authenticated gateway static promotion succeeded with an offline-prepared candidate. Previous bundle rollback: `artifacts/market-compass/dist/public-before-finance-ux-20261123-120340`. Candidate and live index hashes matched; Ionic preview asset and service-worker precache were confirmed.
- Public Pages candidate built and passed synthetic Chromium verification, but is **not deployed to GitHub Pages** by the private static promotion.
- Fixed `native:sync:android` and `native:sync:ios` scripts to invoke `node scripts/build-native.mjs` directly because the Windows HYPRBOX CLI resolves `corepack pnpm`, not the bare `pnpm` executable.
- Private Capacitor Android `native:sync:android` now succeeds and copies the latest web bundle; no signed Android APK or iOS IPA was created.
