/**
 * Safe Face Region of Interest (ROI) and Landmark Constraints
 * Uses MediaPipe FaceLandmarker ONLY for locating the person, defining a safe ROI,
 * and providing a jawline boundary to prevent neck/body leakage.
 * 
 * Never synthesizes fake face geometry or geometric ovals.
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { FaceRoi, Point2D, Rect } from './faceRegionTypes';

// MediaPipe Landmark Indices for the lower jawline (from left tragus to right tragus under chin)
export const JAWLINE_INDICES = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454
];

const LEFT_EYEBROW_INDICES = [70, 63, 105, 66, 107];
const RIGHT_EYEBROW_INDICES = [336, 296, 334, 293, 300];

export class FaceRoiExtractor {
  private static instance: FaceRoiExtractor;
  private landmarker: FaceLandmarker | null = null;
  private landmarkerPromise: Promise<FaceLandmarker | null> | null = null;
  private filesetResolver: any = null;

  public static getInstance(): FaceRoiExtractor {
    if (!FaceRoiExtractor.instance) {
      FaceRoiExtractor.instance = new FaceRoiExtractor();
    }
    return FaceRoiExtractor.instance;
  }

  private async getFilesetResolver() {
    if (this.filesetResolver) return this.filesetResolver;
    try {
      this.filesetResolver = await FilesetResolver.forVisionTasks(
        typeof window !== 'undefined' && window.location.origin
          ? `${window.location.origin}/wasm`
          : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );
      return this.filesetResolver;
    } catch {
      this.filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );
      return this.filesetResolver;
    }
  }

  private async getLandmarker(): Promise<FaceLandmarker | null> {
    if (this.landmarker) return this.landmarker;
    if (this.landmarkerPromise) return this.landmarkerPromise;

    this.landmarkerPromise = (async () => {
      try {
        const resolver = await this.getFilesetResolver();
        const localModelPath = '/models/face_landmarker.task';
        const remoteModelPath = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

        // 1. Try local model with GPU
        try {
          const lm = await FaceLandmarker.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: localModelPath, delegate: 'GPU' },
            runningMode: 'IMAGE',
            numFaces: 1,
          });
          this.landmarker = lm;
          return lm;
        } catch {
          // 2. Try local model with CPU
          try {
            const lm = await FaceLandmarker.createFromOptions(resolver, {
              baseOptions: { modelAssetPath: localModelPath, delegate: 'CPU' },
              runningMode: 'IMAGE',
              numFaces: 1,
            });
            this.landmarker = lm;
            return lm;
          } catch {
            // 3. Fallback to remote CDN model
            const lm = await FaceLandmarker.createFromOptions(resolver, {
              baseOptions: { modelAssetPath: remoteModelPath, delegate: 'CPU' },
              runningMode: 'IMAGE',
              numFaces: 1,
            });
            this.landmarker = lm;
            return lm;
          }
        }
      } catch (err) {
        console.warn('FaceLandmarker initialization failed:', err);
        return null;
      }
    })();

    return this.landmarkerPromise;
  }

  /**
   * Computes the Safe Face ROI and anatomical boundaries using FaceLandmarker
   */
  public async extractRoi(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    previewWidth: number,
    previewHeight: number,
    originalWidth: number,
    originalHeight: number
  ): Promise<FaceRoi | null> {
    const landmarker = await this.getLandmarker();
    if (!landmarker) return null;

    // Run inference on downscaled preview image (never on 4K/6K directly)
    let detectionCanvas: HTMLCanvasElement | null = null;
    let inputForModel: HTMLImageElement | HTMLCanvasElement = imageSource;

    const sourceW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const sourceH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    if (sourceW !== previewWidth || sourceH !== previewHeight) {
      detectionCanvas = document.createElement('canvas');
      detectionCanvas.width = previewWidth;
      detectionCanvas.height = previewHeight;
      const ctx = detectionCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(imageSource, 0, 0, previewWidth, previewHeight);
        inputForModel = detectionCanvas;
      }
    }

    let result: any = null;
    try {
      result = landmarker.detect(inputForModel);
    } catch (detectErr) {
      console.warn('FaceLandmarker detect failed:', detectErr);
      return null;
    } finally {
      if (detectionCanvas) {
        detectionCanvas.width = 1;
        detectionCanvas.height = 1;
      }
    }

    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return null;
    }

    const landmarks = result.faceLandmarks[0];
    if (landmarks.length < 400) return null;

    // Coordinate conversion helpers
    const toPreviewPt = (idx: number): Point2D => ({
      x: Math.max(0, Math.min(previewWidth, landmarks[idx].x * previewWidth)),
      y: Math.max(0, Math.min(previewHeight, landmarks[idx].y * previewHeight)),
    });

    const toOrigPt = (idx: number): Point2D => ({
      x: Math.max(0, Math.min(originalWidth, landmarks[idx].x * originalWidth)),
      y: Math.max(0, Math.min(originalHeight, landmarks[idx].y * originalHeight)),
    });

    // Extract landmark groups
    const jawlinePoints = JAWLINE_INDICES.map(toPreviewPt);
    const originalJawlinePoints = JAWLINE_INDICES.map(toOrigPt);

    const chinTip = toPreviewPt(152);
    const foreheadCenter = toPreviewPt(10);
    const noseTip = toPreviewPt(1);

    let leftEyebrowTopY = previewHeight;
    for (const idx of LEFT_EYEBROW_INDICES) {
      const pt = toPreviewPt(idx);
      if (pt.y < leftEyebrowTopY) leftEyebrowTopY = pt.y;
    }

    let rightEyebrowTopY = previewHeight;
    for (const idx of RIGHT_EYEBROW_INDICES) {
      const pt = toPreviewPt(idx);
      if (pt.y < rightEyebrowTopY) rightEyebrowTopY = pt.y;
    }

    // Compute bounding box around landmarks in preview coordinates
    let minX = previewWidth, maxX = 0, minY = previewHeight, maxY = 0;
    for (const lm of landmarks) {
      const px = lm.x * previewWidth;
      const py = lm.y * previewHeight;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const faceW = maxX - minX;
    const faceH = maxY - minY;

    // Define safe extended ROI (covers forehead up into hair top, and sides to include ears)
    const roiMarginLeft = faceW * 0.35;
    const roiMarginRight = faceW * 0.35;
    const roiMarginTop = faceH * 0.45; // allows segmenter to see full forehead & natural hairline
    const roiMarginBottom = faceH * 0.15; // covers lower chin & jawline

    const previewRoiX = Math.max(0, Math.floor(minX - roiMarginLeft));
    const previewRoiY = Math.max(0, Math.floor(minY - roiMarginTop));
    const previewRoiMaxX = Math.min(previewWidth, Math.ceil(maxX + roiMarginRight));
    const previewRoiMaxY = Math.min(previewHeight, Math.ceil(maxY + roiMarginBottom));

    const previewRoi: Rect = {
      x: previewRoiX,
      y: previewRoiY,
      width: Math.max(1, previewRoiMaxX - previewRoiX),
      height: Math.max(1, previewRoiMaxY - previewRoiY),
    };

    const scaleX = originalWidth / previewWidth;
    const scaleY = originalHeight / previewHeight;

    const originalRoi: Rect = {
      x: Math.round(previewRoi.x * scaleX),
      y: Math.round(previewRoi.y * scaleY),
      width: Math.round(previewRoi.width * scaleX),
      height: Math.round(previewRoi.height * scaleY),
    };

    // Lateral ear bounding boxes in preview coords (from temple level down to lower earlobe)
    const earLevelTop = Math.min(leftEyebrowTopY, rightEyebrowTopY) - faceH * 0.10;
    const earLevelBottom = Math.max(chinTip.y - faceH * 0.02, toPreviewPt(152).y - faceH * 0.02);
    const earH = Math.max(15, earLevelBottom - earLevelTop);

    const leftTragus = toPreviewPt(234);
    const rightTragus = toPreviewPt(454);

    const leftEarRegion: Rect = {
      x: Math.max(0, Math.floor(leftTragus.x - faceW * 0.42)),
      y: Math.max(0, Math.floor(earLevelTop)),
      width: Math.max(15, Math.ceil(faceW * 0.48)),
      height: Math.ceil(earH),
    };

    const rightEarRegion: Rect = {
      x: Math.max(0, Math.floor(rightTragus.x - faceW * 0.06)),
      y: Math.max(0, Math.floor(earLevelTop)),
      width: Math.max(15, Math.ceil(faceW * 0.48)),
      height: Math.ceil(earH),
    };

    return {
      previewRoi,
      originalRoi,
      jawlinePoints,
      originalJawlinePoints,
      chinTip,
      foreheadCenter,
      noseTip,
      leftEyebrowTopY,
      rightEyebrowTopY,
      leftEarRegion,
      rightEarRegion,
      normalizedLandmarks: landmarks,
      previewWidth,
      previewHeight,
      originalWidth,
      originalHeight,
    };
  }

  /**
   * Fast spatial test: checks if a point (x, y) is strictly below the landmark jawline curve.
   * Prevents neck and upper-body leakage without using synthetic face ovals.
   */
  public isBelowJawline(
    x: number,
    y: number,
    jawlinePoints: Point2D[],
    marginPx: number = 2
  ): boolean {
    if (!jawlinePoints || jawlinePoints.length < 2) return false;

    // Find the jawline segment [p1, p2] that spans x
    let leftIdx = -1;
    let rightIdx = -1;

    // Jawline is ordered from left tragus (min x) to right tragus (max x)
    for (let i = 0; i < jawlinePoints.length - 1; i++) {
      const p1 = jawlinePoints[i];
      const p2 = jawlinePoints[i + 1];
      const segMinX = Math.min(p1.x, p2.x);
      const segMaxX = Math.max(p1.x, p2.x);

      if (x >= segMinX && x <= segMaxX) {
        leftIdx = i;
        rightIdx = i + 1;
        break;
      }
    }

    if (leftIdx !== -1 && rightIdx !== -1) {
      const p1 = jawlinePoints[leftIdx];
      const p2 = jawlinePoints[rightIdx];
      const dx = p2.x - p1.x;
      let jawY = p1.y;
      if (Math.abs(dx) > 1e-4) {
        const t = (x - p1.x) / dx;
        jawY = p1.y + t * (p2.y - p1.y);
      }
      return y > jawY + marginPx;
    }

    // For pixels outside the tragus laterally (where ears are located):
    // Only reject pixels strictly below the bottom of the earlobe/neck!
    const leftTragus = jawlinePoints[0];
    const rightTragus = jawlinePoints[jawlinePoints.length - 1];
    const midJawY = jawlinePoints[Math.floor(jawlinePoints.length / 2)]?.y ?? (leftTragus.y + 40);
    const earLobeCutoffY = leftTragus.y + (midJawY - leftTragus.y) * 0.85 + marginPx * 2;

    if (x < leftTragus.x) {
      return y > earLobeCutoffY;
    }
    if (x > rightTragus.x) {
      return y > earLobeCutoffY;
    }

    return false;
  }
}

export const faceRoiExtractor = FaceRoiExtractor.getInstance();
