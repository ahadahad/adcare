/**
 * Authoritative crop and perspective correction adapter.
 * Re-exports from documentDetector to guarantee single authoritative detection pipeline.
 */
import { CropData } from '../types/image';
import { detectDocument, applyRealPerspectiveWarp, orderPoints } from './documentDetector';

export { orderPoints, applyRealPerspectiveWarp };

export function sortCornerPoints(points: any[]): CropData {
  return orderPoints(points);
}

export function getDefaultNidCrop(imageAspect = 1.333): CropData {
  const nidAspect = 85.6 / 54.0; // 1.585

  let w = 0.86;
  let h = (w * imageAspect) / nidAspect;

  if (h > 0.86) {
    h = 0.86;
    w = (h * nidAspect) / imageAspect;
  }

  const left = Math.max(0.02, (1 - w) / 2);
  const top = Math.max(0.02, (1 - h) / 2);
  const right = Math.min(0.98, left + w);
  const bottom = Math.min(0.98, top + h);

  return {
    topLeft: { x: left, y: top },
    topRight: { x: right, y: top },
    bottomRight: { x: right, y: bottom },
    bottomLeft: { x: left, y: bottom },
  };
}

/**
 * Authoritative document corner detector delegating to multi-strategy detector
 */
export async function detectDocumentCorners(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<CropData> {
  const result = await detectDocument(source);
  return result.corners || getDefaultNidCrop();
}

/**
 * Authoritative perspective warp delegating to real OpenCV perspective warp
 */
export async function applyPerspectiveCrop(
  source: HTMLImageElement | HTMLCanvasElement,
  crop: CropData
): Promise<HTMLCanvasElement> {
  return applyRealPerspectiveWarp(source, crop);
}
