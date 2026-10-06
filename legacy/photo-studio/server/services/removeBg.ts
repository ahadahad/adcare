/**
 * Sanitizes and extracts the remove.bg API key from environment variables.
 * Handles common user entry issues: accidental quotes, 'Bearer ' prefix,
 * trailing semicolons, carriage returns, and multiple naming variations.
 */
export function getEffectiveRemoveBgKey(): string | null {
  const possibleKeys = [
    process.env.REMOVE_BG_API_KEY,
    process.env.REMOVEBG_API_KEY,
    process.env.REMOVE_BG_KEY,
    process.env.REMOVEBG_KEY,
    process.env.REMOVE_BG_TOKEN,
    process.env.REMOVEBG_TOKEN,
    process.env.VITE_REMOVE_BG_API_KEY,
    process.env.REMOVE_BG,
  ];

  for (const raw of possibleKeys) {
    if (raw && typeof raw === 'string') {
      let cleaned = raw.trim();
      // Remove BOM and zero-width spaces
      cleaned = cleaned.replace(/^[\uFEFF\u200B\u00A0]+|[\uFEFF\u200B\u00A0]+$/g, '').trim();
      // Strip surrounding single, double, or backtick quotes
      cleaned = cleaned.replace(/^["'`]|["'`]$/g, '').trim();
      // Strip accidental "Bearer " or "Token " prefix
      cleaned = cleaned.replace(/^(bearer|token|key:?)\s+/i, '').trim();
      // Strip accidental trailing semicolons or commas
      cleaned = cleaned.replace(/[;,]+$/, '').trim();

      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }

  return null;
}

export interface RemoveBgOptions {
  size?: 'auto' | 'preview' | 'regular' | 'medium' | 'hd' | '4k' | 'full';
  type?: 'auto' | 'person' | 'product' | 'animal' | 'car' | 'other';
  bgColor?: string;
  crop?: boolean;
}

export interface RemoveBgResult {
  success: boolean;
  cutoutDataUrl: string;
  provider: string;
  creditsCharged?: number;
  detectedType?: string;
  width?: number;
  height?: number;
}

let isRemoveBgQuotaExhausted = false;

export function isQuotaExhausted(): boolean {
  return isRemoveBgQuotaExhausted;
}

export function setQuotaExhausted(exhausted: boolean): void {
  isRemoveBgQuotaExhausted = exhausted;
}

function parseRemoveBgError(status: number, errJson: any, fallbackText?: string): string {
  let details = '';
  if (Array.isArray(errJson?.errors) && errJson.errors.length > 0) {
    details = errJson.errors
      .map((e: any) => {
        const parts = [e.title, e.detail].filter(Boolean);
        return parts.length > 0 ? parts.join(': ') : e.code || 'Unknown error';
      })
      .join('; ');
  } else if (errJson?.error) {
    details = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
  } else if (fallbackText) {
    details = fallbackText.slice(0, 150);
  }

  if (status === 402) {
    isRemoveBgQuotaExhausted = true;
    return 'remove.bg account has 0 credits remaining (quota exhausted). Please top up your account at remove.bg or use Studio Fast Vision.';
  }

  if (status === 401 || status === 403) {
    return `remove.bg rejected the API key (${details || 'Invalid or unauthorized key'}). Please check your REMOVE_BG_API_KEY environment variable.`;
  }

  if (status === 429) {
    return `remove.bg rate limit reached (${details || 'Too many requests'}). Please wait a moment and try again.`;
  }

  return details || `remove.bg API error (HTTP ${status})`;
}

/**
 * Remove image background using the official remove.bg API (https://api.remove.bg/v1.0/removebg)
 * Uses standard multipart/form-data via global FormData supported in Node 18+ and Vercel Serverless.
 */
export async function removeBackgroundWithRemoveBg(
  imageSource: string,
  options?: RemoveBgOptions
): Promise<RemoveBgResult> {
  const apiKey = getEffectiveRemoveBgKey();
  if (!apiKey) {
    throw new Error(
      'REMOVE_BG_API_KEY environment variable is not configured on the server. Please add REMOVE_BG_API_KEY to your Vercel Project Settings -> Environment Variables and redeploy.'
    );
  }

  // Clean base64 string
  let cleanBase64 = imageSource;
  if (imageSource.startsWith('data:')) {
    const commaIdx = imageSource.indexOf(',');
    if (commaIdx !== -1) {
      cleanBase64 = imageSource.slice(commaIdx + 1);
    }
  }
  cleanBase64 = cleanBase64.trim().replace(/\s+/g, '');

  if (!cleanBase64 || cleanBase64.length === 0) {
    throw new Error('Invalid image data provided for background removal.');
  }

  // remove.bg official API endpoint requires multipart/form-data
  const formData = new FormData();
  formData.append('image_file_b64', cleanBase64);
  formData.append('size', options?.size || 'auto');
  formData.append('type', options?.type || 'auto');
  formData.append('format', 'png');
  formData.append('channels', 'rgba');

  if (options?.bgColor && options.bgColor !== 'transparent') {
    formData.append('bg_color', options.bgColor.replace(/^#/, ''));
  }

  if (options?.crop) {
    formData.append('crop', 'true');
  }

  let response: Response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'image/png, application/json',
      },
      body: formData,
    });
  } catch (netErr: any) {
    console.error('[remove.bg] Network request error:', netErr);
    throw new Error(
      `Failed to reach remove.bg API: ${netErr.message || 'Network connection failed'}`
    );
  }

  if (!response.ok) {
    let errJson: any = null;
    let text = '';
    try {
      errJson = await response.json();
    } catch {
      text = await response.text().catch(() => '');
    }

    const errorMessage = parseRemoveBgError(response.status, errJson, text);
    if (response.status === 402 || response.status === 429) {
      console.warn(`[remove.bg] Quota Notice [HTTP ${response.status}]: ${errorMessage}`);
    } else {
      console.error(`[remove.bg] Error [HTTP ${response.status}]: ${errorMessage}`);
    }
    throw new Error(errorMessage);
  }

  // Response is binary PNG data
  const arrayBuffer = await response.arrayBuffer();
  const base64Buffer = Buffer.from(arrayBuffer).toString('base64');
  const cutoutDataUrl = `data:image/png;base64,${base64Buffer}`;

  const creditsCharged = Number(response.headers.get('x-credits-charged')) || 1;
  const detectedType = response.headers.get('x-type') || options?.type || 'auto';
  const width = Number(response.headers.get('x-width')) || undefined;
  const height = Number(response.headers.get('x-height')) || undefined;

  return {
    success: true,
    cutoutDataUrl,
    provider: 'remove.bg API',
    creditsCharged,
    detectedType,
    width,
    height,
  };
}

/**
 * Verify remove.bg API connection & fetch account balance info
 */
export async function testRemoveBgConnection(): Promise<{
  success: boolean;
  message: string;
  keyConfigured: boolean;
  hasUsableCredits?: boolean;
  credits?: {
    total: number;
    subscription: number;
    payg: number;
    enterprise: number;
  };
  apiCalls?: {
    free_calls: number;
  };
}> {
  const apiKey = getEffectiveRemoveBgKey();
  if (!apiKey) {
    return {
      success: false,
      keyConfigured: false,
      message:
        'REMOVE_BG_API_KEY is not set in environment variables. Add it in Vercel -> Settings -> Environment Variables and redeploy.',
    };
  }

  try {
    const response = await fetch('https://api.remove.bg/v1.0/account', {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      let errJson: any = null;
      let text = '';
      try {
        errJson = await response.json();
      } catch {
        text = await response.text().catch(() => '');
      }

      const msg = parseRemoveBgError(response.status, errJson, text);
      return {
        success: false,
        keyConfigured: true,
        message: msg,
      };
    }

    const data: any = await response.json();
    const attributes = data?.data?.attributes;
    const credits = attributes?.credits;
    const apiCalls = attributes?.api;

    const totalCredits = credits?.total ?? 0;
    const freeCalls = apiCalls?.free_calls ?? 0;
    const hasUsableCredits = totalCredits > 0 || freeCalls > 0;
    if (!hasUsableCredits) {
      isRemoveBgQuotaExhausted = true;
    }

    return {
      success: true,
      keyConfigured: true,
      hasUsableCredits,
      message: hasUsableCredits
        ? `Connected to remove.bg successfully! (${totalCredits} credits, ${freeCalls} free calls remaining)`
        : `Connected to remove.bg, but account has 0 credits and 0 free calls remaining. Studio Fast Vision will be used automatically.`,
      credits: credits
        ? {
            total: credits.total ?? 0,
            subscription: credits.subscription ?? 0,
            payg: credits.payg ?? 0,
            enterprise: credits.enterprise ?? 0,
          }
        : undefined,
      apiCalls: apiCalls ? { free_calls: freeCalls } : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      keyConfigured: true,
      message: `Failed to connect to remove.bg: ${err.message || 'Network error'}`,
    };
  }
}
