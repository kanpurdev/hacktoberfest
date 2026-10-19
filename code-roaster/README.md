# Roast My Code

> **Roasts your code so hard you'll question your career, but still gives you real fixes.**

A VS Code extension that reviews your code like a savage stand-up comedian. Choose your pain level and watch your code get absolutely obliterated.

## ✨ Features

- **🔥 Roast entire file** - Opens command palette -> `Roast My Code`
- **🔥 Roast selected code** - Right-click selection -> `Roast Selected Code`
- **🔥 Set roast level** - Command palette -> `Set Roast Level`
- **🎚️ Interactive level picker** - Choose your roast intensity before each roast
- **🎨 Premium UI** - Glassy webview with animated gradients, damage bars, and copy actions
- **⚡ Smart scaling** - Token limits and creativity scale with roast intensity

## 🎚️ Roast Levels

| Level | Emoji | Vibe | What to Expect |
|-------|-------|------|----------------|
| **Mild** | 😊 | Disappointed Dad | Light jabs, gentle humor, still loves you |
| **Medium** | 🔥 | Comedy Roast | Stand-up comedian at a tech roast |
| **Spicy** | 🌶️ | WWE Commentary | Over the top, all caps, dramatic |
| **Savage** | 💀 | Gordon Ramsay | Brutal, meme-heavy, "this is raw" energy |
| **Nuclear** | ☢️ | Psychological Warfare | Profiles your code, destroys your soul |
| **Existential Crisis** | 🕳️ | Therapy Required | May cause career changes and existential dread |

## 🚀 Setup

1. Clone this repo
2. Run `npm install`
3. Add your OpenAI API key in VS Code settings -> `codeRoaster.apiKey`
4. Press `F5` to launch the extension in a new window

## 🎯 Usage

```
Ctrl+Shift+P -> "Roast My Code"
```

Or right-click any selected code -> **🔥 Roast Selected Code**

Or set your default level:

```
Ctrl+Shift+P -> "Set Roast Level"
```

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeRoaster.apiKey` | `""` | Your OpenAI API Key (or active provider key) |
| `codeRoaster.geminiApiKey` | `""` | Google Gemini API Key (free from Google AI Studio) |
| `codeRoaster.roastLevel` | `"medium"` | `mild` / `medium` / `spicy` / `savage` / `nuclear` / `existential-crisis` |
| `codeRoaster.provider` | `"openai"` | `openai` / `gemini` / `claude` / `openrouter` / `ollama` |
| `codeRoaster.model` | `""` | Custom model override (e.g. `gpt-4o-mini`, `gemini-1.5-flash`) |
| `codeRoaster.apiBaseUrl` | `""` | Custom API base URL (for Ollama or custom proxies) |

## Highlights

- 🎭 **Stand-up Comedian Webview Panel** with real-time roast scores and roast badges.
- 🎙️ **Live Voice Readout** using Web Speech API with animated audio visualizer.
- 🥁 **Web Audio Soundboard** featuring synthesized rimshot, fail horn, sizzle, and applause.
- ⚔️ **Battle Diff Arena** with side-by-side comparison and interactive heat slider.
- ⚡ **Redemption Arc** with one-click "Replace in Editor" to apply refactored clean code.
- 🏆 **Hall of Shame Leaderboard** tracking your highest dumpster scores and past roasts.
- 🚀 **Zero-Config Offline Mode** with heuristic code smell detector if running without an API key.
- 🌶️ **Status Bar Shortcut** to quickly toggle roast level or trigger roasts anytime.

## 🎨 UI Features

- **Animated background** - Floating glow gradients and premium dark panels
- **Color themes** - Each roast level has its own color scheme
- **Damage bar** - Visual indicator of roast intensity with glowing segments
- **Gradient text** - Premium header with accent gradients
- **Copy action** - Copy the generated roast directly from the panel
- **Open settings** - Jump back to roast settings from the panel

## 🤝 Contributing

This is a **Hacktoberfest** open source project. Feel free to:
- Add new roast styles and levels
- Add support for other AI providers (Gemini, Claude, local LLMs)
- Add inline diagnostics instead of a panel
- Add code fix suggestions alongside roasts
- Improve the webview UI with more animations

## 📜 License

MIT

> *Built with 🔥, OpenAI, and questionable life choices.*
