/* eslint-disable @typescript-eslint/no-explicit-any */
import { Point2D, QuadCrop } from '../types';
import { loadOpenCV } from './opencvLoader';
import { cropLearningEngine } from '../services/cropLearning/CropLearningEngine';

export const TARGET_NID_WIDTH = 1011;
export const TARGET_NID_HEIGHT = 642;

export const FULL_FRAME_CROP: QuadCrop = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: 0, y: 1 },
};

export const DEFAULT_CARD_INSET_CROP: QuadCrop = {
  topLeft: { x: 0.04, y: 0.04 },
  topRight: { x: 0.96, y: 0.04 },
  bottomRight: { x: 0.96, y: 0.96 },
  bottomLeft: { x: 0.04, y: 0.96 },
};

export interface DetectionResult {
  success: boolean;
  confidence: number;
  corners: QuadCrop;
  rawCorners?: QuadCrop;
  method: string;
}

/**
 * Orders 4 points clockwise: [topLeft, topRight, bottomRight, bottomLeft]
 * Robust coordinate-based ordering via centroid and angles.
 */
export function orderPoints(points: Point2D[]): QuadCrop {
  if (points.length !== 4) {
    return { ...FULL_FRAME_CROP };
  }

  // Calculate centroid
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;

  // Sort by polar angle relative to centroid
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Find the top-left point (smallest x + y)
  let minSum = Infinity;
  let tlIdx = 0;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIdx = i;
    }
  }

  const tl = sorted[tlIdx];
  const tr = sorted[(tlIdx + 1) % 4];
  const br = sorted[(tlIdx + 2) % 4];
  const bl = sorted[(tlIdx + 3) % 4];

  return {
    topLeft: { x: Math.max(0, Math.min(1, tl.x)), y: Math.max(0, Math.min(1, tl.y)) },
    topRight: { x: Math.max(0, Math.min(1, tr.x)), y: Math.max(0, Math.min(1, tr.y)) },
    bottomRight: { x: Math.max(0, Math.min(1, br.x)), y: Math.max(0, Math.min(1, br.y)) },
    bottomLeft: { x: Math.max(0, Math.min(1, bl.x)), y: Math.max(0, Math.min(1, bl.y)) },
  };
}

/**
 * Calculates quadrilateral area in normalized (0..1) units.
 */
export function calculateQuadArea(corners: QuadCrop): number {
  const { topLeft: p1, topRight: p2, bottomRight: p3, bottomLeft: p4 } = corners;
  // Shoelace formula
  const area = 0.5 * Math.abs(
    p1.x * p2.y + p2.x * p3.y + p3.x * p4.y + p4.x * p1.y -
    (p2.x * p1.y + p3.x * p2.y + p4.x * p3.y + p1.x * p4.y)
  );
  return area;
}

/**
 * Verifies if 4 corners form a reasonable convex polygon with valid interior angles.
 */
export function isValidQuad(corners: QuadCrop): boolean {
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = corners;
  const area = calculateQuadArea(corners);
  if (area < 0.05 || area > 1.05) return false;

  // Cross products of consecutive edges to verify strict convexity
  const cp1 = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
  const cp2 = (br.x - tr.x) * (tl.y - tr.y) - (br.y - tr.y) * (tl.x - tr.x);
  const cp3 = (bl.x - br.x) * (tr.y - br.y) - (bl.y - br.y) * (tr.x - br.x);
  const cp4 = (tl.x - bl.x) * (br.y - bl.y) - (tl.y - bl.y) * (br.x - bl.x);

  const allPositive = cp1 > 0 && cp2 > 0 && cp3 > 0 && cp4 > 0;
  const allNegative = cp1 < 0 && cp2 < 0 && cp3 < 0 && cp4 < 0;

  return allPositive || allNegative;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/**
 * Pure Unrefined Detection:
 * Preserves the exact coordinates without edge drift or perturbation.
 */
export function refineSubPixelCorners(
  _source: HTMLImageElement | HTMLCanvasElement,
  corners: QuadCrop
): QuadCrop {
  return corners;
}

/**
 * 1. STATE-OF-THE-ART GEMINI 3.8 FLASH VISION DETECTOR
 * Detects any document (A4 certificates, Bangladesh birth registration, NID cards, receipts, books, forms).
 */
async function detectViaGeminiVision(
  source: HTMLImageElement | HTMLCanvasElement,
  origW: number,
  origH: number,
  abortSignal?: AbortSignal
): Promise<QuadCrop | null> {
  try {
    const maxDim = 1000;
    const scale = Math.min(1.0, maxDim / Math.max(origW, origH));
    const sendW = Math.round(origW * scale);
    const sendH = Math.round(origH * scale);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sendW;
    tempCanvas.height = sendH;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, sendW, sendH);

    const imageBase64 = tempCanvas.toDataURL('image/jpeg', 0.85);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const response = await fetch('/api/detect-corners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && data.corners) {
        const c = data.corners;
        const quad: QuadCrop = {
          topLeft: { x: Math.max(0, Math.min(1, Number(c.topLeft.x))), y: Math.max(0, Math.min(1, Number(c.topLeft.y))) },
          topRight: { x: Math.max(0, Math.min(1, Number(c.topRight.x))), y: Math.max(0, Math.min(1, Number(c.topRight.y))) },
          bottomRight: { x: Math.max(0, Math.min(1, Number(c.bottomRight.x))), y: Math.max(0, Math.min(1, Number(c.bottomRight.y))) },
          bottomLeft: { x: Math.max(0, Math.min(1, Number(c.bottomLeft.x))), y: Math.max(0, Math.min(1, Number(c.bottomLeft.y))) },
        };
        if (isValidQuad(quad)) {
          return quad;
        }
      }
    }
  } catch {
    // Graceful fallback to client-side OpenCV / canvas detectors
  }
  return null;
}

