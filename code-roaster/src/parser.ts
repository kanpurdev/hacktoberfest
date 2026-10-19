import { RoastRequest, RoastResult } from './types';

export function parseRoastResponse(
  rawText: string,
  req: RoastRequest,
  providerUsed: string,
  modelUsed: string
): RoastResult {
  try {
    // 1. Remove markdown fences if present
    let clean = rawText.trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    // 2. Extract json block if surrounded by text
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(clean);

    return {
      id: `roast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      fileName: req.fileName,
      languageId: req.languageId,
      roastLevel: req.roastLevel,
      score: typeof parsed.score === 'number' ? parsed.score : 65,
      verdict: parsed.verdict || 'Code Comedian Review',
      worstCrime: parsed.worstCrime || 'Questionable architecture',
      roastContent: parsed.roast || parsed.roastContent || clean,
      critique: parsed.critique || 'Refactor according to standard industry practices.',
      suggestedCode: parsed.suggestedCode || '',
      punchline: parsed.punchline || 'Happy coding!',
      providerUsed,
      modelUsed,
    };
  } catch (e) {
    // Graceful fallback if JSON parsing fails
    return {
      id: `roast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      fileName: req.fileName,
      languageId: req.languageId,
      roastLevel: req.roastLevel,
      score: 75,
      verdict: 'Certified Chaos',
      worstCrime: 'Confusing both the compiler and the audience',
      roastContent: rawText,
      critique: 'Review code structure, enforce strong typing, and reduce cyclomatic complexity.',
      suggestedCode: '',
      punchline: 'It works on my machine is not a valid CI/CD strategy.',
      providerUsed,
      modelUsed,
    };
  }
}
