/**
 * Semantic Skin Mask Generator
 * MediaPipe Selfie Multiclass Segmentation as the PRIMARY source for visible human skin.
 * 
 * Accurately isolates:
 * - Facial skin (forehead, temples, cheeks, nose, chin)
 * - Complete neck & throat
 * - Shoulders, clavicles, chest
 * - Arms, hands, fingers
 * - Any exposed body skin
 * 
 * Excludes:
 * - Scalp hair, eyebrows, eyelashes
 * - Eyes (pupils, irises, sclera)
 * - Lips and teeth / inner mouth
 * - Clothing, collars, fabric, buttons, straps
 * - Background walls, scenery, furniture, lighting
 * - Accessories, watches, jewelry, glasses
 * 
 * Performance & Memory:
 * - Working preview resolution (<= 1024px, preferred 768px-1024px)
 * - Zero 4K/6K full-res allocations
 */

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { Point2D, Rect, CalibratedSkinModel, SkinRegionResult } from './skinRegionTypes';
import { faceRoiExtractor } from '../faceRegion/roi';
import { FaceRoi } from '../faceRegion/faceRegionTypes';

// MediaPipe Landmark Indices for punching out non-skin facial features
const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LIPS_OUTER_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LEFT_EYEBROW_INDICES = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_EYEBROW_INDICES = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];

export class SemanticSkinMaskGenerator {
  private static instance: SemanticSkinMaskGenerator;
  private segmenter: ImageSegmenter | null = null;
  private segmenterPromise: Promise<ImageSegmenter | null> | null = null;
  private filesetResolver: any = null;

