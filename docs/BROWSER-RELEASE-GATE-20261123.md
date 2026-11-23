# Market Compass — repeatable synthetic browser release gate

Updated: 23 November 2026. **Development / CI only; this is not production acceptance or a deployment authorisation.**

## Purpose and execution

`scripts/browser-release-gate.mjs` validates the **built** Market Compass PWA in an actual desktop Edge/Chromium engine without Playwright, external services, a connected bank, real financial files or any existing browser profile.

1. Build: `pnpm --filter @workspace/market-compass run build`.
2. Windows: `node scripts/browser-release-gate.mjs`.
3. Production subpath: set `BASE_PATH=/market-compass-ios/` **during build and during the test**. The test serves the already-built artifact on two randomly selected **127.0.0.1-only** ports.
4. Optional `MC_TEST_BROWSER` supplies a supported local Edge/Chrome/Chromium executable if the usual Windows paths are absent.

The script launches a separate temporary Edge profile using a random DevTools port, then destroys its own browser/process tree and transient profile at the end. It never opens GitHub Pages, ngrok, HYPRBOX's authenticated gateway, Ollama, your usual browser profile or any live IndexedDB vault.

## Browser-level checks

- Creates a synthetic AES-GCM vault using a random test-only passphrase.
- Selects two fabricated CSV financial exports and checks individual reviews and queue progress. Saves the first and skips the second.
- Reimports the identical first export under a different filename and checks that duplicate evidence is rejected without increasing the saved record count.
- Loads the **existing synthetic encrypted PDF fixture**, verifies that missing and incorrect passwords trigger a prompt, then that `SYNTHETIC_ONLY` decrypts it into a reviewable payslip; skips without saving.
- Waits until encrypted IndexedDB auto-save completes. Inspects only the synthetic encrypted record to confirm AES-256-GCM formatting and the absence of a literal sample description.
- Uses the **download fallback** to test Backup & lock, then unlocks the same vault and checks that its saved document remains.
- Navigates to a second, independent loopback origin (different port), rejects a wrong encrypted-backup password, restores the synthetic ciphertext with the correct password and verifies document count and exact ciphertext identity.

The browser test simulates file selection and button presses through the Chrome DevTools Protocol, which is appropriate for deterministic synthetic integration tests but **does not** prove trusted human gestures or native iOS share-sheet behaviour. The download fallback is forced because programmatic `navigator.share` is rejected without a real gesture. It does not claim that iPhone Files saved a backup.

## CI enforcement

The Windows job in `.github/workflows/validate-safari-launch.yml` runs this browser test **after** its production build, service-worker offline preparation and CSS validation. Failure produces a nonzero exit status. The existing Ubuntu unit test and Windows build checks remain intact.

## Remaining physical-device acceptance

- iPhone Safari: open a *test deployment origin*, create a synthetic vault, import multiple selected files, retry an encrypted PDF password, confirm dates/amount directions, save/skip and lock/unlock.
- Tap native **Export encrypted backup**, explicitly choose **Save to Files**, verify the file exists and has data, then restore it in a separately authorised test origin. Do not overwrite the owner's real vault.
- Verify service-worker refresh, offline launch, source freshness, accessibility, VoiceOver and protected Ollama gateway functionality under the real iPhone's existing constraints.
- Preserve both independent PWA origins' vaults and the approved network gateway. Do not merge into public main or redeploy either origin without the owner-side backup and release evidence.

Synthetic browser green is a necessary **quality gate**, not an assertion of commercial launch readiness.
