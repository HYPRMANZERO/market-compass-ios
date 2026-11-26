# Market Compass — private ngrok PWA blank screen / static recovery

Date: 23 November 2026. **Static recovery performed on HYPRBOX.**

## User-reported symptom

On iPhone Safari, the existing protected ngrok PWA displayed a completely white page. The separate public GitHub Pages PWA still displayed its older dashboard because its UI-only public release candidate PR #59 has not been merged into `main`.

## Root cause — confirmed via protected loopback gateway

The previously active `index.html` had SHA-256 prefix `100F30C1D041100B`. Although the gateway correctly served `/market-compass-ios/` with HTTP 200, this HTML referenced **root-relative** `/assets/index-DIqjbTCd.js` and `/assets/index-CW8sJ9VT.css`.

The gateway intentionally serves static assets **only** under `/market-compass-ios/`; root-level `/assets/` returned HTTP 404. Their correctly prefixed equivalents returned HTTP 200. This explains why Safari received the HTML but could not execute the frontend or apply CSS. The protected network and mandatory local Ollama were running; the gateway's unauthenticated access denial was intact.

## Static-only repair

We validated the separately staged private Bootstrap bundle (`private-ffa57e5-bootstrap-20261123`) using its recorded full `index.html` SHA-256, compiled offline cache, locally bundled Bootstrap CSS and PDF.js worker. Its index uses the correct `/market-compass-ios/assets/` paths, no root-relative asset links.

Only the private gateway's **static bundle directory** was atomically replaced. The previous directory remains preserved as `public-root-assets-recovery-backup-20261123-0718` alongside the live `dist/public`. The new live HTML hash prefix is `0D20CAD59A1F6DE5`; the preserved previous HTML remains `100F30C1D041100B`.

The post-replacement `tools/check-market-compass-private-ui.ps1` succeeded, confirming:
- HTML HTTP 200 under `/market-compass-ios/`.
- Bootstrap CSS HTTP 200 with `text/css`; application JS HTTP 200 with `text/javascript`.
- PDF.js module worker HTTP 200 with correct JavaScript MIME and `nosniff`.
- Existing Tailwind utility classes are present.
- Requests without the private edge proof still receive HTTP 403.
- Unauthenticated external ngrok HTTPS still returned the expected OAuth redirect (302) before this static swap; private OAuth/real-device login must be rechecked after it.

**No gateway process restart, Ollama restart, gateway configuration change, Safari storage clearing or server-side transfer of browser vault content was performed.** The candidate is now *being served live by the private gateway*, but authenticated iPhone Safari display, unlocking, document review and encrypted backup/restore still require physical-device confirmation.

## Deployment-safety follow-up

PR #60 installed a fail-closed Vite/offline-shell build guard against compiling into this live `pwaDist`. The private source branch received that guard before this static-only promotion. Keep building into a separate `MC_PWA_OUT_DIR` and promote only reviewed contents with preserved rollback directories.

Do not infer the **public** PWA has updated: PR #59 is still open and merging it to public `main` will trigger GitHub Pages deployment. The public UI CI passes, but its older branch-to-branch financial-source parity gate remains red. No public production changes were made as part of this recovery.

## Real iPhone checks still required

Open the **same** saved private ngrok URL in Safari while authenticated, then refresh or close/reopen the existing tab. Do **not** delete web app/site data, uninstall the PWA, clear Safari history, or change its origin. Confirm the dashboard loads, header shield opens Vault & Settings, existing encrypted data unlocks, and an encrypted backup can be saved to Files. If the new frontend fails to boot or fails to unlock, preserve the device and use the previous **static-only** rollback copy. This is not a claim of full launch acceptance.
