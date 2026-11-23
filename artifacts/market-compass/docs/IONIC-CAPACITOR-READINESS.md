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
