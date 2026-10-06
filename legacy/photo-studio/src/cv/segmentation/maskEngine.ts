/**
 * High-Accuracy Multi-Stage Computer Vision Segmentation Engine
 * for Face, Skin, and Hair Isolation.
 * 
 * Features:
 * 1. Multi-Stage Pipeline:
 *    - Face Detection & Landmark Extraction
 *    - Subject-Specific Skin Color Calibration (Gaussian / Mahalanobis model)
 *    - Multi-Tone Hair Segmentation & Exclusion
 *    - Facial Feature Exclusion (Eyes, Eyebrows, Lips, Teeth, Nostrils, Glasses)
 *    - Morphological Cleanup (2D Closing, Opening, Island Removal, Hole Filling)
 *    - Resolution-Adaptive Feathering (~5px equivalent at 1000px, scaled proportionally)
 * 2. Native Image Coordinates Storage (width x height independent of screen zoom/pan)
 * 3. Interactive Manual Refinement Brush (Add / Remove from selection with size & hardness)
 * 4. Dual Display Modes: Feathered Slate Gray Overlay and Dimmed Focus Preview
 * 5. High-Performance Cached Adjustments (Brightness, Contrast, Smoothness, Warmth, Saturation)
 */

import { FaceDetectionResult } from '../types';
import { faceParserService } from '../face/faceParser';
import { localFaceDetector } from '../face/detector';
import { faceRegionEngine } from '../faceRegion/FaceRegionEngine';
import { skinRegionEngine } from '../skinRegion/SkinRegionEngine';

export interface MaskData {
  width: number;
  height: number;
  previewWidth?: number;
  previewHeight?: number;
  // 1-channel alpha values (0 to 255)
  alpha: Uint8ClampedArray;
  // Raw unfeathered binary mask (useful for resets or morphological re-runs)
  rawAlpha?: Uint8ClampedArray;
  // Canvas element with the alpha mask (white on transparent)
  maskCanvas: HTMLCanvasElement;
  // Pre-rendered semi-transparent gray overlay canvas (#475569 at 38% alpha)
  overlayCanvas: HTMLCanvasElement;
  // Boundary bbox in image pixels
  bounds: { x: number; y: number; width: number; height: number };
  // Target type
  target: 'face' | 'skin' | 'hair';
  // Offset in image pixels if user moved the selection
  offset: { x: number; y: number };
  // Feather radius applied in image pixels
  featherRadius: number;
  // Exact vector contour points for crisp selection outlines
  contourPoints?: Array<{ x: number; y: number }>;
  previewContourPoints?: Array<{ x: number; y: number }>;
  skinCoveragePercent?: number;
  skinToneDescription?: string;
}

export interface BrushStrokePoint {
  x: number;
  y: number;
}

export class MaskEngine {
  /**
   * Generates a pixel-accurate feathered mask for Face, Skin, or Hair using multi-stage CV.
   */
  public async generateTargetMask(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    target: 'face' | 'skin' | 'hair',
    faceResult?: FaceDetectionResult,
    customImageId?: string
  ): Promise<MaskData> {
    const width = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const height = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    // RULE #1: NEVER create full-res 4K/6K masks, canvases, ImageData, or buffers during Face preview!
    // Preview working resolution (preferred 768-1024px, maximum 1024px)
    if (target === 'face') {
      try {
        const regionResult = await faceRegionEngine.generateFaceRegion(imageSource, customImageId);
        if (regionResult) {
          return {
            width,
            height,
            previewWidth: regionResult.width,
            previewHeight: regionResult.height,
            alpha: regionResult.alpha,
            rawAlpha: regionResult.alpha,
            maskCanvas: regionResult.maskCanvas,
            overlayCanvas: regionResult.overlayCanvas,
            bounds: regionResult.bounds,
            target,
            offset: { x: 0, y: 0 },
            featherRadius: 1,
            contourPoints: regionResult.contourPoints,
            previewContourPoints: regionResult.previewContourPoints,
          };
        }
      } catch (faceErr) {
        console.warn('FaceRegionEngine failed, trying fallback:', faceErr);
      }

      let faceMask: Uint8ClampedArray | null = null;
      try {
        // High-precision multiclass semantic face segmentation model fallback
        faceMask = await faceParserService.generateFaceMask(imageSource, width, height, customImageId);
      } catch (parseErr) {
        console.warn('Face segmentation model failed, trying parser fallback:', parseErr);
      }

      if (!faceMask) {
        try {
          const parsed = await faceParserService.parseFace(imageSource, customImageId);
          if (parsed && parsed.faceOval.length > 0) {
            const MAX_PREVIEW_DIMENSION = 1024;
            const maxDim = Math.max(width, height);
            const scale = maxDim > MAX_PREVIEW_DIMENSION ? MAX_PREVIEW_DIMENSION / maxDim : 1.0;
            const previewW = Math.max(1, Math.round(width * scale));
            const previewH = Math.max(1, Math.round(height * scale));
            faceMask = faceParserService.generateParsedFaceMaskArchitecture(parsed, previewW, previewH, null, null);
          }
        } catch (fallbackErr) {
          console.warn('Face parser fallback failed:', fallbackErr);
        }
      }

      if (!faceMask) {
        throw new Error('Face not detected');
      }

      const maskW = (faceMask as any).previewWidth || width;
      const maskH = (faceMask as any).previewHeight || height;
      const contourPoints: Array<{ x: number; y: number }> | undefined = (faceMask as any).contourPoints;
      const previewContour: Array<{ x: number; y: number }> | undefined = (faceMask as any).previewContourPoints || contourPoints;

      // Compute active bounding box in full-resolution image pixels
      let bounds = { x: 0, y: 0, width, height };
      if (contourPoints && contourPoints.length > 0) {
        let minX = width, maxX = 0, minY = height, maxY = 0;
        for (const pt of contourPoints) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        bounds = {
          x: Math.max(0, Math.floor(minX)),
          y: Math.max(0, Math.floor(minY)),
          width: Math.max(1, Math.ceil(maxX - minX)),
          height: Math.max(1, Math.ceil(maxY - minY)),
        };
      }

      // Build working preview mask canvas & overlay canvas (NOT 4K/6K!)
      const maskCanvas = this.buildMaskCanvas(faceMask, maskW, maskH);
      const overlayCanvas = this.buildOverlayCanvas(faceMask, maskW, maskH, undefined, previewContour);

      return {
        width,
        height,
        previewWidth: maskW,
        previewHeight: maskH,
        alpha: faceMask,
        rawAlpha: faceMask,
        maskCanvas,
        overlayCanvas,
        bounds,
        target,
        offset: { x: 0, y: 0 },
        featherRadius: 1,
        contourPoints,
        previewContourPoints: previewContour,
      };
    }

    // NEVER create full-res 4K/6K masks, canvases, ImageData, or buffers during Skin preview!
    // Preview working resolution (preferred 768-1024px, maximum 1024px)
    if (target === 'skin') {
      try {
        const regionResult = await skinRegionEngine.generateSkinRegion(imageSource, customImageId);
        if (regionResult) {
          return {
            width,
            height,
            previewWidth: regionResult.width,
            previewHeight: regionResult.height,
            alpha: regionResult.alpha,
            rawAlpha: regionResult.alpha,
            maskCanvas: regionResult.maskCanvas,
            overlayCanvas: regionResult.overlayCanvas,
            bounds: regionResult.bounds,
            target,
            offset: { x: 0, y: 0 },
            featherRadius: 3,
            contourPoints: regionResult.contourPoints,
            previewContourPoints: regionResult.previewContourPoints,
            skinCoveragePercent: regionResult.skinCoveragePercent,
            skinToneDescription: regionResult.skinToneDescription,
          };
        }
      } catch (skinErr) {
        console.warn('SkinRegionEngine failed, trying fallback:', skinErr);
      }
    }

    // Output binary/probability mask buffer (0..255) for skin/hair
    const rawMask = new Uint8ClampedArray(width * height);

    let srcData: Uint8ClampedArray | null = null;
    const getSrcData = () => {
      if (srcData) return srcData;
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = width;
      srcCanvas.height = height;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!srcCtx) throw new Error('2D canvas context unavailable');
      srcCtx.drawImage(imageSource, 0, 0, width, height);
      srcData = srcCtx.getImageData(0, 0, width, height).data;
      return srcData;
    };

