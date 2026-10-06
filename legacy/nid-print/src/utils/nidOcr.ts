import { createWorker } from 'tesseract.js';
import { detectBarcodeNid } from './nidExtractor';

/**
 * Preprocesses a canvas specifically for OCR text extraction:
 * Grayscale -> High Contrast -> Thresholding to black & white
 */
function preprocessOcrCanvas(
  sourceCanvas: HTMLCanvasElement,
  roi?: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const sx = roi ? Math.floor(roi.x * sourceCanvas.width) : 0;
  const sy = roi ? Math.floor(roi.y * sourceCanvas.height) : 0;
  const sw = roi ? Math.floor(roi.width * sourceCanvas.width) : sourceCanvas.width;
  const sh = roi ? Math.floor(roi.height * sourceCanvas.height) : sourceCanvas.height;

  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  // Draw region to canvas
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Convert to grayscale and apply Otsu-like adaptive binarization
  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // High contrast thresholding (black text on white background)
    const val = gray < 135 ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Parses recognized text to locate Bangladesh NID number:
 * 1. Explicit "ID NO: 3768415358"
 * 2. 10 digits (Smart NID)
 * 3. 17 digits (Old NID with birth year)
 * 4. 13 digits (Old NID)
 */
export function parseNidNumberFromText(rawText: string): string | null {
  if (!rawText) return null;

  // Clean common OCR misreadings
  const text = rawText
    .replace(/[oO]/g, '0') // Letter O to digit 0 if adjacent to digits
    .replace(/[lI|]/g, '1') // Letter l/I to 1
    .replace(/[sS]/g, '5'); // Letter S to 5 in digit contexts

  // 1. Look for explicit "ID NO" or "NID NO" followed by digits
  const idNoPattern = /(?:id\s*(?:no|number)?|nid|no)[\s:.\-_]*([0-9]{10,17})/i;
  const matchId = text.match(idNoPattern);
  if (matchId && matchId[1]) {
    const num = matchId[1];
    if (num.length === 10 || num.length === 13 || num.length === 17) {
      return num;
    }
  }

  // 2. Look for standalone 10-digit Smart NID number (Most common, e.g. 3768415358)
  const tenDigitMatches = text.match(/\b([0-9]{10})\b/g);
  if (tenDigitMatches && tenDigitMatches.length > 0) {
    // Return first 10-digit sequence
    return tenDigitMatches[0];
  }

  // 3. Look for 17-digit NID number
  const seventeenDigitMatches = text.match(/\b([0-9]{17})\b/g);
  if (seventeenDigitMatches && seventeenDigitMatches.length > 0) {
    return seventeenDigitMatches[0];
  }

  // 4. Look for 13-digit NID number
  const thirteenDigitMatches = text.match(/\b([0-9]{13})\b/g);
  if (thirteenDigitMatches && thirteenDigitMatches.length > 0) {
    return thirteenDigitMatches[0];
  }

  // 5. Look for any sequence of 9 to 17 digits
  const looseMatch = text.match(/([0-9]{9,17})/);
  if (looseMatch && looseMatch[1]) {
    return looseMatch[1];
  }

  return null;
}

/**
 * Extracts NID number directly from the photo canvas using OCR + Barcode
 */
export async function readActualNidFromCanvas(
  canvas: HTMLCanvasElement
): Promise<{ nidNumber: string | null; confidence?: number; method?: string }> {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return { nidNumber: null };
  }

  // STEP 1: Fast Barcode Scan
  try {
    const barcodeNum = await detectBarcodeNid(canvas);
    if (barcodeNum && (barcodeNum.length === 10 || barcodeNum.length === 13 || barcodeNum.length === 17)) {
      return { nidNumber: barcodeNum, method: 'barcode' };
    }
  } catch {
    // continue to OCR
  }

  // STEP 2: Tesseract OCR on targeted NID Number ROI (Bottom Right of Front Card)
  // On Bangladesh NID cards, "ID NO: XXXXXXXXXX" is located between y: 55%-85% and x: 20%-85%
  try {
    const roiCanvas = preprocessOcrCanvas(canvas, {
      x: 0.18,
      y: 0.52,
      width: 0.75,
      height: 0.35,
    });

    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789IDNOidno:.- ',
    });

    const retRoi = await worker.recognize(roiCanvas);
    const parsedRoi = parseNidNumberFromText(retRoi.data.text);

    if (parsedRoi) {
      await worker.terminate();
      return { nidNumber: parsedRoi, confidence: retRoi.data.confidence, method: 'ocr_roi' };
    }

    // STEP 3: If not found in ROI, scan full preprocessed canvas
    const fullCanvas = preprocessOcrCanvas(canvas);
    const retFull = await worker.recognize(fullCanvas);
    await worker.terminate();

    const parsedFull = parseNidNumberFromText(retFull.data.text);
    if (parsedFull) {
      return { nidNumber: parsedFull, confidence: retFull.data.confidence, method: 'ocr_full' };
    }
  } catch (err) {
    console.warn('Tesseract OCR failed:', err);
  }

  return { nidNumber: null };
}
