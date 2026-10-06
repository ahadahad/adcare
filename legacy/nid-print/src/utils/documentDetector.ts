/* eslint-disable @typescript-eslint/no-explicit-any */
import { CropData, Point, DetectionResult } from '../types/image';
import { loadOpenCV } from './opencvLoader';

/**
 * Standard Bangladesh NID dimensions used by itlancerbd.com
 * Width: 1011px, Height: 642px (~1.575 aspect ratio)
 */
export const TARGET_NID_WIDTH = 1011;
export const TARGET_NID_HEIGHT = 642;

/**
 * Default fallback quadrilateral (typical centered phone photo of NID card)
 */
export const DEFAULT_FALLBACK_CROP: CropData = {
  topLeft: { x: 0.10, y: 0.35 },
  topRight: { x: 0.85, y: 0.37 },
  bottomRight: { x: 0.85, y: 0.75 },
  bottomLeft: { x: 0.10, y: 0.73 },
};

/**
 * Orders 4 points clockwise: [topLeft, topRight, bottomRight, bottomLeft]
 * Matching itlancerbd algorithm: sum and diff of coordinates
 */
export function orderPoints(points: Point[]): CropData {
  if (points.length !== 4) {
    return { ...DEFAULT_FALLBACK_CROP };
  }

  const sum = points.map((p) => p.x + p.y);
  const diff = points.map((p) => p.y - p.x);

  const minSumIdx = sum.indexOf(Math.min(...sum));
  const maxSumIdx = sum.indexOf(Math.max(...sum));
  const minDiffIdx = diff.indexOf(Math.min(...diff));
  const maxDiffIdx = diff.indexOf(Math.max(...diff));

  const tl = points[minSumIdx];
  const br = points[maxSumIdx];
  const tr = points[minDiffIdx];
  const bl = points[maxDiffIdx];

  return {
    topLeft: { x: Math.max(0, Math.min(1, tl.x)), y: Math.max(0, Math.min(1, tl.y)) },
    topRight: { x: Math.max(0, Math.min(1, tr.x)), y: Math.max(0, Math.min(1, tr.y)) },
    bottomRight: { x: Math.max(0, Math.min(1, br.x)), y: Math.max(0, Math.min(1, br.y)) },
    bottomLeft: { x: Math.max(0, Math.min(1, bl.x)), y: Math.max(0, Math.min(1, bl.y)) },
  };
}

/**
 * Converts canvas to JPEG blob
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/**
 * 1. AI API DETECTOR (Exact engine used by itlancerbd.com)
 * Calls /api/detect-nid (proxied to https://docu.itlancerbd.com/detect-nid)
 */
async function detectViaItlancerApi(
  source: HTMLImageElement | HTMLCanvasElement,
  origW: number,
  origH: number,
  abortSignal?: AbortSignal
): Promise<CropData | null> {
  try {
    // Resize down to max 1600px for fast upload
    const maxDim = 1600;
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
    formData.append('file', blob, 'nid_image.jpg');

    // Try local proxy first, then direct endpoint with 3.5s timeout
    const urls = ['/api/detect-nid', 'https://docu.itlancerbd.com/detect-nid'];

    for (const url of urls) {
      if (abortSignal?.aborted) return null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

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

          // Normalize points to 0..1 coordinates
          const normalizedPoints: Point[] = data.points.map((p: number[]) => ({
            x: Math.max(0, Math.min(1, p[0] / apiW)),
            y: Math.max(0, Math.min(1, p[1] / apiH)),
          }));

          console.log('[Auto Select API] NID detected successfully via itlancerbd AI model!');
          return orderPoints(normalizedPoints);
        }
      } catch (e) {
        console.warn(`Attempt on ${url} failed or timed out:`, e);
      }
    }
  } catch (err) {
    console.warn('detectViaItlancerApi exception:', err);
  }
  return null;
}

/**
 * 2. CLIENT-SIDE OPENCV ADVANCED LOGIC (from itlancerbd.com's tryAdvancedLogic)
 */
