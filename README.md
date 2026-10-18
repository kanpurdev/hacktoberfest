# 🔥 Code Roaster

A VS Code extension that roasts your code like a comedian — savage, funny, but actually helpful.

## Features

- **Roast entire file** — Opens command palette → `Roast My Code`
- **Roast selected code** — Right-click selection → `Roast Selected Code`
- **3 roast levels** — Mild, Medium, Savage 💀

## Setup

1. Clone this repo
2. Run `npm install`
3. Add your OpenAI API key in VS Code settings → `codeRoaster.apiKey`
4. Press `F5` to launch the extension in a new window

## Usage

```
Ctrl+Shift+P → "Roast My Code"
```
Or right-click any selected code → **🔥 Roast Selected Code**

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeRoaster.apiKey` | `""` | Your OpenAI API Key |
| `codeRoaster.roastLevel` | `"medium"` | `mild` / `medium` / `savage` |

## Contributing

This is an open source project! Feel free to:
- Add new roast styles
- Add support for other AI providers (Gemini, Claude)
- Add inline diagnostics instead of a panel
- Add a leaderboard of worst code 😂

## License

MIT