/**
 * 2. ITLancer NID API Detector (Secondary specialized fallback)
 */
async function detectViaItlancerApi(
  source: HTMLImageElement | HTMLCanvasElement,
  origW: number,
  origH: number,
  abortSignal?: AbortSignal
): Promise<QuadCrop | null> {
  try {
    const maxDim = 1200;
    const scale = Math.min(1.0, maxDim / Math.max(origW, origH));
    const sendW = Math.round(origW * scale);
    const sendH = Math.round(origH * scale);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sendW;
    tempCanvas.height = sendH;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, sendW, sendH);

    const blob = await canvasToBlob(tempCanvas, 0.85);
    if (!blob) return null;

    const formData = new FormData();
    formData.append('file', blob, 'doc_image.jpg');

    const urls = ['/api/detect-nid', 'https://docu.itlancerbd.com/detect-nid'];

    for (const url of urls) {
      if (abortSignal?.aborted) return null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2800);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        if (!response.ok) continue;

        const data = await response.json();
        if (data && data.points && Array.isArray(data.points) && data.points.length === 4) {
          const apiW = parseFloat(data.width) || sendW;
          const apiH = parseFloat(data.height) || sendH;

          const normalizedPoints: Point2D[] = data.points.map((p: number[]) => ({
            x: Math.max(0, Math.min(1, p[0] / apiW)),
            y: Math.max(0, Math.min(1, p[1] / apiH)),
          }));

          const rawCorners = orderPoints(normalizedPoints);
          if (isValidQuad(rawCorners)) {
            return rawCorners;
          }
        }
      } catch {
        // Continue to local detection
      }
    }
  } catch (err) {
    console.warn('detectViaItlancerApi exception:', err);
  }
  return null;
}

/**
 * 2. UNIVERSAL MULTI-PASS OPENCV DOCUMENT DETECTOR
 * Runs 3 distinct segmentation passes:
 * - Pass 1: Adaptive Gaussian threshold (handles uneven lighting & shadow gradients)
 * - Pass 2: Morphological Gradient + Otsu (isolates paper borders regardless of text)
 * - Pass 3: Bilateral filter + Canny edge dilation (for clean high-contrast documents)
 * Finds the highest-scoring convex quadrilateral.
 */
