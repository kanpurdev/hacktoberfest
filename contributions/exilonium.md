# Contributions by exilonium

- Contributor: exilonium
- GitHub: https://github.com/exilonium
- Project: Code Roaster VS Code extension
- Repository: https://github.com/kanpurdev/hacktoberfest
- Date: 2026-10-18

## Summary

I rebuilt the Code Roaster extension from a flat JavaScript stub into a full TypeScript extension. The project now supports five AI backends, an offline rules-based analysis engine, in-panel API key setup, speech synthesis for live roast readings, a Web Audio soundboard, and a side-by-side diff viewer that applies fixes directly into the active editor.

## What changed

### Multi-provider AI engine
Added a provider dispatcher in `code-roaster/src/roaster.ts`. It routes requests to Google Gemini, OpenAI, Anthropic Claude, OpenRouter, or a local Ollama instance. The extension reads keys from VS Code secret storage first, falls back to settings, then checks environment variables. If a user pastes an API key starting with `AIza`, the engine switches the active provider to Gemini automatically.

### In-webview key manager
Added an API Keys tab inside the webview panel. Users can choose their provider from interactive cards, paste their Gemini or OpenAI keys directly into password fields with visibility toggles, and click save. The webview sends messages to the extension host, which updates global secret storage and configuration settings without making the user hunt through the VS Code settings JSON file.

### Google Gemini support
Integrated Google Gemini through its REST endpoint. Requests use `gemini-1.5-flash` by default to keep latency low, with fallback support for `gemini-2.0-flash` and `gemini-1.5-pro`. The client uses `system_instruction` with structured JSON output, then falls back to composite prompts if an older model rejects JSON mime types.

### Stand-up comedian voice player
Connected the webview to the browser SpeechSynthesis API. Clicking the stage button speaks the verdict, worst crime, and roast body out loud. An animated four-bar equalizer visualizer tracks when audio plays, and stopping resets the controls cleanly.

### Web Audio soundboard
Built four sound effects using the Web Audio API without shipping any audio files or MP3 assets. Oscillators and noise buffers synthesize a comedy rimshot, a four-note descending fail trombone, a frying sizzle effect, and a crowd clap burst.

### Battle diff arena
Added a side-by-side comparison tab between the user's original code and the suggested refactor. The left pane shows the original file with red warnings, and the right pane shows the clean code with a one-click button to patch the active editor file. Added an interactive heat slider that adjusts the dumpster fire meter and plays sizzle effects.

### Roast share card export
Built a share card preview modal that formats the score, verdict, worst crime quote, and punchline into a clean card. It includes one-click buttons to copy the formatted text or tweet directly on X with project hashtags.

### Offline heuristic engine
Wrote a static pattern detector in `code-roaster/src/offlineRoaster.ts`. If no API key is present, the extension runs local checks for nested callbacks, eval calls, any types, unhandled catch blocks, and console logging. It computes a dumpster score from 0 to 100 and outputs a local comedy critique so the extension stays usable without an internet connection.

### Redemption arc code fixer
Wrote prompt templates in `code-roaster/src/prompts.ts` and a parser in `code-roaster/src/parser.ts` that force models to return clean refactored code alongside the roast jokes. The webview lets users click a button to replace bad code in their active text editor.

### Build and test pipeline
Set up esbuild bundling and npm workspaces in `package.json`. Bundling takes under 10 milliseconds and outputs a single 95 KB CommonJS file. Added seven unit tests in `code-roaster/test/roaster.test.ts` covering prompts, the offline engine, and the JSON parser.

## Modified and created files

- `code-roaster/src/extension.ts`: command handlers, status bar widget, and webview messaging.
- `code-roaster/src/roaster.ts`: provider routing, Gemini REST client, and key resolution.
- `code-roaster/src/webviewPanel.ts`: webview layout, Web Audio soundboard, speech player, and diff view.
- `code-roaster/src/offlineRoaster.ts`: heuristic smell detector and scoring logic.
- `code-roaster/src/historyManager.ts`: global state history tracking.
- `code-roaster/src/prompts.ts`: prompt builders and tone presets.
- `code-roaster/src/parser.ts`: JSON fence stripping and payload validation.
- `code-roaster/src/types.ts`: TypeScript interfaces for providers and webview events.
- `code-roaster/test/roaster.test.ts`: test suite for offline roasting, prompts, and parsing.
- `code-roaster/package.json`: extension settings, keys, and build scripts.
- `package.json`: workspace scripts.