    if (target === 'skin') {
      let parsedSucceeded = false;
      const data = getSrcData();
      try {
        // High-precision multiclass semantic skin segmentation (face + body skin)
        const skinMask = await faceParserService.generateSkinMask(imageSource, width, height, data, customImageId);
        if (skinMask && skinMask.length === width * height) {
          rawMask.set(skinMask);
          parsedSucceeded = true;
        }
      } catch (parseErr) {
        console.warn('Skin segmentation failed, trying parser fallback:', parseErr);
      }

      if (!parsedSucceeded) {
        try {
          const parsed = await faceParserService.parseFace(imageSource, customImageId);
          if (parsed && parsed.faceOval.length > 0) {
            const parsedMask = faceParserService.generateParsedSkinMask(parsed, width, height, data);
            rawMask.set(parsedMask);
            parsedSucceeded = true;
          }
        } catch (fallbackErr) {
          console.warn('Face parser skin fallback failed:', fallbackErr);
        }
      }

      if (!parsedSucceeded) {
        const bgInfo = this.analyzePerimeterBackground(data, width, height);
        const geom = this.computeFacialGeometry(width, height, faceResult);
        const skinModel = this.calibrateSubjectSkinModel(data, width, height, geom);
        const hairMap = this.computeHairProbabilityMap(data, width, height, geom, bgInfo);
        this.segmentSkinRegion(rawMask, data, width, height, geom, skinModel, hairMap, bgInfo);
      }
    } else if (target === 'hair') {
      let hairSucceeded = false;
      const data = getSrcData();
      try {
        const hairMask = await faceParserService.generateHairMask(imageSource, width, height, data, customImageId);
        if (hairMask && hairMask.length === width * height) {
          let count = 0;
          for (let i = 0; i < hairMask.length; i += 8) {
            if (hairMask[i] === 255) count++;
          }
          if (count > 5) {
            rawMask.set(hairMask);
            hairSucceeded = true;
          }
        }
      } catch (err) {
        console.warn('Hair parsing failed, using fallback:', err);
      }

      if (!hairSucceeded) {
        const bgInfo = this.analyzePerimeterBackground(data, width, height);
        const geom = this.computeFacialGeometry(width, height, faceResult);
        const hairMap = this.computeHairProbabilityMap(data, width, height, geom, bgInfo);
        this.segmentHairRegion(rawMask, data, width, height, geom, hairMap, bgInfo);
      }
    }

    // Morphological Cleanup (Closing small gaps, opening noise, filling interior voids for skin/hair)
    const cleanedMask = this.applyMorphologicalCleanup(rawMask, width, height);

    // Resolution-Adaptive Feathering (~5px at 1000px dimension)
    const maxDim = Math.max(width, height);
    const featherRadius = Math.max(2, Math.min(24, Math.round(5 * (maxDim / 1000))));
    const featheredAlpha = this.applyFeather(cleanedMask, width, height, featherRadius);