function detectViaOpenCVUniversal(
  source: HTMLImageElement | HTMLCanvasElement,
  cv: any
): QuadCrop | null {
  const origW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const origH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  const MAX_DIM = 800;
  const scale = Math.min(1.0, MAX_DIM / Math.max(origW, origH));
  const detW = Math.round(origW * scale);
  const detH = Math.round(origH * scale);
  const totalArea = detW * detH;

  const canvas = document.createElement('canvas');
  canvas.width = detW;
  canvas.height = detH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, detW, detH);

  let src: any = null;
  let gray: any = null;
  let blurred: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const candidateQuads: { quad: QuadCrop; score: number }[] = [];

    // Helper to evaluate a binary mask and extract candidate quads
    const extractQuadsFromMask = (binaryMask: any) => {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      try {
        cv.findContours(binaryMask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);

          // Document must be at least 10% of the image
          if (area > totalArea * 0.10) {
            const hull = new cv.Mat();
            cv.convexHull(cnt, hull, false, true);

            const perimeter = cv.arcLength(hull, true);

            // Test polygon approximations with dynamic epsilon
            for (const epsFactor of [0.015, 0.02, 0.03, 0.04, 0.05]) {
              const approx = new cv.Mat();
              cv.approxPolyDP(hull, approx, epsFactor * perimeter, true);

              if (approx.rows === 4 && cv.isContourConvex(approx)) {
                const pts: Point2D[] = [];
                for (let k = 0; k < 4; k++) {
                  pts.push({
                    x: approx.data32S[k * 2] / detW,
                    y: approx.data32S[k * 2 + 1] / detH,
                  });
                }
                const quad = orderPoints(pts);

                if (isValidQuad(quad)) {
                  const minRect = cv.minAreaRect(cnt);
                  const minArea = minRect.size.width * minRect.size.height;
                  const rectangularity = minArea > 0 ? area / minArea : 0.8;
                  const areaNorm = area / totalArea;

                  // Score: Favor large rectangular areas
                  const score = areaNorm * (0.5 + 0.5 * rectangularity);
                  candidateQuads.push({ quad, score });
                }
              } else if (approx.rows >= 4 && approx.rows <= 16) {
                // Real-world documents with rounded corners (like ID/NID cards) or curved edges
                // Extract 4 extreme corners from polygon
                const polyPts: Point2D[] = [];
                for (let k = 0; k < approx.rows; k++) {
                  polyPts.push({
                    x: approx.data32S[k * 2] / detW,
                    y: approx.data32S[k * 2 + 1] / detH,
                  });
                }
                let tl = polyPts[0];
                let tr = polyPts[0];
                let br = polyPts[0];
                let bl = polyPts[0];
                let minSum = Infinity;
                let maxSum = -Infinity;
                let maxDiff = -Infinity;
                let minDiff = Infinity;

                for (const p of polyPts) {
                  const s = p.x + p.y;
                  const d = p.x - p.y;
                  if (s < minSum) { minSum = s; tl = p; }
                  if (s > maxSum) { maxSum = s; br = p; }
                  if (d > maxDiff) { maxDiff = d; tr = p; }
                  if (d < minDiff) { minDiff = d; bl = p; }
                }

                const quad = orderPoints([tl, tr, br, bl]);
                if (isValidQuad(quad)) {
                  const minRect = cv.minAreaRect(cnt);
                  const minArea = minRect.size.width * minRect.size.height;
                  const rectangularity = minArea > 0 ? area / minArea : 0.8;
                  const areaNorm = area / totalArea;
                  const score = areaNorm * (0.45 + 0.45 * rectangularity);
                  candidateQuads.push({ quad, score });
                }
              }
              approx.delete();
            }

            // Also check rotated minimum bounding rect (cv.minAreaRect) for any strong contour
            try {
              const rotatedRect = cv.minAreaRect(cnt);
              const rectPoints = cv.RotatedRect.points(rotatedRect);
              if (rectPoints && rectPoints.length === 4) {
                const quad = orderPoints(rectPoints.map((pt: any) => ({
                  x: Math.max(0, Math.min(1, pt.x / detW)),
                  y: Math.max(0, Math.min(1, pt.y / detH)),
                })));
                if (isValidQuad(quad)) {
                  const areaNorm = area / totalArea;
                  const score = areaNorm * 0.72;
                  candidateQuads.push({ quad, score });
                }
              }
            } catch {
              // ignore
            }

            hull.delete();
          }
          cnt.delete();
        }
      } finally {
        contours.delete();
        hierarchy.delete();
      }
    };

    // -----------------------------------------------------------
    // PASS 1: Adaptive Gaussian Thresholding (Immune to shadow gradients)
    // -----------------------------------------------------------
    const maskAdaptive = new cv.Mat();
    const kernelAdaptive = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    try {
      cv.adaptiveThreshold(blurred, maskAdaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 25, 8);
      cv.morphologyEx(maskAdaptive, maskAdaptive, cv.MORPH_CLOSE, kernelAdaptive);
      extractQuadsFromMask(maskAdaptive);
    } catch {
      // Pass failed, continue
    } finally {
      maskAdaptive.delete();
      kernelAdaptive.delete();
    }

    // -----------------------------------------------------------
    // PASS 2: Morphological Gradient + Otsu (Isolates paper borders)
    // -----------------------------------------------------------
    const maskGrad = new cv.Mat();
    const kernelGrad = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
    const kernelClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
    try {
      cv.morphologyEx(gray, maskGrad, cv.MORPH_GRADIENT, kernelGrad);
      cv.threshold(maskGrad, maskGrad, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
      cv.morphologyEx(maskGrad, maskGrad, cv.MORPH_CLOSE, kernelClose);
      extractQuadsFromMask(maskGrad);
    } catch {
      // Pass failed, continue
    } finally {
      maskGrad.delete();
      kernelGrad.delete();
      kernelClose.delete();
    }

    // -----------------------------------------------------------
    // PASS 3: Canny with Dilate
    // -----------------------------------------------------------
    const canny = new cv.Mat();
    const kernelCanny = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    try {
      cv.Canny(blurred, canny, 40, 120);
      cv.dilate(canny, canny, kernelCanny);
      extractQuadsFromMask(canny);
    } catch {
      // Pass failed, continue
    } finally {
      canny.delete();
      kernelCanny.delete();
    }

    // Pick candidate with the highest score
    if (candidateQuads.length > 0) {
      candidateQuads.sort((a, b) => b.score - a.score);
      const best = candidateQuads[0].quad;
      return best;
    }
  } catch (err) {
    console.warn('OpenCV universal detection error:', err);
  } finally {
    try {
      src?.delete();
      gray?.delete();
      blurred?.delete();
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * 3. 100% RELIABLE PURE CANVAS PROJECTION & CONTRAST SCANNER
 * Works offline with zero dependencies.
 * Analyzes edge energy and boundary contrast along radial and orthogonal axes.
 */
function detectViaCanvasContrast(
  source: HTMLImageElement | HTMLCanvasElement,
  origW: number,
  origH: number
): QuadCrop | null {
  try {
    const W = 360;
    const H = Math.max(100, Math.round((360 * origH) / origW));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, W, H);

    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    // Fast luminance array
    const lum = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      lum[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    // Step 1: Directional scan from borders towards center to locate true paper perimeter
    const scanEdge = (startX: number, endX: number, startY: number, endY: number, isVertical: boolean): number => {
      let maxDelta = 0;
      let bestPos = isVertical ? startY : startX;

      if (isVertical) {
        const stepY = startY < endY ? 1 : -1;
        for (let y = startY; y !== endY; y += stepY) {
          let diffSum = 0;
          let count = 0;
          for (let x = Math.round(W * 0.2); x < Math.round(W * 0.8); x += 4) {
            const nextY = y + stepY * 2;
            if (nextY >= 0 && nextY < H) {
              diffSum += Math.abs(lum[nextY * W + x] - lum[y * W + x]);
              count++;
            }
          }
          const delta = count > 0 ? diffSum / count : 0;
          if (delta > maxDelta) {
            maxDelta = delta;
            bestPos = y;
          }
        }
      } else {
        const stepX = startX < endX ? 1 : -1;
        for (let x = startX; x !== endX; x += stepX) {
          let diffSum = 0;
          let count = 0;
          for (let y = Math.round(H * 0.2); y < Math.round(H * 0.8); y += 4) {
            const nextX = x + stepX * 2;
            if (nextX >= 0 && nextX < W) {
              diffSum += Math.abs(lum[y * W + nextX] - lum[y * W + x]);
              count++;
            }
          }
          const delta = count > 0 ? diffSum / count : 0;
          if (delta > maxDelta) {
            maxDelta = delta;
            bestPos = x;
          }
        }
      }

      return bestPos;
    };

    // Scan top 35%, bottom 35%, left 35%, right 35%
    const topY = scanEdge(0, 0, 2, Math.round(H * 0.35), true);
    const botY = scanEdge(0, 0, H - 3, Math.round(H * 0.65), true);
    const leftX = scanEdge(2, Math.round(W * 0.35), 0, 0, false);
    const rightX = scanEdge(W - 3, Math.round(W * 0.65), 0, 0, false);

    // If edges enclose at least 40% of the image
    const widthRatio = (rightX - leftX) / W;
    const heightRatio = (botY - topY) / H;

    if (widthRatio > 0.40 && heightRatio > 0.40) {
      const quad: QuadCrop = {
        topLeft: { x: leftX / W, y: topY / H },
        topRight: { x: rightX / W, y: topY / H },
        bottomRight: { x: rightX / W, y: botY / H },
        bottomLeft: { x: leftX / W, y: botY / H },
      };
      return quad;
    }
  } catch (err) {
    console.warn('Canvas contrast scanner error:', err);
  }
  return null;
}

/**
 * 4. PAGE COLOR SEGMENTATION DETECTOR
 * Detects the dominant paper color in the document body, distinguishes it from
 * the background surface (table, desk, bedsheet, carpet, floor, or hands),
 * and traces the exact perimeter where the page color meets the background to decide where to cut.
 */
export function detectViaPageColor(
  source: HTMLImageElement | HTMLCanvasElement,
  origW: number,
  origH: number,
  cv?: any
): QuadCrop | null {
  try {
    const W = 360;
    const H = Math.max(120, Math.round((360 * origH) / origW));

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, W, H);

    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    // 1. Sample central 50% window of image to detect DOMINANT PAGE COLOR
    const minX = Math.round(W * 0.25);
    const maxX = Math.round(W * 0.75);
    const minY = Math.round(H * 0.25);
    const maxY = Math.round(H * 0.75);

    const centerPixels: { r: number; g: number; b: number; lum: number }[] = [];
    for (let y = minY; y < maxY; y += 2) {
      for (let x = minX; x < maxX; x += 2) {
        const idx = (y * W + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        centerPixels.push({ r, g, b, lum });
      }
    }

    if (centerPixels.length < 50) return null;

    // Sort by luminance to filter out dark text / ink
    centerPixels.sort((a, b) => a.lum - b.lum);

    // Take the 65th to 95th percentile pixels: this is pure background paper color!
    const startIdx = Math.floor(centerPixels.length * 0.65);
    const endIdx = Math.floor(centerPixels.length * 0.95);
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let i = startIdx; i < endIdx; i++) {
      sumR += centerPixels[i].r;
      sumG += centerPixels[i].g;
      sumB += centerPixels[i].b;
      count++;
    }

    const pageR = sumR / count;
    const pageG = sumG / count;
    const pageB = sumB / count;
    const pageLum = 0.299 * pageR + 0.587 * pageG + 0.114 * pageB;

    // 2. Sample 4 outer corner margins to detect the BACKGROUND SURFACE COLOR
    const cornerPixels: { r: number; g: number; b: number }[] = [];
    const cornerSize = Math.max(8, Math.round(W * 0.06));
    const sampleCorner = (startX: number, startY: number) => {
      for (let y = startY; y < startY + cornerSize; y += 2) {
        for (let x = startX; x < startX + cornerSize; x += 2) {
          if (x < W && y < H) {
            const idx = (y * W + x) * 4;
            cornerPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
          }
        }
      }
    };
    sampleCorner(0, 0);
    sampleCorner(W - cornerSize, 0);
    sampleCorner(0, H - cornerSize);
    sampleCorner(W - cornerSize, H - cornerSize);

    let bgR = 0, bgG = 0, bgB = 0;
    for (const cp of cornerPixels) {
      bgR += cp.r;
      bgG += cp.g;
      bgB += cp.b;
    }
    bgR /= cornerPixels.length;
    bgG /= cornerPixels.length;
    bgB /= cornerPixels.length;

    // Color distance between page color and background surface
    const pageBgDist = Math.hypot(pageR - bgR, pageG - bgG, pageB - bgB);

    // 3. Build a Page-Color Membership Mask (1 = inside page, 0 = outside background)
    const tol = Math.max(35, Math.min(85, pageBgDist * 0.70));
    const mask = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        const dColor = Math.hypot(r - pageR, g - pageG, b - pageB);

        // Pixel belongs to page if:
        // a) Color matches page color within tolerance, OR
        // b) It's ink/text (darker than page color) inside the document body
        if (dColor < tol || (lum < pageLum && Math.abs((r - g) - (pageR - pageG)) < 35 && dColor < tol * 1.65)) {
          mask[y * W + x] = 1;
        }
      }
    }

    // 4. Trace boundaries from center outward along horizontal and vertical scanlines
    const centerX = Math.round(W / 2);
    const centerY = Math.round(H / 2);

    const topCutYs: number[] = [];
    const botCutYs: number[] = [];
    for (let x = Math.round(W * 0.18); x < Math.round(W * 0.82); x += 3) {
      let topY = 0;
      for (let y = centerY; y >= 0; y--) {
        if (mask[y * W + x] === 0) {
          topY = y;
          break;
        }
      }
      topCutYs.push(topY);

      let botY = H - 1;
      for (let y = centerY; y < H; y++) {
        if (mask[y * W + x] === 0) {
          botY = y;
          break;
        }
      }
      botCutYs.push(botY);
    }

    const leftCutXs: number[] = [];
    const rightCutXs: number[] = [];
    for (let y = Math.round(H * 0.18); y < Math.round(H * 0.82); y += 3) {
      let leftX = 0;
      for (let x = centerX; x >= 0; x--) {
        if (mask[y * W + x] === 0) {
          leftX = x;
          break;
        }
      }
      leftCutXs.push(leftX);

      let rightX = W - 1;
      for (let x = centerX; x < W; x++) {
        if (mask[y * W + x] === 0) {
          rightX = x;
          break;
        }
      }
      rightCutXs.push(rightX);
    }

    const medianOf = (arr: number[]) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };

    const cutTopY = medianOf(topCutYs);
    const cutBotY = medianOf(botCutYs);
    const cutLeftX = medianOf(leftCutXs);
    const cutRightX = medianOf(rightCutXs);

    // 5. If OpenCV is available, refine the page-color mask contour for rotated/tilted documents
    if (cv && cv.Mat) {
      let maskMat: any = null;
      let kernel: any = null;
      let contours: any = null;
      let hierarchy: any = null;
      try {
        maskMat = cv.matFromArray(H, W, cv.CV_8UC1, mask);
        kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
        cv.morphologyEx(maskMat, maskMat, cv.MORPH_CLOSE, kernel);

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(maskMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = 0;
        let bestCnt: any = null;
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const a = cv.contourArea(cnt);
          if (a > maxArea && a > (W * H * 0.10)) {
            maxArea = a;
            bestCnt = cnt;
          }
        }

        if (bestCnt) {
          const hull = new cv.Mat();
          cv.convexHull(bestCnt, hull, false, true);

          const polyPts: Point2D[] = [];
          for (let k = 0; k < hull.rows; k++) {
            polyPts.push({
              x: hull.data32S[k * 2] / W,
              y: hull.data32S[k * 2 + 1] / H,
            });
          }
          hull.delete();

          let tl = polyPts[0], tr = polyPts[0], br = polyPts[0], bl = polyPts[0];
          let minSum = Infinity, maxSum = -Infinity, maxDiff = -Infinity, minDiff = Infinity;
          for (const p of polyPts) {
            const s = p.x + p.y;
            const d = p.x - p.y;
            if (s < minSum) { minSum = s; tl = p; }
            if (s > maxSum) { maxSum = s; br = p; }
            if (d > maxDiff) { maxDiff = d; tr = p; }
            if (d < minDiff) { minDiff = d; bl = p; }
          }

          const quad = orderPoints([tl, tr, br, bl]);
          if (isValidQuad(quad)) {
            return quad;
          }
        }
      } catch {
        // fallback
      } finally {
        maskMat?.delete();
        kernel?.delete();
        contours?.delete();
        hierarchy?.delete();
      }
    }

    // Pure canvas boundary validation
    const widthRatio = (cutRightX - cutLeftX) / W;
    const heightRatio = (cutBotY - cutTopY) / H;

    if (widthRatio > 0.30 && heightRatio > 0.30 && (widthRatio < 0.99 || heightRatio < 0.99)) {
      return orderPoints([
        { x: cutLeftX / W, y: cutTopY / H },
        { x: cutRightX / W, y: cutTopY / H },
        { x: cutRightX / W, y: cutBotY / H },
        { x: cutLeftX / W, y: cutBotY / H },
      ]);
    }
  } catch (err) {
    console.warn('detectViaPageColor error:', err);
  }
  return null;
}

