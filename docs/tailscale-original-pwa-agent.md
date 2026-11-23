# Original Market Compass PWA — Tailscale agent and voice integration

This branch ports the **read-only Agent mode**, source trace, draft-only reminders,
and configurable browser-native English speech into the **original GitHub Pages PWA**.
It does not deploy ngrok or include financial records, credentials, desktop settings,
encrypted vault data, or browser tokens in Git.

## What is shared and what is not

- private desktop runs the private Ollama bridge on **127.0.0.1:8788** with its existing
  DPAPI-protected bearer token and read-only source adapters.
- authorized management laptop, iPhone, and private desktop join the **same private Tailscale tailnet**.
  On private desktop, Tailscale Serve can provide a private HTTPS `*.ts.net` URL to
  that loopback bridge. Use **Serve**, never Funnel.
- In the original PWA's **Assistant → Desktop Ollama**, save the exact `*.ts.net`
  origin and the separate desktop AI bearer token in its encrypted vault.
- The PWA's source is public static code. Its private data stays inside
  device-local, password-encrypted IndexedDB. Tailscale connects the backend,
  **not browser vaults**; encrypted backup export/import remains the supported
  method of moving records across devices or website origins.
- Browser network/CORS rules can vary. The private bridge must explicitly permit
  the original PWA origin; do not use wildcard CORS, public port forwarding,
  or send the bearer token to a non-tailnet host. A same-origin, Tailscale-hosted
  copy of the static PWA is the fallback if cross-origin browser access is blocked.

## Desktop setup (only when the tailnet has been configured)

1. Install and sign in to Tailscale on all three devices. Enable MagicDNS and
   HTTPS certificates for the tailnet. Verify tailnet ACLs restrict access.
2. Keep the current desktop AI bridge bound to loopback only. From private desktop
   PowerShell, verify `tailscale version` and `tailscale status`.
3. With the desktop bridge healthy, run `tailscale serve --bg 8788` to expose
   the *existing* local API privately. Check `tailscale serve status` and record
   the exact HTTPS `*.ts.net` URL it reports. Do not enable Funnel.
4. Open the original GitHub Pages PWA on each device; unlock its own encrypted
   vault and save that exact Tailscale URL under Desktop Ollama. Enter the
   desktop bearer token *in the app only*, never in chat or GitHub.
5. Enable financial-context sharing only on the intended PWA vault.
   Agent mode can request permitted read-only source inventory, historical
   plan context (once the separate desktop patch is deployed), debts and
   explicit Luno balances. It cannot pay, trade, write the vault, or schedule
   reminders; action requests are review-only drafts.
6. Test `/api/session` from the app, Agent mode's source trace, the voice
   preview, and offline handling with Tailscale disconnected. Do not replace
   original Home Screen icons or erase vaults during migration.

## Safety and limitations

- iOS needs the Tailscale VPN connected to reach private `*.ts.net` services.
  Different devices share AI source-of-truth, but not automatically the same
  expense entries, account values, encrypted vault password, or offline files.
- Historical desktop records are **not current bank-verified balances**.
- The private desktop bridge and Ollama must be running for AI and tool access;
  the original PWA's offline features remain device-local.
- Source and UI changes need build, test, review and explicit deployment before
  they appear in the original PWA on devices.
