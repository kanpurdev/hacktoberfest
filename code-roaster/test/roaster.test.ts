import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { generateOfflineRoast } from '../src/offlineRoaster';
import { parseRoastResponse } from '../src/parser';
import { buildUserPrompt, getSystemPrompt } from '../src/prompts';
import { RoastRequest } from '../src/types';

describe('Prompts Generator', () => {
  it('generates system prompts for all 3 levels', () => {
    const mild = getSystemPrompt('mild');
    const medium = getSystemPrompt('medium');
    const savage = getSystemPrompt('savage');

    assert.ok(mild.includes('MILD'), 'Mild prompt should contain MILD');
    assert.ok(medium.includes('MEDIUM'), 'Medium prompt should contain MEDIUM');
    assert.ok(savage.includes('SAVAGE'), 'Savage prompt should contain SAVAGE');
    assert.ok(savage.includes('Gordon Ramsay'), 'Savage prompt should mention Gordon Ramsay style');
  });

  it('builds user prompt with file info and code', () => {
    const req: RoastRequest = {
      code: 'function add(a, b) { return a + b; }',
      languageId: 'typescript',
      fileName: 'math.ts',
      roastLevel: 'savage',
      selectionRange: { startLine: 1, endLine: 1 },
    };

    const userPrompt = buildUserPrompt(req);
    assert.ok(userPrompt.includes('math.ts'));
    assert.ok(userPrompt.includes('typescript'));
    assert.ok(userPrompt.includes('Selected lines 1-1'));
    assert.ok(userPrompt.includes('function add(a, b)'));
  });
});

describe('Offline Heuristic Roaster Engine', () => {
  it('detects multiple code smells and computes a higher dumpster score', () => {
    const badCode = `
      var temp = 10;
      // TODO: fix this later
      function calculate(any: any) {
        console.log("doing calculation");
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 10; j++) {
            if (i == "0") {
              try {
                eval("console.log(i)");
              } catch (e) {}
            }
          }
        }
      }
    `;

    const result = generateOfflineRoast({
      code: badCode,
      languageId: 'javascript',
      fileName: 'badCode.js',
      roastLevel: 'savage',
    });

    assert.ok(result.score >= 70, `Score should be high for terrible code (got ${result.score})`);
    assert.ok(result.roastContent.includes('SAVAGE'), 'Roast content should reflect Savage mode');
    assert.ok(result.worstCrime.length > 0, 'Worst crime should be populated');
    assert.ok(result.critique.length > 0, 'Critique should be populated');
    assert.ok(result.suggestedCode && result.suggestedCode.length > 0, 'Suggested code should be provided');
    assert.ok(result.punchline.length > 0, 'Punchline should be provided');
  });

  it('handles clean code gracefully', () => {
    const cleanCode = `
      export function sum(a: number, b: number): number {
        return a + b;
      }
    `;

    const result = generateOfflineRoast({
      code: cleanCode,
      languageId: 'typescript',
      fileName: 'clean.ts',
      roastLevel: 'mild',
    });

    assert.ok(result.score < 50, `Clean code score should be low (got ${result.score})`);
    assert.strictEqual(result.roastLevel, 'mild');
  });
});

describe('Roaster Response Parser', () => {
  const dummyReq: RoastRequest = {
    code: 'const a = 1;',
    languageId: 'typescript',
    fileName: 'test.ts',
    roastLevel: 'medium',
  };

  it('parses pure JSON responses correctly', () => {
    const raw = JSON.stringify({
      score: 88,
      verdict: 'Dumpster Deluxe',
      worstCrime: 'Single letter variable',
      roast: 'This is a roast',
      critique: 'Use better names',
      suggestedCode: 'const itemCount = 1;',
      punchline: 'Goodbye',
    });

    const parsed = parseRoastResponse(raw, dummyReq, 'OpenAI', 'gpt-4o-mini');
    assert.strictEqual(parsed.score, 88);
    assert.strictEqual(parsed.verdict, 'Dumpster Deluxe');
    assert.strictEqual(parsed.worstCrime, 'Single letter variable');
    assert.strictEqual(parsed.suggestedCode, 'const itemCount = 1;');
  });

  it('parses markdown-fenced JSON responses correctly', () => {
    const raw = '```json\n{\n  "score": 92,\n  "verdict": "Savage Burn",\n  "worstCrime": "Recursion without base case",\n  "roast": "Hilarious"\n}\n```';
    const parsed = parseRoastResponse(raw, dummyReq, 'OpenAI', 'gpt-4o-mini');
    assert.strictEqual(parsed.score, 92);
    assert.strictEqual(parsed.verdict, 'Savage Burn');
  });

  it('gracefully handles non-JSON plain text', () => {
    const raw = 'You call this code? My toaster runs better assembly.';
    const parsed = parseRoastResponse(raw, dummyReq, 'OpenAI', 'gpt-4o-mini');
    assert.ok(parsed.score >= 50);
    assert.strictEqual(parsed.roastContent, raw);
  });
});

