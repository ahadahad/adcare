/**
 * Client-side high-efficiency image optimizer for AI Vision services.
 * Downscales ultra-high resolution photos (e.g., 4K camera captures or 20MB+ data URLs)
 * to an optimal dimension for AI vision models (e.g. TokenHarbor, Gemini) without
 * altering the full-resolution source image in the studio canvas.
 */

export async function optimizeImageForAI(
  dataUrl: string,
  maxDimension: number = 1280,
  quality: number = 0.85
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return dataUrl;
  }

  // Fast path: if dataUrl is already small JPEG under 300KB and requested dimension is high, return as-is
  if (dataUrl.startsWith('data:image/jpeg') && dataUrl.length < 300 * 1024 && maxDimension >= 1200) {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const origWidth = img.naturalWidth || img.width || 1280;
          const origHeight = img.naturalHeight || img.height || 1280;

          let targetWidth = origWidth;
          let targetHeight = origHeight;

          if (origWidth > origHeight) {
            if (origWidth > maxDimension) {
              targetHeight = Math.round((origHeight * maxDimension) / origWidth);
              targetWidth = maxDimension;
            }
          } else {
            if (origHeight > maxDimension) {
              targetWidth = Math.round((origWidth * maxDimension) / origHeight);
              targetHeight = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, targetWidth);
          canvas.height = Math.max(1, targetHeight);
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Fill solid background for JPEGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Consistently export JPEG for lightweight AI Vision payload size safety (< 300KB)
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', Math.min(0.85, quality));
          resolve(optimizedDataUrl);
        } catch {
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        resolve(dataUrl);
      };

      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Safely parse an HTTP response as JSON, preventing
 * SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 * when the server or proxy returns an HTML error page.
 */
export async function safeFetchJSON<T = any>(
  response: Response,
  fallbackErrorMessage = 'API request failed'
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (data === null) {
    const rawText = await response.text().catch(() => '');
    if (response.status === 413 || rawText.includes('PayloadTooLargeError') || rawText.includes('entity too large')) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: 'The image file size is too large for the AI service. ShebaFlow automatically optimizes it, or try a smaller image.',
      };
    }

    // Strip HTML tags if HTML error page was returned
    const cleanText = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const message = cleanText.slice(0, 180) || fallbackErrorMessage;

    return {
      ok: false,
      status: response.status,
      data: null,
      error: response.ok ? message : `${message} (HTTP ${response.status})`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      error: data?.error || data?.message || fallbackErrorMessage,
    };
  }

  return {
    ok: true,
    status: response.status,
    data,
  };
}