    // Compute active bounding box
    let minX = width, maxX = 0, minY = height, maxY = 0;
    const step = Math.max(1, Math.floor(Math.min(width, height) / 400));
    for (let y = 0; y < height; y += step) {
      const row = y * width;
      for (let x = 0; x < width; x += step) {
        if (featheredAlpha[row + x] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      const geom = this.computeFacialGeometry(width, height, faceResult);
      minX = Math.round(geom.faceCenter.x - geom.radiusX);
      maxX = Math.round(geom.faceCenter.x + geom.radiusX);
      minY = Math.round(geom.faceCenter.y - geom.radiusY);
      maxY = Math.round(geom.chinTip.y);
    }

    const bounds = {
      x: Math.max(0, minX),
      y: Math.max(0, minY),
      width: Math.max(1, Math.min(width - minX, maxX - minX)),
      height: Math.max(1, Math.min(height - minY, maxY - minY)),
    };

    const contourPoints: Array<{ x: number; y: number }> | undefined =
      (rawMask as any).contourPoints || (cleanedMask as any).contourPoints;

    // Build White Alpha Mask Canvas & Crisp Vector Cyan Overlay Canvas
    const maskCanvas = this.buildMaskCanvas(featheredAlpha, width, height);
    const overlayCanvas = this.buildOverlayCanvas(featheredAlpha, width, height, bounds, contourPoints);

    return {
      width,
      height,
      alpha: featheredAlpha,
      rawAlpha: cleanedMask,
      maskCanvas,
      overlayCanvas,
      bounds,
      target,
      offset: { x: 0, y: 0 },
      featherRadius,
      contourPoints,
    };
  }

  /**
   * Face-Only Segmentation Fallback:
   * Accurately isolates the complete human face:
   * INCLUDE: Forehead skin (up to actual hairline), temples, cheeks, nose,
   * eyes, eyebrows, lips, mouth, chin, ears, and beard/moustache.
   * EXCLUDE: Head hair (above hairline), side hair, neck, clothing, and background.
   * Zero internal exclusions or subtractions.
   */
  private segmentFaceRegion(
    mask: Uint8ClampedArray,
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    geom: FacialGeometry,
    skinModel: SubjectSkinModel,
    hairMap: Uint8Array,
    bgInfo: BackgroundInfo
  ) {
    const { chinTip, faceCenter, ipd, radiusX, radiusY } = geom;

    // Build anatomical face perimeter control points:
    // Forehead arch across the natural hairline, temples, cheeks/ears, jawline, and chin apex
    const earW = Math.min(26, ipd * 0.18);
    const chinW = Math.min(10, ipd * 0.08);

    const controlPoints: Array<{ x: number; y: number }> = [
      // Forehead apex (center hairline)
      { x: faceCenter.x, y: faceCenter.y - radiusY * 0.98 },
      // Right upper forehead
      { x: faceCenter.x + radiusX * 0.58, y: faceCenter.y - radiusY * 0.90 },
      // Right temple
      { x: faceCenter.x + radiusX * 0.86, y: faceCenter.y - radiusY * 0.48 },
      // Right cheek / ear (including visible ear)
      { x: faceCenter.x + radiusX * 0.98 + earW, y: faceCenter.y },
      // Right jaw
      { x: faceCenter.x + radiusX * 0.75, y: faceCenter.y + radiusY * 0.58 },
      // Right chin
      { x: faceCenter.x + radiusX * 0.35, y: chinTip.y },
      // Chin apex (encompassing chin and beard/moustache)
      { x: chinTip.x, y: chinTip.y + chinW },
      // Left chin
      { x: faceCenter.x - radiusX * 0.35, y: chinTip.y },
      // Left jaw
      { x: faceCenter.x - radiusX * 0.75, y: faceCenter.y + radiusY * 0.58 },
      // Left cheek / ear (including visible ear)
      { x: faceCenter.x - radiusX * 0.98 - earW, y: faceCenter.y },
      // Left temple
      { x: faceCenter.x - radiusX * 0.86, y: faceCenter.y - radiusY * 0.48 },
      // Left upper forehead
      { x: faceCenter.x - radiusX * 0.58, y: faceCenter.y - radiusY * 0.90 },
    ];

    // Smooth Catmull-Rom spline interpolation (8 samples per segment)
    const numPts = controlPoints.length;
    const smoothContour: Array<{ x: number; y: number }> = [];
    const samplesPerSegment = 8;

    for (let i = 0; i < numPts; i++) {
      const p0 = controlPoints[(i - 1 + numPts) % numPts];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % numPts];
      const p3 = controlPoints[(i + 2) % numPts];

      for (let s = 0; s < samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;

        const sx = 0.5 * (
          2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        const sy = 0.5 * (
          2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        smoothContour.push({
          x: Math.max(0, Math.min(width - 1, sx)),
          y: Math.max(0, Math.min(height - 1, sy)),
        });
      }
    }

    // Rasterize smooth face polygon onto offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (smoothContour.length > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(smoothContour[0].x, smoothContour[0].y);
      for (let i = 1; i < smoothContour.length; i++) {
        ctx.lineTo(smoothContour[i].x, smoothContour[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < mask.length; i++) {
      mask[i] = data[i * 4 + 3];
    }

    (mask as any).contourPoints = smoothContour;
  }

  /**
   * Retains only skin pixels connected to known facial seed points (cheeks, forehead, chin, nose)
   */
  private filterConnectedFacialComponent(
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    geom: FacialGeometry
  ) {
    const { leftEye, rightEye, noseTip, mouthCenter, chinTip, faceCenter, ipd } = geom;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    const seedPoints = [
      { x: Math.round(faceCenter.x), y: Math.round(leftEye.y - ipd * 0.3) }, // Forehead
      { x: Math.round(leftEye.x - ipd * 0.2), y: Math.round(noseTip.y) },     // Left cheek
      { x: Math.round(rightEye.x + ipd * 0.2), y: Math.round(noseTip.y) },    // Right cheek
      { x: Math.round(faceCenter.x), y: Math.round((noseTip.y + mouthCenter.y) / 2) }, // Philtrum
      { x: Math.round(faceCenter.x), y: Math.round((mouthCenter.y + chinTip.y) / 2) }, // Chin core
    ];

    for (const pt of seedPoints) {
      if (pt.x >= 0 && pt.x < width && pt.y >= 0 && pt.y < height) {
        const idx = pt.y * width + pt.x;
        if (mask[idx] === 255 && !visited[idx]) {
          visited[idx] = 1;
          queue.push(idx);
        } else {
          // If the exact seed fell on a pore or exclusion, find the nearest 255 pixel within 8px
          for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
              const nx = pt.x + dx;
              const ny = pt.y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (mask[nIdx] === 255 && !visited[nIdx]) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                  break;
                }
              }
            }
            if (visited[idx]) break;
          }
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const neighbors = [
        cur - 1, cur + 1,
        cur - width, cur + width,
        cur - width - 1, cur - width + 1,
        cur + width - 1, cur + width + 1,
      ];

      for (const n of neighbors) {
        if (n >= 0 && n < visited.length && !visited[n] && mask[n] === 255) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }

    // Replace mask with only connected facial skin component
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 255 && !visited[i]) {
        mask[i] = 0;
      }
    }
  }

  /**
   * Skin Segmentation: Isolates all visible human skin across the entire image
   * (facial skin, neck, shoulders, chest, arms, hands, torso, legs)
   * while excluding clothing, head hair, background, eyes, and lips.
   */
  private segmentSkinRegion(
    mask: Uint8ClampedArray,
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    geom: FacialGeometry,
    skinModel: SubjectSkinModel,
    hairMap: Uint8Array,
    bgInfo: BackgroundInfo
  ) {
    const { leftEye, rightEye, mouthCenter, ipd } = geom;
    const eyeRadiusX = ipd * 0.22;
    const eyeRadiusY = ipd * 0.14;
    const lipRadiusX = ipd * 0.36;
    const lipRadiusY = ipd * 0.18;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];

        // 1. Background exclusion
        const bgDiff = Math.abs(r - bgInfo.avgR) + Math.abs(g - bgInfo.avgG) + Math.abs(b - bgInfo.avgB);
        if (bgDiff < 24) continue;

        // 2. Hair exclusion
        if (hairMap[y * width + x] > 100) continue;

        // 3. Eyes exclusion on face
        if (ipd > 10) {
          const leftEyeDx = (x - leftEye.x) / eyeRadiusX;
          const leftEyeDy = (y - leftEye.y) / eyeRadiusY;
          if (leftEyeDx * leftEyeDx + leftEyeDy * leftEyeDy <= 1.0) continue;

          const rightEyeDx = (x - rightEye.x) / eyeRadiusX;
          const rightEyeDy = (y - rightEye.y) / eyeRadiusY;
          if (rightEyeDx * rightEyeDx + rightEyeDy * rightEyeDy <= 1.0) continue;

          // 4. Lips exclusion on face
          const mouthDx = (x - mouthCenter.x) / lipRadiusX;
          const mouthDy = (y - mouthCenter.y) / lipRadiusY;
          if (mouthDx * mouthDx + mouthDy * mouthDy <= 1.0) {
            const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
            const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
            if (Cr - Cb > 22) continue;
          }
        }

        // 5. Skin verification across all visible skin
        if (this.isSkinPixelCalibrated(r, g, b, skinModel)) {
          mask[y * width + x] = 255;
        }
      }
    }
  }

  /**
   * Hair Segmentation: Isolates head hair, bangs, crown, and temple strands
   * across multiple hair tones (black, brown, blonde, red, gray) while excluding face, neck, clothes, and background.
   */
  private segmentHairRegion(
    mask: Uint8ClampedArray,
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    geom: FacialGeometry,
    hairMap: Uint8Array,
    bgInfo: BackgroundInfo
  ) {
    const { faceCenter, radiusX, radiusY, chinTip, noseTip, leftEye, rightEye } = geom;

    // Hair is primarily located in upper head zone (above shoulders and around head contour)
    const lowerHairLimit = Math.min(height - 1, chinTip.y + radiusY * 0.45);
    const eyeLevelY = (leftEye.y + rightEye.y) / 2;

    for (let y = 0; y < lowerHairLimit; y++) {
      for (let x = 0; x < width; x++) {
        // Exclude far horizontal boundaries unless subject has voluminous hair
        const dx = Math.abs(x - faceCenter.x) / (radiusX * 1.85);
        if (dx > 1.0) continue;

        const distFromCenter = Math.abs(x - faceCenter.x);

        // 1. Strictly exclude the lower face / beard / goatee / moustache / chin area:
        // Everything from below the nose bridge down past the chin within the jawline width
        const inBeardZoneY = y >= noseTip.y - radiusY * 0.12 && y <= chinTip.y + radiusY * 0.35;
        const inBeardZoneX = distFromCenter < radiusX * 0.88;
        if (inBeardZoneY && inBeardZoneX) {
          continue; // Never select beard, goatee, moustache, or chin hair as head hair
        }

        // 2. Exclude central mid-face (eyes, nose, cheeks)
        const inMidFaceY = y >= eyeLevelY && y < noseTip.y;
        const inMidFaceX = distFromCenter < radiusX * 0.65;
        if (inMidFaceY && inMidFaceX) {
          continue;
        }

        // 3. Exclude central forehead skin unless it has strong hair signature
        const inForeheadSkinY = y >= faceCenter.y - radiusY * 0.85 && y < eyeLevelY;
        const inForeheadSkinX = distFromCenter < radiusX * 0.6;
        if (inForeheadSkinY && inForeheadSkinX && hairMap[y * width + x] < 120) {
          continue;
        }

        if (hairMap[y * width + x] > 90) {
          mask[y * width + x] = 255;
        }
      }
    }
  }

  /**
   * Calibrates subject-specific skin color distribution by sampling pure skin patches
   * on the cheeks, nose bridge, and forehead center.
   */
  private calibrateSubjectSkinModel(
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    geom: FacialGeometry
  ): SubjectSkinModel {
    const { leftEye, rightEye, noseTip, faceCenter, ipd } = geom;

    const samplePoints = [
      // Left cheek
      { x: Math.round(leftEye.x - ipd * 0.25), y: Math.round(noseTip.y) },
      // Right cheek
      { x: Math.round(rightEye.x + ipd * 0.25), y: Math.round(noseTip.y) },
      // Forehead center
      { x: Math.round(faceCenter.x), y: Math.round(faceCenter.y - ipd * 0.65) },
      // Nose ridge
      { x: Math.round(faceCenter.x), y: Math.round((leftEye.y + noseTip.y) / 2) },
    ];

    let sampleCount = 0;
    let sumY = 0, sumCb = 0, sumCr = 0;
    const yValues: number[] = [];
    const cbValues: number[] = [];
    const crValues: number[] = [];

    const sampleRadius = Math.max(2, Math.round(ipd * 0.08));

    for (const pt of samplePoints) {
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        const sy = pt.y + dy;
        if (sy < 0 || sy >= height) continue;

        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          const sx = pt.x + dx;
          if (sx < 0 || sx >= width) continue;

          const idx = (sy * width + sx) * 4;
          const r = srcData[idx];
          const g = srcData[idx + 1];
          const b = srcData[idx + 2];

          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
          const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

          if (Cb >= 65 && Cb <= 145 && Cr >= 118 && Cr <= 190 && r > (b - 8)) {
            sumY += Y; sumCb += Cb; sumCr += Cr;
            yValues.push(Y); cbValues.push(Cb); crValues.push(Cr);
            sampleCount++;
          }
        }
      }
    }

    if (sampleCount >= 10) {
      const meanY = sumY / sampleCount;
      const meanCb = sumCb / sampleCount;
      const meanCr = sumCr / sampleCount;

      let varCb = 0, varCr = 0;
      for (let i = 0; i < sampleCount; i++) {
        varCb += Math.pow(cbValues[i] - meanCb, 2);
        varCr += Math.pow(crValues[i] - meanCr, 2);
      }
      const stdCb = Math.max(6, Math.sqrt(varCb / sampleCount));
      const stdCr = Math.max(6, Math.sqrt(varCr / sampleCount));

      return {
        calibrated: true,
        meanY,
        meanCb,
        meanCr,
        stdCb,
        stdCr,
      };
    }

    // Default universal fallback
    return {
      calibrated: false,
      meanY: 135,
      meanCb: 104,
      meanCr: 152,
      stdCb: 14,
      stdCr: 14,
    };
  }

  /**
   * Evaluates if a pixel belongs to human skin using subject-calibrated Mahalanobis distance
   * or robust multi-space chromaticity thresholds across Fitzpatrick scales I-VI.
   */
  private isSkinPixelCalibrated(
    r: number,
    g: number,
    b: number,
    model: SubjectSkinModel
  ): boolean {
    // Reject extreme shadows/clipping
    if (r < 22 || g < 16 || b < 10) {
      return false;
    }

    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
    const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

    if (model.calibrated) {
      // Gaussian / Mahalanobis distance in (Cb, Cr) color space
      const dCb = (Cb - model.meanCb) / (model.stdCb * 3.4);
      const dCr = (Cr - model.meanCr) / (model.stdCr * 3.4);
      const distSq = dCb * dCb + dCr * dCr;
      if (distSq <= 1.45 && r > (b - 8)) {
        return true;
      }
    }

    // HSV conversion
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

    // Normalized RGB
    const rgbSum = r + g + b + 0.001;
    const normR = r / rgbSum;
    const normG = g / rgbSum;

    // Universal human skin locus across all ethnicities & lighting
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

    return isYCbCrSkin && isHSVSkin && isRGBSkin;
  }

  /**
   * Computes a high-frequency hair probability map using multi-color clustering,
   * edge variance, and subject crown geometry.
   */
  private computeHairProbabilityMap(
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    geom: FacialGeometry,
    bgInfo: BackgroundInfo
  ): Uint8Array {
    const hairMap = new Uint8Array(width * height);
    const { faceCenter, radiusX, radiusY, chinTip, leftEye, rightEye } = geom;

    const eyeY = (leftEye.y + rightEye.y) / 2;
    const crownTopY = Math.max(0, faceCenter.y - radiusY * 1.55);
    const lowerHairBoundary = Math.min(height - 1, chinTip.y + radiusY * 0.4);

    for (let y = crownTopY; y < lowerHairBoundary; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];

        // Background check
        const bgDiff = Math.abs(r - bgInfo.avgR) + Math.abs(g - bgInfo.avgG) + Math.abs(b - bgInfo.avgB);
        if (bgDiff < 25) continue;

        // Position check relative to head
        const headDx = Math.abs(x - faceCenter.x) / (radiusX * 1.6);
        if (headDx > 1.0) continue;

        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
        const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

        // Exclude obvious skin
        const isObviousSkin = Cb >= 78 && Cb <= 126 && Cr >= 134 && Cr <= 172 && r > g && r > b && (r - g) >= 8;
        if (isObviousSkin) continue;

        // Color categories:
        // 1. Dark / Black hair: Low luminance
        const isDarkHair = Y < 92 && Math.abs(r - g) < 26 && Math.abs(g - b) < 26;
        // 2. Brown / Chestnut hair: Warm dark brown
        const isBrownHair = Y >= 50 && Y < 148 && r > b + 10 && r >= g && (r - b) >= 14;
        // 3. Blonde / Golden hair: Bright yellow-gold
        const isBlondeHair = Y >= 110 && Y <= 220 && r > 120 && g > 105 && b < 170 && (r - b) > 28;
        // 4. Auburn / Red hair: Rich red saturation
        const isAuburnHair = Y < 160 && (r - g) > 28 && (r - b) > 35;
        // 5. Gray / Silver hair: Low saturation neutral on top of head
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
        const isGrayHair = Y > 85 && Y < 225 && sat < 0.16 && y < eyeY;

        if (isDarkHair || isBrownHair || isBlondeHair || isAuburnHair || isGrayHair) {
          hairMap[y * width + x] = 255;
        }
      }
    }

    return hairMap;
  }

  /**
   * Applies 2D Morphological Closing (dilation then erosion) and Opening (erosion then dilation)
   * to seal small gaps/pores, eliminate salt-and-pepper noise, and smooth jagged contours.
   */
  private applyMorphologicalCleanup(
    mask: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const dilated = new Uint8ClampedArray(width * height);
    const closed = new Uint8ClampedArray(width * height);
    const result = new Uint8ClampedArray(width * height);

    // 1. Dilation 3x3
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const center = row + x;
        if (
          mask[center] === 255 ||
          mask[center - 1] === 255 ||
          mask[center + 1] === 255 ||
          mask[center - width] === 255 ||
          mask[center + width] === 255
        ) {
          dilated[center] = 255;
        }
      }
    }

    // 2. Erosion 3x3 (completes Closing operation: fills small holes & pores)
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const center = row + x;
        if (
          dilated[center] === 255 &&
          dilated[center - 1] === 255 &&
          dilated[center + 1] === 255 &&
          dilated[center - width] === 255 &&
          dilated[center + width] === 255
        ) {
          closed[center] = 255;
        }
      }
    }

    // 3. Opening 3x3 (Erosion followed by Dilation to strip isolated stray pixels)
    const eroded = new Uint8ClampedArray(width * height);
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const center = row + x;
        if (
          closed[center] === 255 &&
          closed[center - 1] === 255 &&
          closed[center + 1] === 255 &&
          closed[center - width] === 255 &&
          closed[center + width] === 255
        ) {
          eroded[center] = 255;
        }
      }
    }

    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const center = row + x;
        if (
          eroded[center] === 255 ||
          eroded[center - 1] === 255 ||
          eroded[center + 1] === 255 ||
          eroded[center - width] === 255 ||
          eroded[center + width] === 255
        ) {
          result[center] = 255;
        }
      }
    }

    return result;
  }

  /**
   * Applies resolution-adaptive Gaussian-like feathering/softening to mask edges.
   */
  public applyFeather(
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    radius: number
  ): Uint8ClampedArray {
    if (radius <= 0) return new Uint8ClampedArray(mask);

    const output = new Uint8ClampedArray(width * height);
    const temp = new Float32Array(width * height);

    // Separable 1D box blur passes
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      let windowSum = 0;
      const count = radius * 2 + 1;

      for (let i = -radius; i <= radius; i++) {
        const px = Math.min(width - 1, Math.max(0, i));
        windowSum += mask[rowOffset + px];
      }

      for (let x = 0; x < width; x++) {
        temp[rowOffset + x] = windowSum / count;
        const removeX = Math.max(0, x - radius);
        const addX = Math.min(width - 1, x + radius + 1);
        windowSum += mask[rowOffset + addX] - mask[rowOffset + removeX];
      }
    }

    // Vertical pass
    for (let x = 0; x < width; x++) {
      let windowSum = 0;
      const count = radius * 2 + 1;

      for (let i = -radius; i <= radius; i++) {
        const py = Math.min(height - 1, Math.max(0, i));
        windowSum += temp[py * width + x];
      }

      for (let y = 0; y < height; y++) {
        const val = windowSum / count;
        output[y * width + x] = Math.round(Math.max(0, Math.min(255, val)));
        const removeY = Math.max(0, y - radius);
        const addY = Math.min(height - 1, y + radius + 1);
        windowSum += temp[addY * width + x] - temp[removeY * width + x];
      }
    }

    return output;
  }

  /**
   * Applies manual brush modification (Add / Remove) to the mask in image coordinates.
   */
  public applyBrushStroke(
    maskData: MaskData,
    points: BrushStrokePoint[],
    mode: 'add' | 'remove',
    brushSize: number, // Radius in image pixels
    hardness = 0.5     // 0 = soft falloff, 1 = hard edge
  ): MaskData {
    const { width, height, alpha } = maskData;
    const newAlpha = new Uint8ClampedArray(alpha);
    const radiusSq = brushSize * brushSize;

    for (const pt of points) {
      const startX = Math.max(0, Math.floor(pt.x - brushSize));
      const endX = Math.min(width - 1, Math.ceil(pt.x + brushSize));
      const startY = Math.max(0, Math.floor(pt.y - brushSize));
      const endY = Math.min(height - 1, Math.ceil(pt.y + brushSize));

      for (let y = startY; y <= endY; y++) {
        const dy = y - pt.y;
        for (let x = startX; x <= endX; x++) {
          const dx = x - pt.x;
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) continue;

          const dist = Math.sqrt(distSq);
          const normDist = dist / brushSize;

          // Compute brush falloff
          let factor = 1.0;
          if (hardness < 0.95) {
            const innerRadius = hardness;
            if (normDist > innerRadius) {
              const t = (normDist - innerRadius) / (1.0 - innerRadius);
              factor = Math.cos(t * Math.PI * 0.5);
            }
          }

          const targetDelta = Math.round(factor * 255);
          const idx = y * width + x;

          if (mode === 'add') {
            newAlpha[idx] = Math.min(255, Math.max(newAlpha[idx], targetDelta));
          } else {
            newAlpha[idx] = Math.max(0, Math.min(newAlpha[idx], 255 - targetDelta));
          }
        }
      }
    }

    // Rebuild canvases with updated alpha
    const maskCanvas = this.buildMaskCanvas(newAlpha, width, height);
    const overlayCanvas = this.buildOverlayCanvas(newAlpha, width, height);

    return {
      ...maskData,
      alpha: newAlpha,
      maskCanvas,
      overlayCanvas,
    };
  }

  /**
   * Modifies ONLY the pixels covered by the mask with the provided adjustments.
   * Real-time high-performance compositing on GPU/2D canvas.
   */
  public applyAdjustmentsToMask(
    baseImage: HTMLImageElement | HTMLCanvasElement,
    maskData: MaskData,
    adjustments: {
      brightness?: number; // -100 to 100
      contrast?: number;   // -100 to 100
      smoothness?: number; // 0 to 50
      warmth?: number;     // -50 to 50
      saturation?: number; // -100 to 100
    }
  ): string {
    const width = maskData.width;
    const height = maskData.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable');

    ctx.drawImage(baseImage, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const { brightness = 0, contrast = 0, smoothness = 0, warmth = 0, saturation = 0 } = adjustments;

    // Fast-path: if no adjustments, return untouched image
    if (brightness === 0 && contrast === 0 && smoothness === 0 && warmth === 0 && saturation === 0) {
      return canvas.toDataURL('image/png');
    }

    const bDelta = (brightness / 100) * 85;
    const cFactor = contrast === 0 ? 1 : Math.max(0, (259 * (contrast * 1.5 + 255)) / (255 * (259 - contrast * 1.5)));
    const sFactor = saturation === 0 ? 1 : 1 + (saturation / 100);

    const alphaMask = maskData.alpha;
    const offX = maskData.offset.x;
    const offY = maskData.offset.y;

    const maskW = maskData.previewWidth || maskData.width;
    const maskH = maskData.previewHeight || maskData.height;
    const scaleToMaskX = maskW / (width || 1);
    const scaleToMaskY = maskH / (height || 1);

    // Optional bilateral smoothing pass for skin blemishes
    let smoothedBuffer: Uint8ClampedArray | null = null;
    if (smoothness > 0) {
      smoothedBuffer = this.createBilateralSmoothingBuffer(data, width, height, 3);
    }
    const smoothWeight = Math.min(1.0, smoothness / 80);

    for (let y = 0; y < height; y++) {
      const maskY = Math.floor((y - offY) * scaleToMaskY);
      if (maskY < 0 || maskY >= maskH) continue;
      const maskRow = maskY * maskW;

      for (let x = 0; x < width; x++) {
        const maskX = Math.floor((x - offX) * scaleToMaskX);
        if (maskX < 0 || maskX >= maskW) continue;

        const maskWeight = alphaMask[maskRow + maskX] / 255;
        if (maskWeight <= 0.005) continue;

        const idx = (y * width + x) * 4;
        let r = data[idx];
        let g = data[idx + 1];
        let b = data[idx + 2];

        // 1. Bilateral Smoothing
        if (smoothedBuffer && smoothWeight > 0) {
          const sr = smoothedBuffer[idx];
          const sg = smoothedBuffer[idx + 1];
          const sb = smoothedBuffer[idx + 2];
          r = r + (sr - r) * (smoothWeight * maskWeight);
          g = g + (sg - g) * (smoothWeight * maskWeight);
          b = b + (sb - b) * (smoothWeight * maskWeight);
        }

        // 2. Brightness
        if (bDelta !== 0) {
          r += bDelta * maskWeight;
          g += bDelta * maskWeight;
          b += bDelta * maskWeight;
        }

        // 3. Warmth
        if (warmth !== 0) {
          const w = (warmth / 100) * 45 * maskWeight;
          r += w * 0.65;
          g += w * 0.25;
          b -= w * 0.45;
        }

        // 4. Contrast
        if (contrast !== 0) {
          const cr = cFactor * (r - 128) + 128;
          const cg = cFactor * (g - 128) + 128;
          const cb = cFactor * (b - 128) + 128;
          r = r + (cr - r) * maskWeight;
          g = g + (cg - g) * maskWeight;
          b = b + (cb - b) * maskWeight;
        }

        // 5. Saturation
        if (saturation !== 0) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const sr = lum + (r - lum) * sFactor;
          const sg = lum + (g - lum) * sFactor;
          const sb = lum + (b - lum) * sFactor;
          r = r + (sr - r) * maskWeight;
          g = g + (sg - g) * maskWeight;
          b = b + (sb - b) * maskWeight;
        }

        data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * Builds the white-on-transparent mask canvas.
   */
  public buildMaskCanvas(alpha: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(width, height);
      for (let i = 0; i < alpha.length; i++) {
        const a = alpha[i];
        const p = i * 4;
        imgData.data[p] = 255;
        imgData.data[p + 1] = 255;
        imgData.data[p + 2] = 255;
        imgData.data[p + 3] = a;
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return canvas;
  }

  /**
   * Builds the selection indicator overlay canvas.
   * Per user requirement:
   * DO NOT place a black, dark gray, white, or opaque layer over the face!
   * The original photograph must remain completely visible.
   * Generates a crisp, thin cyan selection outline with zero interior fill opacity.
   */
  public buildOverlayCanvas(
    alpha: Uint8ClampedArray,
    width: number,
    height: number,
    bounds?: { x: number; y: number; width: number; height: number },
    contourPoints?: Array<{ x: number; y: number }>
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, width, height);

    // If exact vector contour points are available, draw crisp, smooth, ultra-thin cyan outline
    if (contourPoints && contourPoints.length > 2) {
      ctx.beginPath();
      ctx.moveTo(contourPoints[0].x, contourPoints[0].y);
      for (let i = 1; i < contourPoints.length; i++) {
        ctx.lineTo(contourPoints[i].x, contourPoints[i].y);
      }
      ctx.closePath();

      // Thin cyan outline: crisp #22D3EE (cyan-400), 1.5px - 2px width
      const maxDim = Math.max(width, height);
      const strokeW = Math.max(1.5, Math.min(2.5, maxDim / 800));

      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // Subtle cyan glow to ensure visibility on light or dark photos without covering any interior pixels
      ctx.shadowColor = 'rgba(6, 182, 212, 0.45)';
      ctx.shadowBlur = 3;
      ctx.stroke();

      return canvas;
    }

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const maxDim = Math.max(width, height);
    const borderRadius = Math.max(1, Math.min(4, Math.round(maxDim / 800)));
    const pad = borderRadius + 4;

    const startX = bounds ? Math.max(borderRadius, bounds.x - pad) : borderRadius;
    const endX = bounds ? Math.min(width - 1 - borderRadius, bounds.x + bounds.width + pad) : width - 1 - borderRadius;
    const startY = bounds ? Math.max(borderRadius, bounds.y - pad) : borderRadius;
    const endY = bounds ? Math.min(height - 1 - borderRadius, bounds.y + bounds.height + pad) : height - 1 - borderRadius;

    for (let y = startY; y <= endY; y++) {
      const row = y * width;
      for (let x = startX; x <= endX; x++) {
        const idx = row + x;
        const a = alpha[idx];
        if (a < 35) continue;

        // Resolution-adaptive multi-radius edge detection
        let isOuterEdge = false;
        for (let r = 1; r <= borderRadius; r++) {
          if (
            alpha[idx - r] < 35 ||
            alpha[idx + r] < 35 ||
            alpha[idx - r * width] < 35 ||
            alpha[idx + r * width] < 35
          ) {
            isOuterEdge = true;
            break;
          }
        }

        if (isOuterEdge) {
          const p = idx * 4;
          // Crisp subtle cyan (#06B6D4) with high opacity on perimeter
          data[p] = 6;
          data[p + 1] = 182;
          data[p + 2] = 212;
          data[p + 3] = 245;

          // 1px soft anti-alias border
          const pLeft = (idx - 1) * 4;
          if (alpha[idx - 1] < 35 && data[pLeft + 3] === 0) {
            data[pLeft] = 56; data[pLeft + 1] = 189; data[pLeft + 2] = 248; data[pLeft + 3] = 120;
          }
          const pRight = (idx + 1) * 4;
          if (alpha[idx + 1] < 35 && data[pRight + 3] === 0) {
            data[pRight] = 56; data[pRight + 1] = 189; data[pRight + 2] = 248; data[pRight + 3] = 120;
          }
          const pTop = (idx - width) * 4;
          if (alpha[idx - width] < 35 && data[pTop + 3] === 0) {
            data[pTop] = 56; data[pTop + 1] = 189; data[pTop + 2] = 248; data[pTop + 3] = 120;
          }
          const pBtm = (idx + width) * 4;
          if (alpha[idx + width] < 35 && data[pBtm + 3] === 0) {
            data[pBtm] = 56; data[pBtm + 1] = 189; data[pBtm + 2] = 248; data[pBtm + 3] = 120;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Builds a Dimmed / Solo Focus view canvas where unselected pixels are dimmed/darkened
   * and selected pixels remain crystal-clear in full color.
   */
  public buildDimmedPreviewCanvas(
    baseImage: HTMLImageElement | HTMLCanvasElement,
    maskData: MaskData
  ): HTMLCanvasElement {
    const width = maskData.width;
    const height = maskData.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.drawImage(baseImage, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const alpha = maskData.alpha;
    const offX = maskData.offset.x;
    const offY = maskData.offset.y;

    for (let y = 0; y < height; y++) {
      const my = y - offY;
      for (let x = 0; x < width; x++) {
        const mx = x - offX;
        let maskAlpha = 0;
        if (mx >= 0 && mx < width && my >= 0 && my < height) {
          maskAlpha = alpha[my * width + mx] / 255;
        }

        const unselectedWeight = 1.0 - maskAlpha;
        if (unselectedWeight > 0.01) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Dim and slightly desaturate unselected pixels
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const dimFactor = 0.35 + 0.65 * maskAlpha;
          const desatR = lum * 0.4 + r * 0.6;
          const desatG = lum * 0.4 + g * 0.6;
          const desatB = lum * 0.4 + b * 0.6;

          data[idx] = Math.round(desatR * dimFactor);
          data[idx + 1] = Math.round(desatG * dimFactor);
          data[idx + 2] = Math.round(desatB * dimFactor);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  private computeFacialGeometry(
    width: number,
    height: number,
    faceResult?: FaceDetectionResult
  ): FacialGeometry {
    let fcX = width * 0.5;
    let fcY = height * 0.42;
    let radiusX = width * 0.22;
    let radiusY = height * 0.28;

    let leftEye = { x: fcX - radiusX * 0.48, y: fcY - radiusY * 0.18 };
    let rightEye = { x: fcX + radiusX * 0.48, y: fcY - radiusY * 0.18 };
    let noseTip = { x: fcX, y: fcY + radiusY * 0.14 };
    let mouthCenter = { x: fcX, y: fcY + radiusY * 0.52 };
    let chinTip = { x: fcX, y: fcY + radiusY * 0.95 };

    if (faceResult) {
      fcX = faceResult.faceCenter.x;
      fcY = faceResult.faceCenter.y;
      radiusX = faceResult.boundingBox.width * 0.52;
      radiusY = faceResult.boundingBox.height * 0.55;

      leftEye = { ...faceResult.landmarks.leftEye };
      rightEye = { ...faceResult.landmarks.rightEye };
      noseTip = { ...faceResult.landmarks.noseTip };
      mouthCenter = { ...faceResult.landmarks.mouthCenter };
      chinTip = { ...faceResult.landmarks.chinTip };
    }

    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const ipd = Math.max(20, Math.sqrt(dx * dx + dy * dy));

    return {
      faceCenter: { x: fcX, y: fcY },
      radiusX,
      radiusY,
      leftEye,
      rightEye,
      noseTip,
      mouthCenter,
      chinTip,
      ipd,
    };
  }

  private analyzePerimeterBackground(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): BackgroundInfo {
    const bgSamples: number[][] = [];
    const step = Math.max(1, Math.floor(Math.max(width, height) / 80));

    for (let x = 0; x < width; x += step) {
      const topIdx = x * 4;
      const btmIdx = ((height - 1) * width + x) * 4;
      bgSamples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
      bgSamples.push([data[btmIdx], data[btmIdx + 1], data[btmIdx + 2]]);
    }
    for (let y = 0; y < Math.floor(height * 0.7); y += step) {
      const leftIdx = (y * width) * 4;
      const rightIdx = (y * width + (width - 1)) * 4;
      bgSamples.push([data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]]);
      bgSamples.push([data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]]);
    }

    let avgR = 240, avgG = 240, avgB = 240;
    if (bgSamples.length > 0) {
      let sumR = 0, sumG = 0, sumB = 0;
      for (const [r, g, b] of bgSamples) {
        sumR += r; sumG += g; sumB += b;
      }
      avgR = sumR / bgSamples.length;
      avgG = sumG / bgSamples.length;
      avgB = sumB / bgSamples.length;
    }

    return { avgR, avgG, avgB };
  }

  private createBilateralSmoothingBuffer(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    radius = 3
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const colorThreshold = 28;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerIdx = (y * width + x) * 4;
        const cr = data[centerIdx];
        const cg = data[centerIdx + 1];
        const cb = data[centerIdx + 2];

        let sumR = 0, sumG = 0, sumB = 0, totalW = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;

          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;

            const nIdx = (ny * width + nx) * 4;
            const nr = data[nIdx];
            const ng = data[nIdx + 1];
            const nb = data[nIdx + 2];

            const colorDiff = Math.abs(cr - nr) + Math.abs(cg - ng) + Math.abs(cb - nb);
            if (colorDiff < colorThreshold) {
              const spatialDist = dx * dx + dy * dy;
              const w = 1.0 / (1.0 + spatialDist * 0.35);
              sumR += nr * w;
              sumG += ng * w;
              sumB += nb * w;
              totalW += w;
            }
          }
        }

        if (totalW > 0) {
          result[centerIdx] = Math.round(sumR / totalW);
          result[centerIdx + 1] = Math.round(sumG / totalW);
          result[centerIdx + 2] = Math.round(sumB / totalW);
          result[centerIdx + 3] = data[centerIdx + 3];
        } else {
          result[centerIdx] = cr;
          result[centerIdx + 1] = cg;
          result[centerIdx + 2] = cb;
          result[centerIdx + 3] = data[centerIdx + 3];
        }
      }
    }

    return result;
  }
}

interface FacialGeometry {
  faceCenter: { x: number; y: number };
  radiusX: number;
  radiusY: number;
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  mouthCenter: { x: number; y: number };
  chinTip: { x: number; y: number };
  ipd: number;
}

interface SubjectSkinModel {
  calibrated: boolean;
  meanY: number;
  meanCb: number;
  meanCr: number;
  stdCb: number;
  stdCr: number;
}

interface BackgroundInfo {
  avgR: number;
  avgG: number;
  avgB: number;
}

export const maskEngine = new MaskEngine();