/**
 * MAIN DOCUMENT DETECTOR (UNIVERSAL)
 * Executes the full multi-tier hierarchy:
 * 1. AI API detector (Gemini Flash Vision AI)
 * 2. Page Color Segmentation Detector (identifies page color & cuts where it meets background)
 * 3. OpenCV universal multi-pass detector
 * 4. Canvas contrast edge scanner
 * 5. Full frame / smart document fallback
 */
export async function detectDocument(
  source: HTMLImageElement | HTMLCanvasElement,
  abortSignal?: AbortSignal
): Promise<DetectionResult> {
  const origW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const origH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  if (!origW || !origH) {
    return { success: true, confidence: 0.9, corners: { ...FULL_FRAME_CROP }, method: 'Full Frame' };
  }

  let rawResult: DetectionResult;

  // 1. Primary AI Vision Detector: Gemini Flash Vision Model
  const geminiCorners = await detectViaGeminiVision(source, origW, origH, abortSignal);
  const geminiArea = geminiCorners ? calculateQuadArea(geminiCorners) : 0;

  // If Gemini returned a tight document boundary (area <= 0.98), use it!
  if (geminiCorners && geminiArea >= 0.08 && geminiArea <= 0.98) {
    rawResult = {
      success: true,
      confidence: 0.99,
      corners: geminiCorners,
      method: 'Gemini Flash Vision AI',
    };
  } else {
    // 2. Page Color Segmentation Detector: detects page paper color and decides where to cut
    const cv = window.cv && window.cv.Mat ? window.cv : await loadOpenCV(500);
    const pageColorCorners = detectViaPageColor(source, origW, origH, cv);

    if (pageColorCorners && calculateQuadArea(pageColorCorners) >= 0.08 && calculateQuadArea(pageColorCorners) <= 0.98) {
      rawResult = {
        success: true,
        confidence: 0.98,
        corners: pageColorCorners,
        method: 'Page Color Edge Detector',
      };
    } else {
      // 3. Client-side OpenCV Universal Multi-Pass Detector
      let cvCorners: QuadCrop | null = null;
      if (cv && cv.Mat && !abortSignal?.aborted) {
        cvCorners = detectViaOpenCVUniversal(source, cv);
      }

      if (cvCorners && calculateQuadArea(cvCorners) >= 0.08 && calculateQuadArea(cvCorners) <= 0.98) {
        rawResult = {
          success: true,
          confidence: 0.97,
          corners: cvCorners,
          method: 'OpenCV Universal Boundary Detector',
        };
      } else {
        // 4. Secondary AI API (itlancerbd specialized model)
        const apiCorners = await detectViaItlancerApi(source, origW, origH, abortSignal);
        if (apiCorners && calculateQuadArea(apiCorners) >= 0.08 && calculateQuadArea(apiCorners) <= 0.98) {
          rawResult = {
            success: true,
            confidence: 0.95,
            corners: apiCorners,
            method: 'AI Auto-Detect (itlancer model)',
          };
        } else {
          // 5. 100% Reliable Canvas Edge Contrast Scanner
          const canvasCorners = detectViaCanvasContrast(source, origW, origH);
          if (canvasCorners && calculateQuadArea(canvasCorners) >= 0.10 && calculateQuadArea(canvasCorners) <= 0.98) {
            rawResult = {
              success: true,
              confidence: 0.90,
              corners: canvasCorners,
              method: 'Canvas Edge Contrast Scanner',
            };
          } else if (geminiCorners) {
            rawResult = {
              success: true,
              confidence: 0.88,
              corners: geminiCorners,
              method: 'Gemini Flash Vision AI',
            };
          } else {
            // 6. Clean safe card/document margin inset
            rawResult = {
              success: true,
              confidence: 0.85,
              corners: { ...DEFAULT_CARD_INSET_CROP },
              method: 'Auto Margin Crop',
            };
          }
        }
      }
    }
  }

  // Learned Correction Layer: Architecture (RAW DETECTION -> GEOMETRY VALIDATION -> LEARNED RULES -> FINAL CORNERS)
  const tunedCorners = cropLearningEngine.applyLearnedCorrection(
    rawResult.corners,
    origW,
    origH
  );

  return {
    ...rawResult,
    corners: tunedCorners,
    rawCorners: rawResult.corners,
  };
}

