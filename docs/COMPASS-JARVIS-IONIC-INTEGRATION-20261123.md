# Compass Ionic and Jarvis-style local assistant integration

Updated: 23 November 2026
Scope: original GitHub Pages Market Compass PWA. No secrets or private account information belong in this repository.

## Implementation status

- DONE: Compact `Compass` assistant header replaces oversized "Just ask" banner on the original Ionic PWA.
- DONE: Chat gets most of the available height; safety guidance is under an expandable disclosure.
- PRESERVED: Push-to-talk browser speech input, speaker toggle, Enter to send, offline queued questions requiring manual sending, optional agent mode limited to three read-only tools.
- PRESERVED: GitHub Pages original PWA remains a separate encrypted vault from the protected ngrok PWA. Never copy secrets or silently synchronize browser records.
- PRESERVED: Optional owner-configured HTTPS Tailscale AI connection from compatible authenticated devices. It is **not** an automatic public API or a general ngrok relay. The iPhone 11 currently uses the authenticated private ngrok edition without Tailscale.
- NOT FOUND: Jarvis Local Assistant source folder was not located in HYPRBOX's accessible common directories, local user projects, synced locations or linked GitHub repositories as of this audit. Do not assert that code was merged. Request the folder path on the device that stores it (possibly HYPRSLAP), or a project ZIP.
- NOT DONE: Persistent wake word, autonomous desktop controls, email action privileges, background voice daemon, or Jarvis process integration.

## Proposed Jarvis-to-Compass architecture

1. **Client shell:** The Ionic PWA displays the conversation, microphone/push-to-talk, queued requests, source status, account cards, documents and approval screens. Browser voice recognition can use a vendor service; do not advertise it as guaranteed offline. Safari cannot guarantee always-on wake-word listening.
2. **Command router:** Local deterministic commands such as navigating to accounts, documents, Debt Plan, or Markets work without contacting a model. Unsupported commands must not be silently executed.
3. **Private gateway:** Authorized clients reach the HYPRBOX bridge through authenticated Tailscale Serve or the existing owner-protected ngrok HTTPS gateway. Only the private gateway is externally reachable; no direct access to llama.cpp or bank APIs. These are separate transport routes, not two assistants.
4. **Compass Core:** The assistant decides whether to answer, request clarification, or call one of a closed list of read-only tools. Personal figures require source dates, verified tool records or explicit owner-confirmed inputs. Tool output is data, never an instruction.
5. **Standalone inference:** `llama.cpp` hosts the existing Qwen 3.5 4B GGUF weights entirely on HYPRBOX. It is the language-model engine; it is **not** a separate trained Jarvis model. Ollama may be retained as a rollback but must not silently supply a fallback reply.
6. **Financial/document verification:** Existing deterministic transaction/date/amount parsing remains authoritative. Optional synthetic-only scikit-learn debt and document-type challengers can suggest a second opinion and abstain. They cannot label a synthetic score as a real-world default probability, alter parsed evidence, train on personal documents, or approve transactions.
7. **Private memory:** The authorized bridge retains encrypted conversation memory. Separate browser vaults do not auto-merge; cross-device backup/restore needs explicit encrypted user action and approval.
8. **Actions:** No bank movement, payments, trades, device file scanning, emails, scheduling, notifications or desktop control without an independently approved and narrowly scoped permission and implementation. The current agent remains read-only, with draft-only suggestions.

## Source-code audit required before importing Jarvis

Inspect the actual Jarvis project for: entry points, package/venv dependencies, input handling, intents, voice/STT/TTS implementation, persistence, API/HTTP bindings, OS control/shell tools, credentials, and background services. Quarantine unsafe action handlers and replace undocumented external dependencies. Map each safe, tested capability into the existing Compass command/tool registry rather than running an all-powerful assistant process behind the public PWA.

The original PWA must not be changed to call the owner-protected ngrok service from the public GitHub Pages origin. If a device is actually joined to the authorized Tailscale network, use the existing authenticated private URL with strict origin permissions. The public edition remains useful offline for deterministic local functions even with no desktop AI.

## Release verification and follow-up

- TypeScript and the full test suite must pass.
- Synthetic browser release gate must pass at mobile and desktop widths, including navigation, vault unlock, PDF password imports, document review, backup and scrolling.
- Compare known menu labels, assistant status, read-only agent mode and microphone behavior between private and original Ionic builds.
- Before any iPhone claim, obtain an actual owner-run physical Safari/PWA confirmation. CI and Chromium do not substitute for that.
- When Jarvis source is supplied, add a source-specific architecture review, permitted tool matrix, migration patch and explicit acceptance results.