function tryItlancerAdvancedOpenCV(
  source: HTMLImageElement | HTMLCanvasElement,
  cv: any
): CropData | null {
  const origW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const origH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  const MAX_DIM = 800;
  const scale = Math.min(1.0, MAX_DIM / Math.max(origW, origH));
  const detW = Math.round(origW * scale);
  const detH = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = detW;
  canvas.height = detH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, detW, detH);

  let src: any = null;
  let gray: any = null;
  let processed: any = null;
  let kernel: any = null;
  let contours: any = null;
  let hierarchy: any = null;
  let potentialCardContour: any = null;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    processed = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, processed, new cv.Size(7, 7), 0);
    cv.threshold(processed, processed, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.morphologyEx(processed, processed, cv.MORPH_CLOSE, kernel);

    cv.findContours(processed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    const totalArea = detW * detH;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > totalArea * 0.10) {
        const rect = cv.boundingRect(cnt);
        const aspectRatio = rect.width / parseFloat(rect.height);
        if (aspectRatio > 1.25 && aspectRatio < 1.95 && area > maxArea) {
          maxArea = area;
          if (potentialCardContour) potentialCardContour.delete();
          potentialCardContour = cnt.clone();
        }
      }
      cnt.delete();
    }

    if (potentialCardContour) {
      const perimeter = cv.arcLength(potentialCardContour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(potentialCardContour, approx, 0.03 * perimeter, true);

      let pts: Point[] = [];
      if (approx.rows === 4) {
        for (let i = 0; i < 4; i++) {
          pts.push({
            x: approx.data32S[i * 2] / detW,
            y: approx.data32S[i * 2 + 1] / detH,
          });
        }
      } else {
        const rect = cv.minAreaRect(potentialCardContour);
        const box = cv.RotatedRect.points(rect);
        for (let i = 0; i < 4; i++) {
          pts.push({
            x: box[i].x / detW,
            y: box[i].y / detH,
          });
        }
      }
      approx.delete();

      if (pts.length === 4) {
        return orderPoints(pts);
      }
    }
  } catch (err) {
    console.warn('OpenCV advanced logic failed:', err);
  } finally {
    try {
      src?.delete();
      gray?.delete();
      processed?.delete();
      kernel?.delete();
      contours?.delete();
      hierarchy?.delete();
      potentialCardContour?.delete();
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * 3. PURE CANVAS EDGE SCANNER (100% Offline Fallback)
 */
function detectCardPureCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  origW: number,
  origH: number
): CropData | null {
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

    const gray = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    const rowGrad = new Float32Array(H);
    const colGrad = new Float32Array(W);

    const xStart = Math.round(W * 0.15);
    const xEnd = Math.round(W * 0.85);
    const yStart = Math.round(H * 0.15);
    const yEnd = Math.round(H * 0.85);

    for (let y = 3; y < H - 3; y++) {
      let rSum = 0;
      for (let x = xStart; x < xEnd; x++) {
        rSum += Math.abs(gray[(y + 2) * W + x] - gray[(y - 2) * W + x]);
      }
      rowGrad[y] = rSum / (xEnd - xStart);
    }

    for (let x = 3; x < W - 3; x++) {
      let cSum = 0;
      for (let y = yStart; y < yEnd; y++) {
        cSum += Math.abs(gray[y * W + x + 2] - gray[y * W + x - 2]);
      }
      colGrad[x] = cSum / (yEnd - yStart);
    }

    let bestTopY = Math.round(H * 0.36);
    let maxTopScore = 0;
    for (let y = Math.round(H * 0.20); y <= Math.round(H * 0.52); y++) {
      if (rowGrad[y] > maxTopScore) {
        maxTopScore = rowGrad[y];
        bestTopY = y;
      }
    }

    let bestBotY = Math.round(H * 0.74);
    let maxBotScore = 0;
    for (let y = Math.round(H * 0.55); y <= Math.round(H * 0.88); y++) {
      if (rowGrad[y] > maxBotScore) {
        maxBotScore = rowGrad[y];
        bestBotY = y;
      }
    }

    let bestLeftX = Math.round(W * 0.10);
    let maxLeftScore = 0;
    for (let x = Math.round(W * 0.04); x <= Math.round(W * 0.35); x++) {
      if (colGrad[x] > maxLeftScore) {
        maxLeftScore = colGrad[x];
        bestLeftX = x;
      }
    }

    let bestRightX = Math.round(W * 0.84);
    let maxRightScore = 0;
    for (let x = Math.round(W * 0.65); x <= Math.round(W * 0.96); x++) {
      if (colGrad[x] > maxRightScore) {
        maxRightScore = colGrad[x];
        bestRightX = x;
      }
    }

    const corners: CropData = {
      topLeft: { x: bestLeftX / W, y: bestTopY / H },
      topRight: { x: bestRightX / W, y: bestTopY / H },
      bottomRight: { x: bestRightX / W, y: bestBotY / H },
      bottomLeft: { x: bestLeftX / W, y: bestBotY / H },
    };

    return orderPoints([corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]);
  } catch {
    return null;
  }
}

