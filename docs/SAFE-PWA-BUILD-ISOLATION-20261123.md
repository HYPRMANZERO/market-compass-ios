# Market Compass — protected live PWA build isolation

Updated: 23 November 2026. Build-safety change, **not** deployment authorisation.

## Issue found and recovered

HYPRBOX's private authenticated gateway currently points `pwaDist` at the same `artifacts/market-compass/dist/public` directory used by an ordinary Vite build in the active checkout. A regular validation build on 23 November therefore temporarily replaced the gateway's live static files. This affected **compiled PWA files**, not Safari's AES-GCM IndexedDB vault, credentials, Ollama process or gateway settings.

The former static files were recovered from a separate local worktree by **exact SHA-256 match** to a hash recorded before the build. After restoring static files only, the previous `index.html` hash prefix was `100F30C1D041100B`. The accidental newer build remains preserved in a separate candidate directory for review; the old static copy is also preserved. No browser storage was cleared and no service was restarted.

**Important qualification:** the restored historical `index.html` references root-level `/assets/` rather than `/market-compass-ios/assets/`. The hash confirms the previous bytes, not correct functionality through the authenticated subpath. Existing real-iPhone asset routing and service-worker acceptance must be independently verified before any release claim.

## New fail-closed guard

`scripts/protect-gateway-dist.mjs` reads only the `pwaDist` setting from the locally installed HYPRBOX gateway config. It supports UTF-8 BOM in PowerShell-written JSON, never prints secrets or the gateway hostname, and fails closed if the settings are unreadable.

- Vite's `configResolved` hook rejects every build output that **equals, contains or is contained by** the active `pwaDist`, including final CLI `--outDir` overrides, before Vite clears the destination.
- `scripts/prepare-offline-shell.mjs` applies the same guard before writing the service worker.
- Ordinary CI and developer machines **without** local gateway settings are unaffected, including the public GitHub Pages workflow.
- `MC_PWA_OUT_DIR` selects an explicit separate static output directory. The private feature branch has an additional CSS verification script; the original public GitHub Pages branch uses its existing CSS checks in `pages.yml` and `validate-public-bootstrap.yml` instead.

### Example local staging (PowerShell)

```powershell
$env:BASE_PATH = '/market-compass-ios/'
$env:NODE_ENV = 'production'
$env:MC_PWA_OUT_DIR = Join-Path $env:LOCALAPPDATA 'MarketCompass\ReleaseCandidates\next-private-ui\public'
Set-Location C:\Users\liamd\market-compass-ios\artifacts\market-compass
.\node_modules\.bin\vite.cmd build --config vite.config.ts
Set-Location C:\Users\liamd\market-compass-ios
node scripts/prepare-offline-shell.mjs
if (Test-Path scripts/verify-private-ui-css.mjs) { node scripts/verify-private-ui-css.mjs }
Remove-Item Env:MC_PWA_OUT_DIR
```

Do **not** use the active private gateway directory as the output destination. Build, review SHA-256, test through an isolated authenticated preview origin, export both iPhone vaults, check the native Safari/Files flows, then use a separately reviewed atomic file promotion and rollback. A staged static bundle is not live.

## Evidence

- Three Node regression tests cover protected/ancestor/descendant paths, UTF-8 BOM, corrupted config and staging paths using invented settings only.
- Full end-to-end mock integration ran Vite and offline-shell operations against a **fake** private gateway path: both refused to write and the sentinel static file remained byte-for-byte intact.
- A separate worktree's ordinary Vite build, offline shell and CSS verification passed with the installed real HYPRBOX gateway configuration, without touching the active static directory.
- The feature release branch's existing financial tests and Windows CI must remain green. No real source documents or passwords are used.
