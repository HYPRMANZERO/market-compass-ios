# Market Compass — encrypted, local-first Ionic PWA

> **24 November 2026 edition work:** The original GitHub Pages application is **Compass Personal**, the complete financial workspace plus general-purpose personal assistant. A separately authenticated ngrok installation is **Compass Financial Advisor** and is finance-only. Both use the same HYPRBOX Qwen 3.5 4B runtime when online, with separate role rules and encrypted histories. Development of offline Personal tasks, draft tools, dual-edition builds and the independent Personal gateway is staged in [PR #78](https://github.com/HYPRMANZERO/market-compass-ios/pull/78) and its [backend counterpart](https://github.com/HYPRMANZERO/financial-advisor/pull/30). Neither draft PR is a live deployment. The original iPhone Personal PWA still needs its separate approved private AI ingress and physical Safari testing.
>
> **Read the current capability and security contract:** [Personal tools and separate PWA editions](docs/PERSONAL-CAPABILITIES-AND-FINANCE-EDITION-20261124.md). Only the existing audited `main` release is live on GitHub Pages. Do not clear local website data or assume private finance vaults sync between app origins.

Market Compass is an offline-capable financial workspace and **Ionic/React progressive web app** for reviewing manually entered debt, budgets, spending and financial documents, with a private, optionally connected AI assistant named **Compass**.

**Original public PWA:** https://hyprmanzero.github.io/market-compass-ios/
**Release source:** [main](https://github.com/HYPRMANZERO/market-compass-ios/tree/main)
**Publish workflow:** [GitHub Pages](https://github.com/HYPRMANZERO/market-compass-ios/actions/workflows/pages.yml)

This is a living project, **not** a ZIP-install template, Expo application, native iOS/Android binary, online bank dashboard, or bank-connected adviser. This repository contains no private server keys or personal financial records by design.

## What works in the public PWA

- Local AES-GCM password-encrypted browser vault, explicit encrypted JSON backup/restore, offline shell, manual accounts, financial summaries, debt plans and saved market references.
- Owner-selected documents, PDF/password support and review-before-recording workflows. Dates, historical statement balances and individual transaction amounts remain separate evidence; a saved source does not automatically post Spend entries.
- Ionic banking-style Home/Menu navigation, clickable account entries, spend and document views, compact chat and built-in browser microphone/speech support when the browser allows it.
- **Compass** typed questions, deterministic read-only financial calculations, navigation, and Jarvis-derived *safe* voice/text intents: time/date, vetted click-to-open websites and voluntary search links. No arbitrary shell commands or automatic Windows app launching.
- Optional owner-configured **private** AI connection for eligible, authenticated private-network setups. The public GitHub Pages deployment does **not** automatically access the protected ngrok gateway, private model, bank data or a server.

**Missing data is unknown, not zero or live.** Owner-entered balances are not bank-verified, and offline market references are not executable quotes.

## Separate private AI edition

A separately authenticated private PWA can reach a gateway on an authorized desktop through an outbound-established HTTPS tunnel; authorized management devices may also use Tailscale. These are separate transport paths, not separate AI models. The model is local to the private desktop and must never be exposed directly to the internet.

The **private authenticated AI backend** was switched to standalone **llama.cpp with the existing Qwen 3.5 4B GGUF weights** on 23 November 2026. It passed private gateway authentication, encrypted memory and read-only agent/synthetic debt-advice tests. The **original public GitHub Pages PWA remains a separate origin** and does not automatically connect to this private gateway. Physical iPhone Safari and reboot acceptance remain open. No cloud-model fallback is permitted to impersonate Compass.

Encrypted vaults on different browser origins/devices **do not silently synchronize**. Back up each origin separately and use intentional encrypted restore when appropriate. Do not share vault passwords, PII or API keys via issues or Git.

## Bank integration status — NOT CONNECTED

No official bank OAuth connection or active bank-data feed is deployed. **Investec** and **Nedbank** are candidates for future consent-based, read-only API onboarding; neither integration has been started or authorized. Statements and manually entered accounts are **not** evidence of live bank access.

See [Bank integration status and consent gates](docs/ASSISTANT-MOBILE-AND-BANK-READINESS-20261123.md). No payments, transfers, brokerage orders, unrestricted filesystem access or autonomous expense posting may occur without a separate, explicitly approved implementation.

## Install the original PWA

On an iPhone, open the public HTTPS URL in Safari and use **Share → Add to Home Screen**. On a desktop/laptop, use the link in a modern browser. Unlock or create a vault using a strong password, and explicitly export and verify an encrypted backup using the device's Files/download flow.

**Real iPhone acceptance remains open.** Automated typechecks, synthetic browser tests and successful GitHub Pages deployments are not physical Safari testing. The release audit previously recorded `launchReady=false` with **eight manual acceptance items still open**, including real-device visual/safe-area and offline behavior. See [the release-candidate acceptance gate](docs/PUBLIC-BOOTSTRAP-RELEASE-CANDIDATE-20261123.md) and [the safety test plans](docs/MARKET-COMPASS-FINANCIAL-UX-RELEASE-20261123.md). Do not clear existing browser site data to test upgrades; first save a current encrypted backup for **each** origin.

## Build and verification

Requirements: Node.js 24, pnpm 10, and a supported browser for local visual tests.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/market-compass typecheck
node --experimental-strip-types --test tests/*.test.mjs
BASE_PATH=/market-compass-ios/ pnpm --filter @workspace/market-compass build
node scripts/prepare-offline-shell.mjs
node scripts/browser-release-gate.mjs
```

PowerShell users can set `$env:BASE_PATH = '/market-compass-ios/'` instead of prefixing the command. The browser gate uses a disposable profile, fabricated data and loopback host. Build output paths for the private gateway must be approved; the build script guards the active deployment directory.

**No `ios/` or `android/` native projects are committed.** Capacitor configuration and build/sync scripts alone do not produce a native installable app. No App Store/TestFlight distribution or free Apple developer iOS IPA is represented as complete. The first-launch native path is explicitly deferred.

## Architecture, status and audit trail

- [Jarvis source audit](docs/JARVIS-SOURCE-AUDIT-20261123.md) and [Ionic integration boundaries](docs/COMPASS-JARVIS-IONIC-INTEGRATION-20261123.md)
- [Current security/release hardening and branch inventory](docs/RELEASE-HARDENING-20261123.md)
- [Document review UX](docs/EVIDENCE-REVIEW-UX-20261123.md) and [desktop/mobile design parity](docs/DESKTOP-MOBILE-UX-PARITY-20261123.md)

The older per-feature release documents are historical checkpoints, not a claim that all work is accepted. **Only commits published on `main` appear at the original GitHub Pages URL.** Private feature branches are not public-site releases.

This is a public repository. Keep credentials, precise device names, local usernames/paths, encrypted backups and personal data out of new commits. Older Git history may retain historical identifiers; editing the current tree does not erase Git history.
