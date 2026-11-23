# Compass standalone AI — protected ngrok PWA acceptance

Updated: 23 November 2026. Scope: **private authenticated Market Compass PWA**. This does not change the public GitHub Pages origin or synchronize the two separate browser vaults.

## Verified backend state

The protected HTTPS ngrok gateway on the authorized private desktop still serves the private app and forwards approved AI requests to a loopback-only bridge. That bridge now uses the independent **`llama.cpp` runtime** and existing **Qwen3.5 4B GGUF weights** to generate responses. This is a runtime change, not a newly trained personal model. There is no cloud inference fallback.

- Authenticated model session: passed.
- Existing password-/DPAPI-protected conversation CompactVault: read and decrypted successfully; encrypted file snapshot backed up before switching.
- Financial-source inventory, previously approved read-only tools and private gateway authentication: passed.
- Direct standalone model port, AI bridge and gateway: bound only to localhost, protected model API key.
- Real read-only agent through protected gateway: passed in **30 seconds**, with no workspace writes, payments or trades.
- Synthetic debt-advice JSON through protected gateway: passed in **98.4 seconds**. Deterministic affordability and APR guardrails stay authoritative; historical context may be bounded for CPU performance.
- Node backend unit tests: **117 passed**. Private Ionic UI tests and browser release gate are maintained separately.
- Backend versioned cutover commit `da261a5` and rollback source preserved in backend feature branch `feature/compass-standalone-cutover-20261123`. No other user's uncommitted source was overwritten.

## Ionic changes

The compact AI header is labeled **Compass**, including connected/loading/offline statuses, spoken replies and the read-only agent label. Internal legacy `ollama` message-source keys remain intentionally unchanged for backwards compatibility, but they are not a claim that Ollama is still producing replies. The existing authenticated URL, token save/reconnect behavior, Tailscale management route, encrypted vault, conversation tools, microphone controls and document processing remain intact.

## Outstanding human checks

**Do not mark physical iPhone Safari acceptance complete.** On the actual device after ensuring an encrypted Files backup exists, confirm: existing vault unlock; status bar and safe-area spacing; AI connection indicator; ordinary Compass chat with an answer from HYPRBOX; source-aware read-only agent response; voice input and spoken reply; document import/classification/approval; offline reopening and manually sending queued questions after reconnection; and backup export/restore on a disposable test origin.

Expect some CPU-bound responses to require **roughly 20–100 seconds**; do not assume a network outage from a long progress indicator. The chat request timeout is 105 seconds and the debt-advice timeout is 125 seconds, leaving limited headroom for particularly long source prompts. Future latency improvements remain a launch requirement.

## Constraints that have not changed

No official Investec/Nedbank bank OAuth connection. No automatic financial document/device scanning or secret collection. No unattended Windows program execution, banking writes, trades or payments. Scikit-learn synthetic debt/doc challengers are independent suggestions, not supervised learning from private user records. Owner approval remains necessary before recording document-derived financial facts.

The standalone service persists via the private desktop's Windows Startup shortcut. An actual supervised reboot/restore and rollback drill is still pending. Rollback is documented in the private backend's `tools/cutover-market-compass-standalone.ps1` and never overwrites the encrypted memory store.
