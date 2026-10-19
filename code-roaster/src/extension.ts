import * as vscode from 'vscode';
import { HistoryManager } from './historyManager';
import { RoasterEngine } from './roaster';
import { Provider, RoastLevel, RoastRequest, WebviewToExtensionMessage } from './types';
import { CodeRoasterPanel } from './webviewPanel';

let statusBarItem: vscode.StatusBarItem;
let historyManager: HistoryManager;
let roasterEngine: RoasterEngine;

// Keeps track of the last code roasted so Re-Roast can re-run even if editor focus changes
let lastRoastRequest: RoastRequest | undefined;
let lastCodeSnippet: string = '';

export function activate(context: vscode.ExtensionContext) {
  historyManager = new HistoryManager(context);
  roasterEngine = new RoasterEngine(context);

  // Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'codeRoaster.statusBarMenu';
  updateStatusBar();
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  // Listen to config changes to update status bar
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codeRoaster.roastLevel')) {
        updateStatusBar();
      }
    })
  );

  // Command 1: Roast Entire File (both aliases)
  const roastCodeCmd = vscode.commands.registerCommand('codeRoaster.roastCode', async () => {
    await executeRoast(context, false);
  });
  const roastMyCodeAliasCmd = vscode.commands.registerCommand('code-roaster.roastMyCode', async () => {
    await executeRoast(context, false);
  });

  // Command 2: Roast Selected Code (both aliases)
  const roastSelectionCmd = vscode.commands.registerCommand('codeRoaster.roastSelection', async () => {
    await executeRoast(context, true);
  });
  const roastSelectionAliasCmd = vscode.commands.registerCommand('code-roaster.roastSelection', async () => {
    await executeRoast(context, true);
  });

  // Command 3: Set API Key
  const setApiKeyCmd = vscode.commands.registerCommand('codeRoaster.setApiKey', async () => {
    await promptSetApiKey(context);
  });

  // Command 3b: Set Google Gemini Key specifically
  const setGeminiKeyCmd = vscode.commands.registerCommand('codeRoaster.setGeminiKey', async () => {
    await promptSetApiKey(context, 'gemini');
  });

  // Command 4: Set Roast Level (both aliases)
  const setRoastLevelCmd = vscode.commands.registerCommand('codeRoaster.setRoastLevel', async () => {
    await promptSetRoastLevel();
  });
  const setRoastLevelAliasCmd = vscode.commands.registerCommand('code-roaster.setRoastLevel', async () => {
    await promptSetRoastLevel();
  });

  // Command 5: Clear History
  const clearHistoryCmd = vscode.commands.registerCommand('codeRoaster.clearHistory', async () => {
    await historyManager.clearHistory();
    if (CodeRoasterPanel.currentPanel) {
      CodeRoasterPanel.currentPanel.updateHistory([]);
    }
    vscode.window.showInformationMessage('🔥 Code Roaster: Roast history cleared!');
  });

  // Status Bar Menu
  const statusBarMenuCmd = vscode.commands.registerCommand('codeRoaster.statusBarMenu', async () => {
    const config = vscode.workspace.getConfiguration('codeRoaster');
    const currentLevel = config.get<string>('roastLevel') || 'medium';
    const currentProvider = config.get<string>('provider') || 'openai';

    const items: vscode.QuickPickItem[] = [
      {
        label: '$(flame) Roast My Code',
        description: 'Roast entire active file',
      },
      {
        label: '$(selection) Roast Selected Code',
        description: 'Roast only highlighted lines',
      },
      {
        label: '$(settings-gear) Change Roast Level',
        description: `Current: ${currentLevel.toUpperCase()}`,
      },
      {
        label: '$(sparkle) Set Google Gemini Key (Free & Fast)',
        description: 'Add free key from Google AI Studio',
      },
      {
        label: '$(key) Set API Key (Any Provider)',
        description: `Current provider: ${currentProvider}`,
      },
      {
        label: '$(trash) Clear History',
        description: 'Reset Hall of Shame',
      },
    ];

    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: 'Code Roaster Quick Actions',
    });

    if (!pick) return;

    if (pick.label.includes('Roast My Code')) {
      await vscode.commands.executeCommand('codeRoaster.roastCode');
    } else if (pick.label.includes('Roast Selected Code')) {
      await vscode.commands.executeCommand('codeRoaster.roastSelection');
    } else if (pick.label.includes('Change Roast Level')) {
      await vscode.commands.executeCommand('codeRoaster.setRoastLevel');
    } else if (pick.label.includes('Set Google Gemini Key')) {
      await vscode.commands.executeCommand('codeRoaster.setGeminiKey');
    } else if (pick.label.includes('Set API Key')) {
      await vscode.commands.executeCommand('codeRoaster.setApiKey');
    } else if (pick.label.includes('Clear History')) {
      await vscode.commands.executeCommand('codeRoaster.clearHistory');
    }
  });

  context.subscriptions.push(
    roastCodeCmd,
    roastMyCodeAliasCmd,
    roastSelectionCmd,
    roastSelectionAliasCmd,
    setApiKeyCmd,
    setGeminiKeyCmd,
    setRoastLevelCmd,
    setRoastLevelAliasCmd,
    clearHistoryCmd,
    statusBarMenuCmd
  );
}

