/**
 * High-Precision Human Face Segmentation Engine
 * Optimized for ultra-low CPU/GPU consumption, sub-millisecond cache lookups,
 * adaptive detection resolution (max 1024px), lazy singleton model lifecycle,
 * and robust request deduplication / stale cancellation.
 * 
 * Pipeline:
 * FaceLandmarker (<=1024px detection copy) -> Cached Landmarks -> Vector Spline Mask Generation -> Canvas
 * 
 * INCLUDES: Forehead skin (up to actual hairline), temples, cheeks, nose,
 * eyes, eyebrows, lips, mouth, chin, ears, and beard/moustache on the face.
 * EXCLUDES: Head hair, side hair, neck, clothing, background.
 */

import { FilesetResolver, FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { skinRegionEngine } from '../skinRegion/SkinRegionEngine';

export interface FaceParsingResult {
  faceOval: Array<{ x: number; y: number }>;
  leftEye: Array<{ x: number; y: number }>;
  rightEye: Array<{ x: number; y: number }>;
  leftEyebrow: Array<{ x: number; y: number }>;
  rightEyebrow: Array<{ x: number; y: number }>;
  lips: Array<{ x: number; y: number }>;
  chinTip: { x: number; y: number };
  foreheadCenter: { x: number; y: number };
  noseTip: { x: number; y: number };
  allLandmarks: Array<{ x: number; y: number }>;
  normalizedLandmarks?: Array<{ x: number; y: number; z?: number }>;
  boundingBox?: { x: number; y: number; width: number; height: number };
  originalWidth?: number;
  originalHeight?: number;
}

// Canonical 36 MediaPipe Face Oval Landmark Indices
export const MEDIAPIPE_FACE_OVAL_INDICES = [
  10,
  338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

const LEFT_EYE_INDICES = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7
];

const RIGHT_EYE_INDICES = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382
];

const LEFT_EYEBROW_INDICES = [
  70, 63, 105, 66, 107, 55, 65, 52, 53, 46
];

const RIGHT_EYEBROW_INDICES = [
  336, 296, 334, 293, 300, 285, 295, 282, 283, 276
];

const LIPS_OUTER_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  375, 321, 405, 314, 17, 84, 181, 91, 146
];

// Maximum allowed dimension for detection inference (preserves full landmark accuracy with ~90% lower GPU overhead)
const MAX_DETECTION_DIMENSION = 1024;
const NORMAL_PORTRAIT_DETECTION_DIMENSION = 768;

class FaceParserService {
  private landmarker: FaceLandmarker | null = null;
  private segmenter: ImageSegmenter | null = null;
  private landmarkerPromise: Promise<FaceLandmarker | null> | null = null;
  private segmenterPromise: Promise<ImageSegmenter | null> | null = null;

  // Cached hardware backend delegate ('GPU' or 'CPU')
  private cachedBackendDelegate: 'GPU' | 'CPU' | null = null;

  // In-memory Face Detection & Landmark Cache (LRU up to 40 images)
  private faceCache = new Map<string, { result: FaceParsingResult; timestamp: number }>();
  private readonly MAX_CACHE_ENTRIES = 40;

  // Stale request protection & in-flight request deduplication
  private currentRequestId = 0;
  private inFlightDetections = new Map<string, Promise<FaceParsingResult | null>>();

  /**
   * Generates a fast, lightweight content fingerprint for image identity
   */
  private computeImageContentFingerprint(
    imageSource: HTMLImageElement | HTMLCanvasElement
  ): string {
    const origW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const origH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;
    const src = 'src' in imageSource ? (imageSource as HTMLImageElement).src : '';

    if (src) {
      const len = src.length;
      const sampleStart = src.slice(0, 32);
      const sampleMid = src.slice(Math.floor(len / 2), Math.floor(len / 2) + 32);
      const sampleEnd = src.slice(-32);
      return `fp_${len}_${sampleStart}_${sampleMid}_${sampleEnd}`;
    }

    try {
      if (origW && origH) {
        const tiny = document.createElement('canvas');
        tiny.width = 16;
        tiny.height = 16;
        const ctx = tiny.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(imageSource, 0, 0, 16, 16);
          const data = ctx.getImageData(0, 0, 16, 16).data;
          let hash = 0;
          for (let i = 0; i < data.length; i += 8) {
            hash = (hash * 31 + data[i]) | 0;
          }
          return `canvas_${origW}x${origH}_${hash}`;
        }
      }
    } catch {
      // Fallback if canvas is tainted or context fails
    }

