# Finance Material UI trial (not deployed)
 
Branch: experiment/finance-material-ui-20261126. Based on public frontend main at 78f5e3f, no private data or backend changes. MUI v7 and Emotion are locally bundled (no CDN, hosted fonts, analytics or new runtime API). React 19 existing version remains unchanged. Opt-in requires VITE_MC_EDITION=finance AND VITE_MC_MUI_TRIAL=true; Personal build refuses trial flag. Only the mobile dock and quick-menu actions use real MUI components; Ionic outer shell, existing custom focus trap, route and keyboard/safe-area measurement, vault and domain logic remain intact. No global CssBaseline or theme reset. This is a hybrid pilot, not a full framework migration.
 
The existing pnpm lock is unchanged in this initial experiment: resolve new exact direct dependencies in the separate checkout using pnpm install --no-frozen-lockfile; preserve minimum release age policy. Before promotion commit reviewed generated lock, then run frozen install in CI. The branch workflow resolves dependencies, typechecks, builds both editions, prepares offline shell and uploads the Finance candidate and resolved lock for inspection. Existing production Pages workflow is untouched. No PWA deployment from this branch.
 
## Owner local preview (PowerShell)
 
Clone this experiment to a separate checkout (use D: on HYPRBOX). Then from repo root:
 
    pnpm install --no-frozen-lockfile
    $env:VITE_MC_EDITION='finance'
    $env:VITE_MC_MUI_TRIAL='true'
    $env:BASE_PATH='/'
    $env:MC_PWA_OUT_DIR='D:\MarketCompass\Releases\finance-mui-trial-20261126'
    pnpm --filter @workspace/market-compass run build
    node scripts/prepare-offline-shell.mjs
    pnpm --filter @workspace/market-compass exec vite preview --config vite.config.ts --host 127.0.0.1 --port 5175
 
Preview is desktop loopback only. Do not enter real financial records into new origin; use synthetic vault. Do not serve preview publicly or change existing ngrok OAuth or gateway settings. Existing protection script denies build into the configured live dist. For protected ngrok test on iPhone, owner must explicitly back up current dist/settings, verify gateway's CSP permits Emotion styles, and switch only the Finance static candidate after three test rounds; retain same origin and service worker update, no clearing website data. 
Verify Home/Markets/AI/Menu, pending badge, account and import actions, focus return, keyboard dismissal, safe areas, dark mode, data retention, offline restart and bundle size against current baseline. Existing backend gateway and original Personal PWA stay untouched. If preview fails, abandon the candidate without changing the live directory.
