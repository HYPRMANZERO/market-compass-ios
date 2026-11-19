# Market Compass — GitHub Pages installation package

This is a **sanitized web-only export** of Market Compass's latest encrypted CompactVault and daily Files backup edition. No personal financial snapshots, private trade history, ledger database, uploaded documents or backend secrets are included.

## Create repository

1. Sign in to GitHub and create **a public repository** named `market-compass-ios` (do not select a license, README, or gitignore; this ZIP already contains them).
2. Extract this ZIP on your computer.
3. Open a terminal inside the extracted folder and run:

```sh
git init -b main
git add .
git commit -m "Add Market Compass local-first PWA"
git remote add origin https://github.com/HYPRMANZERO/market-compass-ios.git
git push -u origin main
```

4. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Publish Market Compass PWA** and confirm the deployment succeeds.
6. Visit `https://hyprmanzero.github.io/market-compass-ios/` in Safari on your iPhone.
7. In Safari, tap **Share → Add to Home Screen → Add**.
8. Launch it from your Home Screen. Create a strong vault password and export an encrypted backup to Files before entering important data.

## Local-only boundary

This static site can run the local encrypted workspace and daily snapshots, but GitHub Pages cannot run Market Compass's Node API, SQLite ledger, Python analysis engine, live price feeds, or broker integrations. The interface marks this limitation; do not mistake failed API requests for live prices. The app shell can reopen offline after a successful install, but no live backend data is available.

AES-256-GCM encrypted workspace data is stored in browser IndexedDB and is bound to your iPhone/browser installation. The app cannot silently write encrypted files into iOS Files while closed; daily snapshot scheduling occurs while the PWA is open, and Save to Files requires user interaction.

GitHub Pages publishes a **public** web application. Do not commit your vault exports, secrets, sensitive market analysis, identity information or financial snapshots. Use a password unique to this vault; keep your backups safe. A PWA cannot provide Expo's native Keychain/Face ID features, and browser data can be erased by the OS or user.

## Update

Commit and push changes to `main`; GitHub Actions rebuilds the PWA automatically. The workflow expects the repository name `market-compass-ios` for the Vite base path; change `BASE_PATH` if the repository name changes.

## Verification status

The production build is configured in Actions but not yet verified on GitHub. If the build fails, check the Actions log; do not assume the site is live until the workflow succeeds and the URL opens in Safari.
