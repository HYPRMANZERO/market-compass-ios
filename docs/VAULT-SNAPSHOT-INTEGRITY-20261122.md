# Market Compass — encrypted vault integrity before iPhone release

Updated: 22 November 2026. Development branch only; no live vault was read, altered or migrated.

## Correctness safeguards

- Daily encrypted restore points use `storeDailySnapshot` only; they do **not** replace the authoritative live workspace. A snapshot may be older than the newest user edits. A background backup never updates the live "Last saved" timestamp.
- "Backup & lock app" now serializes behind all pending IndexedDB writes, encrypts the latest unlocked workspace, and commits a final record **before** clearing React state/password. Earlier queued auto-saves are generation-fenced so older jobs cannot follow the final write. A failed final write leaves the app unlocked and shows an error.
- While the last encrypted write completes, a modal overlay blocks user interaction. An unchanged last-record reference is required before offering Export: changes made during the 350 ms debounce are **not** eligible for an older backup.
- The share sheet's success confirms sharing intent, **not** that Files retained a backup. Backup & lock therefore asks the owner to confirm the encrypted export was saved before locking. Browser storage is still distinct for each PWA origin and device.
- Locks do not persist document passwords or original PDF bytes. HYPRBOX's Ollama remains inaccessible directly to the public Internet; vault logic uses local browser WebCrypto and IndexedDB only.

## Limits / caveats

- Force-closing Safari or a mobile OS process before an in-flight IndexedDB transaction finishes may still lose the newest uncommitted edits. Do not promise a background durable save after process termination. Owners should check Last saved and export the encrypted backup while the page remains open.
- Daily snapshots remain bounded to seven locally encrypted historical restore points. They are not automatic off-device backups. In-app schedules run only while open and unlocked.
- Integration tests use synthetic objects; an actual iPhone Safari full-cycle check and independent verification of saved-to-Files exports are required before deployment.

## Mandatory owner acceptance

1. Back up the current live iPhone vault first, confirm the output file exists in Files, and never clear Safari site data.
2. On a separate *test origin* with synthetic values, create vault, edit Spend and Debt, immediately trigger Backup & lock, then unlock and verify the latest values remain unchanged.
3. Repeat after changing values while auto-save is pending. Ensure the Export button stays disabled until Last saved updates.
4. With local IndexedDB write failures simulated in development, verify the app **stays unlocked** and reports a save/lock error.
5. Enable daily snapshot, edit a value during preparation, and verify the live workspace shows the newer value after relaunch. An older snapshot must not roll it back.
6. Export the vault, verify Files contains a non-empty encrypted `.mc-vault.json` record, restore to a separate test origin and verify plaintext never appears in the export.
7. Repeat for both private ngrok and GitHub Pages PWA editions; never combine their independent vaults.

Automated checks: `tests/vault-safety-smoke.test.mjs`, `tests/import-hardening.test.mjs` and the full `node --test tests/*.test.mjs` suite.
