const vscode = require("vscode");
const { roastCode } = require("./roaster");

function activate(context) {
  // Roast entire file
  context.subscriptions.push(
    vscode.commands.registerCommand("code-roaster.roastMyCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return vscode.window.showErrorMessage("Open a file first, genius 💀");

      const code = editor.document.getText();
      await triggerRoast(code);
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

      await triggerRoast(code);
    })
  );
}

async function triggerRoast(code) {
  const config = vscode.workspace.getConfiguration("codeRoaster");
  const apiKey = config.get("apiKey");

  if (!apiKey) {
    return vscode.window.showErrorMessage(
      "Add your OpenAI API key in settings (codeRoaster.apiKey) 🔑"
    );
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "🔥 Roasting your code..." },
    async () => {
      try {
        const roast = await roastCode(code, apiKey, config.get("roastLevel"));
        showRoastPanel(roast);
      } catch (err) {
        vscode.window.showErrorMessage(`Roast failed: ${err.message || err}`);
      }
    }
  );
}

function showRoastPanel(roast) {
  const panel = vscode.window.createWebviewPanel(
    "codeRoaster",
    "🔥 Code Roast Results",
    vscode.ViewColumn.Beside,
    {}
  );
  panel.webview.html = getRoastHTML(roast);
}

function getRoastHTML(roast) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #1a1a1a; color: #fff; }
    h1 { color: #ff4500; }
    .roast { background: #2a2a2a; padding: 15px; border-left: 4px solid #ff4500; border-radius: 4px; line-height: 1.8; font-size: 15px; }
    .footer { margin-top: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🔥 Your Code Got Roasted</h1>
  <div class="roast">${roast.replace(/\n/g, "<br>")}</div>
  <p class="footer">Powered by Code Roaster 🔥 — It hurts because it's true.</p>
</body>
</html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
