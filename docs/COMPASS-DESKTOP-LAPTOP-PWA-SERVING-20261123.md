# Desktop and laptop Compass PWA — standalone AI serving

Updated: 23 November 2026. Status: **backend live; cross-device browser acceptance pending**.

## What is running

Market Compass has **one current private assistant**, called **Compass**, with independent `llama.cpp` inference running locally on the authorized private desktop. The existing **Qwen 3.5 4B GGUF** weights remain the language model. The existing authenticated gateway, encrypted conversation memory, source inventory, read-only agent, document review and owner approval rules are retained. The model runtime is standalone; this is not a new model trained on the owner's private documents.

There are two authorized connection patterns. Both use the **same** private Compass Core:

| Client | How it connects | What is not automatic |
|---|---|---|
| Private iPhone Safari/Home Screen PWA | Existing authenticated outbound-established ngrok HTTPS gateway | No Tailscale installation is assumed on the phone; never share the private bearer or vault between browser origins |
| Original GitHub Pages PWA on Windows/macOS/Linux desktop or authorized laptop | Owner manually saves **their own** `https://<private-host>.<tailnet>.ts.net/` Tailscale Serve URL and separate bearer **inside that browser's password-encrypted vault** | The public site has no embedded endpoint, token, privileged device tool or automatic remote connection |

An additional browser PWA can be installed using your browser's **Install app** (Chrome/Edge) or Add to Dock/Home Screen when supported. This is an installable web app, **not a compiled desktop executable** or native `ios/` / `android/` project. The local-first financial tools continue to function when the private AI is unavailable.

## Desktop/laptop setup without exposing your model

1. On an authorized laptop/desktop, first connect to the existing owner-approved Tailscale network and verify it can reach the private desktop's Tailscale Serve HTTPS origin.
2. Open the **original Market Compass PWA** at https://hyprmanzero.github.io/market-compass-ios/ and unlock/create its **own** encrypted vault.
3. In **AI → Compass saved connection**, enter the private **Tailscale Serve HTTPS origin only** and the separately issued 48+ character bearer. Select Save & reconnect. Do **not** use the raw model port, localhost IP, an arbitrary ngrok address or an unauthenticated HTTP URL.
4. The green Compass status indicates an authenticated session and available local model. The read-only agent may look at approved source summaries; any optional financial-context sharing must be enabled deliberately. New bank OAuth connections do not exist.
5. An installed PWA should reconnect on unlock and visibility/online events. For first setup, confirm no account or document appears without approved entry/import; encrypted vaults on different devices and origins **do not sync**.
6. To test a slower CPU-generated response, ask a general question without personal numbers. The browser allows up to **130 seconds**, and a timeout does **not** revoke the connection, erase the encrypted vault, or automatically retry a pending question. Don't interpret delayed replies as confirmation of an action.

**Never put your private token in the URL, an issue, a public PWA source file, an email or a device screenshot.** HTTPS origin validation rejects arbitrary external domains and user-info credentials. Desktop OS automation and microphone wake-word monitoring are not enabled through these browser routes.

## Verified transport and regression gates

- On the authorized private desktop, Tailscale Serve routes HTTPS to the loopback-only authenticated backend. Browser preflight from the exact original Pages origin returned **HTTP 204** with explicit `Authorization,Content-Type` support.
- A request including the permitted Pages origin **without** a bearer returned **HTTP 401**; one with the existing DPAPI-protected owner token returned an authorized Qwen 4B model session, and the encrypted CompactVault memory API was readable through the same Tailscale HTTPS route.
- The existing ngrok gateway remains protected separately and has produced model-generated read-only agent and synthetic debt-advice responses after cutover. Native model port, gateway and AI bridge are not exposed as public arbitrary HTTP listeners.
- The public desktop/PWA chat request limit was extended from **65 to 130 seconds**; the private PWA's earlier **105-second** limit is also now 130 seconds. On abort, both preserve saved credentials and require **manual** retry.
- Client-side regression tests exercise Tailscale hostname restrictions, password-vault authentication configuration, response-source checks and timeout handling. Production browser release gates use synthetic data and do **not** count as physical Mac/Windows/Fedora laptop or iPhone acceptance.

## Still outstanding

- **Hands-on HYPRSLAP/browser acceptance:** no separately connected laptop was available during this audit; verify site install, private tailnet reachability, AI response, speech playback/input, lock/unlock and offline recovery from the actual laptop. A test from the host itself verifies routing but not the remote network policy for that device.
- **Physical iPhone Safari acceptance:** existing `launchReady=false` and eight manual gates remain, including safe-area/status-bar and offline behavior.
- **Reliability:** standalone Qwen 4B is CPU-bound and may take ~20–100 seconds; need response-streaming/latency improvements and an owner-supervised real reboot/rollback exercise.
- **Finance:** no Investec/Nedbank official bank connection, no autonomous payments/trades, no unapproved document posting or self-training on user records. Existing dates, source provenance, classification and scikit-learn suggestion-only safeguards remain in force.

Release evidence and rollback live in the backend feature branch's `docs/COMPASS-STANDALONE-LIVE-CUTOVER-20261123.md`. No user is required to reinstall or clear their existing PWA to adopt these UI updates.
