const vscode = require("vscode");
const { roastCode, ROAST_LEVEL_ORDER, ROAST_LEVEL_LABELS } = require("./roaster");

function activate(context) {
  // Roast entire file
  context.subscriptions.push(
    vscode.commands.registerCommand("code-roaster.roastMyCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return vscode.window.showErrorMessage("Open a file first, genius 💀");

      const code = editor.document.getText();
      const level = await pickRoastLevel();
      if (!level) return;
      await triggerRoast(code, level);
    })
  );

  // Roast selected code
  context.subscriptions.push(
    vscode.commands.registerCommand("code-roaster.roastSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const code = editor.document.getText(selection);
      if (!code.trim()) return vscode.window.showErrorMessage("Select some code to roast first 🙄");

      const level = await pickRoastLevel();
      if (!level) return;
      await triggerRoast(code, level);
    })
  );

  // Quick roast with level selector
  context.subscriptions.push(
    vscode.commands.registerCommand("code-roaster.setRoastLevel", async () => {
      const level = await pickRoastLevel();
      if (level) {
        const config = vscode.workspace.getConfiguration("codeRoaster");
        await config.update("roastLevel", level, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`🔥 Roast level set to: ${ROAST_LEVEL_LABELS[level]}`);
      }
    })
  );
}

async function pickRoastLevel() {
  const config = vscode.workspace.getConfiguration("codeRoaster");
  const currentLevel = config.get("roastLevel") || "medium";

  const items = ROAST_LEVEL_ORDER.map((level, index) => ({
    label: ROAST_LEVEL_LABELS[level],
    description: level === currentLevel ? "← current" : "",
    detail: getDetailForLevel(level),
    level: level,
    picked: level === currentLevel,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: "🔥 Choose Your Roast Intensity",
    placeHolder: "How badly do you want to be humiliated?",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return selected ? selected.level : null;
}

function getDetailForLevel(level) {
  const details = {
    mild: "Light jabs, like a disappointed but loving parent",
    medium: "Stand-up comedy roast — funny and helpful",
    spicy: "WWE commentary — over the top and dramatic",
    savage: "Gordon Ramsay meets code review — absolutely brutal",
    nuclear: "Psychological warfare — your code AND your soul get roasted",
    "existential-crisis": "⚠️ WARNING: May cause career changes and existential dread",
  };
  return details[level] || "";
}

async function triggerRoast(code, level) {
  const config = vscode.workspace.getConfiguration("codeRoaster");
  const apiKey = config.get("apiKey");

  if (!apiKey) {
    return vscode.window.showErrorMessage(
      "Add your OpenAI API key in settings (codeRoaster.apiKey) 🔑"
    );
  }

  const levelLabel = ROAST_LEVEL_LABELS[level] || level;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `🔥 Roasting your code at ${levelLabel} level...`,
      cancellable: false
    },
    async () => {
      try {
        const roast = await roastCode(code, apiKey, level);
        showRoastPanel(roast, level);
      } catch (err) {
        vscode.window.showErrorMessage(`Roast failed: ${err.message}`);
      }
    }
  );
}

function showRoastPanel(roast, level) {
  const panel = vscode.window.createWebviewPanel(
    "codeRoaster",
    "🔥 Code Roast Results",
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );
  panel.webview.html = getRoastHTML(roast, level);
}

function getRoastHTML(roast, level) {
  const levelIndex = ROAST_LEVEL_ORDER.indexOf(level);
  const levelLabel = ROAST_LEVEL_LABELS[level] || level;
  const progressPercent = ((levelIndex + 1) / ROAST_LEVEL_ORDER.length) * 100;

  // Color themes per level
  const themes = {
    mild: { accent: "#4ade80", gradient: "linear-gradient(135deg, #065f46, #134e4a)", glow: "rgba(74, 222, 128, 0.3)", bg: "#0a1f1a" },
    medium: { accent: "#fb923c", gradient: "linear-gradient(135deg, #7c2d12, #451a03)", glow: "rgba(251, 146, 60, 0.3)", bg: "#1a0f05" },
    spicy: { accent: "#f87171", gradient: "linear-gradient(135deg, #7f1d1d, #450a0a)", glow: "rgba(248, 113, 113, 0.3)", bg: "#1a0505" },
    savage: { accent: "#ff4500", gradient: "linear-gradient(135deg, #7f1d1d, #1a0000)", glow: "rgba(255, 69, 0, 0.4)", bg: "#120000" },
    nuclear: { accent: "#a855f7", gradient: "linear-gradient(135deg, #581c87, #1e1b4b)", glow: "rgba(168, 85, 247, 0.4)", bg: "#0a0520" },
    "existential-crisis": { accent: "#ec4899", gradient: "linear-gradient(135deg, #831843, #1a0a1a)", glow: "rgba(236, 72, 153, 0.4)", bg: "#120010" },
  };

  const theme = themes[level] || themes.medium;

  // Skull/fire emojis based on level
  const levelEmojis = ["😊", "🔥", "🌶️", "💀", "☢️", "🕳️"];
  const emoji = levelEmojis[levelIndex] || "🔥";

  // Damage bar segments
  const segments = ROAST_LEVEL_ORDER.map((l, i) => {
    const isActive = i <= levelIndex;
    const segColor = isActive ? theme.accent : "#333";
    return `<div class="bar-segment" style="background: ${segColor}; ${isActive ? `box-shadow: 0 0 8px ${theme.glow};` : ''}"></div>`;
  }).join("");

  const sanitizedRoast = roast
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --accent: ${theme.accent};
      --glow: ${theme.glow};
      --bg: ${theme.bg};
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: #e2e8f0;
      padding: 0;
      margin: 0;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Animated background particles */
    .bg-effects {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .bg-effects::before {
      content: '';
      position: absolute;
      top: -50%; left: -50%;
      width: 200%; height: 200%;
      background: radial-gradient(ellipse at 30% 20%, var(--glow) 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, var(--glow) 0%, transparent 50%);
      animation: bgFloat 15s ease-in-out infinite alternate;
    }

    @keyframes bgFloat {
      0% { transform: translate(0, 0) rotate(0deg); }
      100% { transform: translate(-30px, 20px) rotate(3deg); }
    }

    .container {
      position: relative;
      z-index: 1;
      max-width: 800px;
      margin: 0 auto;
      padding: 30px 24px;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 32px;
      animation: slideDown 0.6s ease-out;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .header-emoji {
      font-size: 56px;
      display: block;
      margin-bottom: 12px;
      animation: pulse 2s ease-in-out infinite;
      filter: drop-shadow(0 0 20px var(--glow));
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }

    .header h1 {
      font-size: 28px;
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent), #fff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .header .subtitle {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 400;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* Roast Level Indicator */
    .level-indicator {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 28px;
      backdrop-filter: blur(10px);
      animation: fadeIn 0.8s ease-out 0.2s both;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .level-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .level-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .level-value {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }

    /* Damage bar */
    .damage-bar {
      display: flex;
      gap: 4px;
      margin-bottom: 10px;
    }

    .bar-segment {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      transition: all 0.5s ease;
    }

    .damage-label {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* Roast Card */
    .roast-card {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      overflow: hidden;
      animation: fadeIn 1s ease-out 0.4s both;
      position: relative;
    }

    .roast-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      animation: shimmer 3s ease-in-out infinite;
    }

    @keyframes shimmer {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    .roast-card-header {
      padding: 18px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .roast-card-header .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      animation: dotPulse 2s ease-in-out infinite;
    }

    @keyframes dotPulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--glow); }
      50% { opacity: 0.7; box-shadow: 0 0 0 6px transparent; }
    }

    .roast-card-header span {
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .roast-content {
      padding: 28px 24px;
      font-size: 14.5px;
      line-height: 1.85;
      color: #cbd5e1;
      font-weight: 400;
    }

    .roast-content strong, .roast-content b {
      color: var(--accent);
      font-weight: 700;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      text-align: center;
      animation: fadeIn 1s ease-out 0.6s both;
    }

    .footer-line {
      width: 60px;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      margin: 0 auto 16px;
      border-radius: 1px;
    }

    .footer p {
      font-size: 11px;
      color: #475569;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .footer p span {
      color: var(--accent);
    }

    .footer .credit {
      margin-top: 6px;
      font-size: 10px;
      color: #334155;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

    /* Responsive tweaks */
    @media (max-width: 500px) {
      .container { padding: 20px 16px; }
      .header h1 { font-size: 22px; }
      .roast-content { font-size: 13.5px; padding: 20px 18px; }
    }
  </style>
</head>
<body>
  <div class="bg-effects"></div>
  <div class="container">
    <div class="header">
      <span class="header-emoji">${emoji}</span>
      <h1>Your Code Got Obliterated</h1>
      <p class="subtitle">Code Roaster — Because your code needed a reality check</p>
    </div>

    <div class="level-indicator">
      <div class="level-header">
        <span class="level-label">Roast Intensity</span>
        <span class="level-value">${levelLabel}</span>
      </div>
      <div class="damage-bar">
        ${segments}
      </div>
      <div class="damage-label">
        <span>Mild</span>
        <span>Existential Crisis</span>
      </div>
    </div>

    <div class="roast-card">
      <div class="roast-card-header">
        <div class="dot"></div>
        <span>Roast Output</span>
      </div>
      <div class="roast-content">
        ${sanitizedRoast}
      </div>
    </div>

    <div class="footer">
      <div class="footer-line"></div>
      <p>Powered by <span>Code Roaster 🔥</span> — It hurts because it's true.</p>
      <p class="credit">Built by Akshansh · github.com/akshanshk04</p>
    </div>
  </div>

  <script>
    // Add a subtle entrance animation to roast content paragraphs
    const content = document.querySelector('.roast-content');
    if (content) {
      content.style.opacity = '0';
      content.style.transform = 'translateY(15px)';
      setTimeout(() => {
        content.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
      }, 600);
    }
  </script>
</body>
</html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
