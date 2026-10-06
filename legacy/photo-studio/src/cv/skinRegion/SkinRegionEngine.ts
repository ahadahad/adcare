/**
 * Skin Region Engine
 * Complete architectural replacement for legacy color-heuristic skin detection.
 * 
 * Pipeline:
 * 1. Safe working preview resolution (max 1024px, preferred 768px-1024px)
 * 2. MediaPipe Selfie Multiclass Segmentation (PRIMARY source for face & body skin)
 * 3. Eyes, Eyebrows & Lips punch-out using cached or fast face landmarks
 * 4. Calibrated subject skin color verification
 * 5. Morphological cleanup & soft edge feathering
 * 6. Vector boundary contour extraction for crisp visual overlay
 * 
 * Performance & Memory:
 * - Operates entirely at preview working resolution (<= 1024px)
 * - Zero 4K/6K full-res canvases, buffers, or ImageData allocations
 * - Fast LRU cache for instant (<0.1ms) reuse on slider drags
 */

import { SkinRegionResult } from './skinRegionTypes';
import { skinRegionCache } from './skinRegionCache';
import { semanticSkinMaskGenerator } from './semanticSkinMask';
import { faceRegionCache } from '../faceRegion/faceRegionCache';
import { faceRoiExtractor } from '../faceRegion/roi';
import { FaceRoi } from '../faceRegion/faceRegionTypes';

const MAX_PREVIEW_DIMENSION = 1024;
const PREFERRED_PREVIEW_DIMENSION = 768;

export class SkinRegionEngine {
  private static instance: SkinRegionEngine;
  private inFlightRequests = new Map<string, Promise<SkinRegionResult | null>>();

  public static getInstance(): SkinRegionEngine {
    if (!SkinRegionEngine.instance) {
      SkinRegionEngine.instance = new SkinRegionEngine();
    }
    return SkinRegionEngine.instance;
  }

  /**
   * Main entry point: Generates pixel-accurate Skin mask across all visible skin with zero full-res allocation
   */
  public async generateSkinRegion(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    customImageId?: string
  ): Promise<SkinRegionResult | null> {
    const origW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const origH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    if (!origW || !origH) return null;

    const cacheKey = skinRegionCache.generateKey(imageSource, customImageId);

    // 1. Instant Cache Check (<0.1ms)
    const cached = skinRegionCache.getMask(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. In-flight Request Deduplication
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const requestPromise = (async (): Promise<SkinRegionResult | null> => {
      const startTime = performance.now();

      // Compute preview working resolution (preferred 768-1024px, never 4K/6K)
      const maxDim = Math.max(origW, origH);
      const targetDim = maxDim > 2000 ? MAX_PREVIEW_DIMENSION : Math.min(maxDim, PREFERRED_PREVIEW_DIMENSION);
      const scale = Math.min(1.0, targetDim / maxDim);
      const previewW = Math.max(1, Math.round(origW * scale));
      const previewH = Math.max(1, Math.round(origH * scale));

      try {
        // Step 1: Check for cached face landmarks (to punch out eyes/lips from skin)
        const faceCacheKey = faceRegionCache.generateKey(imageSource, customImageId);
        let faceRoi: FaceRoi | null = faceRegionCache.getRoi(faceCacheKey);

        if (!faceRoi) {
          try {
            faceRoi = await faceRoiExtractor.extractRoi(
              imageSource,
              previewW,
              previewH,
              origW,
              origH
            );
            if (faceRoi) {
              faceRegionCache.setRoi(faceCacheKey, faceRoi);
            }
          } catch {
            // Non-fatal if landmarks unavailable (e.g. non-frontal or multiple subjects)
            faceRoi = null;
          }
        }

        // Step 2: Generate semantic skin mask via MediaPipe Selfie Multiclass model
        const result = await semanticSkinMaskGenerator.generateMask(
          imageSource,
          previewW,
          previewH,
          origW,
          origH,
          faceRoi
        );

        if (!result) {
          console.warn('[SkinRegionEngine] Semantic skin mask generator returned null');
          return null;
        }

        // Cache result
        skinRegionCache.setMask(cacheKey, result);

        if (import.meta.env.DEV) {
          const duration = performance.now() - startTime;
          console.log(
            `[SkinRegionEngine] Success in ${duration.toFixed(1)}ms:\n` +
            `- Working Resolution: ${result.width}x${result.height}\n` +
            `- Original Image: ${origW}x${origH}\n` +
            `- Coverage: ${result.skinCoveragePercent}%\n` +
            `- Tone: ${result.skinToneDescription}\n` +
            `- Contour Points: ${result.contourPoints.length}\n` +
            `- Eyes/Lips Punched: ${faceRoi ? 'Yes' : 'No'}`
          );
        }

        return result;
      } catch (err) {
        console.error('[SkinRegionEngine] Error generating skin region:', err);
        return null;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }
}

export const skinRegionEngine = SkinRegionEngine.getInstance();
