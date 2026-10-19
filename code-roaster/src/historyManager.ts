import * as vscode from 'vscode';
import { HistoryItem, RoastResult } from './types';

const HISTORY_KEY = 'codeRoaster.roastHistory';
const MAX_HISTORY = 50;

export class HistoryManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public getHistory(): HistoryItem[] {
    const raw = this.context.globalState.get<HistoryItem[]>(HISTORY_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  public async addEntry(result: RoastResult, codeSnippet: string): Promise<HistoryItem[]> {
    const history = this.getHistory();
    const truncatedCode = codeSnippet.length > 500 ? codeSnippet.substring(0, 500) + '...' : codeSnippet;

    const newItem: HistoryItem = {
      id: result.id,
      timestamp: result.timestamp,
      fileName: result.fileName,
      languageId: result.languageId,
      roastLevel: result.roastLevel,
      score: result.score,
      verdict: result.verdict,
      worstCrime: result.worstCrime,
      codeSnippet: truncatedCode,
    };

    // Keep unique by ID, insert at start, trim to MAX_HISTORY
    const updated = [newItem, ...history.filter((h) => h.id !== newItem.id)].slice(0, MAX_HISTORY);
    await this.context.globalState.update(HISTORY_KEY, updated);
    return updated;
  }

  public async clearHistory(): Promise<void> {
    await this.context.globalState.update(HISTORY_KEY, []);
  }

  public getStats(): {
    totalRoasts: number;
    worstScore: number;
    averageScore: number;
    hallOfShame: HistoryItem[];
  } {
    const history = this.getHistory();
    if (history.length === 0) {
      return { totalRoasts: 0, worstScore: 0, averageScore: 0, hallOfShame: [] };
    }

    const totalRoasts = history.length;
    const worstScore = Math.max(...history.map((h) => h.score));
    const averageScore = Math.round(
      history.reduce((sum, h) => sum + h.score, 0) / totalRoasts
    );

    // Sorted descending by score (worst code at the top)
    const hallOfShame = [...history].sort((a, b) => b.score - a.score).slice(0, 5);

    return { totalRoasts, worstScore, averageScore, hallOfShame };
  }
}
