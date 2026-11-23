# Compass Ionic and Jarvis-style local assistant integration

Updated: 23 November 2026
Scope: original GitHub Pages Market Compass PWA. No secrets or private account information belong in this repository.

## Implementation status

- DONE: Compact `Compass` assistant header replaces oversized "Just ask" banner on the original Ionic PWA.
- DONE: Chat gets most of the available height; safety guidance is under an expandable disclosure.
- PRESERVED: Push-to-talk browser speech input, speaker toggle, Enter to send, offline queued questions requiring manual sending, optional agent mode limited to three read-only tools.
- PRESERVED: GitHub Pages original PWA remains a separate encrypted vault from the protected ngrok PWA. Never copy secrets or silently synchronize browser records.
- PRESERVED: Optional owner-configured HTTPS Tailscale AI connection from compatible authenticated devices. It is **not** an automatic public API or a general ngrok relay. The iPhone 11 currently uses the authenticated private ngrok edition without Tailscale.
- SOURCE FOUND: Owner supplied `Jarvis-Local-Assistant.zip`. Actual Python CLI in `local-jarvis/` was reviewed; all 28 isolated, mocked Python tests passed. The source uses Vosk/pyttsx3, deterministic browser/app commands and an Ollama-only loopback API. Only safe browser-local intents were ported to Compass; desktop program launches and microphone processes are not exposed to the PWA. See `docs/JARVIS-SOURCE-AUDIT-20261123.md`.
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

## Jarvis source review and staged integration

The owner's uploaded `Jarvis-Local-Assistant.zip` was inspected without running the desktop agent. Python CLI code lives in `local-jarvis/`; its Vosk wake-word clip loop, pyttsx3 replies, local app-discovery logic, website commands, music links and Ollama chat client have all been reviewed. 28 existing mocked Python tests passed. The new safe web-intent router lives at `src/lib/jarvisPersonalCommands.ts` and is covered by tests and a Chromium chat interaction. Desktop app launching, on-device microphone services, NewsAPI credentials and auto-start remain explicitly out of scope. See `docs/JARVIS-SOURCE-AUDIT-20261123.md` for detailed file-by-file findings.

The original PWA must not be changed to call the owner-protected ngrok service from the public GitHub Pages origin. If a device is actually joined to the authorized Tailscale network, use the existing authenticated private URL with strict origin permissions. The public edition remains useful offline for deterministic local functions even with no desktop AI.

## Release verification and follow-up

- TypeScript and the full test suite must pass.
- Synthetic browser release gate must pass at mobile and desktop widths, including navigation, vault unlock, PDF password imports, document review, backup and scrolling.
- Compare known menu labels, assistant status, read-only agent mode and microphone behavior between private and original Ionic builds.
- Before any iPhone claim, obtain an actual owner-run physical Safari/PWA confirmation. CI and Chromium do not substitute for that.
- Source-specific review, safe-intent patch and mocked tests are now recorded. A Windows companion runtime, local voice verification and action permission matrix still require separate review and explicit owner approval.
