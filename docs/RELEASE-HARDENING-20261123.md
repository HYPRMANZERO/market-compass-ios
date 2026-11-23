# Market Compass — original PWA release hardening, 23 November 2026

**Scope:** Current `main` of the public Ionic PWA and its separate private AI release. This is a checkpoint, **not** a blanket launch approval.

## 1. Official bank connectivity

**NOT CONNECTED.** No authenticated Investec or Nedbank OAuth session or token, no official bank data feed, and no live verified bank balances exist. Those institutions are **candidate read-only API routes**, requiring provider eligibility, sandbox access, contractual approval, granular scopes, explicit owner consent, token vaulting, revocation and separate acceptance tests. No screen, reviewed statement or manually entered account can be called a bank integration.

## 2. Physical iPhone launch acceptance

**NOT VERIFIED.** Last public launch audit reported `launchReady=false` with **eight outstanding manual acceptance items**. The synthetic Chromium/Edge release gates are useful but do not validate actual iPhone Safari status-bar/safe-area inset, Home Screen behavior or offline reload. The independent owner-run checks include vault backup to Files from **both distinct origins**; correct/wrong PDF password, sequential per-file review; date and debit/credit accuracy; Last saved/lock/unlock; offline shell/reconnection; and encrypted backup restoration to a disposable origin. Never clear existing Safari website storage or treat an automated synthetic pass as owner acceptance. Record each acceptance evidence item and result before setting `launchReady=true`.

## 3. Public README accuracy

The root README is the current product entry point, not a first-ZIP installation. It now links to the original Pages URL, documents separate private AI, notes no bank authorization, records the physical acceptance gap and clarifies the native-app status. Prior design docs are **historical checkpoints**; do not follow outdated “do not publish” instructions after Pages releases.

## 4. Existing parity branches and their drift

All refs were verified against the remote of `HYPRMANZERO/market-compass-ios` on 23 Nov, not guessed from a branches dropdown:

| Branch | Remote SHA prefix | Compared to then-current `main` (`f3ce342`) |
|---|---|---|
| [main](https://github.com/HYPRMANZERO/market-compass-ios/tree/main) | `f3ce342` | published GitHub Pages |
| [feature/ios-safari-launch-2026-11-26](https://github.com/HYPRMANZERO/market-compass-ios/tree/feature/ios-safari-launch-2026-11-26) | `129627e` | 171 main-only / 248 feature-only commits |
| [fix/test-pdf-page-completeness](https://github.com/HYPRMANZERO/market-compass-ios/tree/fix/test-pdf-page-completeness) | `b4a897f` | 171 main-only / 295 fix-only commits |

These are **diverged lines of history** and commit counts, not a claim that 248 or 295 functional items differ. CI's `validate-owner-document-parity.yml` deliberately selects the corresponding older branch and pins known file hashes for sensitive document-core comparisons. **Do not merge an old feature wholesale into `main`.** Review each parser/source normalizer diff with synthetic fixtures and approval before cherry-picking. The backend repository also has a separate `feature/ios-safari-launch-2026-11-26` ref; identical branch naming does **not** imply identical files or commit SHA.

## 5. Public source sanitization

Current public Markdown documentation replaces private machine hostnames with **private desktop** and **authorized management laptop**, and replaces a hardcoded Windows username with a portable placeholder. Source code still contains some historical machine-name user-facing descriptions and test assertions; these must be migrated intentionally rather than mass-replaced if changing any route/security semantics. **Git history is not erased by current-tree redaction.** A full history rewrite would be disruptive and requires separately explicit authorization and collaborator coordination. Never publish real tunnel tokens, DPAPI files, per-device vault exports or full local filesystem paths.

## 6. Legacy development dependencies

Root `@replit/connectors-sdk`, Vite-only Replit plugins and their broad minimum-release-age exceptions are no longer part of the Ionic build. The root's directly pinned Windows-only native Rollup/lightningcss packages were removed from the manifest: CI must verify cross-platform builds from the refreshed lockfile. Source commands and `node_modules`/lockfile can still contain transitive platform-specific optional packages; this does **not** indicate a native iOS project. Preserve `minimumReleaseAge: 1440` instead of permitting a broad trusted-publisher bypass.

## 7. Native iOS and Android

No `ios/` or `android/` platform projects currently exist. `capacitor.config.ts` plus `native:build` and `native:sync` commands are **scaffolding only**. Native build verification/Apple signing/TestFlight/physical install have not occurred, and free Apple account limitations remain. Continue with the installable Safari PWA until an actual native build can be supported.

## 8–10. Jarvis Local Assistant source risks

The owner-supplied ZIP contains a Python desktop CLI under `local-jarvis/`, not a Safari background agent. The local process uses Windows app discovery and launch functions, SpeechRecognition/Vosk microphone clips, pyttsx3 speech and optional NewsAPI.

**Confirmed source risks:** A `re.search` wake match could trigger from TV/other people anywhere in a clip; prefix matches auto-launched any uniquely named Start-menu program (including shells) without written owner approval; the highest-risk microphone/process/news paths lacked behavioral tests; NewsAPI passed its key in a query-string URL. The live PWA integration intentionally **does not import these dangerous pathways**. It ports only deterministic safe commands and vetted click-only HTTPS links. An independent **hardened Jarvis source ZIP** was prepared in the owner's conversation as a **not-installed test candidate**, with leading wake-word matching, keyboard-only one-action confirmation, explicit executable allowlists, refusal to launch shells/terminal programs and API-key headers; **34 Python sandbox tests passed** (including simulated microphone/CLI and news-key tests). This is not physical Windows/microphone or production sidecar acceptance, and TV speech is not speaker-authenticated.

Source audit: [Jarvis integration](JARVIS-SOURCE-AUDIT-20261123.md). The uploaded ZIP is never itself an authorized installer or trusted command source.

## Standalone Compass status and release gates

Independent `llama.cpp` runs the existing Qwen 4B GGUF on loopback. On 23 November the **live private bridge** was switched to standalone inference, retaining the same authenticated private ngrok gateway and encrypted CompactVault. Post-switch gateway read-only Agent returned in 30 seconds and structured synthetic debt advice in 98.4 seconds; 117 backend and 257 private frontend tests passed. Safe rollback of the prior bridge/startup shortcut is preserved under owner-local backups and tracked in [the backend standalone release branch](https://github.com/HYPRMANZERO/financial-advisor/tree/feature/compass-standalone-cutover-20261123). **This does not connect the original public Pages PWA to the private gateway.** Scikit-learn synthetic debt/doc challengers remain suggestions, not bank-calibrated or self-learning authority.

**Remaining release gates:** the backend cutover and protected gateway checks are complete, but an owner-supervised actual Windows reboot, physical iPhone Safari status-bar/offline tests and a latency improvement are still needed before full launch readiness. Never expose raw model ports, clear existing vaults or claim official bank connectivity.
