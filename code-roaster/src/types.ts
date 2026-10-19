export type RoastLevel = 'mild' | 'medium' | 'spicy' | 'savage' | 'nuclear' | 'existential-crisis';

export type Provider = 'openai' | 'gemini' | 'claude' | 'openrouter' | 'ollama';

export interface RoastRequest {
  code: string;
  languageId: string;
  fileName: string;
  selectionRange?: {
    startLine: number;
    endLine: number;
  };
  roastLevel: RoastLevel;
  provider?: Provider;
  model?: string;
}

export interface RoastResult {
  id: string;
  timestamp: number;
  fileName: string;
  languageId: string;
  roastLevel: RoastLevel;
  score: number; // 0 to 100 (100 = legendary dumpster fire)
  verdict: string;
  worstCrime: string;
  roastContent: string;
  critique: string;
  suggestedCode?: string;
  punchline: string;
  providerUsed: string;
  modelUsed: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  languageId: string;
  roastLevel: RoastLevel;
  score: number;
  verdict: string;
  worstCrime: string;
  codeSnippet: string;
}

export type WebviewToExtensionMessage =
  | { type: 'reRoast'; level?: RoastLevel }
  | { type: 'changeLevel'; level: RoastLevel }
  | { type: 'setApiKey'; key: string; provider?: Provider }
  | { type: 'saveApiKey'; provider: Provider; key: string }
  | { type: 'setProvider'; provider: Provider }
  | { type: 'getKeysStatus' }
  | { type: 'promptApiKey' }
  | { type: 'openSettings' }
  | { type: 'applyFix'; code: string }
  | { type: 'copyText'; text: string }
  | { type: 'clearHistory' }
  | { type: 'loadHistoryItem'; id: string }
  | { type: 'ready' };

export type ExtensionToWebviewMessage =
  | { type: 'status'; state: 'loading' | 'roasting' | 'idle' | 'error'; message?: string; level?: RoastLevel }
  | { type: 'roastResult'; result: RoastResult; history: HistoryItem[]; codeSnippet?: string }
  | { type: 'streamChunk'; text: string }
  | { type: 'historyUpdate'; history: HistoryItem[] }
  | { type: 'apiKeyMissing'; provider: string }
  | { type: 'keysStatus'; providers: Record<Provider, { configured: boolean; maskedKey?: string }>; activeProvider: Provider }
  | { type: 'keySaved'; provider: Provider; success: boolean; message: string }
  | { type: 'error'; message: string };

