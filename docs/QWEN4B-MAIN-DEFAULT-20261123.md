# Market Compass — Qwen 4B becomes the default private model

**Status:** 23 November 2026. Qwen 3.5 4B is the active default on the protected ngrok Safari PWA. This supersedes the opt-in canary-only status described in QWEN4B-OWNER-CANARY-20261123.md.

The normal /api/session and /api/agent/run endpoints use the private gateway on 127.0.0.1:8790, main AI bridge 127.0.0.1:8788, and Ollama 127.0.0.1:11435 running qwen3.5:4b on D:\MarketCompass\Ollama-Preview\models. Original qwen3.5:0.8b and llama3.1 remain installed on separate 127.0.0.1:11434. No Ollama listener is publicly exposed. The original GitHub Pages edition is distinct and must not be pointed at an unauthenticated private model.

**Existing knowledge remains accessible through retrieval, not weight transfer.** The assistant uses the same prompts, approved read-only source tools, and encrypted Compact Vault on HYPRBOX. The local DPAPI memory key, encrypted archives and iPhone encrypted workspace were not overwritten, transferred or re-trained. No unsolicited document scan or sharing was performed. Browser-visible agent mode remains read-only. No trades, fund movements or scheduled execution are enabled.

**Owner review:** https://concrete-sharper-depict.ngrok-free.dev/market-compass-ios/ — unlock the existing private workspace, open AI and verify the banner reports Qwen 4B connected. Ask a short read-only question, then a financial-context question only if sharing has already been approved. On HYPRBOX CPU-only hardware, responses may take tens of seconds.

**Validation:** 244 PWA tests, TypeScript, production build, synthetic Chromium browser gate including vault recovery, and 112 backend tests pass. The authenticated private agent test returned the correct read-only debt tool trace and non-executable reminder draft. Real Safari physical-device testing is still outstanding.

**Rollback:** On HYPRBOX, run the verified D:\MarketCompass\Ollama-Preview\rollback-primary-0.8b.ps1 script. This re-selects the old model and restarts only the authenticated main AI bridge. It does not delete memory, model files or browser data. Previous static bundle: artifacts/market-compass/dist/public-before-finance-ux-20261123-172813. Separate backend release notes: financial-advisor/docs/QWEN4B-MAIN-CUTOVER-20261123.md.