function updateStatusBar(): void {
  const config = vscode.workspace.getConfiguration('codeRoaster');
  const level = config.get<string>('roastLevel') || 'medium';
  const icon = level === 'savage' ? '💀' : level === 'medium' ? '🌶️🌶️' : '🌶️';
  statusBarItem.text = `$(flame) Roast: ${level.toUpperCase()} ${icon}`;
  statusBarItem.tooltip = `Code Roaster (Level: ${level.toUpperCase()}) - Click for options`;
}

async function executeRoast(context: vscode.ExtensionContext, selectionOnly: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Code Roaster: Please open a code file first to roast it!');
    return;
  }

  const document = editor.document;
  let codeToRoast = '';
  let rangeInfo: { startLine: number; endLine: number } | undefined;

  if (selectionOnly || !editor.selection.isEmpty) {
    codeToRoast = document.getText(editor.selection);
    if (!codeToRoast.trim()) {
      codeToRoast = document.getText();
    } else {
      rangeInfo = {
        startLine: editor.selection.start.line + 1,
        endLine: editor.selection.end.line + 1,
      };
    }
  } else {
    codeToRoast = document.getText();
  }

  if (!codeToRoast.trim()) {
    vscode.window.showWarningMessage('Code Roaster: Cannot roast an empty file! Write some code first.');
    return;
  }

  const config = vscode.workspace.getConfiguration('codeRoaster');
  const roastLevel = (config.get<RoastLevel>('roastLevel') || 'medium') as RoastLevel;

  const fileName = document.fileName.split(/[/\\]/).pop() || 'Untitled';
  const languageId = document.languageId;

  const request: RoastRequest = {
    code: codeToRoast,
    languageId,
    fileName,
    selectionRange: rangeInfo,
    roastLevel,
  };

  lastRoastRequest = request;
  lastCodeSnippet = codeToRoast;

  // Open or reveal panel
  const panel = CodeRoasterPanel.createOrShow(context.extensionUri, (msg) =>
    handleWebviewMessage(context, msg)
  );

  panel.showLoading(roastLevel, fileName);

  try {
    const result = await roasterEngine.roast(request);
    const updatedHistory = await historyManager.addEntry(result, codeToRoast);
    panel.showResult(result, updatedHistory, codeToRoast);
  } catch (err: any) {
    panel.showError(err.message || 'Failed to roast code');
  }
}

