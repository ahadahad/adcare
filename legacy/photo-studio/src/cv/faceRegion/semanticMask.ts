/**
 * Semantic Face Mask Generator
 * MediaPipe Selfie Multiclass Segmentation as the PRIMARY source of the human face region.
 * 
 * Accurately selects:
 * - Natural forehead skin up to hairline
 * - Temples & Cheeks
 * - Eyes, eyelids, eyebrows
 * - Nose, mouth, lips
 * - Facial hair (beard, moustache, goatee, stubble)
 * - Complete visible ears (helix, earlobes, tragus)
 * - Jaw & chin
 * 
 * Excludes:
 * - Scalp hair (top, back, sides of head)
 * - Neck & throat (via landmark jawline safety constraint)
 * - Shoulders, chest, clothing, background
 */

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { FaceRoi, FaceRegionResult, Point2D, Rect } from './faceRegionTypes';
import { faceRoiExtractor } from './roi';

export class SemanticFaceMaskGenerator {
  private static instance: SemanticFaceMaskGenerator;
  private segmenter: ImageSegmenter | null = null;
  private segmenterPromise: Promise<ImageSegmenter | null> | null = null;
  private filesetResolver: any = null;

  public static getInstance(): SemanticFaceMaskGenerator {
    if (!SemanticFaceMaskGenerator.instance) {
      SemanticFaceMaskGenerator.instance = new SemanticFaceMaskGenerator();
    }
    return SemanticFaceMaskGenerator.instance;
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

  private async getSegmenter(): Promise<ImageSegmenter | null> {
    if (this.segmenter) return this.segmenter;
    if (this.segmenterPromise) return this.segmenterPromise;

    this.segmenterPromise = (async () => {
      try {
        const resolver = await this.getFilesetResolver();
        const modelUrl =
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

        // 1. Try GPU delegate
        try {
          const seg = await ImageSegmenter.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
            runningMode: 'IMAGE',
            outputCategoryMask: true,
            outputConfidenceMasks: true,
          });
          this.segmenter = seg;
          return seg;
        } catch {
          // 2. Fallback to CPU delegate
          const seg = await ImageSegmenter.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
            runningMode: 'IMAGE',
            outputCategoryMask: true,
            outputConfidenceMasks: true,
          });
          this.segmenter = seg;
          return seg;
        }
      } catch (err) {
        console.warn('MediaPipe ImageSegmenter initialization failed:', err);
        return null;
      }
    })();

    return this.segmenterPromise;
  }

  /**
   * Generates the semantic Face + Ear mask using Selfie Multiclass segmenter and safe ROI constraints
   */
  public async generateMask(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    roi: FaceRoi
  ): Promise<FaceRegionResult | null> {
    const segmenter = await this.getSegmenter();
    if (!segmenter) return null;

    const { previewWidth, previewHeight, originalWidth, originalHeight } = roi;

    // Downscaled working preview canvas for segmenter inference
    const workCanvas = document.createElement('canvas');
    workCanvas.width = previewWidth;
    workCanvas.height = previewHeight;
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return null;

    workCtx.drawImage(imageSource, 0, 0, previewWidth, previewHeight);

    let segResult: any = null;
    try {
      segResult = segmenter.segment(workCanvas);
    } catch (segErr) {
      console.warn('Semantic segmentation execution failed:', segErr);
      return null;
    }

    if (!segResult || !segResult.categoryMask || !segResult.confidenceMasks) {
      return null;
    }

    const categoryMask = segResult.categoryMask;
    const confidenceMasks = segResult.confidenceMasks;

    const segW = categoryMask.width;
    const segH = categoryMask.height;
    const catData = categoryMask.getAsUint8Array();

    const bgConf = confidenceMasks[0]?.getAsFloat32Array();
    const hairConf = confidenceMasks[1]?.getAsFloat32Array();
    const bodyConf = confidenceMasks[2]?.getAsFloat32Array();
    const faceConf = confidenceMasks[3]?.getAsFloat32Array();
    const clothesConf = confidenceMasks[4]?.getAsFloat32Array();
    const othersConf = confidenceMasks[5]?.getAsFloat32Array();

    if (!faceConf || !hairConf) return null;

    // Working preview mask buffer (0..255)
    const previewMask = new Uint8ClampedArray(previewWidth * previewHeight);

    const safeRoi = roi.previewRoi;
    const jawline = roi.jawlinePoints;
    const leftEar = roi.leftEarRegion;
    const rightEar = roi.rightEarRegion;
    const noseTipY = roi.noseTip.y;
    const chinTipY = roi.chinTip.y;

    const scaleSegToPrevX = previewWidth / segW;
    const scaleSegToPrevY = previewHeight / segH;

    // Evaluate each pixel at preview working resolution
    for (let py = 0; py < previewHeight; py++) {
      // 1. Safe ROI vertical check
      if (py < safeRoi.y || py > safeRoi.y + safeRoi.height) {
        continue;
      }

      // Map preview y to segmentation coordinate
      const sy = Math.min(segH - 1, Math.floor(py / scaleSegToPrevY));
      const segRow = sy * segW;
      const prevRow = py * previewWidth;

      for (let px = 0; px < previewWidth; px++) {
        // Safe ROI horizontal check
        if (px < safeRoi.x || px > safeRoi.x + safeRoi.width) {
          continue;
        }

        // Map preview x to segmentation coordinate
        const sx = Math.min(segW - 1, Math.floor(px / scaleSegToPrevX));
        const segIdx = segRow + sx;

        const cat = catData[segIdx];
        const fVal = faceConf[segIdx];
        const hVal = hairConf[segIdx];
        const bVal = bodyConf ? bodyConf[segIdx] : 0;
        const cVal = clothesConf ? clothesConf[segIdx] : 0;
        const bgVal = bgConf ? bgConf[segIdx] : 0;
        const oVal = othersConf ? othersConf[segIdx] : 0;

        // Check if pixel is within lateral ear regions
        const isLeftEarZone =
          px >= leftEar.x && px <= leftEar.x + leftEar.width &&
          py >= leftEar.y && py <= leftEar.y + leftEar.height;

        const isRightEarZone =
          px >= rightEar.x && px <= rightEar.x + rightEar.width &&
          py >= rightEar.y && py <= rightEar.y + rightEar.height;

        const isEarZone = isLeftEarZone || isRightEarZone;

        // 1. Ear detection: Evaluated BEFORE jawline so ears & earlobes are never cut off by neck constraints
        if (isEarZone) {
          const skinScore = Math.max(fVal, bVal, (fVal + bVal) * 0.7);
          const isEarSkin =
            (cat === 3 || cat === 2 || cat === 5 || skinScore >= 0.14 || oVal > 0.18) &&
            bgVal < 0.70 &&
            cVal < 0.60;

          if (isEarSkin) {
            previewMask[prevRow + px] = 255;
            continue;
          }
        }

        // 2. Neck safety constraint: strictly reject pixels below the landmark jawline (for face interior)
        if (faceRoiExtractor.isBelowJawline(px, py, jawline, 2)) {
          continue; // Neck, throat, or body skin
        }

        // Scalp Hair exclusion:
        // Scalp hair is located on top of the head, temples, and sides above the mouth
        const isUpperHead = py < noseTipY;
        const isScalpHair = (cat === 1 || hVal >= 0.35) && hVal > fVal * 0.95 && isUpperHead;

        if (isScalpHair) {
          continue; // Scalp hair excluded
        }

        // Facial Hair retention (beard, moustache, goatee, stubble):
        // Within the face area below the nose and above jawline, hair is FACIAL hair
        const isFacialHairArea = py >= noseTipY && py <= chinTipY + 4;
        if (isFacialHairArea && (cat === 1 || hVal > 0.3) && bgVal < 0.5 && cVal < 0.5) {
          previewMask[prevRow + px] = 255;
          continue;
        }

        // Primary Face Skin classification
        const isFaceSkin =
          (cat === 3 || fVal >= 0.28) &&
          fVal > cVal &&
          bgVal < 0.65;

        // Facial interior features (eyes, eyelids, lips, mouth, nose, accessories/glasses)
        const isFacialFeature =
          (cat === 5 || oVal > 0.3 || (cat === 3 && fVal > 0.15)) &&
          py >= safeRoi.y + safeRoi.height * 0.15 &&
          py <= chinTipY &&
          cVal < 0.5 &&
          bgVal < 0.5;

        if (isFaceSkin || isFacialFeature) {
          previewMask[prevRow + px] = 255;
        }
      }
    }

    // 1b. Bridge any thin gaps between ears and cheeks so the boundary contour smoothly encompasses both ears
    const leftTragusX = roi.previewWidth * (roi.normalizedLandmarks[234]?.x ?? 0.25);
    const rightTragusX = roi.previewWidth * (roi.normalizedLandmarks[454]?.x ?? 0.75);
    const maxBridgeGap = Math.max(8, Math.round(roi.previewRoi.width * 0.12));
    this.bridgeEarsToFace(previewMask, previewWidth, previewHeight, leftEar, rightEar, leftTragusX, rightTragusX, maxBridgeGap);

    // 2. Fill interior holes (pupils, glasses frames, open mouth, teeth)
    this.fillInteriorHoles(previewMask, previewWidth, previewHeight, safeRoi);

    // 3. Fast morphological smoothing (3x3 closing) to eliminate pixel staircase artifacts
    const smoothedMask = this.smoothMaskEdges(previewMask, previewWidth, previewHeight);

    // 4. Extract smooth vector boundary contour
    const previewContour = this.extractContour(smoothedMask, previewWidth, previewHeight);

    // Scale contour to original image coordinates for crisp rendering
    const scaleToOrigX = originalWidth / previewWidth;
    const scaleToOrigY = originalHeight / previewHeight;

    const originalContour: Point2D[] = previewContour.map(pt => ({
      x: pt.x * scaleToOrigX,
      y: pt.y * scaleToOrigY,
    }));

    // Compute bounding boxes
    let minPx = previewWidth, maxPx = 0, minPy = previewHeight, maxPy = 0;
    for (const pt of previewContour) {
      if (pt.x < minPx) minPx = pt.x;
      if (pt.x > maxPx) maxPx = pt.x;
      if (pt.y < minPy) minPy = pt.y;
      if (pt.y > maxPy) maxPy = pt.y;
    }

    const previewBounds: Rect = {
      x: Math.max(0, Math.floor(minPx)),
      y: Math.max(0, Math.floor(minPy)),
      width: Math.max(1, Math.ceil(maxPx - minPx)),
      height: Math.max(1, Math.ceil(maxPy - minPy)),
    };

    const originalBounds: Rect = {
      x: Math.max(0, Math.floor(previewBounds.x * scaleToOrigX)),
      y: Math.max(0, Math.floor(previewBounds.y * scaleToOrigY)),
      width: Math.max(1, Math.ceil(previewBounds.width * scaleToOrigX)),
      height: Math.max(1, Math.ceil(previewBounds.height * scaleToOrigY)),
    };

    // 5. Build pre-rendered mask canvas & overlay canvas at preview resolution (NOT 4K/6K)
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = previewWidth;
    maskCanvas.height = previewHeight;
    const mCtx = maskCanvas.getContext('2d');
    if (mCtx) {
      const imgData = mCtx.createImageData(previewWidth, previewHeight);
      const data = imgData.data;
      for (let i = 0; i < smoothedMask.length; i++) {
        const val = smoothedMask[i];
        const idx = i * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = val;
      }
      mCtx.putImageData(imgData, 0, 0);
    }

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = previewWidth;
    overlayCanvas.height = previewHeight;
    const oCtx = overlayCanvas.getContext('2d');
    if (oCtx) {
      oCtx.clearRect(0, 0, previewWidth, previewHeight);

      // Draw ONLY crisp, thin cyan boundary stroke (zero interior mask fill)
      if (previewContour.length > 2) {
        oCtx.save();
        oCtx.strokeStyle = '#22D3EE';
        oCtx.lineWidth = 1.5;
        oCtx.lineJoin = 'round';
        oCtx.lineCap = 'round';
        oCtx.shadowColor = 'rgba(6, 182, 212, 0.45)';
        oCtx.shadowBlur = 2;
        oCtx.beginPath();
        oCtx.moveTo(previewContour[0].x, previewContour[0].y);
        for (let i = 1; i < previewContour.length; i++) {
          oCtx.lineTo(previewContour[i].x, previewContour[i].y);
        }
        oCtx.closePath();
        oCtx.stroke();
        oCtx.restore();
      }
    }

    return {
      alpha: smoothedMask,
      width: previewWidth,
      height: previewHeight,
      originalWidth,
      originalHeight,
      contourPoints: originalContour,
      previewContourPoints: previewContour,
      bounds: originalBounds,
      previewBounds,
      maskCanvas,
      overlayCanvas,
    };
  }

  /**
   * Fast flood-fill hole filler: fills interior voids (eyes, pupils, glasses, lips) inside the face
   */
  private fillInteriorHoles(
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    roi: Rect
  ): void {
    const totalPixels = width * height;
    const visited = new Uint8Array(totalPixels);

    // Flood fill from outer image borders (outside the face)
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    // Seed top and bottom rows
    for (let x = 0; x < width; x++) {
      if (mask[x] === 0) {
        visited[x] = 1;
        queue[tail++] = x;
      }
      const btmIdx = (height - 1) * width + x;
      if (mask[btmIdx] === 0) {
        visited[btmIdx] = 1;
        queue[tail++] = btmIdx;
      }
    }

    // Seed left and right columns
    for (let y = 1; y < height - 1; y++) {
      const leftIdx = y * width;
      if (mask[leftIdx] === 0) {
        visited[leftIdx] = 1;
        queue[tail++] = leftIdx;
      }
      const rightIdx = y * width + (width - 1);
      if (mask[rightIdx] === 0) {
        visited[rightIdx] = 1;
        queue[tail++] = rightIdx;
      }
    }

    while (head < tail) {
      const idx = queue[head++];
      const cx = idx % width;
      const cy = (idx - cx) / width;

      // 4-neighborhood
      if (cx > 0) {
        const nIdx = idx - 1;
        if (!visited[nIdx] && mask[nIdx] === 0) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
      if (cx < width - 1) {
        const nIdx = idx + 1;
        if (!visited[nIdx] && mask[nIdx] === 0) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
      if (cy > 0) {
        const nIdx = idx - width;
        if (!visited[nIdx] && mask[nIdx] === 0) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
      if (cy < height - 1) {
        const nIdx = idx + width;
        if (!visited[nIdx] && mask[nIdx] === 0) {
          visited[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }

    // Any pixel in the ROI that is 0 and NOT reachable from outside is an interior hole! Fill it.
    const startY = Math.max(0, roi.y);
    const endY = Math.min(height, roi.y + roi.height);
    const startX = Math.max(0, roi.x);
    const endX = Math.min(width, roi.x + roi.width);

    for (let y = startY; y < endY; y++) {
      const row = y * width;
      for (let x = startX; x < endX; x++) {
        const idx = row + x;
        if (mask[idx] === 0 && !visited[idx]) {
          mask[idx] = 255;
        }
      }
    }
  }

  /**
   * Fast 3x3 morphological closing & feathering for natural organic contours
   */
  private smoothMaskEdges(
    mask: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const dilated = new Uint8ClampedArray(width * height);
    const eroded = new Uint8ClampedArray(width * height);

    // 1. Dilation (1px radius)
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        let maxVal = mask[idx];
        if (mask[idx - 1] > maxVal) maxVal = mask[idx - 1];
        if (mask[idx + 1] > maxVal) maxVal = mask[idx + 1];
        if (mask[idx - width] > maxVal) maxVal = mask[idx - width];
        if (mask[idx + width] > maxVal) maxVal = mask[idx + width];
        dilated[idx] = maxVal;
      }
    }

    // 2. Erosion (1px radius) on dilated mask to complete morphological closing
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        let minVal = dilated[idx];
        if (dilated[idx - 1] < minVal) minVal = dilated[idx - 1];
        if (dilated[idx + 1] < minVal) minVal = dilated[idx + 1];
        if (dilated[idx - width] < minVal) minVal = dilated[idx - width];
        if (dilated[idx + width] < minVal) minVal = dilated[idx + width];
        eroded[idx] = minVal;
      }
    }

    // 3. Soft 1px edge feathering (simple 3-tap box blur on edge transition pixels)
    const result = new Uint8ClampedArray(width * height);
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        const val = eroded[idx];
        // If on the boundary
        if (val > 0 && val < 255) {
          const sum =
            eroded[idx] * 4 +
            eroded[idx - 1] + eroded[idx + 1] +
            eroded[idx - width] + eroded[idx + width];
          result[idx] = Math.round(sum / 8);
        } else {
          result[idx] = val;
        }
      }
    }

    return result;
  }

  /**
   * Bridges any thin gap (such as sideburns or hairline shadow) between the ears and cheeks
   * to ensure the ears and face form a single contiguous boundary contour.
   */
  private bridgeEarsToFace(
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    leftEar: Rect,
    rightEar: Rect,
    leftTragusX: number,
    rightTragusX: number,
    maxGapPx: number
  ): void {
    const bridgeYStart = Math.max(0, Math.floor(Math.min(leftEar.y, rightEar.y)));
    const bridgeYEnd = Math.min(height - 1, Math.ceil(Math.max(leftEar.y + leftEar.height, rightEar.y + rightEar.height)));

    for (let y = bridgeYStart; y <= bridgeYEnd; y++) {
      const row = y * width;

      // 1. Left Ear Bridge (connect left ear pixels to cheek pixels across leftTragusX)
      let lastEarX = -1;
      const leftEarEnd = Math.min(width - 1, Math.ceil(leftTragusX + maxGapPx * 0.5));
      for (let x = Math.max(0, Math.floor(leftEar.x)); x <= leftEarEnd; x++) {
        if (mask[row + x] > 0) lastEarX = x;
      }
      let firstFaceX = -1;
      const faceSearchEnd = Math.min(width - 1, Math.ceil(leftTragusX + maxGapPx * 2.5));
      for (let x = Math.max(0, Math.floor(leftTragusX - maxGapPx * 0.5)); x <= faceSearchEnd; x++) {
        if (mask[row + x] > 0) {
          firstFaceX = x;
          break;
        }
      }
      if (lastEarX !== -1 && firstFaceX !== -1 && firstFaceX > lastEarX && (firstFaceX - lastEarX) <= maxGapPx) {
        for (let x = lastEarX + 1; x < firstFaceX; x++) {
          mask[row + x] = 255;
        }
      }

      // 2. Right Ear Bridge (connect cheek pixels to right ear pixels across rightTragusX)
      let lastCheekX = -1;
      const cheekSearchStart = Math.max(0, Math.floor(rightTragusX - maxGapPx * 2.5));
      for (let x = cheekSearchStart; x <= Math.min(width - 1, Math.ceil(rightTragusX + maxGapPx * 0.5)); x++) {
        if (mask[row + x] > 0) lastCheekX = x;
      }
      let firstEarX = -1;
      const rightEarEnd = Math.min(width - 1, Math.ceil(rightEar.x + rightEar.width));
      for (let x = Math.max(0, Math.floor(rightTragusX - maxGapPx * 0.5)); x <= rightEarEnd; x++) {
        if (mask[row + x] > 0) {
          firstEarX = x;
          break;
        }
      }
      if (lastCheekX !== -1 && firstEarX !== -1 && firstEarX > lastCheekX && (firstEarX - lastCheekX) <= maxGapPx) {
        for (let x = lastCheekX + 1; x < firstEarX; x++) {
          mask[row + x] = 255;
        }
      }
    }
  }

  /**
   * Extracts smooth Catmull-Rom spline contour points along the mask boundary
   */
  private extractContour(
    mask: Uint8ClampedArray,
    width: number,
    height: number
  ): Point2D[] {
    // 1. Find initial boundary pixel
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

    // 2. Moore-Neighbor Tracing
    const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
    const dy = [0, -1, -1, -1, 0, 1, 1, 1];

    const rawPoints: Point2D[] = [];
    let currX = startX;
    let currY = startY;
    let dir = 0;

    const isMask = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return mask[y * width + x] > 128;
    };

    const maxSteps = width * height;
    let step = 0;
    rawPoints.push({ x: currX, y: currY });

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

      rawPoints.push({ x: currX, y: currY });
    }

    if (rawPoints.length < 12) return rawPoints;

    // 3. Subsample to ~90 control points to preserve fine ear curves
    const targetControlPts = 90;
    const stepSize = Math.max(1, Math.floor(rawPoints.length / targetControlPts));
    const sampled: Point2D[] = [];
    for (let i = 0; i < rawPoints.length; i += stepSize) {
      sampled.push(rawPoints[i]);
    }

    // 4. Catmull-Rom Spline interpolation
    const n = sampled.length;
    const smoothContour: Point2D[] = [];
    const samplesPerSegment = 4;
    const alpha = 0.5;

    const getKnot = (t: number, pA: Point2D, pB: Point2D) => {
      const d = Math.hypot(pB.x - pA.x, pB.y - pA.y);
      return t + Math.pow(Math.max(1e-4, d), alpha);
    };

    for (let i = 0; i < n; i++) {
      const p0 = sampled[(i - 1 + n) % n];
      const p1 = sampled[i];
      const p2 = sampled[(i + 1) % n];
      const p3 = sampled[(i + 2) % n];

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
}

export const semanticFaceMaskGenerator = SemanticFaceMaskGenerator.getInstance();
