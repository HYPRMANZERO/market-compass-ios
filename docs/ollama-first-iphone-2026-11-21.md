# Ollama-first iPhone Assistant — paired review change (21 Nov 2026)

**Status: code review branch only. Do not replace the installed PWA until the
HYPRBOX bridge and iPhone tests pass.**

This frontend branch pairs with
`HYPRMANZERO/financial-advisor:feature/ollama-first-compass-core-2026-11-21`.

Changes:
- In connected mode, informational conversation goes to the HYPRBOX private
  Ollama chat route. Local navigation and safety refusal remain local;
  offline-first calculations and locally queued questions remain available.
- Agent mode invokes only registered private read-only personal-data tools,
  plus review-only proposals. Generic public market/BTC price questions
  are ordinary Ollama conversation, **not Luno balance checks**.
- An agent-generated Ollama explanation is labelled with the model origin.
  Source amounts/status are separately displayed from the server's
  `verifiedSummary` (immutable read-only source facts, not bank verification).
- Agent requests with no matching tools are answered conversationally by
  Ollama when online, not falsely described as draft-only tool requests.
- The PWA does **not** gain live price feeds, banking authority, an always-on
  iPhone process or a new public model.

The current access path stays iPhone Safari/Home Screen PWA → authenticated
ngrok HTTPS → HYPRBOX gateway/bridge → localhost-only Ollama. HYPRSLAP is a
separately authorized management device. A firewall-isolated research/egress
network is planned, **not deployed**. Do not expose ports, enable WAN port
forwarding, disable vault encryption or uninstall either existing PWA origin.

Before rollout: run PWA typecheck/build, verify the private-origin CSS and
offline shell scripts, run backend tests, restart only the verified owner
AI bridge, then open the protected ngrok PWA and verify both general
conversation and read-only tools. No test result is implied by this document.