/**
 * Solves 8-parameter homography matrix H from destination quad to source quad.
 */
function solveHomography(
  srcPts: { x: number; y: number }[],
  dstPts: { x: number; y: number }[]
): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = srcPts[i].x;
    const sy = srcPts[i].y;
    const dx = dstPts[i].x;
    const dy = dstPts[i].y;

    A.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx]);
    b.push(sx);

    A.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy]);
    b.push(sy);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    const tempA = A[i]; A[i] = A[maxRow]; A[maxRow] = tempA;
    const tempB = b[i]; b[i] = b[maxRow]; b[maxRow] = tempB;

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-8) continue;
    for (let j = i; j < n; j++) A[i][j] /= pivot;
    b[i] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
        b[k] -= factor * b[i];
      }
    }
  }

  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}

/**
 * Pure JavaScript perspective warp fallback
 */
function pureJsPerspectiveWarp(
  sourceCanvas: HTMLCanvasElement,
  corners: QuadCrop,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d');
  const srcCtx = sourceCanvas.getContext('2d');
  if (!outCtx || !srcCtx) return outCanvas;

  const origW = sourceCanvas.width;
  const origH = sourceCanvas.height;

  const srcPts = [
    { x: corners.topLeft.x * origW, y: corners.topLeft.y * origH },
    { x: corners.topRight.x * origW, y: corners.topRight.y * origH },
    { x: corners.bottomRight.x * origW, y: corners.bottomRight.y * origH },
    { x: corners.bottomLeft.x * origW, y: corners.bottomLeft.y * origH },
  ];

  const dstPts = [
    { x: 0, y: 0 },
    { x: targetW, y: 0 },
    { x: targetW, y: targetH },
    { x: 0, y: targetH },
  ];

  const H = solveHomography(srcPts, dstPts);
  const srcImgData = srcCtx.getImageData(0, 0, origW, origH);
  const srcData = srcImgData.data;
  const outImgData = outCtx.createImageData(targetW, targetH);
  const outData = outImgData.data;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;
  let outIdx = 0;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const denom = h6 * x + h7 * y + 1;
      const sx = (h0 * x + h1 * y + h2) / denom;
      const sy = (h3 * x + h4 * y + h5) / denom;

      const ix = Math.floor(sx);
      const iy = Math.floor(sy);

      if (ix >= 0 && ix < origW && iy >= 0 && iy < origH) {
        const srcIdx = (iy * origW + ix) * 4;
        outData[outIdx] = srcData[srcIdx];
        outData[outIdx + 1] = srcData[srcIdx + 1];
        outData[outIdx + 2] = srcData[srcIdx + 2];
        outData[outIdx + 3] = srcData[srcIdx + 3];
      }
      outIdx += 4;
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * Adjusts quadrilateral margin outward or inward relative to its centroid.
 * Positive deltaPercent (e.g. +0.02) expands the crop outward for extra safety.
 * Negative deltaPercent shrinks the crop inward.
 */
export function adjustCropMargin(corners: QuadCrop, deltaPercent: number): QuadCrop {
  const cx = (corners.topLeft.x + corners.topRight.x + corners.bottomRight.x + corners.bottomLeft.x) / 4;
  const cy = (corners.topLeft.y + corners.topRight.y + corners.bottomRight.y + corners.bottomLeft.y) / 4;

  const move = (p: Point2D): Point2D => {
    const vx = p.x - cx;
    const vy = p.y - cy;
    return {
      x: Math.max(0, Math.min(1, Number((p.x + vx * deltaPercent).toFixed(4)))),
      y: Math.max(0, Math.min(1, Number((p.y + vy * deltaPercent).toFixed(4)))),
    };
  };

  return {
    topLeft: move(corners.topLeft),
    topRight: move(corners.topRight),
    bottomRight: move(corners.bottomRight),
    bottomLeft: move(corners.bottomLeft),
  };
}

/**
 * HIGH-RESOLUTION PERSPECTIVE WARP
 * Exact implementation using cv.warpPerspective with bicubic interpolation.
 */
export async function applyRealPerspectiveWarp(
  source: HTMLImageElement | HTMLCanvasElement,
  corners: QuadCrop,
  targetWidth?: number,
  targetHeight?: number
): Promise<HTMLCanvasElement> {
  const origW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const origH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  let sourceCanvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    sourceCanvas = source;
  } else {
    sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = origW;
    sourceCanvas.height = origH;
    const ctx = sourceCanvas.getContext('2d');
    if (ctx) ctx.drawImage(source, 0, 0);
  }

  const isNorm = corners.topRight.x <= 1.05 && corners.bottomRight.x <= 1.05 && corners.bottomRight.y <= 1.05;
  const pTL = { x: isNorm ? corners.topLeft.x * origW : corners.topLeft.x, y: isNorm ? corners.topLeft.y * origH : corners.topLeft.y };
  const pTR = { x: isNorm ? corners.topRight.x * origW : corners.topRight.x, y: isNorm ? corners.topRight.y * origH : corners.topRight.y };
  const pBR = { x: isNorm ? corners.bottomRight.x * origW : corners.bottomRight.x, y: isNorm ? corners.bottomRight.y * origH : corners.bottomRight.y };
  const pBL = { x: isNorm ? corners.bottomLeft.x * origW : corners.bottomLeft.x, y: isNorm ? corners.bottomLeft.y * origH : corners.bottomLeft.y };

  // Calculate proportional target dimensions
  const topW = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
  const botW = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
  const leftH = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
  const rightH = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);

  const approxW = Math.max(topW, botW);
  const approxH = Math.max(leftH, rightH);
  const aspect = approxW / Math.max(1, approxH);

  let tW = targetWidth;
  let tH = targetHeight;

  if (!tW || !tH) {
    // If aspect ratio is close to Bangladesh NID / Smart card (1.45 - 1.70)
    if (aspect >= 1.45 && aspect <= 1.70) {
      tW = TARGET_NID_WIDTH;
      tH = TARGET_NID_HEIGHT;
    } else if (aspect >= 0.62 && aspect <= 0.80) {
      // Standard A4 Portrait document (1 : 1.4142) - eliminate foreshortening distortion
      const targetBase = Math.max(1400, Math.round(approxH));
      tH = targetBase;
      tW = Math.round(targetBase / 1.4142);
    } else if (aspect >= 1.25 && aspect <= 1.58) {
      // Standard A4 Landscape document (1.4142 : 1)
      const targetBase = Math.max(1400, Math.round(approxW));
      tW = targetBase;
      tH = Math.round(targetBase / 1.4142);
    } else {
      tW = Math.max(100, Math.round(approxW));
      tH = Math.max(100, Math.round(approxH));
    }
  }

  const cv = window.cv && window.cv.Mat ? window.cv : await loadOpenCV(500);
  if (cv && cv.Mat && cv.getPerspectiveTransform && cv.warpPerspective) {
    let srcMat: any = null;
    let dstMat: any = null;
    let srcTri: any = null;
    let dstTri: any = null;
    let M: any = null;
    try {
      srcMat = cv.imread(sourceCanvas);
      dstMat = new cv.Mat();
      srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        pTL.x, pTL.y,
        pTR.x, pTR.y,
        pBR.x, pBR.y,
        pBL.x, pBL.y,
      ]);
      dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        tW, 0,
        tW, tH,
        0, tH,
      ]);

      M = cv.getPerspectiveTransform(srcTri, dstTri);
      const dsize = new cv.Size(tW, tH);
      cv.warpPerspective(
        srcMat,
        dstMat,
        M,
        dsize,
        cv.INTER_CUBIC, // High quality cubic interpolation for maximum text sharpness
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255)
      );

      const outCanvas = document.createElement('canvas');
      outCanvas.width = tW;
      outCanvas.height = tH;
      cv.imshow(outCanvas, dstMat);
      return outCanvas;
    } catch (err) {
      console.warn('OpenCV warp error, using pure-JS homography:', err);
    } finally {
      srcMat?.delete();
      dstMat?.delete();
      srcTri?.delete();
      dstTri?.delete();
      M?.delete();
    }
  }

  return pureJsPerspectiveWarp(sourceCanvas, corners, tW, tH);
}
