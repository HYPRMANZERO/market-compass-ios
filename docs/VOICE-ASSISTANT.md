# Market Compass voice assistant · iPhone 11, Windows desktop and laptop

**Status:** Offline commands are included in the installable PWA. A persistent encrypted-vault connection to self-hosted Ollama can reconnect automatically when the app is unlocked. Push-to-talk and spoken replies still depend on the device browser.

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

## 3. Set up a persistent desktop AI host (Windows)

The desktop runs Ollama and the private Financial Advisor Node bridge. Tailscale Serve makes the bridge available **only** on the owner's tailnet, not the public internet.

Your existing `tailscale serve --bg 8788` configuration is persistent as long as Tailscale remains running. You do not need to re-enter it each time.

### One-time desktop setup

Use your normal Windows account (not an elevated Administrator window) for the Windows startup setup. In PowerShell:

```powershell
cd C:\Users\<Windows-user>\financial-advisor
git pull origin main
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup-market-compass-ai.ps1
```

The interactive setup:
- Detects an installed Qwen 3.5 tag using `ollama list` (or pass `-Model "your-exact-tag"`).
- Uses the `MC_AI_TOKEN` already present in the PowerShell session, or asks for the **same** separate 48+ character token previously entered into Market Compass.
- Encrypts the token using **Windows DPAPI for the signed-in Windows account** in `%LOCALAPPDATA%\MarketCompass\PrivateAI\operator-token.dpapi`. The token is not committed to Git, and not placed in a startup command or config file as plaintext.
- Saves non-secret model and executable settings to `%LOCALAPPDATA%\MarketCompass\PrivateAI\bridge-settings.json`.
- Installs a Windows **Startup** shortcut to launch the private Node bridge automatically at **your Windows sign-in**.
- Starts the bridge now if port `8788` has no listener and reports a local connectivity result.

A startup log lives in `%LOCALAPPDATA%\MarketCompass\PrivateAI\bridge-startup.log` (no token values or financial input logging). If you move the project folder, rerun setup.

Test the service from another PowerShell window:

```powershell
Test-NetConnection 127.0.0.1 -Port 8788
tailscale serve status
```

The first should say `TcpTestSucceeded : True`, and Tailscale Serve should show a private `.ts.net` HTTPS address forwarded to `http://127.0.0.1:8788`.

If you already have an old Financial Advisor bridge process listening on port 8788, stop it first before rerunning setup to apply changes. Don't expose ports 8788 or 11434 on your public router, and **never use Tailscale Funnel**.

**Availability limits:** The installed startup shortcut runs when your Windows user signs in. It does not provide a machine-wide service when nobody is logged in. Keep the desktop powered on, signed in, awake and connected to Tailscale. Windows sleeping, shutting down, signing out, or losing network connectivity will temporarily interrupt iPhone chat. Offline debt calculations remain available. For unattended access after reboot without login, a separately reviewed Windows service and Tailscale unattended configuration would be required.

### Revoke desktop autostart

Remove the `Market Compass Private AI.lnk` shortcut from your Windows Startup folder to disable automatic bridge startup. You may also delete the user-scoped `%LOCALAPPDATA%\MarketCompass\PrivateAI` directory **after stopping the bridge** to revoke saved local configuration. This does not remove tokens from encrypted Market Compass backups; rotate the token if a device or backup is lost.

## 4. Save the iPhone/laptop connection ONCE

Open **Market Compass → AI → Desktop Ollama · saved connection**:

1. Paste the private `https://<desktop>.<tailnet>.ts.net/` URL, or the bare tailnet hostname.
2. Paste the matching 48+ character `MC_AI_TOKEN` for that desktop.
3. Only enable **Share entered financial figures** if you want to transmit that summary to your **own** private desktop for open-ended answers. This is off by default.
4. Tap **Save & reconnect automatically** once. The complete settings, including the AI access token, are stored in the **AES-GCM password-encrypted workspace** on this device. They are NOT put into localStorage, browser URLs or GitHub Pages source.
5. The app tests `GET /api/session` with the authenticated token and checks that the configured Ollama model is installed. It displays **Desktop model available** only after both checks pass.
6. Return to the AI tab after a later restart: once the vault is unlocked, the connection is restored automatically. It also retries on browser visibility changes, when the network comes back, and periodically while the app is open.

Use **Check connection now** to retry without re-entering settings, **Pause connection** to retain the encrypted token without connecting, or **Forget credentials** to remove it from the current workspace. Your encrypted backup files may still include an earlier copy of the token.

The conversation itself remains in page memory, not saved to the vault. Supported questions are always answered by the local deterministic engine; open-ended questions use private Ollama only when it is reachable.

Each device has its **own encrypted vault**, so saving settings on the iPhone does not magically provision the laptop. To bring the same connection settings to a second device, restore an *encrypted vault backup* there, or save the connection once on that device. Never send an unencrypted vault or token via a public link.

Browser/PWA limits remain: the iPhone cannot run Ollama in the background, stay awake when the app is closed, or skip the owner's vault unlock. Saving credentials does not grant the AI permission to make payments or trade.

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
