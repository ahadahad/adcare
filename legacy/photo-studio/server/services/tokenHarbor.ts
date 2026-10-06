import { GoogleGenAI } from '@google/genai';
import { AIResponse, AIResponseSchema, ClientAssistantRequest } from '../validation/aiSchemas.js';

export interface TokenHarborConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

export function normalizeBaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return 'https://tokenharbor.ai/v1';
  }
  let url = rawUrl.trim().replace(/\/+$/, '');
  url = url.replace('https://api.tokenharbor.ai', 'https://tokenharbor.ai');
  url = url.replace('http://api.tokenharbor.ai', 'https://tokenharbor.ai');
  if (url === 'https://tokenharbor.ai' || url === 'http://tokenharbor.ai') {
    url = 'https://tokenharbor.ai/v1';
  }
  return url;
}

export function getTokenHarborConfig(): TokenHarborConfig {
  const apiKey = process.env.TOKEN_HARBOR_API_KEY?.trim();
  const baseUrl = normalizeBaseUrl(
    process.env.TOKEN_HARBOR_BASE_URL || 'https://tokenharbor.ai/v1'
  );
  const model = process.env.TOKEN_HARBOR_MODEL?.trim() || 'gpt-5.6-luna';

  return {
    apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined,
    baseUrl,
    model,
  };
}

export function getAIStatus() {
  const tokenHarbor = getTokenHarborConfig();
  const hasTokenHarbor = Boolean(tokenHarbor.apiKey && tokenHarbor.apiKey.length > 0);
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0
  );

  return {
    configured: hasTokenHarbor || hasGemini,
    activeProvider: hasTokenHarbor
      ? 'TokenHarbor'
      : hasGemini
      ? 'Gemini'
      : 'None',
    model: hasTokenHarbor
      ? tokenHarbor.model
      : hasGemini
      ? 'gemini-flash-latest'
      : 'gpt-5.6-luna',
  };
}

