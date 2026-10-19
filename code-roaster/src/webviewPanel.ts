import * as vscode from 'vscode';
import { HistoryItem, Provider, RoastLevel, RoastResult, WebviewToExtensionMessage } from './types';

export class CodeRoasterPanel {
  public static currentPanel: CodeRoasterPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private currentResult: RoastResult | undefined;
  private currentHistory: HistoryItem[] = [];
  private currentCodeSnippet: string = '';
  private onMessageCallback?: (msg: WebviewToExtensionMessage) => void;

  public static createOrShow(
    extensionUri: vscode.Uri,
    onMessage: (msg: WebviewToExtensionMessage) => void
  ): CodeRoasterPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (CodeRoasterPanel.currentPanel) {
      CodeRoasterPanel.currentPanel.panel.reveal(column);
      CodeRoasterPanel.currentPanel.onMessageCallback = onMessage;
      return CodeRoasterPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeRoaster',
      '🔥 Code Roaster',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    CodeRoasterPanel.currentPanel = new CodeRoasterPanel(panel, extensionUri, onMessage);
    return CodeRoasterPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    onMessage: (msg: WebviewToExtensionMessage) => void
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.onMessageCallback = onMessage;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      },
      null,
      this.disposables
    );

    this.updateHtml();
  }

  public showLoading(level: RoastLevel, fileName: string): void {
    this.panel.webview.postMessage({
      type: 'status',
      state: 'roasting',
      level,
      message: 'Roasting ' + fileName + '...',
    });
  }

  public showResult(result: RoastResult, history: HistoryItem[], codeSnippet: string): void {
    this.currentResult = result;
    this.currentHistory = history;
    this.currentCodeSnippet = codeSnippet;

    this.panel.webview.postMessage({
      type: 'roastResult',
      result,
      history,
      codeSnippet,
    });
  }

  public postKeysStatus(data: {
    providers: Record<Provider, { configured: boolean; maskedKey?: string }>;
    activeProvider: Provider;
  }): void {
    this.panel.webview.postMessage({
      type: 'keysStatus',
      providers: data.providers,
      activeProvider: data.activeProvider,
    });
  }

  public updateHistory(history: HistoryItem[]): void {
    this.currentHistory = history;
    this.panel.webview.postMessage({
      type: 'historyUpdate',
      history,
    });
  }

  public showError(message: string): void {
    this.panel.webview.postMessage({
      type: 'error',
      message,
    });
  }

  public dispose(): void {
    CodeRoasterPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  private updateHtml(): void {
    this.panel.webview.html = this.getHtmlContent();
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Roaster</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: var(--vscode-editorWidget-background, #252526);
      --border: var(--vscode-widget-border, #3c3c3c);
      --accent: #ff4500;
      --accent-hover: #ff6347;
      --code-bg: var(--vscode-textCodeBlock-background, #181818);
      --danger: #f43f5e;
      --warning: #f59e0b;
      --success: #10b981;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.6;
      padding: 16px;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 16px;
      gap: 12px;
      flex-wrap: wrap;
    }

    .title-group { display: flex; align-items: center; gap: 10px; }
    .flame-logo {
      font-size: 28px;
      animation: flamePulse 2s ease-in-out infinite alternate;
    }
    @keyframes flamePulse {
      0% { transform: scale(1) rotate(-2deg); filter: drop-shadow(0 0 2px #ff4500); }
      100% { transform: scale(1.15) rotate(3deg); filter: drop-shadow(0 0 10px #ff6347); }
    }
    .title-text h1 {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--vscode-foreground, #ffffff);
    }
    .title-text p { font-size: 0.82rem; opacity: 0.75; }

    /* Nav Tabs */
    .nav-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .nav-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.82rem;
      transition: all 0.2s ease;
    }
    .nav-btn:hover { background: rgba(255, 255, 255, 0.08); }
    .nav-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
      font-weight: 600;
    }

    /* Controls Bar */
    .controls-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .level-picker { display: flex; align-items: center; gap: 6px; }
    .level-label { font-weight: 600; font-size: 0.85rem; margin-right: 2px; }
    .level-chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .level-chip:hover { background: rgba(255, 255, 255, 0.15); }
    .level-chip.active-mild {
      background: #10b98122; border-color: #10b981; color: #34d399; font-weight: 600;
    }
    .level-chip.active-medium {
      background: #f59e0b22; border-color: #f59e0b; color: #fbbf24; font-weight: 600;
    }
    .level-chip.active-savage {
      background: #ef444422; border-color: #ef4444; color: #f87171; font-weight: 600;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .btn-fire {
      background: linear-gradient(135deg, #ff4500, #ff8c00);
      color: white;
      font-weight: 600;
    }
    .btn-fire:hover {
      background: linear-gradient(135deg, #e03e00, #ff7700);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.08); }

    /* Stage Bar (Soundboard & Speech) */
    .stage-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: linear-gradient(90deg, rgba(255,69,0,0.1), rgba(138,43,226,0.1));
      border: 1px solid rgba(255, 69, 0, 0.3);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .stage-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .stage-label { font-size: 0.8rem; font-weight: 600; color: #ff6347; text-transform: uppercase; letter-spacing: 0.5px; }
    .sound-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .sound-btn:hover { background: rgba(255, 255, 255, 0.15); transform: scale(1.05); }

    /* Equalizer Wave */
    .wave-container {
      display: none;
      align-items: center;
      gap: 3px;
      height: 16px;
    }
    .wave-bar {
      width: 3px;
      height: 100%;
      background: #ff4500;
      border-radius: 2px;
      animation: waveAnim 1s ease-in-out infinite alternate;
    }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 70%; background: #ff7700; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 100%; background: #ffaa00; }
    .wave-bar:nth-child(4) { animation-delay: 0.1s; height: 50%; background: #ff4500; }
    @keyframes waveAnim {
      0% { transform: scaleY(0.3); }
      100% { transform: scaleY(1); }
    }

    /* Views */
    .view-container { display: none; }
    .view-container.active { display: block; }

    /* Score & Verdict Card */
    .verdict-card {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 16px;
      position: relative;
      overflow: hidden;
    }
    .verdict-card::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0; width: 5px;
      background: var(--accent);
    }
    .score-circle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 86px;
      height: 86px;
      border-radius: 50%;
      border: 3px solid var(--accent);
      background: rgba(255, 69, 0, 0.1);
      box-shadow: 0 0 15px rgba(255, 69, 0, 0.2);
    }
    .score-value {
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1;
      color: #ff6347;
    }
    .score-label {
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
    }
    .verdict-info { flex: 1; min-width: 200px; }
    .verdict-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .meta-badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--border);
    }

    /* Crime Callout */
    .crime-callout {
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .crime-header {
      display: flex; align-items: center; gap: 8px;
      color: #f43f5e; font-weight: 700; font-size: 0.9rem; margin-bottom: 4px;
    }
    .crime-text { font-size: 0.88rem; opacity: 0.95; }

    /* Section Card */
    .section-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
    }
    .roast-body { font-size: 0.92rem; line-height: 1.7; }
    .roast-body p { margin-bottom: 10px; }

    /* Code Block */
    .code-container {
      position: relative;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-top: 10px;
      overflow: hidden;
    }
    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid var(--border);
      padding: 6px 12px;
      font-size: 0.78rem;
      opacity: 0.85;
    }
    pre code {
      display: block;
      padding: 12px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.82rem;
      line-height: 1.5;
    }

    /* Punchline */
    .punchline-card {
      background: linear-gradient(135deg, rgba(255, 69, 0, 0.12), rgba(138, 43, 226, 0.12));
      border: 1px solid rgba(255, 69, 0, 0.3);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 16px;
      font-style: italic;
      text-align: center;
      font-size: 0.95rem;
      font-weight: 500;
    }

    /* Battle Diff Arena */
    .battle-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .battle-meter-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 14px;
      flex: 1;
      min-width: 250px;
    }
    .flame-slider {
      flex: 1;
      accent-color: #ff4500;
      cursor: pointer;
    }
    .diff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 650px) {
      .diff-grid { grid-template-columns: 1fr; }
    }
    .diff-col {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .diff-col-header {
      padding: 8px 12px;
      font-weight: 700;
      font-size: 0.82rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    .diff-col-header.bad { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
    .diff-col-header.good { background: rgba(16, 185, 129, 0.15); color: #10b981; }

    /* Keys View UI */
    .keys-intro {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 16px;
    }
    .provider-selector-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }
    .provider-card-btn {
      background: var(--card-bg);
      border: 2px solid var(--border);
      border-radius: 8px;
      padding: 12px 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--fg);
    }
    .provider-card-btn:hover { border-color: rgba(255, 69, 0, 0.5); transform: translateY(-2px); }
    .provider-card-btn.active {
      border-color: #ff4500;
      background: rgba(255, 69, 0, 0.1);
      box-shadow: 0 0 10px rgba(255, 69, 0, 0.2);
    }
    .provider-icon { font-size: 22px; margin-bottom: 4px; }
    .provider-name { font-weight: 700; font-size: 0.82rem; }
    .provider-sub { font-size: 0.68rem; opacity: 0.75; }

    .key-input-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 14px;
    }
    .key-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .key-status-pill {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .key-status-pill.configured {
      background: rgba(16, 185, 129, 0.2);
      border-color: #10b981;
      color: #34d399;
      font-weight: 600;
    }
    .key-input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .key-text-input {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 7px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .key-text-input:focus {
      outline: none;
      border-color: #ff4500;
    }
    .eye-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 0 10px;
      border-radius: 6px;
      cursor: pointer;
    }

    /* Modal Share Card */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-box {
      background: #141414;
      border: 2px solid #ff4500;
      border-radius: 12px;
      width: 100%;
      max-width: 520px;
      padding: 20px;
      box-shadow: 0 0 30px rgba(255, 69, 0, 0.3);
      position: relative;
    }
    .modal-close {
      position: absolute;
      top: 12px;
      right: 14px;
      background: transparent;
      border: none;
      color: #888;
      font-size: 18px;
      cursor: pointer;
    }
    .share-card-render {
      background: linear-gradient(135deg, #1e1e1e, #2a1610);
      border: 1px solid rgba(255, 69, 0, 0.4);
      border-radius: 10px;
      padding: 18px;
      margin: 14px 0;
    }

    /* History / Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .stat-number { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
    .stat-title { font-size: 0.72rem; opacity: 0.75; text-transform: uppercase; }
    .history-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.2s;
    }
    .history-card:hover { border-color: var(--accent); transform: translateX(3px); }

    .loading-container { display: none; text-align: center; padding: 50px 20px; }
    .loading-spinner { font-size: 44px; animation: spinFlame 1.5s infinite linear; margin-bottom: 12px; }
    @keyframes spinFlame {
      0% { transform: scale(1) rotate(0deg); }
      50% { transform: scale(1.2) rotate(180deg); }
      100% { transform: scale(1) rotate(360deg); }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="title-group">
      <div class="flame-logo">🔥</div>
      <div class="title-text">
        <h1>Code Roaster</h1>
        <p>Savage, funny, but actually helpful.</p>
      </div>
    </div>
    <div class="nav-tabs">
      <button class="nav-btn active" id="tabRoastBtn" onclick="showTab('roast')">🔥 Roast</button>
      <button class="nav-btn" id="tabBattleBtn" onclick="showTab('battle')">⚔️ Battle Diff</button>
      <button class="nav-btn" id="tabHistoryBtn" onclick="showTab('history')">🏆 Hall of Shame</button>
      <button class="nav-btn" id="tabKeysBtn" onclick="showTab('keys')">🔑 API Keys</button>
    </div>
  </div>

  <!-- Controls Bar -->
  <div class="controls-bar">
    <div class="level-picker">
      <span class="level-label">Roast Level:</span>
      <button class="level-chip" id="chip-mild" onclick="selectLevel('mild')">🌶️ Mild</button>
      <button class="level-chip" id="chip-medium" onclick="selectLevel('medium')">🌶️🌶️ Medium</button>
      <button class="level-chip" id="chip-savage" onclick="selectLevel('savage')">💀 Savage</button>
    </div>

    <div style="display: flex; gap: 8px;">
      <button class="btn btn-fire" onclick="triggerReRoast()">🔥 Roast Again</button>
      <button class="btn btn-secondary" onclick="showTab('keys')">🔑 Keys</button>
    </div>
  </div>

  <!-- Stage & Soundboard Bar (Killer Feature) -->
  <div class="stage-bar">
    <div class="stage-group">
      <span class="stage-label">🎙️ Stand-Up Stage</span>
      <button class="btn btn-secondary" id="speechToggleBtn" style="font-size: 0.78rem; padding: 4px 10px;" onclick="toggleSpeech()">
        <span id="speechBtnIcon">▶️</span> <span id="speechBtnLabel">Live Roast Voice</span>
      </button>
      <div class="wave-container" id="waveVisualizer">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>
    </div>

    <div class="stage-group">
      <span style="font-size: 0.75rem; opacity: 0.7;">FX:</span>
      <button class="sound-btn" onclick="soundFX.playRimshot()" title="Ba-dum-tss">🥁 Rimshot</button>
      <button class="sound-btn" onclick="soundFX.playFailHorn()" title="Wah-wah-wah-waaah">🎺 Fail</button>
      <button class="sound-btn" onclick="soundFX.playSizzle()" title="Sizzle burn">🔥 Sizzle</button>
      <button class="sound-btn" onclick="soundFX.playApplause()" title="Crowd cheer">👏 Cheers</button>
      <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 3px 8px; margin-left: 6px;" onclick="openShareCard()">📸 Share Card</button>
    </div>
  </div>

  <!-- Loading State -->
  <div id="loadingState" class="loading-container">
    <div class="loading-spinner">🔥</div>
    <div class="loading-text" id="loadingTitle">Roasting Your Code...</div>
    <div class="loading-quip" id="loadingQuip" style="font-style: italic; opacity: 0.8; margin-top: 6px;">Calling Gordon Ramsay...</div>
  </div>

  <!-- 1. ROAST VIEW -->
  <div id="roastMainView" class="view-container active">
    <div id="initialPrompt" style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 44px; margin-bottom: 12px;">🎭</div>
      <h2>Ready for the Roast?</h2>
      <p style="margin: 8px 0 16px 0; opacity: 0.8;">Open a code file or highlight code, then fire away!</p>
      <button class="btn btn-fire" onclick="triggerReRoast()">🔥 Roast Active Code</button>
    </div>

    <div id="resultContainer" style="display: none;">
      <!-- Score & Verdict -->
      <div class="verdict-card">
        <div class="score-circle" id="scoreCircle">
          <div class="score-value" id="scoreValue">85</div>
          <div class="score-label">Dumpster Score</div>
        </div>
        <div class="verdict-info">
          <div class="verdict-title" id="verdictTitle">Certified Dumpster Fire 💀</div>
          <div class="meta-badges">
            <span class="badge" id="badgeFile">app.ts</span>
            <span class="badge" id="badgeLang">typescript</span>
            <span class="badge" id="badgeLevel">savage</span>
            <span class="badge" id="badgeProvider">Google Gemini (gemini-1.5-flash)</span>
          </div>
        </div>
      </div>

      <!-- Worst Crime -->
      <div class="crime-callout" id="crimeContainer">
        <div class="crime-header">🚨 Worst Crime Against Computer Science</div>
        <div class="crime-text" id="crimeText">Writing code that hurts to look at.</div>
      </div>

      <!-- The Comedy Roast -->
      <div class="section-card">
        <div class="section-title">
          <span>🎤 The Comedy Roast</span>
          <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 3px 8px;" onclick="copyRoastText()">📋 Copy</button>
        </div>
        <div class="roast-body" id="roastBodyText"></div>
      </div>

      <!-- Technical Breakdown -->
      <div class="section-card">
        <div class="section-title">💡 Technical Breakdown (The Serious Part)</div>
        <div class="roast-body" id="critiqueBodyText"></div>
      </div>

      <!-- Redemption Arc Code -->
      <div class="section-card" id="codeSection">
        <div class="section-title">
          <span>🛠️ How A Pro Would Write It (Redemption Arc)</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 2px 8px;" onclick="copySuggestedCode()">📋 Copy</button>
            <button class="btn btn-fire" style="font-size: 0.72rem; padding: 2px 8px;" onclick="applyFix()">⚡ Replace In Editor</button>
          </div>
        </div>
        <div class="code-container">
          <pre><code id="suggestedCodeBlock"></code></pre>
        </div>
      </div>

      <!-- Punchline Quote -->
      <div class="punchline-card" id="punchlineCard"></div>
    </div>
  </div>

  <!-- 2. BATTLE DIFF VIEW (Killer Feature) -->
  <div id="battleMainView" class="view-container">
    <div class="battle-header">
      <div>
        <h3 style="font-size: 1.1rem; color: #ff6347;">⚔️ Roast Battle: Before vs. After</h3>
        <p style="font-size: 0.8rem; opacity: 0.75;">Inspect the dumpster fire on the left and redemption on the right.</p>
      </div>
      <div class="battle-meter-box">
        <span style="font-size: 0.78rem; font-weight: 600;">🔥 Flame Heat:</span>
        <input type="range" class="flame-slider" id="flameSlider" min="0" max="100" value="85" oninput="onFlameSliderChange(this.value)">
        <span id="flameSliderLabel" style="font-size: 0.85rem; font-weight: 700; color: #ff6347; width: 35px;">85%</span>
      </div>
    </div>

    <div class="diff-grid">
      <div class="diff-col">
        <div class="diff-col-header bad">
          <span>💀 Original Dumpster Fire</span>
          <span id="diffCrimeBadge" style="font-size: 0.7rem; background: rgba(244,63,94,0.2); padding: 2px 6px; border-radius: 4px;">Crime Detected</span>
        </div>
        <div class="code-container" style="margin: 0; border: none; flex: 1;">
          <pre><code id="diffOriginalCode" style="color: #f87171;">// Original roasted code snippet will appear here</code></pre>
        </div>
      </div>

      <div class="diff-col">
        <div class="diff-col-header good">
          <span>✨ Redeemed Clean Code</span>
          <button class="btn btn-fire" style="font-size: 0.72rem; padding: 2px 8px;" onclick="applyFix()">⚡ Apply to File</button>
        </div>
        <div class="code-container" style="margin: 0; border: none; flex: 1;">
          <pre><code id="diffRedeemedCode" style="color: #34d399;">// Suggested refactored code will appear here</code></pre>
        </div>
      </div>
    </div>
  </div>

  <!-- 3. HALL OF SHAME (History) -->
  <div id="historyMainView" class="view-container">
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-number" id="statTotal">0</div>
        <div class="stat-title">Total Roasts</div>
      </div>
      <div class="stat-box">
        <div class="stat-number" id="statWorst">0</div>
        <div class="stat-title">Worst Score</div>
      </div>
      <div class="stat-box">
        <div class="stat-number" id="statAvg">0</div>
        <div class="stat-title">Avg Score</div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h3 style="font-size: 1rem;">Past Code Tragedies</h3>
      <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 3px 8px;" onclick="clearHistory()">🗑️ Clear History</button>
    </div>
    <ul id="historyList" style="list-style: none;"></ul>
  </div>

  <!-- 4. API KEYS & PROVIDER HUB (In-Webview Key Management) -->
  <div id="keysMainView" class="view-container">
    <div class="keys-intro">
      <h3 style="font-size: 1.05rem; margin-bottom: 4px;">🔑 AI Provider & API Key Manager</h3>
      <p style="font-size: 0.82rem; opacity: 0.8;">
        Select your AI provider and enter your API keys. Google Gemini offers a generous <strong>free tier</strong> via Google AI Studio.
      </p>
    </div>

    <div class="provider-selector-grid">
      <button class="provider-card-btn" id="pCard-gemini" onclick="selectProviderUI('gemini')">
        <div class="provider-icon">⚡</div>
        <div class="provider-name">Google Gemini</div>
        <div class="provider-sub">Free &amp; Ultra-Fast</div>
      </button>
      <button class="provider-card-btn" id="pCard-openai" onclick="selectProviderUI('openai')">
        <div class="provider-icon">🧠</div>
        <div class="provider-name">OpenAI</div>
        <div class="provider-sub">gpt-4o-mini / gpt-4o</div>
      </button>
      <button class="provider-card-btn" id="pCard-claude" onclick="selectProviderUI('claude')">
        <div class="provider-icon">🎭</div>
        <div class="provider-name">Claude</div>
        <div class="provider-sub">Anthropic Claude 3.5</div>
      </button>
      <button class="provider-card-btn" id="pCard-openrouter" onclick="selectProviderUI('openrouter')">
        <div class="provider-icon">🌐</div>
        <div class="provider-name">OpenRouter</div>
        <div class="provider-sub">100+ Models</div>
      </button>
      <button class="provider-card-btn" id="pCard-ollama" onclick="selectProviderUI('ollama')">
        <div class="provider-icon">🦙</div>
        <div class="provider-name">Ollama</div>
        <div class="provider-sub">100% Local / Free</div>
      </button>
    </div>

    <!-- Gemini Card -->
    <div class="key-input-card">
      <div class="key-header">
        <div>
          <strong style="font-size: 0.95rem;">⚡ Google Gemini API Key</strong>
          <span style="font-size: 0.75rem; color: #10b981; margin-left: 6px;">(Recommended • Free Tier Available)</span>
        </div>
        <span class="key-status-pill" id="statusPill-gemini">Checking...</span>
      </div>
      <div class="key-input-row">
        <input type="password" class="key-text-input" id="inputKey-gemini" placeholder="AIzaSy...">
        <button class="eye-btn" onclick="toggleKeyVisibility('inputKey-gemini')">👁️</button>
        <button class="btn btn-fire" onclick="saveKeyUI('gemini')">Save Key</button>
      </div>
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px; font-size: 0.78rem;">
        <span style="opacity: 0.7;">Need a free key?</span>
        <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 2px 8px;" onclick="copyText('https://aistudio.google.com/app/apikey')">
          📋 Copy Google AI Studio Link
        </button>
      </div>
    </div>

    <!-- OpenAI Card -->
    <div class="key-input-card">
      <div class="key-header">
        <strong style="font-size: 0.95rem;">🧠 OpenAI API Key</strong>
        <span class="key-status-pill" id="statusPill-openai">Checking...</span>
      </div>
      <div class="key-input-row">
        <input type="password" class="key-text-input" id="inputKey-openai" placeholder="sk-...">
        <button class="eye-btn" onclick="toggleKeyVisibility('inputKey-openai')">👁️</button>
        <button class="btn btn-fire" onclick="saveKeyUI('openai')">Save Key</button>
      </div>
    </div>

    <!-- Claude Card -->
    <div class="key-input-card">
      <div class="key-header">
        <strong style="font-size: 0.95rem;">🎭 Anthropic Claude API Key</strong>
        <span class="key-status-pill" id="statusPill-claude">Checking...</span>
      </div>
      <div class="key-input-row">
        <input type="password" class="key-text-input" id="inputKey-claude" placeholder="sk-ant-...">
        <button class="eye-btn" onclick="toggleKeyVisibility('inputKey-claude')">👁️</button>
        <button class="btn btn-fire" onclick="saveKeyUI('claude')">Save Key</button>
      </div>
    </div>

    <!-- OpenRouter Card -->
    <div class="key-input-card">
      <div class="key-header">
        <strong style="font-size: 0.95rem;">🌐 OpenRouter API Key</strong>
        <span class="key-status-pill" id="statusPill-openrouter">Checking...</span>
      </div>
      <div class="key-input-row">
        <input type="password" class="key-text-input" id="inputKey-openrouter" placeholder="sk-or-...">
        <button class="eye-btn" onclick="toggleKeyVisibility('inputKey-openrouter')">👁️</button>
        <button class="btn btn-fire" onclick="saveKeyUI('openrouter')">Save Key</button>
      </div>
    </div>
  </div>

  <!-- Share Card Modal -->
  <div class="modal-overlay" id="shareCardModal" onclick="closeShareCard(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeShareCard()">✕</button>
      <h3 style="color: #ff6347; font-size: 1.1rem; margin-bottom: 4px;">📸 Roast Share Card</h3>
      <p style="font-size: 0.78rem; opacity: 0.75;">Share your code roast on X / Twitter or with your team!</p>

      <div class="share-card-render" id="shareCardContent">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: 700; color: #ff6347; font-size: 0.9rem;">🔥 CODE ROASTER</span>
          <span style="font-size: 0.75rem; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px;" id="modalFileBadge">file.ts</span>
        </div>
        <div style="font-size: 1.2rem; font-weight: 800; margin-bottom: 6px;" id="modalVerdict">Certified Dumpster Fire 💀</div>
        <div style="font-size: 0.85rem; color: #f43f5e; margin-bottom: 10px;" id="modalCrime">🚨 Worst Crime: Ternary abuse</div>
        <div style="font-style: italic; font-size: 0.88rem; opacity: 0.9; margin-bottom: 10px;" id="modalPunchline">“It hurts because it's true.”</div>
        <div style="font-size: 0.75rem; opacity: 0.6; text-align: right;">Dumpster Score: <strong id="modalScore" style="color: #ff4500;">85/100</strong></div>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="copyShareCardText()">📋 Copy Text</button>
        <button class="btn btn-fire" onclick="tweetRoast()">🐦 Tweet on X</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let currentLevel = 'medium';
    let lastResult = null;
    let lastCodeSnippet = '';
    let currentHistory = [];
    let loadingInterval = null;
    let isSpeaking = false;
    let configuredProviders = {};
    let activeProvider = 'openai';

    // 1. Synthesized Web Audio API Soundboard (Zero External Files Needed)
    class Soundboard {
      constructor() {
        this.ctx = null;
      }
      init() {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      }
      playRimshot() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Kick
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);

        // Snare / Rim at now + 0.12
        setTimeout(() => {
          if (!this.ctx) return;
          const t = this.ctx.currentTime;
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(260, t);
          osc2.frequency.exponentialRampToValueAtTime(80, t + 0.08);
          gain2.gain.setValueAtTime(0.6, t);
          gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
          osc2.connect(gain2);
          gain2.connect(this.ctx.destination);
          osc2.start(t);
          osc2.stop(t + 0.1);
        }, 120);

        // Hi-hat / Cymbal at now + 0.24
        setTimeout(() => {
          if (!this.ctx) return;
          const t = this.ctx.currentTime;
          const bufferSize = this.ctx.sampleRate * 0.15;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 7000;
          const gain3 = this.ctx.createGain();
          gain3.gain.setValueAtTime(0.4, t);
          gain3.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
          noise.connect(filter);
          filter.connect(gain3);
          gain3.connect(this.ctx.destination);
          noise.start(t);
        }, 240);
      }

      playFailHorn() {
        this.init();
        if (!this.ctx) return;
        const notes = [311.13, 293.66, 277.18, 261.63]; // Eb, D, Db, C
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            if (!this.ctx) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            if (idx === 3) {
              // Slur down on last note
              osc.frequency.exponentialRampToValueAtTime(200, t + 0.5);
              gain.gain.setValueAtTime(0.3, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
              osc.start(t);
              osc.stop(t + 0.6);
            } else {
              gain.gain.setValueAtTime(0.3, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
              osc.start(t);
              osc.stop(t + 0.22);
            }
            osc.connect(gain);
            gain.connect(this.ctx.destination);
          }, idx * 220);
        });
      }

      playSizzle() {
        this.init();
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.7));
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3500;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
      }

      playApplause() {
        this.init();
        if (!this.ctx) return;
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            if (!this.ctx) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 400 + Math.random() * 300;
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.09);
          }, i * 40);
        }
      }
    }

    const soundFX = new Soundboard();

    // 2. Web Speech API Live Stand-Up Roast Player
    function toggleSpeech() {
      if (isSpeaking) {
        stopSpeech();
      } else {
        startSpeech();
      }
    }

    function startSpeech() {
      if (!window.speechSynthesis) {
        alert('Web Speech is not supported in this environment.');
        return;
      }
      if (!lastResult) return;

      window.speechSynthesis.cancel();
      const cleanRoast = (lastResult.roastContent || '').replace(/[*#_]/g, '');
      const textToSpeak = 'Verdict: ' + lastResult.verdict + '. Worst Crime: ' + lastResult.worstCrime + '. ' + cleanRoast + '. ' + (lastResult.punchline || '');


      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      utterance.onstart = () => {
        isSpeaking = true;
        document.getElementById('speechBtnIcon').innerText = '⏹️';
        document.getElementById('speechBtnLabel').innerText = 'Stop Speech';
        document.getElementById('waveVisualizer').style.display = 'flex';
      };

      utterance.onend = () => {
        stopSpeech();
        soundFX.playRimshot();
      };

      utterance.onerror = () => {
        stopSpeech();
      };

      window.speechSynthesis.speak(utterance);
    }

    function stopSpeech() {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      isSpeaking = false;
      document.getElementById('speechBtnIcon').innerText = '▶️';
      document.getElementById('speechBtnLabel').innerText = 'Live Roast Voice';
      document.getElementById('waveVisualizer').style.display = 'none';
    }

    // 3. Tab Navigation
    function showTab(tab) {
      document.getElementById('tabRoastBtn').className = 'nav-btn' + (tab === 'roast' ? ' active' : '');
      document.getElementById('tabBattleBtn').className = 'nav-btn' + (tab === 'battle' ? ' active' : '');
      document.getElementById('tabHistoryBtn').className = 'nav-btn' + (tab === 'history' ? ' active' : '');
      document.getElementById('tabKeysBtn').className = 'nav-btn' + (tab === 'keys' ? ' active' : '');

      document.getElementById('roastMainView').className = 'view-container' + (tab === 'roast' ? ' active' : '');
      document.getElementById('battleMainView').className = 'view-container' + (tab === 'battle' ? ' active' : '');
      document.getElementById('historyMainView').className = 'view-container' + (tab === 'history' ? ' active' : '');
      document.getElementById('keysMainView').className = 'view-container' + (tab === 'keys' ? ' active' : '');

      if (tab === 'keys') {
        vscode.postMessage({ type: 'getKeysStatus' });
      }
    }

    function selectLevel(level) {
      currentLevel = level;
      updateLevelUI(level);
      vscode.postMessage({ type: 'changeLevel', level: level });
    }

    function updateLevelUI(level) {
      document.getElementById('chip-mild').className = 'level-chip' + (level === 'mild' ? ' active-mild' : '');
      document.getElementById('chip-medium').className = 'level-chip' + (level === 'medium' ? ' active-medium' : '');
      document.getElementById('chip-savage').className = 'level-chip' + (level === 'savage' ? ' active-savage' : '');
    }

    function triggerReRoast() {
      stopSpeech();
      vscode.postMessage({ type: 'reRoast', level: currentLevel });
    }

    function applyFix() {
      if (lastResult && lastResult.suggestedCode) {
        vscode.postMessage({ type: 'applyFix', code: lastResult.suggestedCode });
      }
    }

    function copyRoastText() {
      if (lastResult) {
        const full = lastResult.roastContent + "\n\n" + lastResult.critique;
        vscode.postMessage({ type: 'copyText', text: full });
      }
    }

    function copySuggestedCode() {
      if (lastResult && lastResult.suggestedCode) {
        vscode.postMessage({ type: 'copyText', text: lastResult.suggestedCode });
      }
    }

    function copyText(str) {
      vscode.postMessage({ type: 'copyText', text: str });
    }

    function clearHistory() {
      vscode.postMessage({ type: 'clearHistory' });
    }

    // 4. Battle Diff & Flame Slider
    function onFlameSliderChange(val) {
      document.getElementById('flameSliderLabel').innerText = val + '%';
      if (val > 80) soundFX.playSizzle();
    }

    function updateBattleDiff(result, codeSnippet) {
      const origCode = codeSnippet || lastCodeSnippet || '// Highlight code or open file to view original lines';
      const cleanCode = result.suggestedCode || '// No suggested fix needed — code was already sparkling!';

      document.getElementById('diffOriginalCode').innerText = origCode;
      document.getElementById('diffRedeemedCode').innerText = cleanCode;
      document.getElementById('diffCrimeBadge').innerText = result.worstCrime ? result.worstCrime.slice(0, 30) : 'Smell Detected';
      document.getElementById('flameSlider').value = result.score || 80;
      document.getElementById('flameSliderLabel').innerText = (result.score || 80) + '%';
    }

    // 5. In-Webview Keys Management
    function selectProviderUI(p) {
      activeProvider = p;
      updateProviderCards();
      vscode.postMessage({ type: 'setProvider', provider: p });
    }

    function updateProviderCards() {
      ['gemini', 'openai', 'claude', 'openrouter', 'ollama'].forEach(p => {
        const el = document.getElementById('pCard-' + p);
        if (el) {
          el.className = 'provider-card-btn' + (p === activeProvider ? ' active' : '');
        }
      });
    }

    function saveKeyUI(p) {
      const input = document.getElementById('inputKey-' + p);
      if (!input) return;
      const keyVal = input.value;
      vscode.postMessage({ type: 'saveApiKey', provider: p, key: keyVal });
    }

    function toggleKeyVisibility(inputId) {
      const input = document.getElementById(inputId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    }

    function renderKeysStatus(providers, activeP) {
      configuredProviders = providers || {};
      activeProvider = activeP || 'openai';
      updateProviderCards();

      ['gemini', 'openai', 'claude', 'openrouter'].forEach(p => {
        const pill = document.getElementById('statusPill-' + p);
        const info = configuredProviders[p];
        if (pill) {
          if (info && info.configured) {
            pill.className = 'key-status-pill configured';
            pill.innerText = '🟢 ' + (info.maskedKey || 'Configured');
          } else {
            pill.className = 'key-status-pill';
            pill.innerText = '⚪ Not Set';
          }
        }
      });
    }

    // 6. Share Card Modal
    function openShareCard() {
      if (!lastResult) return;
      document.getElementById('modalFileBadge').innerText = lastResult.fileName || 'file.ts';
      document.getElementById('modalVerdict').innerText = lastResult.verdict || 'Code Roast';
      document.getElementById('modalCrime').innerText = '🚨 ' + (lastResult.worstCrime || 'Crimes against software');
      document.getElementById('modalPunchline').innerText = '“' + (lastResult.punchline || 'It hurts because it\'s true.') + '”';
      document.getElementById('modalScore').innerText = (lastResult.score || 85) + '/100';
      document.getElementById('shareCardModal').style.display = 'flex';
    }

    function closeShareCard(e) {
      document.getElementById('shareCardModal').style.display = 'none';
    }

    function copyShareCardText() {
      if (!lastResult) return;
      const text = '🔥 Code Roaster Verdict: ' + lastResult.verdict + ' (' + lastResult.score + '/100 Dumpster Score)\n🚨 Worst Crime: ' + lastResult.worstCrime + '\n💬 "' + lastResult.punchline + '"\n\n#CodeRoaster #Hacktoberfest';
      vscode.postMessage({ type: 'copyText', text: text });
    }

    function tweetRoast() {
      if (!lastResult) return;
      const tweet = encodeURIComponent('My code just got roasted by 🔥 Code Roaster with a Dumpster Score of ' + lastResult.score + '/100!\nVerdict: ' + lastResult.verdict + '\n"' + lastResult.punchline + '"\n#CodeRoaster #Hacktoberfest');
      window.open('https://twitter.com/intent/tweet?text=' + tweet, '_blank');
    }

    // 7. Markdown & Result Renderer
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderMarkdown(md) {
      if (!md) return '';
      let html = escapeHtml(md);
      html = html.replace(/^### (.*$)/gim, '<h3 style="margin: 8px 0 4px 0; color: #ff6347;">$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2 style="margin: 10px 0 6px 0; color: #ff4500;">$1</h2>');
      html = html.replace(/^# (.*$)/gim, '<h1 style="margin: 12px 0 8px 0;">$1</h1>');
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
      html = html.replace(new RegExp('\x60([^\x60]+)\x60', 'g'), '<code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
      html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid #ff4500; padding-left: 10px; margin: 8px 0; opacity: 0.9;">$1</blockquote>');
      html = html.replace(/^• (.*$)/gim, '<li style="margin-left: 18px;">$1</li>');
      html = html.replace(/^\- (.*$)/gim, '<li style="margin-left: 18px;">$1</li>');
      html = html.replace(/\n\n/g, '<p style="margin-bottom: 8px;"></p>');
      return html;
    }

    function displayResult(result, codeSnippet) {
      stopLoadingAnimation();
      lastResult = result;
      if (codeSnippet) lastCodeSnippet = codeSnippet;

      document.getElementById('initialPrompt').style.display = 'none';
      document.getElementById('resultContainer').style.display = 'block';

      if (result.roastLevel) {
        currentLevel = result.roastLevel;
        updateLevelUI(result.roastLevel);
      }

      const score = result.score || 65;
      const scoreEl = document.getElementById('scoreValue');
      scoreEl.innerText = score;

      const circle = document.getElementById('scoreCircle');
      if (score > 80) {
        circle.style.borderColor = '#ef4444';
        scoreEl.style.color = '#ef4444';
      } else if (score > 50) {
        circle.style.borderColor = '#f59e0b';
        scoreEl.style.color = '#f59e0b';
      } else {
        circle.style.borderColor = '#10b981';
        scoreEl.style.color = '#10b981';
      }

      document.getElementById('verdictTitle').innerText = result.verdict || 'Code Roast';
      document.getElementById('badgeFile').innerText = result.fileName || 'file';
      document.getElementById('badgeLang').innerText = result.languageId || 'code';
      document.getElementById('badgeLevel').innerText = result.roastLevel || currentLevel;
      document.getElementById('badgeProvider').innerText = result.providerUsed + (result.modelUsed ? ' (' + result.modelUsed + ')' : '');

      document.getElementById('crimeText').innerText = result.worstCrime || 'Various aesthetic transgressions';
      document.getElementById('roastBodyText').innerHTML = renderMarkdown(result.roastContent);
      document.getElementById('critiqueBodyText').innerHTML = renderMarkdown(result.critique);

      const codeSec = document.getElementById('codeSection');
      if (result.suggestedCode && result.suggestedCode.trim()) {
        codeSec.style.display = 'block';
        document.getElementById('suggestedCodeBlock').innerText = result.suggestedCode;
      } else {
        codeSec.style.display = 'none';
      }

      const punchlineCard = document.getElementById('punchlineCard');
      if (result.punchline) {
        punchlineCard.style.display = 'block';
        punchlineCard.innerText = '“ ' + result.punchline + ' ”';
      } else {
        punchlineCard.style.display = 'none';
      }

      updateBattleDiff(result, codeSnippet);
    }

    function renderHistoryList(history) {
      currentHistory = history || [];
      const listEl = document.getElementById('historyList');

      document.getElementById('statTotal').innerText = currentHistory.length;
      if (currentHistory.length > 0) {
        const scores = currentHistory.map(h => h.score);
        document.getElementById('statWorst').innerText = Math.max(...scores);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        document.getElementById('statAvg').innerText = avg;
      } else {
        document.getElementById('statWorst').innerText = '0';
        document.getElementById('statAvg').innerText = '0';
      }

      if (currentHistory.length === 0) {
        listEl.innerHTML = '<li style="text-align: center; padding: 30px; opacity: 0.6;">No past roasts yet. Roast code to fill the Hall of Shame!</li>';
        return;
      }

      listEl.innerHTML = currentHistory.map(function(item) {
        var scoreColor = item.score > 80 ? '#ef4444' : (item.score > 50 ? '#f59e0b' : '#10b981');
        return '<li class="history-card" onclick="loadHistoryItem(\'' + item.id + '\')">' +
          '<div>' +
            '<div style="font-weight: 600; font-size: 0.88rem;">' + escapeHtml(item.fileName) + ' &bull; ' + escapeHtml(item.verdict) + '</div>' +
            '<div style="font-size: 0.78rem; opacity: 0.7;">🚨 ' + escapeHtml(item.worstCrime) + '</div>' +
          '</div>' +
          '<div style="font-size: 1.1rem; font-weight: 700; color: ' + scoreColor + ';">' + item.score + '</div>' +
        '</li>';
      }).join('');
    }

    function loadHistoryItem(id) {
      vscode.postMessage({ type: 'loadHistoryItem', id: id });
    }

    function startLoadingAnimation(level, message) {
      document.getElementById('initialPrompt').style.display = 'none';
      document.getElementById('resultContainer').style.display = 'none';
      document.getElementById('loadingState').style.display = 'block';
      if (message) document.getElementById('loadingTitle').innerText = message;
    }

    function stopLoadingAnimation() {
      document.getElementById('loadingState').style.display = 'none';
    }

    // Message handler
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'status':
          if (message.state === 'roasting') {
            startLoadingAnimation(message.level, message.message);
          } else {
            stopLoadingAnimation();
          }
          break;
        case 'roastResult':
          displayResult(message.result, message.codeSnippet);
          renderHistoryList(message.history);
          break;
        case 'historyUpdate':
          renderHistoryList(message.history);
          break;
        case 'keysStatus':
          renderKeysStatus(message.providers, message.activeProvider);
          break;
        case 'error':
          stopLoadingAnimation();
          alert('Code Roaster Error: ' + message.message);
          break;
      }
    });

    updateLevelUI(currentLevel);
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
