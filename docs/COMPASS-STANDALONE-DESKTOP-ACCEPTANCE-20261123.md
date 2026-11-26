# Compass standalone runtime — final desktop/PWA smoke checkpoint (2026-11-23)

## Verified running architecture

The **production** private AI bridge at `127.0.0.1:8788` reports `inferenceProvider=llama.cpp`, `model=qwen3.5:4b`, and `service=market-compass-private-standalone`. It is backed by the local GGUF model at `127.0.0.1:11436` under a protected API key. The existing ngrok/Tailscale gateway stays on loopback port `8790` and forwards the same authorized AI requests. Standalone test bridge `8791` is separate, **not** the production route. No cloud AI fallback is active.

## Live acceptance evidence

- Process ownership: `llama-server.exe` bound only to `127.0.0.1:11436`; Node bridge bound only to `127.0.0.1:8788`; authenticated gateway bound only to `127.0.0.1:8790`.
- Main bridge unauthenticated `/api/session` denied; valid owner bearer model session authorized and reports Qwen 4B ready.
- Existing DPAPI-protected CompactVault decrypts on the same live bridge. No encrypted chat contents were printed or exported.
- Private `/api/sources` is read-only.
- Private protected gateway with edge proof and owner bearer returns authorized model session through port `8790`.
- Canary standalone chat produced a real, bounded answer about loan principal vs interest in **91.2 seconds** (one CPU-bound observation; no market feeds or owner account values).
- Prior protected-gateway educational agent test took **30 seconds**, synthetic debt-advice JSON **98.4 seconds**; read-only no payments/trades/writes. Latency must be improved before broad release claims.
- Private React/Ionic TypeScript passed, **257/257** Node UI tests passed, and Chromium browser release gate passed for mobile and desktop viewports: encrypted vault/restore, wrong-PDF password, document review/approval, tabs, desktop menus, spending scroll and deterministic Jarvis web intents.
- Current private static `index.html`, `sw.js` and `manifest.webmanifest` hashes match the release candidate `candidate-20261123-standalone-compass-brand`; prior static bundle remains backed up.

**What these tests do not establish:** physical iPhone Safari safe-area/offline/microphone acceptance; reboots; exact model uptime after HYPRBOX logout/restart; performance on HYPRSLAP; direct public Pages-to-private access; bank API access; comprehensive source-grounded answer quality. The private gateway must not be exposed directly to public GitHub Pages using owner secrets.

## Desktop/laptop deployment policy

Desktop and laptop browsers may use the original public Ionic PWA independently. Devices that have explicitly joined the private network may use the separately authenticated Tailscale AI route; iPhone Safari uses the existing ngrok HTTPS private PWA. Neither original public Pages nor copied files gain automatic access to private DPAPI keys. The two PWAs' IndexedDB encrypted vaults are isolated, and user-initiated encrypted backup/restore is the permitted migration.

No native `ios/` or `android/` bundle, full Windows Jarvis companion, continuous wake-word daemon or auto-app-launch service was deployed in this cutover.

## Remaining prioritized work

1. **P0: Owner real iPhone Safari acceptance:** backup existing encrypted vaults; safe-area/status bar, landscape/scroll, Home/Menu, current-model status, read-only agent and voice reply, PDF period/amount/classification approval, lock/unlock, offline reopening, backup/restore on disposable origin. Keep `launchReady=false` until evidence exists.
2. **P0: Cold-start and reboot persistence:** supervised HYPRBOX restart after saving unsaved work; verify GGUF server, 8788 bridge and 8790 gateway startup; test protected ngrok and laptop Tailscale with actual connected devices. Exercise documented rollback script in a planned window; **never** delete old Ollama model/credentials/CompactVault prematurely.
3. **P1: Latency:** 91-second simple chat shows current CPU-only throughput is marginal. Profile context size, prompt overhead, prefill latency, thread count and power settings; consider measured quantization or GPU offload only with reproducible answer-quality checks. Do not silently substitute a smaller or cloud model.
4. **P1: Document quality assurance:** test multi-file PDF/payslip/statement dates, direction, duplicates, account/statement periods, balances and source provenance, classify with abstention under uncertainty, and require owner approval before posting.
5. **P1: Laptop/desktop UI:** test full browser navigation, responsive overflow, voice permissions, Tailscale origin/CORS, encrypted backups and offline opening on the real laptop; screenshots and owner acceptance are still required.
6. **P2: Bank integration:** Investec and Nedbank are read-only candidates only. No bank credentials, OAuth consent, current balances or live feeds exist. Sandbox/partner approval and scoped permission/revocation implementation are separate future work.
7. **P2: Jarvis sidecar:** security-hardened Python candidate has sandbox tests but no live desktop installation. Require opt-in microphone, leading wake word, per-action confirmation, narrow executable allowlist, NewsAPI header key, tests against recorded/replayed voice, and no remote shell endpoints.

For the original public PWA, see `HYPRMANZERO/market-compass-ios` current `main`; do not merge private secrets or backend runtime files into its bundle.
