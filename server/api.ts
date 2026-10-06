import express, { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { aiRouter } from '../legacy/photo-studio/server/routes/ai.js';

export const apiRouter = Router();

apiRouter.use(express.json({ limit: '60mb' }));
apiRouter.use(express.urlencoded({ limit: '60mb', extended: true }));

// Cache for document corner detections
const cornerDetectionCache = new Map<string, { corners: any; method: string }>();

const parseCoord = (val: any): number => {
  let n = Number(val);
  if (isNaN(n)) return 0;
  if (n > 1.0) n /= 1000.0;
  return Math.max(0, Math.min(1, Number(n.toFixed(4))));
};

// -------------------------------------------------------------
// POST /api/detect-corners
// Gemini Flash Vision Document Corner Detector with Quota-Proof Fallbacks
// -------------------------------------------------------------
apiRouter.post('/detect-corners', async (req: Request, res: Response) => {
  const a4PrintServiceUrl = process.env.A4_PRINT_URL || process.env.AFOUR_PRINT_URL;
  if (a4PrintServiceUrl) {
    try {
      const targetUrl = new URL('/api/detect-corners', a4PrintServiceUrl);
      const forwardRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await forwardRes.json();
      return res.status(forwardRes.status).json(data);
    } catch (err: any) {
      console.warn('Bound a4-print service unreachable, using local detector:', err?.message);
    }
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const cacheKey = `${cleanBase64.length}_${cleanBase64.slice(0, 48)}_${cleanBase64.slice(-48)}`;
    const cached = cornerDetectionCache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        corners: cached.corners,
        method: `${cached.method} (Cached)`,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ success: false, fallback: true, reason: 'no_api_key' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an elite computer vision model specialized in document edge detection and perspective deskew (like CamScanner, Adobe Scan, Microsoft Lens).
Your task is to detect the EXACT four physical outer corners of the document, paper sheet, ID card, certificate, receipt, or passport in the image:
- topLeft: physical top-left corner of the document
- topRight: physical top-right corner of the document
- bottomRight: physical bottom-right corner of the document
- bottomLeft: physical bottom-left corner of the document

PAGE-COLOR SEGMENTATION INSTRUCTIONS:
1. DETECT THE PAGE COLOR: First identify the dominant interior color of the page/paper.
2. DISTINGUISH FROM BACKGROUND: Notice the background surface behind the paper (e.g. wooden table, bedsheet, carpet, desk, fingers, hands, or floor).
3. DECIDE WHERE TO CUT: Trace outward until the page color transitions into the background surface color. Place the 4 corners precisely where the page color ends and the background surface begins!
4. EXCLUDE BACKGROUND AND HANDS: The background surface, hands, fingers, shadow borders, and surrounding clutter must remain completely OUTSIDE the 4 corners.
5. PERSPECTIVE AWARE: If the document is photographed from an angle or tilted, place the 4 corners on the quadrilateral corners of the document so perspective correction will make it perfectly rectangular.
6. FULL CONTENT PRESERVATION: Ensure all text, photos, seals, signatures, header lines, and footer text stay completely INSIDE the boundary.
7. All coordinates are normalized floats from 0.0 to 1.0 (where {x:0, y:0} is top-left, {x:1, y:1} is bottom-right).`;

    const modelsToTry = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let response: any = null;
    let successfulModel = '';

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topLeft: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: 'Normalized X (0.0 to 1.0)' },
                    y: { type: Type.NUMBER, description: 'Normalized Y (0.0 to 1.0)' },
                  },
                  required: ['x', 'y'],
                },
                topRight: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: 'Normalized X (0.0 to 1.0)' },
                    y: { type: Type.NUMBER, description: 'Normalized Y (0.0 to 1.0)' },
                  },
                  required: ['x', 'y'],
                },
                bottomRight: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: 'Normalized X (0.0 to 1.0)' },
                    y: { type: Type.NUMBER, description: 'Normalized Y (0.0 to 1.0)' },
                  },
                  required: ['x', 'y'],
                },
                bottomLeft: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: 'Normalized X (0.0 to 1.0)' },
                    y: { type: Type.NUMBER, description: 'Normalized Y (0.0 to 1.0)' },
                  },
                  required: ['x', 'y'],
                },
              },
              required: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
            },
          },
        });

        if (response && response.text) {
          successfulModel = model;
          break;
        }
      } catch (err: any) {
        const isQuota = err?.status === 429 || (typeof err?.message === 'string' && err.message.includes('429'));
        if (!isQuota) {
          console.warn(`Model ${model} unavailable, trying fallback.`);
        }
      }
    }

    if (!response || !response.text) {
      return res.json({ success: false, fallback: true, reason: 'ai_quota_exceeded' });
    }

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.topLeft && parsed.topRight && parsed.bottomRight && parsed.bottomLeft) {
      const corners = {
        topLeft: {
          x: parseCoord(parsed.topLeft.x),
          y: parseCoord(parsed.topLeft.y),
        },
        topRight: {
          x: parseCoord(parsed.topRight.x),
          y: parseCoord(parsed.topRight.y),
        },
        bottomRight: {
          x: parseCoord(parsed.bottomRight.x),
          y: parseCoord(parsed.bottomRight.y),
        },
        bottomLeft: {
          x: parseCoord(parsed.bottomLeft.x),
          y: parseCoord(parsed.bottomLeft.y),
        },
      };

      const result = {
        success: true,
        corners,
        method: `Gemini Vision AI (${successfulModel})`,
      };

      if (cornerDetectionCache.size >= 50) {
        const firstKey = cornerDetectionCache.keys().next().value;
        if (firstKey) cornerDetectionCache.delete(firstKey);
      }
      cornerDetectionCache.set(cacheKey, { corners, method: result.method });

      return res.json(result);
    }

    return res.json({ success: false, fallback: true, reason: 'invalid_coordinates' });
  } catch (err: any) {
    return res.json({ success: false, fallback: true, error: err.message || 'Detection failed' });
  }
});

// -------------------------------------------------------------
// Photo Studio AI Router (/api/ai and /api)
// -------------------------------------------------------------
apiRouter.use(async (req: Request, res: Response, next) => {
  const photoStudioServiceUrl = process.env.PHOTO_STUDIO_URL;
  const isPhotoStudioRoute =
    req.path.startsWith('/ai') ||
    req.path === '/status' ||
    req.path === '/remove-bg' ||
    req.path.startsWith('/remove-bg') ||
    req.path.startsWith('/photo-assistant') ||
    req.path.startsWith('/enhance') ||
    req.path.startsWith('/upscale');

  if (photoStudioServiceUrl && isPhotoStudioRoute) {
    try {
      const subpath = req.originalUrl.replace(/^\/api/, '');
      const targetUrl = new URL(subpath, photoStudioServiceUrl);
      const forwardRes = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': String(req.headers['content-type'] || 'application/json'),
        },
        body: ['GET', 'HEAD'].includes(req.method)
          ? undefined
          : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body),
      });
      const data = await forwardRes.text();
      res.status(forwardRes.status);
      const contentType = forwardRes.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      return res.send(data);
    } catch (err: any) {
      console.warn('Bound photo-studio service unreachable, falling back to local router:', err?.message);
    }
  }
  next();
});
apiRouter.use('/ai', aiRouter);
apiRouter.use(aiRouter);

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Ahad Digital Care',
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// NID detection proxy (/api/detect-nid)
// -------------------------------------------------------------
apiRouter.all(['/detect-nid', '/detect-nid/*'], async (req: Request, res: Response) => {
  try {
    const subpath = req.url.replace(/^\/detect-nid/, '');
    const targetUrl = `https://docu.itlancerbd.com/detect-nid${subpath}`;
    const contentType = req.headers['content-type'] || 'application/json';

    const forwardRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': String(contentType),
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)),
    });

    const bodyText = await forwardRes.text();
    res.status(forwardRes.status);
    const resContentType = forwardRes.headers.get('content-type');
    if (resContentType) {
      res.setHeader('content-type', resContentType);
    }
    res.send(bodyText);
  } catch (err: any) {
    res.status(502).json({
      error: 'Upstream NID service unavailable',
      message: err.message,
    });
  }
});
