import { Router, Request, Response } from 'express';
import { ClientAssistantRequestSchema } from '../validation/aiSchemas.js';
import {
  getAIStatus,
  processAIAssistantRequest,
} from '../services/tokenHarbor.js';
import {
  detectFeaturesWithAI,
  enhanceImageWithAI,
  processVisionDetectRequest,
} from '../services/visionDetection.js';
import {
  removeBackgroundWithRemoveBg,
  getEffectiveRemoveBgKey,
  testRemoveBgConnection,
  isQuotaExhausted,
  setQuotaExhausted,
} from '../services/removeBg.js';
import {
  getRealEsrganConfig,
} from '../services/realEsrgan.js';

export const aiRouter = Router();

let removeBgCache: { timestamp: number; data: { hasUsableCredits: boolean; message: string } } | null = null;

// Generic AI Status - returns non-sensitive status only
aiRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = getAIStatus();
    const removeBgKey = getEffectiveRemoveBgKey();
    const realEsrganConfig = getRealEsrganConfig();

    let removeBgStatus: {
      isConfigured: boolean;
      hasUsableCredits?: boolean;
      message?: string;
    } = {
      isConfigured: Boolean(removeBgKey),
    };

    if (removeBgKey) {
      const now = Date.now();
      if (removeBgCache && now - removeBgCache.timestamp < 60_000) {
        removeBgStatus.hasUsableCredits = removeBgCache.data.hasUsableCredits;
        removeBgStatus.message = removeBgCache.data.message;
      } else {
        try {
          const testRes = await testRemoveBgConnection();
          const hasUsable = Boolean(testRes.hasUsableCredits);
          removeBgCache = {
            timestamp: now,
            data: {
              hasUsableCredits: hasUsable,
              message: testRes.message,
            },
          };
          removeBgStatus.hasUsableCredits = hasUsable;
          removeBgStatus.message = testRes.message;
        } catch {
          // Fall back gracefully
        }
      }
    }

    res.json({
      configured: status.configured,
      activeProvider: status.activeProvider,
      model: status.model,
      removeBg: removeBgStatus,
      realEsrgan: {
        enabled: realEsrganConfig.enabled,
        isConfigured: realEsrganConfig.isConfigured,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve AI status' });
  }
});

// Real-ESRGAN Configuration Status (no sensitive paths)
aiRouter.get('/realesrgan/status', (_req: Request, res: Response) => {
  try {
    const config = getRealEsrganConfig();
    return res.json({
      enabled: config.enabled,
      isConfigured: config.isConfigured,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to get Real-ESRGAN status' });
  }
});

// Photo Assistant Endpoint
aiRouter.post('/photo-assistant', async (req: Request, res: Response) => {
  try {
    const parsed = ClientAssistantRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: parsed.error.issues.map((i) => i.message),
      });
    }

    const aiResult = await processAIAssistantRequest(parsed.data);
    return res.json(aiResult);
  } catch (error: any) {
    const message = error?.message || 'Failed to process AI assistant request.';
    return res.status(502).json({
      error: message,
    });
  }
});

// Primary Vision Detection & Enhance Endpoint for Studio Canvas
aiRouter.post('/vision-detect', async (req: Request, res: Response) => {
  try {
    const { image, target, powerMode } = req.body;
    if (!image || !target) {
      return res.status(400).json({ error: 'Image data and target (enhance|face|skin|hair|remove-bg) are required.' });
    }

    const result = await processVisionDetectRequest({ image, target, powerMode });
    return res.json(result);
  } catch (error: any) {
    const message = error?.message || 'Failed to process AI vision request';
    return res.status(502).json({ error: message });
  }
});

// Diagnostics / test remove.bg connection & credit balance
aiRouter.get('/remove-bg/test', async (_req: Request, res: Response) => {
  try {
    const result = await testRemoveBgConnection();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      keyConfigured: false,
      message: err.message || 'Failed to verify remove.bg connection',
    });
  }
});

// Dedicated AI Background Removal Endpoint (supports remove.bg and studio vision fallback)
aiRouter.post('/remove-bg', async (req: Request, res: Response) => {
  try {
    const { image, provider, size, type, bgColor } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'image is required' });
    }

    const effectiveRemoveBgKey = getEffectiveRemoveBgKey();
    const quotaExhausted = isQuotaExhausted();

    // If remove.bg key is configured on server, has credits, and not quota-exhausted
    if (effectiveRemoveBgKey && !quotaExhausted && provider !== 'studio') {
      try {
        const removeBgResult = await removeBackgroundWithRemoveBg(
          image,
          { size: size || 'auto', type: type || 'auto', bgColor }
        );
        return res.json({
          success: true,
          cutoutDataUrl: removeBgResult.cutoutDataUrl,
          provider: 'remove.bg API',
          creditsCharged: removeBgResult.creditsCharged,
          detectedType: removeBgResult.detectedType,
          summary: 'Subject cleanly isolated using remove.bg API.',
        });
      } catch (removeBgError: any) {
        setQuotaExhausted(true);
        if (req.body.strict) {
          return res.status(400).json({
            error: removeBgError.message || 'remove.bg API call failed',
            provider: 'remove.bg API',
          });
        }
      }
    }

    const result = await processVisionDetectRequest({ image, target: 'remove-bg' });
    return res.json(result);
  } catch (error: any) {
    const message = error?.message || 'Failed to remove background via AI API';
    return res.status(502).json({ error: message });
  }
});

// AI Feature Detection Endpoint (Face, Skin, Hair)
aiRouter.post('/detect', async (req: Request, res: Response) => {
  try {
    const { imageBase64, target } = req.body;
    if (!imageBase64 || !['face', 'skin', 'hair'].includes(target)) {
      return res.status(400).json({ error: 'Valid imageBase64 and target (face|skin|hair) are required.' });
    }

    const result = await detectFeaturesWithAI(imageBase64, target);
    return res.json(result);
  } catch (error: any) {
    const message = error?.message || 'Failed to detect photo features';
    return res.status(502).json({ error: message });
  }
});

// AI Photo Auto-Enhance Endpoint
aiRouter.post('/enhance', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const result = await enhanceImageWithAI(imageBase64);
    return res.json(result);
  } catch (error: any) {
    const message = error?.message || 'Failed to enhance photo via AI API';
    return res.status(502).json({ error: message });
  }
});

// Dedicated Real-ESRGAN route informs clients that Real-ESRGAN runs browser-side
aiRouter.post(['/enhance-realesrgan', '/ai/enhance-realesrgan'], (_req: Request, res: Response) => {
  return res.json({
    success: false,
    code: 'CLIENT_SIDE_ONLY',
    message: 'Real-ESRGAN AI enhancement runs entirely in the client browser (WebGPU/WASM).',
  });
});
