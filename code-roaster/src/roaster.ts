import * as vscode from 'vscode';
import { generateOfflineRoast } from './offlineRoaster';
import { parseRoastResponse } from './parser';
import { buildUserPrompt, getSystemPrompt } from './prompts';
import { Provider, RoastRequest, RoastResult } from './types';

export class RoasterEngine {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public async getApiKey(provider: Provider): Promise<string> {
    // 1. Check secret storage for specific provider
    const secretKey = await this.context.secrets.get(`codeRoaster.apiKey.${provider}`);
    if (secretKey && secretKey.trim()) {
      return secretKey.trim();
    }

    // 2. Check settings configuration for specific provider
    const config = vscode.workspace.getConfiguration('codeRoaster');
    if (provider === 'gemini') {
      const geminiConfigKey = config.get<string>('geminiApiKey');
      if (geminiConfigKey && geminiConfigKey.trim()) {
        return geminiConfigKey.trim();
      }
    }
    if (provider === 'openai') {
      const openaiConfigKey = config.get<string>('openaiApiKey');
      if (openaiConfigKey && openaiConfigKey.trim()) {
        return openaiConfigKey.trim();
      }
    }

    // 3. Check general secret key
    const generalSecretKey = await this.context.secrets.get('codeRoaster.apiKey');
    if (generalSecretKey && generalSecretKey.trim()) {
      return generalSecretKey.trim();
    }

    // 4. Check general settings configuration
    const configKey = config.get<string>('apiKey');
    if (configKey && configKey.trim()) {
      return configKey.trim();
    }

