# Jarvis Local Assistant — source audit, safe Compass migration

Date: 23 November 2026. User-supplied archive: `Jarvis-Local-Assistant.zip`. This document records inspected source, not presumed runtime capabilities.

## Audited source

The usable application is `local-jarvis/`, an independently installable Python 3.10+ CLI under `src/jarvis_local/`. The surrounding TypeScript/Replit Express, database, and mockup directories are mostly scaffolding and are **not** an authenticated Jarvis HTTP interface. The archive also contains an embedded `generated-artifacts/jarvis-local.zip` of the CLI and `.git/` history; neither is copied into the PWA.

- `assistant.py`: typed command and optional wake-prefix routing; greetings, local clock/date, sites, searches, music-library links, optional NewsAPI headlines and local-AI fallback.
- `programs.py`: Windows shortcut/Start-menu app enumeration and launching, plus configurable explicit commands. It does not run free-form shell commands but its discovery may include *all* installed apps, so this is **not suitable for direct remote PWA access**. Require narrowly scoped owner-approved app allowlist and on-device confirmation in any future desktop sidecar.
- `voice.py`: explicit consent before microphone use; short clips via SpeechRecognition + local Vosk offline English STT, voice replies through pyttsx3. This is not a continuous OS wake-word service; it listens only while an owner-enabled process is running.
- `voice_setup.py`: downloads a bounded Vosk model archive after explicit setup, with extraction path validation. Do not trigger downloads on PWA startup.
- `local_ai.py`: loopback-only Ollama `/api/chat` calls, no cloud fallback, fixed proxy-disabled opener and bounded responses. It does **not** currently support llama.cpp authentication or the protected Compass gateway; a separate authenticated local adapter is necessary.
- `actions.py`: five known websites, encoded Google search, NewsAPI on demand. Original NewsAPI implementation passes its key via query parameters, which can leak to logs; do not port keys into browser source or public routes.
- `settings.py`: per-user local JSON configuration, music library, explicit app command mappings, news key, voice model path and local model URL. The included config example has placeholders only; production secrets must use existing Windows DPAPI/encrypted-vault controls, not copied static config files.
- The Replit `replit.md` incorrectly advertises optional Gemini: the inspected Python runtime and README actually use Ollama. Treat the executable source as authoritative, not the stale Replit notes.

## Verified tests (source only)

28 Python `unittest` tests passed in an isolated sandbox without microphone, outside network, NewsAPI, Ollama, Windows app launching or bank data. This verifies the mocked behaviors and static assumptions—not microphone compatibility, real app launching, model accuracy or iPhone behavior.

## Integrated into the two Market Compass Ionic PWA source trees

The new browser-safe `jarvisPersonalCommands.ts` ports only deterministic, non-privileged intent behavior:
- Accept optional **Compass** or legacy **Jarvis** wake prefix.
- Answer local device time/date without calling an LLM.
- Offer **user-click-only** links to exactly YouTube, Google, Spotify, GitHub and WhatsApp Web.
- Offer explicitly requested encoded Google search or Google News **links**; do not auto-open, fetch results, claim a verified headline or send a request unless the user taps.
- Reply that playing personal music or launching desktop applications is **not configured/authorized** in the PWA.
- Reject javascript:, file:, raw arbitrary website commands, control characters and overlong search queries.
- Preserve financial safety checks, owner-specific financial context handling, per-device encrypted vault, the read-only agent, and original private-model routing.
- Extend chat bubbles only with links produced by the deterministic helper. They open in a separate tab with `noopener noreferrer`.

New independent unit tests and synthetic Chromium browser interaction verify safe links, wake prefixes, money-movement refusal, HTML anchoring, Enter-to-send and encrypted-vault compatibility. See repository test logs and verified workflow status for commit-specific evidence.

## Not yet installed or permitted

The Jarvis Python desktop process, live Vosk voice model, pyttsx3 desktop audio, music-link library, Windows app discovery/launching, and NewsAPI are **not** activated as an agent API. The authenticated standalone model canary uses `llama.cpp` with existing Qwen 4B GGUF on HYPRBOX, but its live ngrok cutover is a separate security and user-acceptance gate. The original public GitHub Pages edition must not directly access the owner ngrok private API.

## Subsequent gated work

1. Add a Windows-only **opt-in** native Compass sidecar based on the audited Jarvis code, using local-only Vosk/STT and pyttsx3/TTS with explicit owner microphone consent; no default startup/wake-word.
2. Replace Jarvis's Ollama chat client with an authenticated localhost `llama.cpp` adapter; reuse Compass Core's existing read-only tools and encrypted memory, not a new unprotected AI or duplicate vault.
3. Provide a strict per-action scope matrix and a local confirmation UI before app launch, email, filesystem, notification or OS control. Never put unrestricted command execution behind the public PWA, Tailscale Serve or ngrok.
4. Preserve dates, amounts, debit/credit classification, encrypted PDF/payslip/receipt parsing and owner approval. Synthetic-only scikit-learn second opinions must abstain on uncertain evidence and never silently save labels or transactions.
5. Run real HYPRBOX microphone/device tests and owner iPhone Safari acceptance before claiming Siri/Jarvis equivalence.

**No automation, banking access, trading, payments, device scanning, or unrestricted app-launch permissions were granted by this archive upload.**