async function handleWebviewMessage(
  context: vscode.ExtensionContext,
  message: WebviewToExtensionMessage
): Promise<void> {
  const panel = CodeRoasterPanel.currentPanel;

  switch (message.type) {
    case 'reRoast': {
      if (!lastRoastRequest) {
        // Fallback to active editor
        await executeRoast(context, false);
        return;
      }

      if (message.level) {
        lastRoastRequest.roastLevel = message.level;
      }

      if (panel) {
        panel.showLoading(lastRoastRequest.roastLevel, lastRoastRequest.fileName);
      }

      try {
        const result = await roasterEngine.roast(lastRoastRequest);
        const updatedHistory = await historyManager.addEntry(result, lastCodeSnippet);
        if (panel) {
          panel.showResult(result, updatedHistory, lastCodeSnippet);
        }
      } catch (err: any) {
        if (panel) panel.showError(err.message || 'Failed to roast code');
      }
      break;
    }

    case 'changeLevel': {
      const config = vscode.workspace.getConfiguration('codeRoaster');
      await config.update('roastLevel', message.level, vscode.ConfigurationTarget.Global);
      if (lastRoastRequest) {
        lastRoastRequest.roastLevel = message.level;
      }
      updateStatusBar();
      break;
    }

    case 'applyFix': {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor open to apply fix!');
        return;
      }

      const editSuccess = await editor.edit((editBuilder) => {
        if (!editor.selection.isEmpty) {
          editBuilder.replace(editor.selection, message.code);
        } else {
          // Replace full document
          const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(editor.document.getText().length)
          );
          editBuilder.replace(fullRange, message.code);
        }
      });

      if (editSuccess) {
        vscode.window.showInformationMessage('✨ Refactored code applied successfully!');
      }
      break;
    }

    case 'copyText': {
      await vscode.env.clipboard.writeText(message.text);
      vscode.window.showInformationMessage('📋 Copied to clipboard!');
      break;
    }

    case 'openSettings': {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'codeRoaster');
      break;
    }

    case 'promptApiKey': {
      await promptSetApiKey(context);
      break;
    }

    case 'saveApiKey': {
      const provider = message.provider;
      const trimmedKey = message.key.trim();
      const config = vscode.workspace.getConfiguration('codeRoaster');

      if (!trimmedKey) {
        await context.secrets.delete(`codeRoaster.apiKey.${provider}`);
        if (provider === 'gemini') {
          await config.update('geminiApiKey', '', vscode.ConfigurationTarget.Global);
        } else if (provider === 'openai') {
          await config.update('openaiApiKey', '', vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage(`API key for ${provider.toUpperCase()} cleared.`);
      } else {
        await context.secrets.store(`codeRoaster.apiKey.${provider}`, trimmedKey);
        await context.secrets.store('codeRoaster.apiKey', trimmedKey);

        if (provider === 'gemini') {
          await config.update('geminiApiKey', trimmedKey, vscode.ConfigurationTarget.Global);
        } else if (provider === 'openai') {
          await config.update('openaiApiKey', trimmedKey, vscode.ConfigurationTarget.Global);
        }

        // Auto switch active provider to the one newly saved
        await config.update('provider', provider, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`🎉 ${provider.toUpperCase()} API key saved securely! Active provider updated.`);
      }

      if (panel) {
        const status = await roasterEngine.getProvidersStatus();
        panel.postKeysStatus(status);
      }
      break;
    }

    case 'setProvider': {
      const config = vscode.workspace.getConfiguration('codeRoaster');
      await config.update('provider', message.provider, vscode.ConfigurationTarget.Global);
      updateStatusBar();
      if (panel) {
        const status = await roasterEngine.getProvidersStatus();
        panel.postKeysStatus(status);
      }
      vscode.window.showInformationMessage(`Active AI Provider switched to: ${message.provider.toUpperCase()}`);
      break;
    }

    case 'getKeysStatus': {
      if (panel) {
        const status = await roasterEngine.getProvidersStatus();
        panel.postKeysStatus(status);
      }
      break;
    }

    case 'clearHistory': {
      await historyManager.clearHistory();
      if (panel) {
        panel.updateHistory([]);
      }
      break;
    }

    case 'loadHistoryItem': {
      const history = historyManager.getHistory();
      const item = history.find((h) => h.id === message.id);
      if (item && panel) {
        // Construct a displayable result from the history item
        const result = {
          id: item.id,
          timestamp: item.timestamp,
          fileName: item.fileName,
          languageId: item.languageId,
          roastLevel: item.roastLevel,
          score: item.score,
          verdict: item.verdict,
          worstCrime: item.worstCrime,
          roastContent: `### Past Roast: ${item.verdict}\n\nRevisiting past code crime recorded on ${new Date(item.timestamp).toLocaleString()}.\n\n\`\`\`${item.languageId}\n${item.codeSnippet}\n\`\`\``,
          critique: 'Click 🔥 Roast Again above to generate a fresh take on this code!',
          suggestedCode: item.codeSnippet,
          punchline: 'Those who do not remember past bugs are condemned to repeat them.',
          providerUsed: 'history',
          modelUsed: '',
        };
        panel.showResult(result, history, item.codeSnippet);
      }
      break;
    }

    case 'ready': {
      // Panel loaded and ready
      const history = historyManager.getHistory();
      if (panel) {
        panel.updateHistory(history);
        const status = await roasterEngine.getProvidersStatus();
        panel.postKeysStatus(status);
      }
      break;
    }
  }
}

