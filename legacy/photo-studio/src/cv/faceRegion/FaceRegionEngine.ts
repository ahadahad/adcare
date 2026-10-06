/**
 * Face Region Engine
 * Complete architectural replacement for the legacy synthetic face oval/parser.
 * 
 * Pipeline:
 * 1. Safe Face ROI (FaceLandmarker used ONLY for locating subject & jawline cutoff boundary)
 * 2. MediaPipe Selfie Multiclass Segmentation (PRIMARY source of the facial & ear region)
 * 3. Neck & body exclusion via landmark constraints
 * 4. Fast morphological smoothing & vector spline contour extraction
 * 
 * Performance & Memory:
 * - Operates entirely at preview working resolution (<= 1024px)
 * - Zero 4K/6K full-res canvases, buffers, or ImageData allocations
 * - Fast LRU cache for instant (<0.1ms) reuse on slider drags
 */

import { FaceRoi, FaceRegionResult } from './faceRegionTypes';
import { faceRegionCache } from './faceRegionCache';
import { faceRoiExtractor } from './roi';
import { semanticFaceMaskGenerator } from './semanticMask';

const MAX_PREVIEW_DIMENSION = 1024;
const PREFERRED_PREVIEW_DIMENSION = 768;

export class FaceRegionEngine {
  private static instance: FaceRegionEngine;
  private inFlightRequests = new Map<string, Promise<FaceRegionResult | null>>();

  public static getInstance(): FaceRegionEngine {
    if (!FaceRegionEngine.instance) {
      FaceRegionEngine.instance = new FaceRegionEngine();
    }
    return FaceRegionEngine.instance;
  }

  /**
   * Main entry point: Generates pixel-accurate Face & Ear mask with zero full-res allocation
   */
  public async generateFaceRegion(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    customImageId?: string
  ): Promise<FaceRegionResult | null> {
    const origW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const origH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    if (!origW || !origH) return null;

    const cacheKey = faceRegionCache.generateKey(imageSource, customImageId);

    // 1. Instant Cache Check (<0.1ms)
    const cached = faceRegionCache.getMask(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. In-flight Request Deduplication
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const requestPromise = (async (): Promise<FaceRegionResult | null> => {
      const startTime = performance.now();

      // Compute preview working resolution (preferred 768-1024px, never 4K/6K)
      const maxDim = Math.max(origW, origH);
      const targetDim = maxDim > 2000 ? MAX_PREVIEW_DIMENSION : Math.min(maxDim, PREFERRED_PREVIEW_DIMENSION);
      const scale = Math.min(1.0, targetDim / maxDim);
      const previewW = Math.max(1, Math.round(origW * scale));
      const previewH = Math.max(1, Math.round(origH * scale));

      try {
        // Step 1: Extract safe ROI & landmark constraints (cached if available)
        let roi: FaceRoi | null = faceRegionCache.getRoi(cacheKey);
        if (!roi) {
          roi = await faceRoiExtractor.extractRoi(
            imageSource,
            previewW,
            previewH,
            origW,
            origH
          );
          if (roi) {
            faceRegionCache.setRoi(cacheKey, roi);
          }
        }

        if (!roi) {
          console.warn('[FaceRegionEngine] FaceLandmarker could not locate face ROI');
          return null;
        }

        // Step 2: Generate semantic mask via MediaPipe Selfie Multiclass model
        const result = await semanticFaceMaskGenerator.generateMask(imageSource, roi);
        if (!result) {
          console.warn('[FaceRegionEngine] Semantic mask generator failed');
          return null;
        }

        // Cache result
        faceRegionCache.setMask(cacheKey, result);

        if (import.meta.env.DEV) {
          const duration = performance.now() - startTime;
          console.log(
            `[FaceRegionEngine] Success in ${duration.toFixed(1)}ms:\n` +
            `- Working Resolution: ${result.width}x${result.height}\n` +
            `- Original Image: ${origW}x${origH}\n` +
            `- Vector Contour Points: ${result.contourPoints.length}\n` +
            `- Primary Model: MediaPipe Selfie Multiclass Segmenter\n` +
            `- Landmark Boundary: Neck / Jawline constrained`
          );
        }

        return result;
      } catch (err) {
        console.error('[FaceRegionEngine] Error generating face region:', err);
        return null;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }
}

export const faceRegionEngine = FaceRegionEngine.getInstance();