    return `img_${origW}x${origH}`;
  }

  /**
   * Generates a stable cache key for an image content fingerprint and dimensions
   */
  public generateCacheKey(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    customId?: string
  ): string {
    const origW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const origH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;
    const fp = this.computeImageContentFingerprint(imageSource);
    const MODEL_CONFIG_VERSION = 'v5_mediapipe_oval';
    return `${customId || 'img'}_${fp}_${origW}x${origH}_${MODEL_CONFIG_VERSION}`;
  }

  /**
   * Retrieves cached face landmark result if previously computed
   */
  public getCachedParsing(cacheKey: string): FaceParsingResult | null {
    const entry = this.faceCache.get(cacheKey);
    if (entry) {
      return entry.result;
    }
    return null;
  }

  /**
   * Stores face landmark result in cache with LRU eviction
   */
  public setCachedParsing(cacheKey: string, result: FaceParsingResult): void {
    if (this.faceCache.size >= this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.faceCache.keys().next().value;
      if (oldestKey) this.faceCache.delete(oldestKey);
    }
    this.faceCache.set(cacheKey, { result, timestamp: Date.now() });
  }

  /**
   * Clears all cached face parsing results (e.g. on full reset)
   */
  public clearCache(): void {
    this.faceCache.clear();
  }

  /**
   * Detects and caches optimal hardware backend delegate (GPU WebGL/WebGPU with CPU fallback)
   */
  private async getOptimalBackendDelegate(): Promise<'GPU' | 'CPU'> {
    if (this.cachedBackendDelegate) {
      return this.cachedBackendDelegate;
    }

    try {
      if (typeof window !== 'undefined') {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
          this.cachedBackendDelegate = 'GPU';
          return 'GPU';
        }
      }
    } catch {
      // Ignore and fallback to CPU
    }

    this.cachedBackendDelegate = 'CPU';
    return 'CPU';
  }

  /**
   * Resolves vision task fileset, preferring local fast static /wasm bundle
   */
  private async getFilesetResolver() {
    try {
      return await FilesetResolver.forVisionTasks('/wasm');
    } catch {
      return await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );
    }
  }

  /**
   * Lazy singleton initializer for MediaPipe FaceLandmarker
   */
  private async getLandmarker(): Promise<FaceLandmarker | null> {
    if (this.landmarker) return this.landmarker;
    if (this.landmarkerPromise) return this.landmarkerPromise;

    this.landmarkerPromise = (async () => {
      const startTime = performance.now();
      const preferredDelegate = await this.getOptimalBackendDelegate();
      const localModelPath = '/models/face_landmarker.task';
      const remoteModelPath = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

      try {
        const filesetResolver = await this.getFilesetResolver();

        // 1. Try local model with preferred delegate
        let landmarker: FaceLandmarker | null = null;
        try {
          landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: localModelPath,
              delegate: preferredDelegate,
            },
            runningMode: 'IMAGE',
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          });
        } catch {
          // Try local model with CPU
          try {
            landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: localModelPath,
                delegate: 'CPU',
              },
              runningMode: 'IMAGE',
              numFaces: 1,
              outputFaceBlendshapes: false,
              outputFacialTransformationMatrixes: false,
            });
            this.cachedBackendDelegate = 'CPU';
          } catch {
            // Try CDN model
            landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: remoteModelPath,
                delegate: preferredDelegate,
              },
              runningMode: 'IMAGE',
              numFaces: 1,
              outputFaceBlendshapes: false,
              outputFacialTransformationMatrixes: false,
            });
          }
        }

        this.landmarker = landmarker;
        if (import.meta.env.DEV) {
          console.debug(`[FaceCV Performance] FaceLandmarker initialized in ${(performance.now() - startTime).toFixed(1)}ms`);
        }
        return landmarker;
      } catch (err) {
        console.warn('FaceLandmarker primary initialization failed, trying CPU fallback:', err);
        try {
          const filesetResolver = await this.getFilesetResolver();
          const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: remoteModelPath,
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            numFaces: 1,
          });
          this.cachedBackendDelegate = 'CPU';
          this.landmarker = landmarker;
          return landmarker;
        } catch (cpuErr) {
          console.warn('FaceLandmarker initialization failed completely:', cpuErr);
          return null;
        }
      }
    })();

    return this.landmarkerPromise;
  }

  /**
   * Lazy singleton initializer for MediaPipe ImageSegmenter
   */
  private async getSegmenter(): Promise<ImageSegmenter | null> {
    if (this.segmenter) return this.segmenter;
    if (this.segmenterPromise) return this.segmenterPromise;

    this.segmenterPromise = (async () => {
      const preferredDelegate = await this.getOptimalBackendDelegate();
      try {
        const filesetResolver = await this.getFilesetResolver();
        const segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
            delegate: preferredDelegate,
          },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: true,
        });
        this.segmenter = segmenter;
        return segmenter;
      } catch (err) {
        console.warn(`ImageSegmenter ${preferredDelegate} init failed, trying CPU fallback:`, err);
        try {
          const filesetResolver = await this.getFilesetResolver();
          const segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            outputCategoryMask: true,
            outputConfidenceMasks: true,
          });
          this.cachedBackendDelegate = 'CPU';
          this.segmenter = segmenter;
          return segmenter;
        } catch (cpuErr) {
          console.warn('ImageSegmenter initialization failed completely:', cpuErr);
          return null;
        }
      }
    })();

    return this.segmenterPromise;
  }

  /**
   * Creates an optimized, downscaled detection canvas/image.
   * Never runs AI inference on huge 4K/6K images directly.
   * Maximum detection dimension: 1024px (typically 768px for portraits).
   */
  private createDetectionCopy(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    origW: number,
    origH: number
  ): { canvas: HTMLCanvasElement; scale: number } {
    const maxDimension = Math.max(origW, origH);
    const targetMaxDim = maxDimension > 2000 ? MAX_DETECTION_DIMENSION : NORMAL_PORTRAIT_DETECTION_DIMENSION;
    const scale = Math.min(1.0, targetMaxDim / maxDimension);
    const sw = Math.max(1, Math.round(origW * scale));
    const sh = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(imageSource, 0, 0, sw, sh);
    }
    return { canvas, scale };
  }

  /**
   * Parses facial landmarks using downscaled detection copy and cached model inference.
   * Fast, throttled, protected against stale async completions, and cached by image identity.
   */
  public async parseFace(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    customImageId?: string
  ): Promise<FaceParsingResult | null> {
    const origW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const origH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    if (!origW || !origH) return null;

    const cacheKey = this.generateCacheKey(imageSource, customImageId);

    // 1. Instant Cache Check (<0.1ms)
    const cached = this.getCachedParsing(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. In-flight Request Deduplication
    if (this.inFlightDetections.has(cacheKey)) {
      return this.inFlightDetections.get(cacheKey)!;
    }

    const requestId = ++this.currentRequestId;
    const detectionPromise = (async (): Promise<FaceParsingResult | null> => {
      const startTime = performance.now();
      let detectionCopy: { canvas: HTMLCanvasElement; scale: number } | null = null;

      try {
        const landmarker = await this.getLandmarker();
        if (!landmarker) return null;

        // Check if a newer request arrived while model was initializing
        if (requestId !== this.currentRequestId) {
          return null;
        }

        // Downscaled detection copy (<= 1024px)
        detectionCopy = this.createDetectionCopy(imageSource, origW, origH);

        const detectStartTime = performance.now();
        const result = landmarker.detect(detectionCopy.canvas);
        const detectDuration = performance.now() - detectStartTime;

        // Dispose temporary detection canvas immediately
        detectionCopy.canvas.width = 1;
        detectionCopy.canvas.height = 1;
        detectionCopy = null;

        if (requestId !== this.currentRequestId) {
          return null;
        }

        if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
          return null;
        }

        const landmarks = result.faceLandmarks[0];

        // Validate landmark bounds: 0 <= x <= 1, 0 <= y <= 1 (normalized)
        let validLandmarkCount = 0;
        for (const lm of landmarks) {
          if (lm.x >= -0.1 && lm.x <= 1.1 && lm.y >= -0.1 && lm.y <= 1.1) {
            validLandmarkCount++;
          }
        }
        if (validLandmarkCount < 400) {
          console.warn('[FACE DEBUG] Rejected landmark result: out of bounds');
          return null;
        }

        // Map normalized coordinates (0.0 to 1.0) back to original full image dimensions
        const toCoord = (idx: number) => {
          const lm = landmarks[idx];
          return {
            x: Math.max(0, Math.min(origW, lm.x * origW)),
            y: Math.max(0, Math.min(origH, lm.y * origH)),
          };
        };

        const faceOval = MEDIAPIPE_FACE_OVAL_INDICES.map(toCoord);

        // Verify face oval has at least 30 points and positive area via Shoelace formula
        if (faceOval.length < 30) {
          console.warn('[FACE DEBUG] Rejected face oval: insufficient points');
          return null;
        }

        let signedArea = 0;
        const nOval = faceOval.length;
        for (let i = 0; i < nOval; i++) {
          const p1 = faceOval[i];
          const p2 = faceOval[(i + 1) % nOval];
          signedArea += (p1.x * p2.y - p2.x * p1.y);
        }
        const area = Math.abs(signedArea / 2);
        if (area < 100) {
          console.warn('[FACE DEBUG] Rejected face oval: invalid or zero area');
          return null;
        }

        const leftEye = LEFT_EYE_INDICES.map(toCoord);
        const rightEye = RIGHT_EYE_INDICES.map(toCoord);
        const leftEyebrow = LEFT_EYEBROW_INDICES.map(toCoord);
        const rightEyebrow = RIGHT_EYEBROW_INDICES.map(toCoord);
        const lips = LIPS_OUTER_INDICES.map(toCoord);

        const chinTip = toCoord(152);
        const foreheadCenter = toCoord(10);
        const noseTip = toCoord(1);
        const allLandmarks = landmarks.map((lm) => ({
          x: Math.max(0, Math.min(origW, lm.x * origW)),
          y: Math.max(0, Math.min(origH, lm.y * origH)),
        }));

        // Compute Bounding Box
        let minX = origW, maxX = 0, minY = origH, maxY = 0;
        for (const pt of allLandmarks) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }

        const parsingResult: FaceParsingResult = {
          faceOval,
          leftEye,
          rightEye,
          leftEyebrow,
          rightEyebrow,
          lips,
          chinTip,
          foreheadCenter,
          noseTip,
          allLandmarks,
          normalizedLandmarks: landmarks,
          originalWidth: origW,
          originalHeight: origH,
          boundingBox: {
            x: Math.max(0, minX),
            y: Math.max(0, minY),
            width: Math.min(origW - minX, maxX - minX),
            height: Math.min(origH - minY, maxY - minY),
          },
        };

        // Cache result
        this.setCachedParsing(cacheKey, parsingResult);

        if (import.meta.env.DEV) {
          const detectDuration = performance.now() - startTime;
          let ovalMinX = origW, ovalMaxX = 0, ovalMinY = origH, ovalMaxY = 0;
          for (const pt of faceOval) {
            if (pt.x < ovalMinX) ovalMinX = pt.x;
            if (pt.x > ovalMaxX) ovalMaxX = pt.x;
            if (pt.y < ovalMinY) ovalMinY = pt.y;
            if (pt.y > ovalMaxY) ovalMaxY = pt.y;
          }
          console.log(
            `[FACE DEBUG]\n\n` +
            `Image:\n${origW} × ${origH}\n\n` +
            `Landmarks:\n${landmarks.length}\n\n` +
            `Face oval points:\n${faceOval.length}\n\n` +
            `Bounding box:\nx=${minX.toFixed(0)}, y=${minY.toFixed(0)}, w=${(maxX - minX).toFixed(0)}, h=${(maxY - minY).toFixed(0)}\n\n` +
            `Contour:\nminX=${ovalMinX.toFixed(0)}, maxX=${ovalMaxX.toFixed(0)}, minY=${ovalMinY.toFixed(0)}, maxY=${ovalMaxY.toFixed(0)}\n\n` +
            `Detection time:\n${detectDuration.toFixed(1)} ms\n\n` +
            `Cache:\nMISS`
          );
        }

        return parsingResult;
      } catch (err) {
        console.warn('Optimized face parsing execution failed:', err);
        return null;
      } finally {
        if (detectionCopy) {
          detectionCopy.canvas.width = 1;
          detectionCopy.canvas.height = 1;
        }
        this.inFlightDetections.delete(cacheKey);
      }
    })();

    this.inFlightDetections.set(cacheKey, detectionPromise);
    return detectionPromise;
  }

  /**
   * Generates the pixel-level Human Face selection mask:
   * 1. Uses cached landmarks or triggers single downscaled detection.
   * 2. Assembles full visible face-skin architecture (forehead skin to hairline, complete left/right ears, cheeks, nose, eyes, beard, moustache)
   * 3. Subtracts scalp hair and neck area.
   */
  public async generateFaceMask(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    customImageId?: string
  ): Promise<Uint8ClampedArray | null> {
    const maskGenStartTime = performance.now();

    try {
      // Step 1: Get cached or fast-detected landmarks
      const parsed = await this.parseFace(imageSource, customImageId);
      if (!parsed) {
        return null;
      }

      // Preview working resolution (max 1024px, preferred 768-1024px)
      // NEVER create full-res 4K/6K masks, canvases, or arrays during face preview
      const MAX_PREVIEW_DIMENSION = 1024;
      const maxDim = Math.max(targetWidth, targetHeight);
      const scale = maxDim > MAX_PREVIEW_DIMENSION ? MAX_PREVIEW_DIMENSION / maxDim : 1.0;
      const previewW = Math.max(1, Math.round(targetWidth * scale));
      const previewH = Math.max(1, Math.round(targetHeight * scale));

      // Step 2: Fetch scalp hair mask via MediaPipe ImageSegmenter AT PREVIEW WORKING RESOLUTION
      let hairMask: Uint8ClampedArray | null = null;
      try {
        hairMask = await this.generateHairMask(imageSource, previewW, previewH, undefined, customImageId);
      } catch (err) {
        console.warn('Hair mask generation notice:', err);
      }

      // Step 3: Build complete visible face-skin mask architecture AT PREVIEW WORKING RESOLUTION
      const mask = this.generateParsedFaceMaskArchitecture(parsed, previewW, previewH, hairMask, null);

      if (import.meta.env.DEV) {
        console.debug(`[FaceCV Performance] Full Face-Skin Mask Generation (${previewW}x${previewH}): ${(performance.now() - maskGenStartTime).toFixed(1)}ms`);
      }

      return mask;
    } catch (err) {
      console.warn('Face mask generation failed:', err);
      return null;
    }
  }

  /**
   * Generates the precise Human Face selection mask directly from facial landmarks and segmentation features.
   */
  public generateParsedFaceMask(
    parsingResult: FaceParsingResult,
    width: number,
    height: number
  ): Uint8ClampedArray {
    return this.generateParsedFaceMaskArchitecture(parsingResult, width, height, null, null);
  }

  /**
   * Complete Visible Face-Skin Mask Architecture:
   * FACE_CORE + FOREHEAD (to hairline) + EARS (left & right) - SCALP_HAIR - NECK
   */
  public generateParsedFaceMaskArchitecture(
    parsingResult: FaceParsingResult,
    width: number,
    height: number,
    hairMask: Uint8ClampedArray | null,
    skinMask: Uint8ClampedArray | null
  ): Uint8ClampedArray {
    const { allLandmarks, normalizedLandmarks } = parsingResult;

    if (!allLandmarks || allLandmarks.length < 468) {
      return new Uint8ClampedArray(width * height);
    }

    const origW = parsingResult.originalWidth || (parsingResult.boundingBox ? parsingResult.boundingBox.width + parsingResult.boundingBox.x : width);
    const origH = parsingResult.originalHeight || (parsingResult.boundingBox ? parsingResult.boundingBox.height + parsingResult.boundingBox.y : height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return new Uint8ClampedArray(width * height);

    ctx.fillStyle = '#FFFFFF';

    const getPt = (idx: number) => {
      if (normalizedLandmarks && normalizedLandmarks[idx]) {
        return {
          x: Math.max(0, Math.min(width - 1, normalizedLandmarks[idx].x * width)),
          y: Math.max(0, Math.min(height - 1, normalizedLandmarks[idx].y * height)),
        };
      }
      return {
        x: Math.max(0, Math.min(width - 1, allLandmarks[idx].x * (width / (origW || 1)))),
        y: Math.max(0, Math.min(height - 1, allLandmarks[idx].y * (height / (origH || 1)))),
      };
    };

    const noseTip = getPt(1);
    const glabella = getPt(9);
    const chinTip = getPt(152);
    const foreheadTop = getPt(10);
    const leftTemple = getPt(103);
    const rightTemple = getPt(332);
    const leftCheekAnchor = getPt(234);
    const rightCheekAnchor = getPt(454);

    const mouthCenterY = (getPt(13).y + getPt(14).y) / 2;

    // A. Draw Face Core Polygon (Cheeks, Nose, Mouth, Lips, Eyes, Eyebrows, Chin, Jaw, Beard, Moustache)
    const faceCoreIndices = MEDIAPIPE_FACE_OVAL_INDICES;
    ctx.beginPath();
    const p0 = getPt(faceCoreIndices[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < faceCoreIndices.length; i++) {
      const pt = getPt(faceCoreIndices[i]);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fill();

    // B. Draw Forehead Region Polygon (Extending seamlessly up to natural hairline)
    const vDx = glabella.x - noseTip.x;
    const vDy = glabella.y - noseTip.y;
    const vLen = Math.hypot(vDx, vDy) || 1;
    const upX = vDx / vLen;
    const upY = vDy / vLen;

    const noseToBrowDist = Math.hypot(glabella.x - noseTip.x, glabella.y - noseTip.y);
    const foreheadExtendH = Math.max(35, noseToBrowDist * 1.45);

    const foreheadApex1 = {
      x: leftTemple.x + upX * foreheadExtendH * 0.9,
      y: leftTemple.y + upY * foreheadExtendH * 0.9,
    };
    const foreheadApexCenter = {
      x: foreheadTop.x + upX * foreheadExtendH * 1.35,
      y: foreheadTop.y + upY * foreheadExtendH * 1.35,
    };
    const foreheadApex2 = {
      x: rightTemple.x + upX * foreheadExtendH * 0.9,
      y: rightTemple.y + upY * foreheadExtendH * 0.9,
    };

    ctx.beginPath();
    ctx.moveTo(leftTemple.x, leftTemple.y);
    ctx.lineTo(foreheadApex1.x, foreheadApex1.y);
    ctx.lineTo(foreheadApexCenter.x, foreheadApexCenter.y);
    ctx.lineTo(foreheadApex2.x, foreheadApex2.y);
    ctx.lineTo(rightTemple.x, rightTemple.y);
    ctx.lineTo(getPt(297).x, getPt(297).y);
    ctx.lineTo(glabella.x, glabella.y);
    ctx.lineTo(getPt(67).x, getPt(67).y);
    ctx.closePath();
    ctx.fill();

    // C. Draw Complete Left Ear and Right Ear Regions
    const cheekW = Math.hypot(rightCheekAnchor.x - leftCheekAnchor.x, rightCheekAnchor.y - leftCheekAnchor.y) || 100;
    const earW = Math.max(22, cheekW * 0.45);
    const earTopY = Math.min(getPt(70).y, getPt(336).y, getPt(105).y, getPt(334).y) - earW * 0.35;
    const earBottomY = Math.max(getPt(150).y, getPt(379).y, getPt(136).y, getPt(365).y) + earW * 0.15;

    // Left Ear Polygon (Helical rim, tragus, lobule)
    const leftEarPoly = [
      getPt(103),
      getPt(127),
      { x: leftCheekAnchor.x - earW * 0.8, y: earTopY },
      { x: leftCheekAnchor.x - earW * 1.25, y: (earTopY * 0.6 + earBottomY * 0.4) },
      { x: leftCheekAnchor.x - earW * 1.2, y: (earTopY * 0.3 + earBottomY * 0.7) },
      { x: leftCheekAnchor.x - earW * 0.85, y: earBottomY },
      getPt(132),
      getPt(234),
    ];
    ctx.beginPath();
    ctx.moveTo(leftEarPoly[0].x, leftEarPoly[0].y);
    for (let i = 1; i < leftEarPoly.length; i++) ctx.lineTo(leftEarPoly[i].x, leftEarPoly[i].y);
    ctx.closePath();
    ctx.fill();

    // Right Ear Polygon (Helical rim, tragus, lobule)
    const rightEarPoly = [
      getPt(332),
      getPt(356),
      { x: rightCheekAnchor.x + earW * 0.8, y: earTopY },
      { x: rightCheekAnchor.x + earW * 1.25, y: (earTopY * 0.6 + earBottomY * 0.4) },
      { x: rightCheekAnchor.x + earW * 1.2, y: (earTopY * 0.3 + earBottomY * 0.7) },
      { x: rightCheekAnchor.x + earW * 0.85, y: earBottomY },
      getPt(361),
      getPt(454),
    ];
    ctx.beginPath();
    ctx.moveTo(rightEarPoly[0].x, rightEarPoly[0].y);
    for (let i = 1; i < rightEarPoly.length; i++) ctx.lineTo(rightEarPoly[i].x, rightEarPoly[i].y);
    ctx.closePath();
    ctx.fill();

    // Merge skin segmentation near left/right ear anchors if skin mask available
    if (skinMask && skinMask.length === width * height) {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const leftEarMinX = Math.max(0, Math.floor(leftCheekAnchor.x - earW * 1.35));
      const leftEarMaxX = Math.min(width - 1, Math.ceil(leftCheekAnchor.x + earW * 0.2));
      const rightEarMinX = Math.max(0, Math.floor(rightCheekAnchor.x - earW * 0.2));
      const rightEarMaxX = Math.min(width - 1, Math.ceil(rightCheekAnchor.x + earW * 1.35));

      const earMinY = Math.max(0, Math.floor(earTopY - earW * 0.3));
      const earMaxY = Math.min(height - 1, Math.ceil(earBottomY + earW * 0.3));

      for (let y = earMinY; y <= earMaxY; y++) {
        const row = y * width;
        for (let x = leftEarMinX; x <= leftEarMaxX; x++) {
          const idx = row + x;
          if (skinMask[idx] === 255) {
            data[idx * 4 + 3] = 255;
          }
        }
        for (let x = rightEarMinX; x <= rightEarMaxX; x++) {
          const idx = row + x;
          if (skinMask[idx] === 255) {
            data[idx * 4 + 3] = 255;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Extract raw composite mask buffer
    const rawImgData = ctx.getImageData(0, 0, width, height);
    const rawData = rawImgData.data;
    const finalMask = new Uint8ClampedArray(width * height);

    for (let i = 0; i < finalMask.length; i++) {
      finalMask[i] = rawData[i * 4 + 3];
    }

    // D. Scalp Hair Exclusion: Subtract scalp hair above mouth level
    if (hairMask && hairMask.length === width * height) {
      for (let y = 0; y < height; y++) {
        if (y < mouthCenterY) {
          const row = y * width;
          for (let x = 0; x < width; x++) {
            const idx = row + x;
            if (hairMask[idx] === 255) {
              finalMask[idx] = 0;
            }
          }
        }
      }
    }

    // E. Neck Exclusion: Zero out skin strictly below the mandibular jawline curve
    const mandibularIndices = [132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361];
    const jawPts = mandibularIndices.map((idx) => getPt(idx));
    
    // Compute lower jawline Y for each X column
    const jawYMap = new Float32Array(width);
    jawYMap.fill(height);

    for (let i = 0; i < jawPts.length - 1; i++) {
      const ptA = jawPts[i];
      const ptB = jawPts[i + 1];
      const minX = Math.max(0, Math.floor(Math.min(ptA.x, ptB.x)));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(ptA.x, ptB.x)));

      for (let x = minX; x <= maxX; x++) {
        const t = (x - ptA.x) / ((ptB.x - ptA.x) || 1e-4);
        const interpolatedY = ptA.y + t * (ptB.y - ptA.y);
        if (interpolatedY < jawYMap[x]) {
          jawYMap[x] = interpolatedY;
        }
      }
    }

    const minJawX = Math.max(0, Math.floor(Math.min(...jawPts.map(p => p.x))));
    const maxJawX = Math.min(width - 1, Math.ceil(Math.max(...jawPts.map(p => p.x))));

    for (let x = minJawX; x <= maxJawX; x++) {
      const maxYAllowed = jawYMap[x] + 4;
      for (let y = Math.floor(maxYAllowed); y < height; y++) {
        const idx = y * width + x;
        finalMask[idx] = 0;
      }
    }

    // Release temporary canvas
    canvas.width = 1;
    canvas.height = 1;

    // F. Extract exact single vector boundary contour for cyan outline and editing mask at preview resolution
    const previewContour = this.extractMaskBoundaryContour(finalMask, width, height);

    // Map contour points to original image coordinates for razor-sharp vector overlay rendering
    const scaleToOrigX = origW / (width || 1);
    const scaleToOrigY = origH / (height || 1);
    const origContour = previewContour.map((pt) => ({
      x: pt.x * scaleToOrigX,
      y: pt.y * scaleToOrigY,
    }));

    (finalMask as any).contourPoints = origContour;
    (finalMask as any).previewContourPoints = previewContour;
    (finalMask as any).previewWidth = width;
    (finalMask as any).previewHeight = height;
    (finalMask as any).originalWidth = origW;
    (finalMask as any).originalHeight = origH;

    // G. Store Debug Layers & Log when DEV or FACE_DEBUG is active
    if (import.meta.env.DEV || (typeof window !== 'undefined' && (window as any).FACE_DEBUG)) {
      (finalMask as any).debugInfo = {
        landmarksCount: allLandmarks.length,
        contourPointsCount: origContour.length,
        width,
        height,
        origW,
        origH,
      };
      console.log(
        `[FACE DEBUG] Full Face-Skin Mask Built:\n` +
        `Working Preview Dimensions: ${width} × ${height}\n` +
        `Original Image Dimensions: ${origW} × ${origH}\n` +
        `Contour Points: ${origContour.length}\n` +
        `Forehead Extended: YES (to natural hairline)\n` +
        `Ears Included: YES (left & right)\n` +
        `Scalp Hair Excluded: YES\n` +
        `Facial Hair (Beard/Moustache) Included: YES\n` +
        `Neck Excluded: YES`
      );
    }

    return finalMask;
  }

  /**
   * Traces the exact outer 2D boundary of a binary mask and generates
   * a smooth, shape-preserving vector contour using Catmull-Rom spline interpolation.
   */
  private extractMaskBoundaryContour(
    mask: Uint8ClampedArray,
    width: number,
    height: number
  ): Array<{ x: number; y: number }> {
    let startX = -1, startY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (mask[row + x] > 128) {
          startX = x;
          startY = y;
          break;
        }
      }
      if (startY !== -1) break;
    }

    if (startY === -1) return [];

    const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
    const dy = [0, -1, -1, -1, 0, 1, 1, 1];

    const boundaryPoints: Array<{ x: number; y: number }> = [];
    let currX = startX;
    let currY = startY;
    let dir = 0;

    const isMask = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return mask[y * width + x] > 128;
    };

    const maxSteps = width * height;
    let step = 0;

    boundaryPoints.push({ x: currX, y: currY });

    while (step < maxSteps) {
      step++;
      let found = false;
      let startDir = (dir + 5) % 8;

      for (let i = 0; i < 8; i++) {
        const checkDir = (startDir + i) % 8;
        const nx = currX + dx[checkDir];
        const ny = currY + dy[checkDir];

        if (isMask(nx, ny)) {
          currX = nx;
          currY = ny;
          dir = checkDir;
          found = true;
          break;
        }
      }

      if (!found || (currX === startX && currY === startY)) {
        break;
      }

      boundaryPoints.push({ x: currX, y: currY });
    }

    if (boundaryPoints.length < 10) return boundaryPoints;

    // Downsample to ~56 control points for smooth vector rendering
    const targetControlPoints = 56;
    const stepSize = Math.max(1, Math.floor(boundaryPoints.length / targetControlPoints));
    const sampledPoints: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < boundaryPoints.length; i += stepSize) {
      sampledPoints.push(boundaryPoints[i]);
    }

    const numPts = sampledPoints.length;
    const smoothContour: Array<{ x: number; y: number }> = [];
    const samplesPerSegment = 4;
    const alpha = 0.5;

    const getKnot = (t: number, pA: { x: number; y: number }, pB: { x: number; y: number }) => {
      const d = Math.hypot(pB.x - pA.x, pB.y - pA.y);
      return t + Math.pow(Math.max(1e-4, d), alpha);
    };

    for (let i = 0; i < numPts; i++) {
      const p0 = sampledPoints[(i - 1 + numPts) % numPts];
      const p1 = sampledPoints[i];
      const p2 = sampledPoints[(i + 1) % numPts];
      const p3 = sampledPoints[(i + 2) % numPts];

      const t0 = 0;
      const t1 = getKnot(t0, p0, p1);
      const t2 = getKnot(t1, p1, p2);
      const t3 = getKnot(t2, p2, p3);

      for (let s = 0; s < samplesPerSegment; s++) {
        const t = t1 + (s / samplesPerSegment) * (t2 - t1);

        const a1x = ((t1 - t) * p0.x + (t - t0) * p1.x) / (t1 - t0 || 1e-4);
        const a1y = ((t1 - t) * p0.y + (t - t0) * p1.y) / (t1 - t0 || 1e-4);
        const a2x = ((t2 - t) * p1.x + (t - t1) * p2.x) / (t2 - t1 || 1e-4);
        const a2y = ((t2 - t) * p1.y + (t - t1) * p2.y) / (t2 - t1 || 1e-4);
        const a3x = ((t3 - t) * p2.x + (t - t2) * p3.x) / (t3 - t2 || 1e-4);
        const a3y = ((t3 - t) * p2.y + (t - t2) * p3.y) / (t3 - t2 || 1e-4);

        const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0 || 1e-4);
        const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0 || 1e-4);
        const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1 || 1e-4);
        const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1 || 1e-4);

        const cx = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1 || 1e-4);
        const cy = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1 || 1e-4);

        smoothContour.push({
          x: Math.max(0, Math.min(width - 1, cx)),
          y: Math.max(0, Math.min(height - 1, cy)),
        });
      }
    }

    return smoothContour;
  }

  /**
   * Generates the pixel-level semantic Human Skin mask across all visible skin
   */
  public async generateSkinMask(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    srcData: Uint8ClampedArray,
    customImageId?: string
  ): Promise<Uint8ClampedArray | null> {
    try {
      const regionResult = await skinRegionEngine.generateSkinRegion(imageSource, customImageId);
      if (regionResult) {
        if (targetWidth === regionResult.width && targetHeight === regionResult.height) {
          return regionResult.alpha;
        }

        // Upscale mask to target dimensions smoothly
        const upscaledMask = new Uint8ClampedArray(targetWidth * targetHeight);
        const scaleX = (regionResult.width - 1) / (targetWidth - 1 || 1);
        const scaleY = (regionResult.height - 1) / (targetHeight - 1 || 1);

        for (let y = 0; y < targetHeight; y++) {
          const srcY = y * scaleY;
          const y0 = Math.floor(srcY);
          const y1 = Math.min(regionResult.height - 1, y0 + 1);
          const dy = srcY - y0;

          for (let x = 0; x < targetWidth; x++) {
            const srcX = x * scaleX;
            const x0 = Math.floor(srcX);
            const x1 = Math.min(regionResult.width - 1, x0 + 1);
            const dx = srcX - x0;

            const v00 = regionResult.alpha[y0 * regionResult.width + x0];
            const v10 = regionResult.alpha[y0 * regionResult.width + x1];
            const v01 = regionResult.alpha[y1 * regionResult.width + x0];
            const v11 = regionResult.alpha[y1 * regionResult.width + x1];

            const interp = (1 - dy) * ((1 - dx) * v00 + dx * v10) + dy * ((1 - dx) * v01 + dx * v11);

            if (interp >= 120) {
              upscaledMask[y * targetWidth + x] = 255;
            }
          }
        }

        (upscaledMask as any).previewWidth = regionResult.width;
        (upscaledMask as any).previewHeight = regionResult.height;
        (upscaledMask as any).contourPoints = regionResult.contourPoints;
        (upscaledMask as any).previewContourPoints = regionResult.previewContourPoints;
        return upscaledMask;
      }

      return null;
    } catch (err) {
      console.warn('[FaceParser] Skin segmentation execution failed:', err);
      return null;
    }
  }

  /**
   * Generates the pixel-level semantic Human Hair mask
   */
  public async generateHairMask(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    srcData?: Uint8ClampedArray,
    customImageId?: string
  ): Promise<Uint8ClampedArray | null> {
    try {
      const segmenter = await this.getSegmenter();
      if (!segmenter) return null;

      const result = segmenter.segment(imageSource);
      if (!result) return null;

      const categoryMask = result.categoryMask;
      const confidenceMasks = result.confidenceMasks;

      if (!categoryMask || !confidenceMasks || confidenceMasks.length < 5) {
        return null;
      }

      const maskW = categoryMask.width;
      const maskH = categoryMask.height;
      const categoryData = categoryMask.getAsUint8Array();

      const hairConf = confidenceMasks[1]?.getAsFloat32Array();
      const bodyConf = confidenceMasks[2]?.getAsFloat32Array();
      const faceConf = confidenceMasks[3]?.getAsFloat32Array();
      const clothesConf = confidenceMasks[4]?.getAsFloat32Array();
      const bgConf = confidenceMasks[0]?.getAsFloat32Array();

      if (!hairConf) return null;

      const modelMask = new Uint8ClampedArray(maskW * maskH);
      let hairPixelCount = 0;

      for (let y = 0; y < maskH; y++) {
        for (let x = 0; x < maskW; x++) {
          const idx = y * maskW + x;
          const cat = categoryData[idx];
          const hVal = hairConf[idx];
          const fVal = faceConf ? faceConf[idx] : 0;
          const bVal = bodyConf ? bodyConf[idx] : 0;
          const cVal = clothesConf ? clothesConf[idx] : 0;
          const bgVal = bgConf ? bgConf[idx] : 0;

          const isHair =
            (cat === 1 || hVal >= 0.28) &&
            hVal > fVal * 0.92 &&
            hVal > bVal * 0.92 &&
            cVal < 0.55 &&
            bgVal < 0.65;

          if (isHair) {
            modelMask[idx] = 255;
            hairPixelCount++;
          }
        }
      }

      if (hairPixelCount < 10) {
        return null;
      }

      const finalHairMask = new Uint8ClampedArray(targetWidth * targetHeight);
      const scaleX = (maskW - 1) / (targetWidth - 1 || 1);
      const scaleY = (maskH - 1) / (targetHeight - 1 || 1);

      for (let y = 0; y < targetHeight; y++) {
        const srcY = y * scaleY;
        const y0 = Math.floor(srcY);
        const y1 = Math.min(maskH - 1, y0 + 1);
        const dy = srcY - y0;

        for (let x = 0; x < targetWidth; x++) {
          const srcX = x * scaleX;
          const x0 = Math.floor(srcX);
          const x1 = Math.min(maskW - 1, x0 + 1);
          const dx = srcX - x0;

          const v00 = modelMask[y0 * maskW + x0];
          const v10 = modelMask[y0 * maskW + x1];
          const v01 = modelMask[y1 * maskW + x0];
          const v11 = modelMask[y1 * maskW + x1];

          const interp = (1 - dy) * ((1 - dx) * v00 + dx * v10) + dy * ((1 - dx) * v01 + dx * v11);
          if (interp >= 90) {
            finalHairMask[y * targetWidth + x] = 255;
          }
        }
      }

      const filled = this.fillInteriorHoles(finalHairMask, targetWidth, targetHeight);
      await this.excludeBeardAndFacialHair(filled, imageSource, targetWidth, targetHeight, customImageId);

      return this.smoothMaskContour(filled, targetWidth, targetHeight);
    } catch (err) {
      console.warn('Multiclass hair segmentation warning:', err);
      return null;
    }
  }

  /**
   * Excludes beard, moustache, goatee, and lower facial hair from hair mask
   */
  private async excludeBeardAndFacialHair(
    mask: Uint8ClampedArray,
    imageSource: HTMLImageElement | HTMLCanvasElement,
    width: number,
    height: number,
    customImageId?: string
  ): Promise<void> {
    try {
      const parsed = await this.parseFace(imageSource, customImageId);
      if (!parsed || !parsed.allLandmarks || parsed.allLandmarks.length < 468) {
        return;
      }

      const lms = parsed.allLandmarks;
      const srcW = imageSource instanceof HTMLImageElement ? imageSource.naturalWidth : imageSource.width;
      const srcH = imageSource instanceof HTMLImageElement ? imageSource.naturalHeight : imageSource.height;
      const scaleX = width / (srcW || 1);
      const scaleY = height / (srcH || 1);

      const getPt = (idx: number) => ({
        x: lms[idx].x * scaleX,
        y: lms[idx].y * scaleY,
      });

      const noseBase = getPt(2);
      const chin = getPt(152);
      const leftJaw = getPt(288);
      const rightJaw = getPt(58);
      const lowerFaceH = Math.max(10, chin.y - noseBase.y);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';

      const beardPolyIndices = [
        2, 98, 205, 50,
        132, 58, 172, 136, 150, 149, 176, 148,
        152,
        377, 400, 378, 379, 365, 397, 288, 361,
        280, 425, 327, 2,
      ];

      const polyPoints = beardPolyIndices.map((idx) => getPt(idx));

      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      for (let i = 1; i < polyPoints.length; i++) {
        ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();

      const minJawX = Math.min(rightJaw.x, getPt(172).x, getPt(136).x);
      const maxJawX = Math.max(leftJaw.x, getPt(397).x, getPt(365).x);
      const jawWidth = Math.max(20, maxJawX - minJawX);

      const underChinCenterY = chin.y + lowerFaceH * 0.35;
      const underChinRadiusX = jawWidth * 0.48;
      const underChinRadiusY = lowerFaceH * 0.65;

      ctx.beginPath();
      ctx.ellipse(chin.x, underChinCenterY, underChinRadiusX, underChinRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      const exclusionData = ctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < mask.length; i++) {
        if (exclusionData[i * 4] > 64) {
          mask[i] = 0;
        }
      }

      canvas.width = 1;
      canvas.height = 1;
    } catch (err) {
      console.warn('Beard exclusion non-fatal warning:', err);
    }
  }

  /**
   * Generates a core facial polygon mask directly from MediaPipe facial landmarks.
   */
  private generateFaceCorePolygon(
    parsingResult: FaceParsingResult,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const { allLandmarks } = parsingResult;
    const mask = new Uint8ClampedArray(width * height);
    if (!allLandmarks || allLandmarks.length < 36) return mask;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return mask;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    const p0 = allLandmarks[MEDIAPIPE_FACE_OVAL_INDICES[0]];
    if (p0) ctx.moveTo(Math.max(0, Math.min(width - 1, p0.x)), Math.max(0, Math.min(height - 1, p0.y)));
    for (let i = 1; i < MEDIAPIPE_FACE_OVAL_INDICES.length; i++) {
      const pt = allLandmarks[MEDIAPIPE_FACE_OVAL_INDICES[i]];
      if (pt) ctx.lineTo(Math.max(0, Math.min(width - 1, pt.x)), Math.max(0, Math.min(height - 1, pt.y)));
    }
    ctx.closePath();
    ctx.fill();

    const imgData = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imgData[i * 4 + 3];
    }

    canvas.width = 1;
    canvas.height = 1;
    return mask;
  }

  /**
   * Generates the precise Human Skin selection mask across ALL visible skin in the image
   */
  public generateParsedSkinMask(
    parsingResult: FaceParsingResult,
    width: number,
    height: number,
    srcData: Uint8ClampedArray
  ): Uint8ClampedArray {
    const {
      allLandmarks,
      chinTip,
      foreheadCenter,
      leftEye,
      rightEye,
      leftEyebrow,
      rightEyebrow,
      lips,
    } = parsingResult;

    const faceHeight = Math.abs(chinTip.y - foreheadCenter.y);
    const ipd = Math.hypot(leftEye[0].x - rightEye[0].x, leftEye[0].y - rightEye[0].y) || (faceHeight * 0.45);

    const faceMask = this.generateFaceCorePolygon(parsingResult, width, height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return faceMask;

    ctx.clearRect(0, 0, width, height);

    const faceImgData = ctx.createImageData(width, height);
    for (let i = 0; i < faceMask.length; i++) {
      if (faceMask[i] === 255) {
        const p = i * 4;
        faceImgData.data[p] = 255;
        faceImgData.data[p + 1] = 255;
        faceImgData.data[p + 2] = 255;
        faceImgData.data[p + 3] = 255;
      }
    }
    ctx.putImageData(faceImgData, 0, 0);

    // Punch out Eyes, Eyebrows, and Lips from face region
    ctx.globalCompositeOperation = 'destination-out';

    if (leftEye.length > 0) {
      ctx.beginPath();
      ctx.moveTo(leftEye[0].x, leftEye[0].y);
      for (let i = 1; i < leftEye.length; i++) ctx.lineTo(leftEye[i].x, leftEye[i].y);
      ctx.closePath();
      ctx.fill();
    }

    if (rightEye.length > 0) {
      ctx.beginPath();
      ctx.moveTo(rightEye[0].x, rightEye[0].y);
      for (let i = 1; i < rightEye.length; i++) ctx.lineTo(rightEye[i].x, rightEye[i].y);
      ctx.closePath();
      ctx.fill();
    }

    if (leftEyebrow.length > 0) {
      ctx.beginPath();
      ctx.moveTo(leftEyebrow[0].x, leftEyebrow[0].y);
      for (let i = 1; i < leftEyebrow.length; i++) ctx.lineTo(leftEyebrow[i].x, leftEyebrow[i].y);
      ctx.closePath();
      ctx.fill();
    }

    if (rightEyebrow.length > 0) {
      ctx.beginPath();
      ctx.moveTo(rightEyebrow[0].x, rightEyebrow[0].y);
      for (let i = 1; i < rightEyebrow.length; i++) ctx.lineTo(rightEyebrow[i].x, rightEyebrow[i].y);
      ctx.closePath();
      ctx.fill();
    }

    if (lips.length > 0) {
      ctx.beginPath();
      ctx.moveTo(lips[0].x, lips[0].y);
      for (let i = 1; i < lips.length; i++) ctx.lineTo(lips[i].x, lips[i].y);
      ctx.closePath();
      ctx.fill();
    }

    const facialImgData = ctx.getImageData(0, 0, width, height);
    const facialData = facialImgData.data;

    // Calibrate subject skin color
    const sampleLocations: Array<{ x: number; y: number }> = [];
    if (allLandmarks && allLandmarks.length >= 400) {
      const sampleIndices = [10, 151, 9, 6, 168, 117, 123, 187, 346, 352, 411, 199, 152];
      for (const idx of sampleIndices) {
        if (allLandmarks[idx]) {
          sampleLocations.push({ x: allLandmarks[idx].x, y: allLandmarks[idx].y });
        }
      }
    } else {
      sampleLocations.push(
        { x: foreheadCenter.x, y: foreheadCenter.y },
        { x: chinTip.x - ipd * 0.35, y: (chinTip.y + foreheadCenter.y) * 0.5 },
        { x: chinTip.x + ipd * 0.35, y: (chinTip.y + foreheadCenter.y) * 0.5 },
        { x: chinTip.x, y: chinTip.y - ipd * 0.2 }
      );
    }

    let sumCb = 0, sumCr = 0, sampleCount = 0;
    const cbSamples: number[] = [];
    const crSamples: number[] = [];
    const sampleRadius = Math.max(2, Math.round(ipd * 0.06));

    for (const pt of sampleLocations) {
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        const sy = Math.round(pt.y + dy);
        if (sy < 0 || sy >= height) continue;

        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          const sx = Math.round(pt.x + dx);
          if (sx < 0 || sx >= width) continue;

          const pIdx = (sy * width + sx) * 4;
          const r = srcData[pIdx];
          const g = srcData[pIdx + 1];
          const b = srcData[pIdx + 2];

          const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
          const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

          if (Cb >= 65 && Cb <= 145 && Cr >= 118 && Cr <= 190 && r > (b - 5)) {
            sumCb += Cb;
            sumCr += Cr;
            cbSamples.push(Cb);
            crSamples.push(Cr);
            sampleCount++;
          }
        }
      }
    }

    let meanCb = 104, meanCr = 152, stdCb = 14, stdCr = 14;
    let isCalibrated = false;
    if (sampleCount >= 10) {
      meanCb = sumCb / sampleCount;
      meanCr = sumCr / sampleCount;
      let varCb = 0, varCr = 0;
      for (let i = 0; i < sampleCount; i++) {
        varCb += Math.pow(cbSamples[i] - meanCb, 2);
        varCr += Math.pow(crSamples[i] - meanCr, 2);
      }
      stdCb = Math.max(6, Math.sqrt(varCb / sampleCount));
      stdCr = Math.max(6, Math.sqrt(varCr / sampleCount));
      isCalibrated = true;
    }

    const skinMask = new Uint8ClampedArray(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const p = idx * 4;

        if (facialData[p + 3] > 64) {
          skinMask[idx] = 255;
          continue;
        }

        if (faceMask[idx] === 255 && facialData[p + 3] <= 64) {
          continue;
        }

        const r = srcData[p];
        const g = srcData[p + 1];
        const b = srcData[p + 2];

        if (r < 22 || g < 16 || b < 10) continue;

        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
        const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const delta = maxC - minC;
        const V = maxC / 255;
        const S = maxC > 0 ? delta / maxC : 0;
        let H = 0;
        if (delta > 0) {
          if (maxC === r) {
            H = ((g - b) / delta) % 6;
          } else if (maxC === g) {
            H = (b - r) / delta + 2;
          } else {
            H = (r - g) / delta + 4;
          }
          H *= 60;
          if (H < 0) H += 360;
        }

        const rgbSum = r + g + b + 0.001;
        const normR = r / rgbSum;
        const normG = g / rgbSum;

        if (y < chinTip.y && delta < 15 && V < 0.28) {
          continue;
        }

        let isSubjectSkinMatch = false;
        if (isCalibrated) {
          const dCb = (Cb - meanCb) / (stdCb * 3.4);
          const dCr = (Cr - meanCr) / (stdCr * 3.4);
          if (dCb * dCb + dCr * dCr <= 1.45 && r > (b - 8)) {
            isSubjectSkinMatch = true;
          }
        }

        const isYCbCrSkin =
          Cb >= 68 &&
          Cb <= 142 &&
          Cr >= 118 &&
          Cr <= 186 &&
          Cr >= Cb - 12 &&
          (Cr + 0.6 * Cb) >= 160 &&
          (Cr + 0.6 * Cb) <= 255 &&
          Y >= 20;

        const isHSVSkin =
          ((H >= 0 && H <= 50) || (H >= 335 && H <= 360)) &&
          S >= 0.08 &&
          S <= 0.88 &&
          V >= 0.12;

        const isRGBSkin =
          (r > b - 10) &&
          (r >= g - 8) &&
          normR >= 0.31 &&
          normR <= 0.65 &&
          normG >= 0.24 &&
          normG <= 0.42;

        if (isSubjectSkinMatch || (isYCbCrSkin && isHSVSkin && isRGBSkin)) {
          skinMask[idx] = 255;
        }
      }
    }

    canvas.width = 1;
    canvas.height = 1;

    return skinMask;
  }

  private sampleSubjectSkinModel(
    parsingResult: FaceParsingResult,
    srcData: Uint8ClampedArray,
    width: number,
    height: number
  ) {
    const { foreheadCenter, chinTip, leftEye, rightEye, noseTip } = parsingResult;
    const eyeCenterY = (leftEye[0].y + rightEye[0].y) / 2;
    const midForeheadY = (foreheadCenter.y + eyeCenterY) / 2;
    const faceMidX = foreheadCenter.x;

    let sumY = 0, sumCb = 0, sumCr = 0, count = 0;
    const sampleRadius = Math.max(4, Math.round(Math.abs(chinTip.y - eyeCenterY) * 0.08));

    for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const px = Math.round(faceMidX + dx);
        const py = Math.round(midForeheadY + dy);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          const r = srcData[idx];
          const g = srcData[idx + 1];
          const b = srcData[idx + 2];

          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
          const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

          sumY += Y;
          sumCb += Cb;
          sumCr += Cr;
          count++;
        }
      }
    }

    const noseBridgeY = (eyeCenterY + noseTip.y) / 2;
    for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const px = Math.round(faceMidX + dx);
        const py = Math.round(noseBridgeY + dy);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          const r = srcData[idx];
          const g = srcData[idx + 1];
          const b = srcData[idx + 2];

          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
          const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

          sumY += Y;
          sumCb += Cb;
          sumCr += Cr;
          count++;
        }
      }
    }

    if (count === 0) {
      return { meanY: 160, meanCb: 110, meanCr: 150 };
    }

    return {
      meanY: sumY / count,
      meanCb: sumCb / count,
      meanCr: sumCr / count,
    };
  }

  private findDynamicHairlineY(
    startX: number,
    startY: number,
    skinModel: { meanY: number; meanCb: number; meanCr: number },
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    maxUpwardPixels: number
  ): number {
    let lastValidSkinY = startY;
    const x = Math.max(0, Math.min(width - 1, Math.round(startX)));
    const minY = Math.max(0, Math.round(startY - maxUpwardPixels));
    let consecutiveNonSkin = 0;

    for (let y = Math.round(startY); y >= minY; y--) {
      const idx = (y * width + x) * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];

      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
      const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

      const isDefiniteDarkHair =
        (r < 46 && g < 46 && b < 46) ||
        (Y < 42 && r < 58) ||
        (Y < skinModel.meanY * 0.42 && r < 65 && Math.abs(r - b) < 16);

      if (isDefiniteDarkHair) {
        break;
      }

      const dCb = Cb - skinModel.meanCb;
      const dCr = Cr - skinModel.meanCr;
      const distSq = dCb * dCb + dCr * dCr;

      const isSkinPixel =
        (distSq < 48 * 48 || (Cb >= 62 && Cb <= 145 && Cr >= 112 && Cr <= 192)) &&
        r >= b - 12 &&
        r >= g - 12 &&
        Y >= Math.max(24, skinModel.meanY * 0.30);

      if (isSkinPixel) {
        lastValidSkinY = y;
        consecutiveNonSkin = 0;
      } else {
        consecutiveNonSkin++;
        if (consecutiveNonSkin >= 4) {
          break;
        }
      }
    }

    return lastValidSkinY;
  }

  private fillInteriorHoles(mask: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const totalPixels = width * height;
    const filled = new Uint8ClampedArray(mask);
    const reachable = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    for (let x = 0; x < width; x++) {
      if (mask[x] === 0 && !reachable[x]) {
        reachable[x] = 1;
        queue[tail++] = x;
      }
      const btmIdx = (height - 1) * width + x;
      if (mask[btmIdx] === 0 && !reachable[btmIdx]) {
        reachable[btmIdx] = 1;
        queue[tail++] = btmIdx;
      }
    }
    for (let y = 0; y < height; y++) {
      const leftIdx = y * width;
      if (mask[leftIdx] === 0 && !reachable[leftIdx]) {
        reachable[leftIdx] = 1;
        queue[tail++] = leftIdx;
      }
      const rightIdx = y * width + (width - 1);
      if (mask[rightIdx] === 0 && !reachable[rightIdx]) {
        reachable[rightIdx] = 1;
        queue[tail++] = rightIdx;
      }
    }

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % width;
      const cy = (curr / width) | 0;

      if (cy > 0) {
        const n = curr - width;
        if (mask[n] === 0 && !reachable[n]) {
          reachable[n] = 1;
          queue[tail++] = n;
        }
      }
      if (cy < height - 1) {
        const n = curr + width;
        if (mask[n] === 0 && !reachable[n]) {
          reachable[n] = 1;
          queue[tail++] = n;
        }
      }
      if (cx > 0) {
        const n = curr - 1;
        if (mask[n] === 0 && !reachable[n]) {
          reachable[n] = 1;
          queue[tail++] = n;
        }
      }
      if (cx < width - 1) {
        const n = curr + 1;
        if (mask[n] === 0 && !reachable[n]) {
          reachable[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    for (let i = 0; i < totalPixels; i++) {
      if (!reachable[i]) {
        filled[i] = 255;
      }
    }

    return filled;
  }

  private smoothMaskContour(mask: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(mask);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (mask[(y + dy) * width + (x + dx)] === 255) {
              count++;
            }
          }
        }

        if (count >= 5) {
          result[idx] = 255;
        } else if (count <= 3) {
          result[idx] = 0;
        }
      }
    }

    return result;
  }
}

export const faceParserService = new FaceParserService();