/**
 * MAIN DETECT DOCUMENT FUNCTION
 * 1. AI API (itlancerbd model)
 * 2. OpenCV client-side fallback
 * 3. Pure Canvas edge scanner
 * 4. Default layout
 */
export async function detectDocument(
  source: HTMLImageElement | HTMLCanvasElement,
  abortSignal?: AbortSignal
): Promise<DetectionResult> {
  const origW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const origH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  if (!origW || !origH) {
    return { success: true, confidence: 0.9, corners: { ...DEFAULT_FALLBACK_CROP }, method: 'Default' };
  }

  // 1. Try AI API (same endpoint as itlancerbd.com)
  const apiCorners = await detectViaItlancerApi(source, origW, origH, abortSignal);
  if (apiCorners) {
    return {
      success: true,
      confidence: 0.99,
      corners: apiCorners,
      method: 'AI Auto-Detect (itlancer model)',
    };
  }

  // 2. Client-side OpenCV fallback
  if (window.cv && window.cv.Mat && !abortSignal?.aborted) {
    const cvCorners = tryItlancerAdvancedOpenCV(source, window.cv);
    if (cvCorners) {
      return {
        success: true,
        confidence: 0.92,
        corners: cvCorners,
        method: 'OpenCV Advanced Detector',
      };
    }
  }

  // 3. Pure Canvas Edge Scanner fallback
  const canvasCorners = detectCardPureCanvas(source, origW, origH);
  if (canvasCorners) {
    return {
      success: true,
      confidence: 0.88,
      corners: canvasCorners,
      method: 'Edge Scanner Detector',
    };
  }

  return {
    success: true,
    confidence: 0.85,
    corners: { ...DEFAULT_FALLBACK_CROP },
    method: 'Default Centered Card Layout',
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
  corners: CropData,
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
 * HIGH-RESOLUTION FINAL PERSPECTIVE WARP
 * Exact implementation as itlancerbd.com: cv.warpPerspective to 1011 × 642
 */
export async function applyRealPerspectiveWarp(
  source: HTMLImageElement | HTMLCanvasElement,
  corners: CropData,
  targetWidth = TARGET_NID_WIDTH,
  targetHeight = TARGET_NID_HEIGHT
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

  const pTL = { x: corners.topLeft.x * origW, y: corners.topLeft.y * origH };
  const pTR = { x: corners.topRight.x * origW, y: corners.topRight.y * origH };
  const pBR = { x: corners.bottomRight.x * origW, y: corners.bottomRight.y * origH };
  const pBL = { x: corners.bottomLeft.x * origW, y: corners.bottomLeft.y * origH };

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
        targetWidth, 0,
        targetWidth, targetHeight,
        0, targetHeight,
      ]);

      M = cv.getPerspectiveTransform(srcTri, dstTri);
      const dsize = new cv.Size(targetWidth, targetHeight);

      cv.warpPerspective(
        srcMat,
        dstMat,
        M,
        dsize,
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar()
      );

      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetWidth;
      outCanvas.height = targetHeight;
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

  return pureJsPerspectiveWarp(sourceCanvas, corners, targetWidth, targetHeight);
}
