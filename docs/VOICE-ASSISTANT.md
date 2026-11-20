# Market Compass voice assistant · iPhone 11, Windows desktop and laptop

**Status:** Offline typed commands are included in the PWA. Push-to-talk and spoken replies depend on the device browser. An optional, separately running private Ollama server is required for open-ended AI conversations.

The **AI** tab is no longer connected to the old, nonexistent GitHub Pages command API. It answers supported questions directly using the unlocked, locally encrypted workspace.

## 1. Try the AI tab immediately on iPhone

1. Open https://hyprmanzero.github.io/market-compass-ios/ from its Home Screen icon (or Safari) and unlock your existing vault.
2. Open the **AI** bottom tab.
3. Tap **What is my total debt?** or type it and tap Send. If you have no debt accounts yet, it explains why there is no total instead of fabricating one.
4. Try **How much extra can I afford?**, **What market data is saved?**, and **Open Debt Plan**.
5. Turn on the **speaker** icon to hear supported responses. Tap the **microphone** and allow permission if Safari supports speech recognition. The iPhone's *keyboard dictation microphone* is a fallback when speech recognition is unavailable.

**Browser speech recognition is not guaranteed offline**: Safari may use Apple's or another browser-provided speech service, and may be unavailable in some iOS contexts. The app's typed command interpreter is offline and does not contact a server. Spoken replies depend on the OS speech synthesis capability.

This is **not** a replacement for Siri. It has no continuous wake-word, cannot listen while the PWA is closed or in the background, and cannot control the whole operating system. The user must unlock the vault and intentionally open the assistant.

## 2. Region and currency (no silent FX conversion)

In the app tap the **shield** icon at top right → expand **Encrypted vault & settings** → **Local currency & region**.

- Choose **South Africa · ZAR** for local rand values, or another available country and currency.
- Selecting ZAR does **not** turn a historical USD market candle into a ZAR candle. In Markets the original price and chart remain in the exchange's native currency.
- When online, Market Compass can fetch a **dated approximate FX reference** from the public Frankfurter v2 API (no API key) and display a converted latest closing price alongside the original. This is not a live bank FX or trade quote. A previously fetched FX rate remains in the encrypted local vault for offline viewing.
- Changing a debt currency never silently converts saved balances, reserves or monthly payments. You must re-enter amounts in the chosen currency and confirm the review banner.

## 3. Desktop Ollama: optional connected conversations

This section is needed only for open-ended conversations, not for the offline command engine.

On your **Windows desktop**, install and log into [Tailscale](https://tailscale.com/), with the same tailnet on the iPhone and laptop. Run Tailscale Serve, NOT Funnel. Funnel would publish a private API to the internet.

From PowerShell in your **private** `financial-advisor` checkout:

```powershell
cd C:\Users\liamd\financial-advisor
git pull origin main
ollama list
```

The private bridge defaults to `llama3.1`. If that model is not installed, download it once:

```powershell
ollama pull llama3.1
```

Create a **cryptographically random**, separate access token. Do not reuse the Market Compass vault password and do not paste the token into chat or GitHub:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:MC_AI_TOKEN = [Convert]::ToBase64String($bytes)
$env:MC_OLLAMA_MODEL = "llama3.1"
node .\server\market-compass-ai.mjs
```

Keep this PowerShell process running. Copy the token privately to your phone, for example through your password manager. The bridge listens only on `127.0.0.1:8788` and sends model requests only to your local `127.0.0.1:11434`; it has no banking or trading tools.

In a **second PowerShell window opened as Administrator** (Tailscale's Windows requirement), after installing Tailscale, run:

```powershell
tailscale serve --bg 8788
tailscale serve status
```

Tailscale displays a private `https://<your-desktop>.<your-tailnet>.ts.net/` URL. Enable HTTPS when prompted by Tailscale. Confirm that both your iPhone and desktop are connected to the same tailnet. If the desktop goes to sleep or Ollama shuts down, remote chat will stop; offline typed commands continue functioning.

**Never** open firewall port 8788 or 11434 to the public internet, use `tailscale funnel`, or copy Ollama secrets to GitHub Pages.

## 4. Connect in the AI tab

Open **AI → Connect private desktop Ollama**, then:

1. Enter the Tailscale **HTTPS hostname**, including the trailing slash (accepted hosts must end in `.ts.net`).
2. Paste your private access token (48+ characters, not saved in the vault or persisted by the app).
3. Leave **Share my entered financial summary** unchecked unless you explicitly want to send those user-entered details to your own desktop for that conversation.
4. Tap **Test and connect desktop AI**. The connection test now authenticates your token and checks Ollama's installed-model list. It reports connected only after both pass. The model must still successfully generate a reply to complete end-to-end verification.
5. Ask an open-ended question, such as **Explain the difference between snowball and avalanche debt repayment**. A reply labeled **Desktop Ollama** confirms the working full pipeline.

If the private connection is lost, a clear error is displayed and the local command engine remains available. CORS only accepts the deployed PWA's HTTPS origin and every chat request requires the separate operator token.

## 5. Three devices and offline rules

| Device | Offline | Online through private tailnet |
|---|---|---|
| Desktop | Installed PWA + cached market history + debt tools + optional locally running Ollama | Hosts the private AI service |
| Laptop | Installed PWA with local debt and market calculations | Can ask desktop Ollama, or become a separately configured backup host |
| iPhone 11 | Installed PWA with local text commands, encrypted vault and saved market candles | Can speak via browser speech recognition when supported and reach desktop Ollama |

Encrypted vaults are **per device**, not automatically synchronized. Use **Encrypted vault & settings → Export encrypted backup** and import the backup on another device. Avoid deleting an installed app or clearing website data until the backup is verified.

## 6. Important financial controls

The offline command engine can answer questions using entered debt balances, minimum monthly repayments, relative APRs, recurring budget headroom and saved market prices. It will not pay loans, initiate transfers, buy or sell securities or claim unverified funds are available.

The desktop model's conversational replies are explanatory and may be incorrect. Debt repayments remain constrained by the app's deterministic affordability and reserve checks, scikit-learn models are only synthetic research challengers, and **payment approvals remain manual**.

**Still requires a real-device check:** microphone permissions in the installed iOS PWA and the desktop-to-iPhone HTTPS connection cannot be validated from GitHub Actions. Speech support depends on iOS version and the chosen browser.