  public static getInstance(): SemanticSkinMaskGenerator {
    if (!SemanticSkinMaskGenerator.instance) {
      SemanticSkinMaskGenerator.instance = new SemanticSkinMaskGenerator();
    }
    return SemanticSkinMaskGenerator.instance;
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
        console.warn('[SemanticSkinMask] MediaPipe ImageSegmenter initialization failed:', err);
        return null;
      }
    })();

    return this.segmenterPromise;
  }

  /**
   * Generates the semantic Skin mask across all visible human skin
   */
  public async generateMask(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    previewWidth: number,
    previewHeight: number,
    originalWidth: number,
    originalHeight: number,
    faceRoi?: FaceRoi | null
  ): Promise<SkinRegionResult | null> {
    const segmenter = await this.getSegmenter();
    if (!segmenter) return null;

    // Working preview canvas for segmentation and color sampling
    const workCanvas = document.createElement('canvas');
    workCanvas.width = previewWidth;
    workCanvas.height = previewHeight;
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return null;

    workCtx.drawImage(imageSource, 0, 0, previewWidth, previewHeight);
    const imgData = workCtx.getImageData(0, 0, previewWidth, previewHeight);
    const srcData = imgData.data;

    let segResult: any = null;
    try {
      segResult = segmenter.segment(workCanvas);
    } catch (segErr) {
      console.warn('[SemanticSkinMask] Segmentation failed:', segErr);
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

    if (!faceConf || !bodyConf) return null;

    // Step 1: Calibrate subject skin color profile from high-confidence skin seeds
    const skinModel = this.calibrateSkinModel(
      srcData,
      previewWidth,
      previewHeight,
      catData,
      faceConf,
      bodyConf,
      hairConf,
      clothesConf,
      bgConf,
      segW,
      segH
    );

    // Step 2: Semantic Skin Mask Fusion
    const previewMask = new Uint8ClampedArray(previewWidth * previewHeight);
    const scaleSegToPrevX = previewWidth / segW;
    const scaleSegToPrevY = previewHeight / segH;

    let skinPixelCount = 0;

    for (let py = 0; py < previewHeight; py++) {
      const sy = Math.min(segH - 1, Math.floor(py / scaleSegToPrevY));
      const segRow = sy * segW;
      const prevRow = py * previewWidth;

      for (let px = 0; px < previewWidth; px++) {
        const sx = Math.min(segW - 1, Math.floor(px / scaleSegToPrevX));
        const segIdx = segRow + sx;
        const prevIdx = prevRow + px;

        const cat = catData[segIdx];
        const fVal = faceConf[segIdx];
        const bVal = bodyConf[segIdx];
        const hVal = hairConf ? hairConf[segIdx] : 0;
        const cVal = clothesConf ? clothesConf[segIdx] : 0;
        const bgVal = bgConf ? bgConf[segIdx] : 0;
        const oVal = othersConf ? othersConf[segIdx] : 0;

        const pIdx = prevIdx * 4;
        const r = srcData[pIdx];
        const g = srcData[pIdx + 1];
        const b = srcData[pIdx + 2];

        // 1. Scalp hair exclusion
        if (cat === 1 || (hVal >= 0.40 && hVal > (fVal + bVal) * 0.9)) {
          continue;
        }

        // 2. Clothing exclusion
        if (cat === 4 && cVal >= 0.45 && cVal > (fVal + bVal) * 1.1) {
          continue;
        }

        // 3. Background exclusion
        if (cat === 0 && bgVal >= 0.45 && bgVal > (fVal + bVal) * 1.1) {
          continue;
        }

        // 4. Combined Skin Score
        const skinScore = Math.max(fVal, bVal, (fVal + bVal) * 0.75);
        const isSkinClass = cat === 2 || cat === 3;

        // 5. Chromaticity plausibility
        const isPlausibleSkinColor = this.verifySkinColor(r, g, b, skinModel);

        if (!isPlausibleSkinColor) {
          continue;
        }

        // Candidate check
        const isSkin =
          (isSkinClass || skinScore >= 0.26) &&
          hVal < 0.42 &&
          cVal < 0.48 &&
          bgVal < 0.48 &&
          oVal < 0.65;

        if (isSkin) {
          previewMask[prevIdx] = 255;
          skinPixelCount++;
        }
      }
    }

    // Step 3: Facial Feature Punch-Out (Punch out Eyes, Eyebrows & Lips)
    if (faceRoi && faceRoi.normalizedLandmarks && faceRoi.normalizedLandmarks.length >= 400) {
      this.punchOutFacialFeatures(previewMask, previewWidth, previewHeight, faceRoi.normalizedLandmarks);
    }

    // Step 4: Morphological Cleanup at preview resolution
    const cleanedMask = this.cleanupMask(previewMask, previewWidth, previewHeight);

    // Step 5: Fast feathering (3px soft edge)
    const featheredMask = this.featherMask(cleanedMask, previewWidth, previewHeight, 3);

    // Step 6: Extract vector boundary contour
    const previewContour = this.extractContour(cleanedMask, previewWidth, previewHeight);

    // Scale contour to original image coordinates
    const scaleToOrigX = originalWidth / previewWidth;
    const scaleToOrigY = originalHeight / previewHeight;

    const originalContour: Point2D[] = previewContour.map(pt => ({
      x: pt.x * scaleToOrigX,
      y: pt.y * scaleToOrigY,
    }));

    // Step 7: Bounding boxes
    let minPx = previewWidth, maxPx = 0, minPy = previewHeight, maxPy = 0;
    if (previewContour.length > 0) {
      for (const pt of previewContour) {
        if (pt.x < minPx) minPx = pt.x;
        if (pt.x > maxPx) maxPx = pt.x;
        if (pt.y < minPy) minPy = pt.y;
        if (pt.y > maxPy) maxPy = pt.y;
      }
    } else {
      minPx = 0; maxPx = previewWidth; minPy = 0; maxPy = previewHeight;
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

    // Step 8: Build pre-rendered mask canvas & overlay canvas at preview resolution
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = previewWidth;
    maskCanvas.height = previewHeight;
    const mCtx = maskCanvas.getContext('2d');
    if (mCtx) {
      const imgDataOut = mCtx.createImageData(previewWidth, previewHeight);
      const outData = imgDataOut.data;
      for (let i = 0; i < featheredMask.length; i++) {
        const val = featheredMask[i];
        const idx = i * 4;
        outData[idx] = 255;
        outData[idx + 1] = 255;
        outData[idx + 2] = 255;
        outData[idx + 3] = val;
      }
      mCtx.putImageData(imgDataOut, 0, 0);
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

    // Step 9: Skin Coverage & Tone Description
    const totalPixels = previewWidth * previewHeight;
    const skinCoveragePercent = parseFloat(((skinPixelCount / (totalPixels || 1)) * 100).toFixed(1));
    const skinToneDescription = this.describeSkinTone(skinModel);

    return {
      alpha: featheredMask,
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
      skinCoveragePercent,
      skinToneDescription,
      skinModel,
    };
  }

  /**
   * Calibrates subject skin color profile from high-confidence seeds
   */
  private calibrateSkinModel(
    srcData: Uint8ClampedArray,
    previewW: number,
    previewH: number,
    catData: Uint8Array,
    faceConf: Float32Array,
    bodyConf: Float32Array,
    hairConf: Float32Array | null,
    clothesConf: Float32Array | null,
    bgConf: Float32Array | null,
    segW: number,
    segH: number
  ): CalibratedSkinModel {
    const scaleSegToPrevX = previewW / segW;
    const scaleSegToPrevY = previewH / segH;

    let sumCb = 0, sumCr = 0, sumY = 0, count = 0;
    const cbSamples: number[] = [];
    const crSamples: number[] = [];

    // Step by 4 for rapid sampling (~100-500 samples)
    for (let py = 0; py < previewH; py += 4) {
      const sy = Math.min(segH - 1, Math.floor(py / scaleSegToPrevY));
      const segRow = sy * segW;
      const prevRow = py * previewW;

      for (let px = 0; px < previewW; px += 4) {
        const sx = Math.min(segW - 1, Math.floor(px / scaleSegToPrevX));
        const segIdx = segRow + sx;

        const cat = catData[segIdx];
        const fVal = faceConf[segIdx];
        const bVal = bodyConf[segIdx];
        const hVal = hairConf ? hairConf[segIdx] : 0;
        const cVal = clothesConf ? clothesConf[segIdx] : 0;
        const bgVal = bgConf ? bgConf[segIdx] : 0;

        // Sample only high-confidence skin seeds
        if (
          (cat === 3 || cat === 2) &&
          (fVal + bVal) >= 0.65 &&
          hVal < 0.20 &&
          cVal < 0.20 &&
          bgVal < 0.20
        ) {
          const pIdx = (prevRow + px) * 4;
          const r = srcData[pIdx];
          const g = srcData[pIdx + 1];
          const b = srcData[pIdx + 2];

          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
          const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

          // Kovacs / Peer human skin locus bounds
          if (Cb >= 65 && Cb <= 145 && Cr >= 118 && Cr <= 190 && r > (b - 8)) {
            sumCb += Cb;
            sumCr += Cr;
            sumY += Y;
            cbSamples.push(Cb);
            crSamples.push(Cr);
            count++;
          }
        }
      }
    }

    if (count >= 12) {
      const meanCb = sumCb / count;
      const meanCr = sumCr / count;
      const meanY = sumY / count;

      let varCb = 0, varCr = 0;
      for (let i = 0; i < count; i++) {
        varCb += Math.pow(cbSamples[i] - meanCb, 2);
        varCr += Math.pow(crSamples[i] - meanCr, 2);
      }

      return {
        meanCb,
        meanCr,
        stdCb: Math.max(5, Math.sqrt(varCb / count)),
        stdCr: Math.max(5, Math.sqrt(varCr / count)),
        meanY,
        meanHue: 20,
        meanSat: 0.35,
        isCalibrated: true,
      };
    }

    // Default universal Caucasian/Asian/Afro-Caribbean human skin locus
    return {
      meanCb: 106,
      meanCr: 152,
      stdCb: 14,
      stdCr: 14,
      meanY: 135,
      meanHue: 20,
      meanSat: 0.35,
      isCalibrated: false,
    };
  }

  /**
   * Evaluates if a pixel has plausible human skin chromaticity
   */
  private verifySkinColor(r: number, g: number, b: number, model: CalibratedSkinModel): boolean {
    // Reject extreme shadows, near black, or extreme highlights
    if (r < 18 && g < 14 && b < 10) return false;

    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
    const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

    // 1. Broad Kovacs/Peer universal human skin chromaticity
    const isWithinLocus =
      Cb >= 62 &&
      Cb <= 146 &&
      Cr >= 115 &&
      Cr <= 192 &&
      r > (b - 12) &&
      (r >= g * 0.82) &&
      Y >= 18;

    if (!isWithinLocus) return false;

    // 2. If calibrated, apply distance metric
    if (model.isCalibrated) {
      const dCb = (Cb - model.meanCb) / (model.stdCb * 3.6);
      const dCr = (Cr - model.meanCr) / (model.stdCr * 3.6);
      const distSq = dCb * dCb + dCr * dCr;
      return distSq <= 1.8;
    }

    return true;
  }

  /**
   * Punches out non-skin facial features (Eyes, Eyebrows, Lips) from the skin mask
   */
  private punchOutFacialFeatures(
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    landmarks: Array<{ x: number; y: number }>
  ): void {
    const punchPolygon = (indices: number[], padding = 1.0) => {
      const pts: Point2D[] = [];
      let cx = 0, cy = 0;
      for (const idx of indices) {
        const lm = landmarks[idx];
        if (lm) {
          const px = lm.x * width;
          const py = lm.y * height;
          pts.push({ x: px, y: py });
          cx += px;
          cy += py;
        }
      }
      if (pts.length < 3) return;

      cx /= pts.length;
      cy /= pts.length;

      // Expand points slightly with padding
      const expandedPts = pts.map(p => ({
        x: cx + (p.x - cx) * padding,
        y: cy + (p.y - cy) * padding,
      }));

      // Rasterize polygon and clear to 0
      let minY = height, maxY = 0;
      for (const p of expandedPts) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      minY = Math.max(0, Math.floor(minY));
      maxY = Math.min(height - 1, Math.ceil(maxY));

      for (let y = minY; y <= maxY; y++) {
        // Ray-casting for scanline
        const nodes: number[] = [];
        let j = expandedPts.length - 1;
        for (let i = 0; i < expandedPts.length; i++) {
          const pi = expandedPts[i];
          const pj = expandedPts[j];
          if ((pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)) {
            const nodeX = pi.x + ((y - pi.y) / (pj.y - pi.y)) * (pj.x - pi.x);
            nodes.push(nodeX);
          }
          j = i;
        }
        nodes.sort((a, b) => a - b);

        const row = y * width;
        for (let k = 0; k < nodes.length; k += 2) {
          if (k + 1 >= nodes.length) break;
          const startX = Math.max(0, Math.floor(nodes[k]));
          const endX = Math.min(width - 1, Math.ceil(nodes[k + 1]));
          for (let x = startX; x <= endX; x++) {
            mask[row + x] = 0;
          }
        }
      }
    };

    // Punch out Left Eye, Right Eye, and Lips
    punchPolygon(LEFT_EYE_INDICES, 1.15);
    punchPolygon(RIGHT_EYE_INDICES, 1.15);
    punchPolygon(LIPS_OUTER_INDICES, 1.08);

    // Punch out Eyebrows
    punchPolygon(LEFT_EYEBROW_INDICES, 1.1);
    punchPolygon(RIGHT_EYEBROW_INDICES, 1.1);
  }

  /**
   * Fast morphological cleanup (opening + hole closure) at preview resolution
   */
  private cleanupMask(
    mask: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const total = width * height;
    const eroded = new Uint8ClampedArray(total);
    const opened = new Uint8ClampedArray(total);

    // 1. Erosion 3x3 (removes single-pixel noise specks)
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        if (mask[idx] > 0) {
          if (
            mask[idx - 1] > 0 &&
            mask[idx + 1] > 0 &&
            mask[idx - width] > 0 &&
            mask[idx + width] > 0
          ) {
            eroded[idx] = 255;
          }
        }
      }
    }

    // 2. Dilation 3x3 (restores boundary)
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + x;
        if (
          eroded[idx] > 0 ||
          eroded[idx - 1] > 0 ||
          eroded[idx + 1] > 0 ||
          eroded[idx - width] > 0 ||
          eroded[idx + width] > 0
        ) {
          opened[idx] = 255;
        }
      }
    }

    // 3. Fast Hole Filling (flood fill from outside perimeter to find exterior background)
    const reachable = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0, tail = 0;

    // Seed outer boundary pixels
    for (let x = 0; x < width; x++) {
      if (opened[x] === 0) { reachable[x] = 1; queue[tail++] = x; }
      const bottomIdx = (height - 1) * width + x;
      if (opened[bottomIdx] === 0) { reachable[bottomIdx] = 1; queue[tail++] = bottomIdx; }
    }
    for (let y = 0; y < height; y++) {
      const leftIdx = y * width;
      if (opened[leftIdx] === 0 && reachable[leftIdx] === 0) { reachable[leftIdx] = 1; queue[tail++] = leftIdx; }
      const rightIdx = y * width + (width - 1);
      if (opened[rightIdx] === 0 && reachable[rightIdx] === 0) { reachable[rightIdx] = 1; queue[tail++] = rightIdx; }
    }

    // BFS Flood Fill
    while (head < tail) {
      const idx = queue[head++];
      const x = idx % width;
      const y = Math.floor(idx / width);

      if (x > 0) {
        const n = idx - 1;
        if (reachable[n] === 0 && opened[n] === 0) { reachable[n] = 1; queue[tail++] = n; }
      }
      if (x < width - 1) {
        const n = idx + 1;
        if (reachable[n] === 0 && opened[n] === 0) { reachable[n] = 1; queue[tail++] = n; }
      }
      if (y > 0) {
        const n = idx - width;
        if (reachable[n] === 0 && opened[n] === 0) { reachable[n] = 1; queue[tail++] = n; }
      }
      if (y < height - 1) {
        const n = idx + width;
        if (reachable[n] === 0 && opened[n] === 0) { reachable[n] = 1; queue[tail++] = n; }
      }
    }

    // Fill all enclosed holes (pixels not reachable from outside)
    const filled = new Uint8ClampedArray(opened);
    for (let i = 0; i < total; i++) {
      if (reachable[i] === 0) {
        filled[i] = 255;
      }
    }

    return filled;
  }

  /**
   * Fast Gaussian/box feathering on preview resolution
   */
  private featherMask(
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    radius: number
  ): Uint8ClampedArray {
    if (radius <= 0) return mask;

    const total = width * height;
    const temp = new Float32Array(total);
    const result = new Uint8ClampedArray(total);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const clampedX = Math.max(0, Math.min(width - 1, i));
        sum += mask[row + clampedX];
      }
      const count = 2 * radius + 1;
      for (let x = 0; x < width; x++) {
        temp[row + x] = sum / count;
        const removeX = Math.max(0, x - radius);
        const addX = Math.min(width - 1, x + radius + 1);
        sum += mask[row + addX] - mask[row + removeX];
      }
    }

    // Vertical pass
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const clampedY = Math.max(0, Math.min(height - 1, i));
        sum += temp[clampedY * width + x];
      }
      const count = 2 * radius + 1;
      for (let y = 0; y < height; y++) {
        const val = sum / count;
        result[y * width + x] = Math.round(Math.max(0, Math.min(255, val)));
        const removeY = Math.max(0, y - radius);
        const addY = Math.min(height - 1, y + radius + 1);
        sum += temp[addY * width + x] - temp[removeY * width + x];
      }
    }

    return result;
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

    // 3. Subsample to ~70 control points
    const targetControlPts = 70;
    const stepSize = Math.max(1, Math.floor(rawPoints.length / targetControlPts));
    const sampled: Point2D[] = [];
    for (let i = 0; i < rawPoints.length; i += stepSize) {
      sampled.push(rawPoints[i]);
    }

    // 4. Catmull-Rom Spline interpolation
    const n = sampled.length;
    const smoothContour: Point2D[] = [];
    const samplesPerSegment = 3;
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

  /**
   * Describes calibrated human skin complexion
   */
  private describeSkinTone(model: CalibratedSkinModel): string {
    const y = model.meanY;
    if (y >= 170) return 'Fair / Porcelain Complexion';
    if (y >= 140) return 'Light / Warm Ivory Complexion';
    if (y >= 110) return 'Medium / Natural Warm Complexion';
    if (y >= 80) return 'Olive / Golden Tan Complexion';
    return 'Rich Bronze / Deep Complexion';
  }
}

export const semanticSkinMaskGenerator = SemanticSkinMaskGenerator.getInstance();