export async function testTokenHarborConnection(config: TokenHarborConfig): Promise<{
  success: boolean;
  message: string;
  model: string;
}> {
  if (!config.apiKey) {
    throw new Error('API Key is missing. Please provide a TokenHarbor API key.');
  }

  const cleanBaseUrl = normalizeBaseUrl(config.baseUrl || 'https://tokenharbor.ai/v1');
  const url = `${cleanBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-5.6-luna',
      messages: [{ role: 'user', content: 'Say hello in two words.' }],
      temperature: 0.2,
      max_tokens: 15,
    }),
  });

  const responseText = await response.text().catch(() => '');
  let json: any = null;
  try {
    json = JSON.parse(responseText);
  } catch {
    // Non-JSON response (e.g. 404 HTML, Cloudflare challenge, or proxy error)
    if (responseText.trim().startsWith('<')) {
      throw new Error(
        `Endpoint (${cleanBaseUrl}) returned HTML instead of JSON. Ensure Base URL is "https://tokenharbor.ai/v1" and not an invalid host.`
      );
    }
    throw new Error(
      `Endpoint returned invalid response (${response.status}): ${
        responseText.slice(0, 160) || response.statusText
      }`
    );
  }

  if (!response.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.message ||
      response.statusText ||
      `HTTP Error ${response.status}`;
    throw new Error(`TokenHarbor API error (${response.status}): ${errorMsg}`);
  }

  return {
    success: true,
    message: `Connected successfully to TokenHarbor using model "${config.model}"!`,
    model: config.model,
  };
}

export async function fetchTokenHarborModels(config: TokenHarborConfig): Promise<string[]> {
  if (!config.apiKey) return [];
  const cleanBaseUrl = normalizeBaseUrl(config.baseUrl || 'https://tokenharbor.ai/v1');
  try {
    const res = await fetch(`${cleanBaseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
    if (!res.ok) return [];
    const json: any = await res.json().catch(() => null);
    if (Array.isArray(json?.data)) {
      return json.data.map((m: any) => m.id || m.name).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

export const SYSTEM_PROMPT = `You are ShebaFlow Photo Studio's AI editing assistant powered by TokenHarbor.

Your responsibility is to translate natural-language photo editing requests into safe structured operations.

Supported operations:
- setBrightness (value: -100 to 100)
- setContrast (value: -100 to 100)
- setSaturation (value: -100 to 100)
- setExposure (value: -100 to 100)
- setFilter (filter: "original" | "grayscale" | "sepia" | "vivid" | "warm" | "cool" | "vintage" | "soft" | "highContrast" | "blackAndWhite")
- crop (x: number, y: number, width: number, height: number, aspect?: string)
- resize (width: 1-8000, height: 1-8000, lockAspectRatio: boolean)
- rotate (degrees: 90 | 180 | 270)
- flipHorizontal (value: true)
- flipVertical (value: true)
- setBackground (color: string hex or name e.g. "#FFFFFF", "#E0F2FE", "#000000")
- setTransparency (enabled: true | false)
- removeBackground (targetColor?: string e.g. "#FFFFFF" or "transparent")
- enhancePhoto (level: "subtle" | "balanced" | "vivid")
- setBorder (enabled: true | false, color: string, width: number 0-40, radius: number 0-40)
- resetAdjustments ()
- exportSuggestion (format: "png" | "jpeg" | "webp", quality: 10-100)
- unsupported (reason: string)

Rules:
1. Return JSON only matching the schema.
2. Never return arbitrary code or HTML.
3. Be precise with parameters.
4. If the request cannot be handled, return operation unsupported with a clear reason.

Output schema:
{
  "operations": [
    { "type": "setBrightness", "value": 15 }
  ],
  "explanation": "Increased brightness by 15%."
}`;

export async function processAIAssistantRequest(
  payload: ClientAssistantRequest
): Promise<AIResponse> {
  const { instruction, editorState } = payload;
  const config = getTokenHarborConfig();

  const userContextPrompt = `Current Editor State:
- Current Image Dimensions: ${editorState.currentDimensions.width}x${editorState.currentDimensions.height} px
- Adjustments: brightness=${editorState.adjustments.brightness}, contrast=${editorState.adjustments.contrast}, saturation=${editorState.adjustments.saturation}, exposure=${editorState.adjustments.exposure}
- Current Filter: ${editorState.filter}
- Background: ${editorState.background.isTransparent ? 'Transparent' : editorState.background.color}
- Border: ${editorState.border.enabled ? `Enabled (${editorState.border.color}, ${editorState.border.width}px, r:${editorState.border.radius}px)` : 'Disabled'}
- Rotation: ${editorState.rotation}°
- Mode: ${editorState.isPassportMode ? 'Passport Mode' : 'Standard Studio'}

User Request: "${instruction}"

Translate this request into safe JSON operations following the system instructions.`;

  // 1. Primary: TokenHarbor API
  if (config.apiKey) {
    return await callTokenHarbor(config, userContextPrompt);
  }

  // 2. Secondary: Gemini API if available in environment
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
    return await callGeminiFallback(userContextPrompt);
  }

  // 3. If neither key is provided, return explicit error to ensure authentic API integration
  throw new Error(
    'TOKEN_HARBOR_API_KEY is not configured. Please set your TokenHarbor API key (from https://tokenharbor.ai/) in environment variables or settings to use the AI assistant.'
  );
}

export async function callTokenHarbor(config: TokenHarborConfig, userPrompt: string): Promise<AIResponse> {
  const url = `${config.baseUrl}/chat/completions`;

  const requestBody = {
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `TokenHarbor API error (${response.status}): ${errorText.slice(0, 300) || response.statusText}`
    );
  }

  const json: any = await response.json();
  const rawContent = json?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('TokenHarbor API returned an empty or invalid response.');
  }

  return parseAndValidateAIResponse(rawContent);
}

export async function callTokenHarborVision(
  config: TokenHarborConfig,
  prompt: string,
  imageBase64: string
): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${cleanBase64}`;

  const requestBody = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `TokenHarbor Vision API error (${response.status}): ${errorText.slice(0, 300) || response.statusText}`
    );
  }

  const json: any = await response.json();
  const rawContent = json?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('TokenHarbor Vision returned an empty or invalid response.');
  }

  return rawContent;
}

async function callGeminiFallback(userPrompt: string): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = new GoogleGenAI({ apiKey });
  const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const rawText = response.text || '';
      if (rawText) {
        return parseAndValidateAIResponse(rawText);
      }
    } catch {
      continue;
    }
  }

  throw new Error('Gemini API service temporarily unavailable');
}

function parseAndValidateAIResponse(raw: string): AIResponse {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`AI generated invalid JSON: ${err.message}`);
  }

  const validationResult = AIResponseSchema.safeParse(parsed);
  if (!validationResult.success) {
    const formattedErrors = validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`AI response failed schema validation: ${formattedErrors}`);
  }

  return validationResult.data;
}
