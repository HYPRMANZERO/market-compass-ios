# HYPRBOX owner Qwen 3.5 4B canary — 23 Nov 2026

## Purpose and scope
Test a stronger local Ollama model on the authenticated ngrok iPhone PWA without replacing the normal working model. The unauthenticated GitHub Pages edition was not modified. Do not expose the Ollama API, owner token or raw financial records publicly.

## Installed configuration
- Main Ollama: 127.0.0.1:11434, existing Qwen 3.5 0.8B and Llama 3.1, unchanged.
- Candidate Ollama: 127.0.0.1:11435; model qwen3.5:4b (about 3.3 GB), installed at D:\MarketCompass\Ollama-Preview\models, configured OLLAMA_NO_CLOUD=true.
- Main authenticated AI bridge: 127.0.0.1:8788, unchanged.
- Candidate authenticated AI bridge: 127.0.0.1:8789, starts the common server/market-compass-ai.mjs with MC_AI_PORT=8789, MC_OLLAMA_MODEL=qwen3.5:4b, MC_OLLAMA_URL=http://127.0.0.1:11435.
- Authenticated gateway: 127.0.0.1:8790; /api/session/preview and /api/agent/preview route exclusively to 8789. Normal session and agent routes remain on 8788. Same protected edge, same owner bearer second factor, no direct browser access to Ollama.
- Private candidate static release: candidate-20261123-preview-timeout; promotion rollback folder: public-before-finance-ux-20261123-165106.
- Owner canary URL (requires normal ngrok authentication and existing encrypted workspace connection): https://concrete-sharper-depict.ngrok-free.dev/market-compass-ios/assistant?compassAI=qwen35-4b
- Normal comparison URL: https://concrete-sharper-depict.ngrok-free.dev/market-compass-ios/assistant

## Findings
HYPRBOX: Intel i5-7400 (4 CPU cores), 16 GB RAM, NVIDIA GeForce 210 without usable Ollama GPU offload. Initial free RAM about 6.5 GB; no expectation of GPU acceleration. System C: low on disk, D: ample space. A Qwen 3.5 4B direct test responded in 32.5 seconds cold (51 tokens); a warm test took 14.2 seconds (65 tokens). Both correctly declined to invent live stock prices. Such timings are single-run observations, not a latency guarantee. Benchmark was against synthetic public questions, not personal financial records.

## Validation
- 244 PWA tests pass, TypeScript passes, isolated Vite build passes and synthetic Chromium browser release gate passes (including encrypted vault recovery, phone geometry and account form).
- 111 backend tests pass; preview gateway suite verifies only authenticated allowlisted routes forward to loopback and normal routes remain unchanged.
- Preview /health reported configured=true and model=qwen3.5:4b, without disclosing credentials. Unauthenticated /api/session returned 401 on 8789; unauthenticated gateway probes returned 403.
- Verified 11434/11435/8788/8789/8790 are loopback listeners; preview Ollama startup log confirms OLLAMA_NO_CLOUD=true.
- Actual authenticated iPhone requests and native Safari responsiveness still require owner testing; unit and Chromium tests cannot substitute for that check.

## Owner test
Open normal PWA first; confirm existing replies. Open the canary URL in authenticated Safari and unlock the same encrypted workspace. Verify the banner says “4B preview connected” and ask a general financial education question without sharing sensitive records. If it is slow or offline, return to the normal URL: no data migration or model deletion is required.

## Limits and rollback
This is a model preview, not a live equities feed or investment execution engine. Current stock prices require independently verified read-only sources, timestamps and appropriate licensing; the model must not invent facts. DebiCheck/Capfin suggestions require owner approval and do not alter saved accounts' debt balances or source amounts.
To disable only the preview, stop the local 8789 bridge and 11435 Ollama process; normal 8788 and 11434 remain running. The UI preview parameter can simply be removed. Do not delete the user's encrypted vault or Safari storage. Do not deploy to the original GitHub Pages edition without owner acceptance.
