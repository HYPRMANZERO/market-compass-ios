# Market Compass — Safari-only offline-first owner budget and question queue

## Goal and current boundary

The owner is using an iPhone 11 with Safari and two already-installed web apps.
They cannot currently install additional iOS apps. HYPRBOX can be running at
home, but the iPhone may have no network connection or may be unable to reach
a private Tailscale-only endpoint.

**A phone with no network cannot remotely communicate with an online PC in
real time.** Offline-first means local work and a durable, reviewable queue
that can be sent **after reconnecting**, not fictitious persistent access.

## Implemented in both PWA editions

1. **Owner budget draft** under **Expenses → Owner budget**:
   - Accept a strict, bounded \`market-compass-owner-budget-v1\` JSON document.
   - Preview before the owner explicitly saves.
   - Save only within the existing, passphrase-encrypted PWA workspace.
   - Leave current entries/debts, separate encrypted browser vaults, tokens
     and installed Home Screen app untouched.
   - Treat salary, incentive, hourly rate, normal costs, exceptional months and
     historical statements as owner-reported *planning figures*.
   - The existing backend financial mirror remains separate: saving a draft
     on this iPhone does **not** send anything to HYPRBOX or the other PWA.
2. **Offline question queue** in Assistant:
   - Locally answer known read-only finance questions when possible.
   - For unknown or missing historical-source questions, offer local queueing.
   - Only short, syntactically read-only requests are eligible for the queue,
     such as “Review my budget” or “What is my hourly pay rate?”
   - Maximum 20 pending, no duplicate exact questions, 500-character limit.
   - Each question retains a unique ID and the time it was entered.
   - Questions **expire after seven days for dispatch**; expired items remain
     visible until the owner removes them. Never silently discard a queue.
   - No request is automatically transmitted on reconnection, browser resume
     or background sync. The owner must unlock the PWA, connect to HYPRBOX,
     review the question and tap **Send now · read-only**.
   - A queue entry is removed only after the bridge returns an authenticated,
     validated read-only agent response.
   - Questions about payments, trading, moving funds, shell commands,
     installation, deleting files and direct device control are rejected.
   - Local encrypted queue state is not yet server-side job scheduling.
3. **Voice**:
   - Speak available local answers with Safari-native speech, if enabled.
   - Voice recognition support is browser dependent; typing and the iPhone
     keyboard microphone remain the fallback when offline.
   - Safari may not expose every iOS downloaded premium voice.

## What is and is not mirrored

| Item | PWA vault | HYPRBOX shared owner profile | Second PWA |
|---|---|---|---|
| New owner budget draft | Encrypted on the device where saved | Not automatically transferred | Not automatically transferred |
| Existing HYPRBOX budget (once owner imports) | Read-only rendered reference | Encrypted authoritative file | Same read-only reference when connected |
| Offline read-only question queue | Encrypted and origin-specific | No server task exists until owner sends | Its own encrypted queue |
| Agent answer after owner sends | Visible in current PWA conversation | Read-only agent and approved memory behaviour | Not automatically copied to another vault |

The original PWA uses private **Tailscale Serve** for its HYPRBOX AI link.
The second PWA uses the existing protected **ngrok gateway**. Without an
installed Tailscale app, the user's iPhone can still use the browser-accessible
protected ngrok route when online, but the Tailscale-only route cannot be
reached through the public internet.

## Future: real remote supervisory device commands (NOT implemented)

A future HYPRBOX/HYPRSLAP agent can offer owner-approved command classes:
- **Read-only:** status of allowed services, logs, document inventory,
  source freshness, health checks; no arbitrary full-disk reads.
- **Limited maintenance:** pre-registered, parameter-validated scripts only,
  version pinned and bound to the logged-in owner. All stateful operations
  require an explicit, fresh, per-device confirmation and a rollback plan.
- **High-risk:** money transfers, trading, banking credentials, destructive
  or unrestricted shell actions are **not eligible for an offline queue**.

Security architecture required before enabling any such command:
1. Owner-only authentication to the protected ngrok app; rotating short-lived
   sessions and separate device-level authorisation.
2. No exposed Windows SSH/PowerShell port. Device agents initiate outbound
   secure links and reject unsolicited arbitrary command execution.
3. A typed allowlist of operations, narrow scopes, server-side validation
   and a **new** authorization check independent of the browser.
4. Nonces, monotonically tracked IDs/idempotency, expiry and replay
   protection; clear pending/running/failed/completed receipts.
5. Explicit approval at execution time for each state-changing task.
6. No live trading, payments or credential management through the bot.
7. Read-only actions can be queued for execution when a target device
   later comes online, but only if the owner had approved that class of
   work. A disconnected iPhone cannot send newly entered tasks until it
   gains network connectivity.

On iOS Safari, background synchronization while the PWA is closed is not
guaranteed. The correct initial behaviour is **foreground reconnect and
review**, never promises of continuous background operation.

## Verification before claiming deployment

- GitHub CI: strict TypeScript typecheck, synthetic budget draft tests,
  offline queue tests, existing source-health and voice tests, production
  build, offline asset shell and protected Windows build.
- Owner: confirm App Store restrictions do not require any new installation;
  existing original and protected Home Screen apps still open.
- Owner: unlock each *existing* workspace and verify that saving a draft
  triggers the encrypted auto-save confirmation.
- Offline: disable network briefly while keeping PWA open; check a local
  salary question from the saved draft; queue a remote historical-source
  question. The question must remain queued after the app is reopened
  and unlocked, with no HTTP traffic attempted while offline.
- Online: reconnect through the existing protected ngrok app; manually
  submit one queued read-only question to a verified backend. Confirm
  its result and that exactly one queued item is removed.
- No production success claims until tests on both real devices pass.

**Status:** application code implemented in PRs; a GitHub merge does not
remotely update already-served HYPRBOX static assets or install private
owner financial data. Actual offline/on-device acceptance remains pending.