    // 5. Check environment variables
    if (provider === 'gemini' && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!.trim();
    }
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY.trim();
    }
    if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY.trim();
    }
    if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY.trim();
    }

    return '';
  }

  public async getProvidersStatus(): Promise<{
    providers: Record<Provider, { configured: boolean; maskedKey?: string }>;
    activeProvider: Provider;
  }> {
    const config = vscode.workspace.getConfiguration('codeRoaster');
    const activeProvider = (config.get<Provider>('provider') || 'openai') as Provider;
    const providerList: Provider[] = ['gemini', 'openai', 'claude', 'openrouter', 'ollama'];

    const providers: Record<Provider, { configured: boolean; maskedKey?: string }> = {
      gemini: { configured: false },
      openai: { configured: false },
      claude: { configured: false },
      openrouter: { configured: false },
      ollama: { configured: true, maskedKey: 'localhost:11434' },
    };

    for (const p of providerList) {
      if (p === 'ollama') continue;
      const key = await this.getApiKey(p);
      if (key && key.trim()) {
        const trimmed = key.trim();
        const prefix = trimmed.slice(0, 4);
        const suffix = trimmed.slice(-3);
        providers[p] = {
          configured: true,
          maskedKey: `${prefix}••••••••${suffix}`,
        };
      }
    }

    return { providers, activeProvider };
  }

  public async roast(request: RoastRequest): Promise<RoastResult> {
    const config = vscode.workspace.getConfiguration('codeRoaster');
    let provider = request.provider || config.get<Provider>('provider') || 'openai';
    const customModel = request.model || config.get<string>('model') || '';
    const customBaseUrl = config.get<string>('apiBaseUrl') || '';

    let apiKey = await this.getApiKey(provider);

    // Auto-detect provider if key prefix strongly matches Google Gemini (starts with AIza)
    if (apiKey.startsWith('AIza') && provider !== 'gemini') {
      provider = 'gemini';
    }

    // If no API key for active provider, check if Gemini or OpenAI has a key available
    if (!apiKey && provider !== 'ollama') {
      const geminiKey = await this.getApiKey('gemini');
      if (geminiKey) {
        provider = 'gemini';
        apiKey = geminiKey;
      } else {
        const openaiKey = await this.getApiKey('openai');
        if (openaiKey) {
          provider = 'openai';
          apiKey = openaiKey;
        }
      }
    }

    // If still no API key and not ollama, fallback to offline heuristic comedy engine
    if (!apiKey && provider !== 'ollama') {
      return generateOfflineRoast(request);
    }

    try {
      switch (provider) {
        case 'gemini':
          return await this.roastWithGemini(request, apiKey, customModel);
        case 'claude':
          return await this.roastWithClaude(request, apiKey, customModel, customBaseUrl);
        case 'ollama':
          return await this.roastWithOpenAICompatible(
            request,
            'ollama',
            customModel || 'llama3',
            customBaseUrl || 'http://localhost:11434/v1'
          );
        case 'openrouter':
          return await this.roastWithOpenAICompatible(
            request,
            apiKey,
            customModel || 'openai/gpt-4o-mini',
            customBaseUrl || 'https://openrouter.ai/api/v1'
          );
        case 'openai':
        default:
          return await this.roastWithOpenAI(
            request,
            apiKey,
            customModel || 'gpt-4o-mini',
            customBaseUrl || 'https://api.openai.com/v1'
          );
      }
    } catch (error: any) {
      console.error('AI provider call failed:', error);
      // Fallback to offline roaster with error context
      const fallback = generateOfflineRoast(request);
      fallback.roastContent = `> ⚠️ **Provider Error**: Could not connect to ${provider} (${error.message || 'Network error'}). Enjoy our backup standup set instead!\n\n${fallback.roastContent}`;
      return fallback;
    }
  }

  private async roastWithOpenAI(
    req: RoastRequest,
    apiKey: string,
    model: string,
    baseUrl: string
  ): Promise<RoastResult> {
    return this.roastWithOpenAICompatible(req, apiKey, model, baseUrl);
  }

  private async roastWithOpenAICompatible(
    req: RoastRequest,
    apiKey: string,
    model: string,
    baseUrl: string
  ): Promise<RoastResult> {
    const systemPrompt = getSystemPrompt(req.roastLevel);
    const userPrompt = buildUserPrompt(req);

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content || '';
    return this.parseRoastResult(content, req, 'OpenAI', model);
  }

  private async roastWithGemini(
    req: RoastRequest,
    apiKey: string,
    modelName: string
  ): Promise<RoastResult> {
    const model = modelName || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemPrompt = getSystemPrompt(req.roastLevel);
    const userPrompt = buildUserPrompt(req);

    // Primary request using system_instruction and JSON mime type
    const requestBody: any = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
      },
    };

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // Fallback if system_instruction / responseMimeType is rejected by older or specialized models
    if (!response.ok && response.status === 400) {
      const fallbackBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
        },
      };
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackBody),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Google Gemini Error (${response.status})`;
      try {
        const parsedErr = JSON.parse(errText);
        if (parsedErr?.error?.message) {
          errorMsg = `Gemini API: ${parsedErr.error.message}`;
        }
      } catch (_) {
        errorMsg = `Gemini API (${response.status}): ${errText.slice(0, 150)}`;
      }
      throw new Error(errorMsg);
    }

    const data = (await response.json()) as any;
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';

    if (!content) {
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error('Gemini safety filter flagged the code snippet or comedy critique.');
      }
      throw new Error('Gemini returned an empty response. Please try again.');
    }

    return this.parseRoastResult(content, req, 'Google Gemini', model);
  }

  private async roastWithClaude(
    req: RoastRequest,
    apiKey: string,
    modelName: string,
    baseUrl: string
  ): Promise<RoastResult> {
    const model = modelName || 'claude-3-5-haiku-20241022';
    const cleanBaseUrl = (baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/messages`;

    const systemPrompt = getSystemPrompt(req.roastLevel);
    const userPrompt = buildUserPrompt(req);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 3000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.content?.[0]?.text || '';
    return parseRoastResponse(content, req, 'Anthropic Claude', model);
  }

  public parseRoastResult(
    rawText: string,
    req: RoastRequest,
    providerUsed: string,
    modelUsed: string
  ): RoastResult {
    return parseRoastResponse(rawText, req, providerUsed, modelUsed);
  }
}

export { parseRoastResponse } from './parser';