async function promptSetApiKey(
  context: vscode.ExtensionContext,
  defaultProvider?: Provider
): Promise<void> {
  let targetProvider = defaultProvider;

  if (!targetProvider) {
    const providerPick = await vscode.window.showQuickPick(
      [
        { label: 'Google Gemini', description: 'Free & fast via Google AI Studio (gemini-1.5-flash)', provider: 'gemini' as Provider },
        { label: 'OpenAI', description: 'Standard GPT models (gpt-4o-mini / gpt-4o)', provider: 'openai' as Provider },
        { label: 'Anthropic Claude', description: 'claude-3-5-haiku / sonnet', provider: 'claude' as Provider },
        { label: 'OpenRouter', description: 'openrouter.ai API key', provider: 'openrouter' as Provider },
      ],
      { placeHolder: 'Select AI Provider for API Key' }
    );

    if (!providerPick) return;
    targetProvider = providerPick.provider;
  }

  const providerNames: Record<Provider, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    claude: 'Anthropic Claude',
    openrouter: 'OpenRouter',
    ollama: 'Ollama',
  };

  const key = await vscode.window.showInputBox({
    prompt: `Enter your ${providerNames[targetProvider]} API Key`,
    password: true,
    placeHolder: targetProvider === 'gemini' ? 'AIzaSy...' : 'sk-...',
    ignoreFocusOut: true,
  });

  if (key === undefined) return;

  const config = vscode.workspace.getConfiguration('codeRoaster');

  if (!key.trim()) {
    // Clear key
    await context.secrets.delete(`codeRoaster.apiKey.${targetProvider}`);
    if (targetProvider === 'gemini') {
      await config.update('geminiApiKey', '', vscode.ConfigurationTarget.Global);
    } else if (targetProvider === 'openai') {
      await config.update('openaiApiKey', '', vscode.ConfigurationTarget.Global);
    }
    vscode.window.showInformationMessage(`API key for ${providerNames[targetProvider]} removed.`);
  } else {
    // Store in SecretStorage securely
    await context.secrets.store(`codeRoaster.apiKey.${targetProvider}`, key.trim());
    await context.secrets.store('codeRoaster.apiKey', key.trim());

    if (targetProvider === 'gemini') {
      await config.update('geminiApiKey', key.trim(), vscode.ConfigurationTarget.Global);
    } else if (targetProvider === 'openai') {
      await config.update('openaiApiKey', key.trim(), vscode.ConfigurationTarget.Global);
    }

    // Also update provider setting to active
    await config.update('provider', targetProvider, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`🎉 ${providerNames[targetProvider]} API Key saved securely!`);
  }

  if (CodeRoasterPanel.currentPanel) {
    const status = await roasterEngine.getProvidersStatus();
    CodeRoasterPanel.currentPanel.postKeysStatus(status);
  }
}

async function promptSetRoastLevel(): Promise<void> {
  const options: Array<vscode.QuickPickItem & { level: RoastLevel }> = [
    {
      label: '😊 Mild',
      description: 'Disappointed dad — gentle jabs and light feedback',
      level: 'mild',
    },
    {
      label: '🔥 Medium',
      description: 'Comedy roast — funny standup critique and real tips',
      level: 'medium',
    },
    {
      label: '🌶️ Spicy',
      description: 'WWE commentary — dramatic, over-the-top high energy',
      level: 'spicy',
    },
    {
      label: '💀 Savage',
      description: 'Gordon Ramsay mode — brutally hilarious code takedown',
      level: 'savage',
    },
    {
      label: '☢️ Nuclear',
      description: 'Psychological warfare — roasts your code and your soul',
      level: 'nuclear',
    },
    {
      label: '🕳️ Existential Crisis',
      description: 'Question everything — philosophical tech nightmare',
      level: 'existential-crisis',
    },
  ];

  const pick = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select Code Roaster intensity level',
  });

  if (!pick) return;

  const config = vscode.workspace.getConfiguration('codeRoaster');
  await config.update('roastLevel', pick.level, vscode.ConfigurationTarget.Global);
  updateStatusBar();
  vscode.window.showInformationMessage(`🔥 Roast level set to: ${pick.level.toUpperCase()}`);
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
