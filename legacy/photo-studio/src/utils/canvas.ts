import { FilterType, ImageAdjustments, ImageItem, CropRect } from '../types/editor';
import { getFilterCss } from './filters';
import {
  loadImageSource,
  isValidCanvasImageSource,
  getImageDimensions,
  SupportedImageSource,
} from './imageLoader';

export { loadImageSource, isValidCanvasImageSource, getImageDimensions };
export type { SupportedImageSource };

export async function loadImage(src: string): Promise<HTMLImageElement> {
  if (!src) {
    throw new Error('Enhance image source is missing');
  }
  const source = await loadImageSource(src);
  if (source instanceof HTMLImageElement) {
    return source;
  }
  // If not HTMLImageElement (e.g. canvas or ImageBitmap), wrap cleanly
  const canvas = document.createElement('canvas');
  const dims = getImageDimensions(source);
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, 0, 0);
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const dataUrl = canvas.toDataURL();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image element'));
    img.src = dataUrl;
  });
  return img;
}

export function computeFilterString(adjustments: ImageAdjustments, filter: FilterType): string {
  const parts: string[] = [];

  // Combine Brightness (-100 to 100) and Exposure (-100 to 100) into single unified multiplier
  let b = 1 + (adjustments.brightness || 0) / 100;
  if (adjustments.exposure && adjustments.exposure !== 0) {
    b *= Math.pow(2, adjustments.exposure / 50);
  }
  b = Math.max(0, b);
  if (Math.abs(b - 1.0) > 0.005) {
    parts.push(`brightness(${b.toFixed(3)})`);
  }

  // Contrast: -100 to 100 -> 0 to 2 (1 is neutral)
  if (adjustments.contrast && adjustments.contrast !== 0) {
    const c = Math.max(0, 1 + adjustments.contrast / 100);
    parts.push(`contrast(${c.toFixed(3)})`);
  }

  // Saturation: -100 to 100 -> 0 to 2 (1 is neutral)
  if (adjustments.saturation && adjustments.saturation !== 0) {
    const s = Math.max(0, 1 + adjustments.saturation / 100);
    parts.push(`saturate(${s.toFixed(3)})`);
  }

  // Blur: 0 to 20px
  if (adjustments.blur && adjustments.blur > 0) {
    parts.push(`blur(${adjustments.blur.toFixed(1)}px)`);
  }

  // Filter preset
  const presetCss = getFilterCss(filter);
  if (presetCss && presetCss !== 'none') {
    parts.push(presetCss);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

export function fileToDataUrl(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const img = await loadImage(dataUrl);
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Unable to read the image file.'));
    reader.readAsDataURL(file);
  });
}

export function createThumbnail(imageSource: CanvasImageSource, maxDim = 160): string {
  if (!imageSource) {
    throw new Error('Image source is missing');
  }

  const canvas = document.createElement('canvas');
  const dims = getImageDimensions(imageSource);
  const nw = dims.width || 100;
  const nh = dims.height || 100;

  let tw = maxDim;
  let th = maxDim;
  if (nw > nh) {
    th = Math.round((nh / nw) * maxDim);
  } else {
    tw = Math.round((nw / nh) * maxDim);
  }

  canvas.width = Math.max(1, tw);
  canvas.height = Math.max(1, th);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/png');
}

export async function createThumbnailAsync(
  source: SupportedImageSource,
  maxDim = 160
): Promise<string> {
  if (!source) {
    throw new Error('Image source is missing');
  }
  const validSource = await loadImageSource(source);
  return createThumbnail(validSource, maxDim);
}

export async function applyCrop(
  source: SupportedImageSource,
  crop: CropRect
): Promise<string> {
  if (!source) {
    throw new Error('Image source is missing');
  }
  const validSource = await loadImageSource(source);
  const { width: srcW, height: srcH } = getImageDimensions(validSource);

  const targetW = Math.max(1, Math.round(crop?.width || 1));
  const targetH = Math.max(1, Math.round(crop?.height || 1));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not obtain canvas 2D context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Calculate safe intersection with source bounds
  const rawX = crop.x ?? 0;
  const rawY = crop.y ?? 0;
  const rawW = crop.width ?? srcW;
  const rawH = crop.height ?? srcH;

  const sx = Math.max(0, Math.min(srcW - 1, Math.round(rawX)));
  const sy = Math.max(0, Math.min(srcH - 1, Math.round(rawY)));
  const sw = Math.max(1, Math.min(srcW - sx, Math.round(rawW)));
  const sh = Math.max(1, Math.min(srcH - sy, Math.round(rawH)));

  // Destination placement if crop was partially out of source bounds
  const dx = Math.max(0, Math.round(sx - rawX));
  const dy = Math.max(0, Math.round(sy - rawY));
  const dw = Math.min(targetW - dx, sw);
  const dh = Math.min(targetH - dy, sh);

  if (sw > 0 && sh > 0 && dw > 0 && dh > 0) {
    ctx.drawImage(validSource, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  return canvas.toDataURL('image/png');
}

export async function applyResize(
  source: SupportedImageSource,
  newWidth: number,
  newHeight: number
): Promise<string> {
  if (!source) {
    throw new Error('Enhance image source is missing');
  }
  const validSource = await loadImageSource(source);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(newWidth));
  canvas.height = Math.max(1, Math.round(newHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(validSource, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

// Helper to render solid or gradient background safely
export function renderBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: { isTransparent: boolean; color: string }
) {
  if (background.isTransparent || !background.color) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const colorStr = background.color.trim();
  if (colorStr.startsWith('linear-gradient')) {
    const match = colorStr.match(/linear-gradient\s*\((.*)\)/i);
    if (match) {
      const parts = match[1].split(',').map((p) => p.trim());
      let angle = 135;
      let startIndex = 0;
      if (parts[0].includes('deg')) {
        angle = parseFloat(parts[0]) || 135;
        startIndex = 1;
      } else if (parts[0].includes('to bottom')) {
        angle = 180;
        startIndex = 1;
      } else if (parts[0].includes('to right')) {
        angle = 90;
        startIndex = 1;
      }

      const rad = ((angle - 90) * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const length = Math.sqrt(width * width + height * height) / 2;
      const x0 = cx - Math.cos(rad) * length;
      const y0 = cy - Math.sin(rad) * length;
      const x1 = cx + Math.cos(rad) * length;
      const y1 = cy + Math.sin(rad) * length;

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      const colorStops = parts.slice(startIndex);
      colorStops.forEach((stop, idx) => {
        const stopParts = stop.split(/\s+/);
        const col = stopParts[0];
        let pos = idx / Math.max(1, colorStops.length - 1);
        if (stopParts[1] && stopParts[1].endsWith('%')) {
          pos = parseFloat(stopParts[1]) / 100;
        }
        try {
          grad.addColorStop(Math.min(1, Math.max(0, pos)), col);
        } catch {
          // ignore invalid stop
        }
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      return;
    }
  }

  try {
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, width, height);
  } catch {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }
}

export function renderCompositeCanvas(
  imageEl: CanvasImageSource,
  item: ImageItem,
  customDimensions?: { width: number; height: number }
): HTMLCanvasElement {
  if (!imageEl) {
    throw new Error('Enhance image source is missing');
  }

  const isRotated90or270 = item.transform.rotation === 90 || item.transform.rotation === 270;
  const baseW = isRotated90or270 ? item.height : item.width;
  const baseH = isRotated90or270 ? item.width : item.height;

  const targetW = customDimensions ? customDimensions.width : baseW;
  const targetH = customDimensions ? customDimensions.height : baseH;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Background layer
  renderBackgroundLayer(ctx, canvas.width, canvas.height, item.background);

  // 2. Draw Transformed Image with Filter
  ctx.save();

  // Move origin to center of canvas
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // Rotation
  if (item.transform.rotation !== 0) {
    ctx.rotate((item.transform.rotation * Math.PI) / 180);
  }

  // Flips
  const scaleX = item.transform.flipH ? -1 : 1;
  const scaleY = item.transform.flipV ? -1 : 1;
  ctx.scale(scaleX, scaleY);

  // Apply filters
  const filterStr = computeFilterString(item.adjustments, item.filter);
  ctx.filter = filterStr;

  // Destination size in rotated space
  const destW = isRotated90or270 ? canvas.height : canvas.width;
  const destH = isRotated90or270 ? canvas.width : canvas.height;

  // Account for border margin if border is applied inside or wrapped
  ctx.drawImage(imageEl, -destW / 2, -destH / 2, destW, destH);
  ctx.restore();

  // Apply optical sharpness pass if sharpness adjustment > 0
  if (item.adjustments.sharpness > 0) {
    applySharpeningPass(ctx, canvas.width, canvas.height, item.adjustments.sharpness);
  }

  // 3. Border Layer (drawn cleanly on top of composite)
  if (item.border.enabled && item.border.width > 0) {
    ctx.save();
    const bw = item.border.width;
    ctx.strokeStyle = item.border.color;
    ctx.lineWidth = bw;

    const r = Math.min(item.border.radius, (canvas.width - bw) / 2, (canvas.height - bw) / 2);
    const halfBw = bw / 2;
    const x = halfBw;
    const y = halfBw;
    const w = canvas.width - bw;
    const h = canvas.height - bw;

    ctx.beginPath();
    if (r > 0 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else if (r > 0) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();
    ctx.restore();
  }

  return canvas;
}

export function downloadCanvasBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
  filename: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const mime = `image/${format}`;
    const q = Math.max(0.1, Math.min(1.0, quality / 100));

    // If JPEG and transparent, fill background with white to prevent black background
    let finalCanvas = canvas;
    if (format === 'jpeg') {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const ctx = finalCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(canvas, 0, 0);
      }
    }

    finalCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob for export.'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const ext = format === 'jpeg' ? 'jpg' : format;
        const cleanName = (filename.trim() || 'shebaflow-photo').replace(/\.[^/.]+$/, '');
        link.download = `${cleanName}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        resolve();
      },
      mime,
      q
    );
  });
}

/**
 * Optical unsharp sharpening convolution pass for Canvas 2D
 */
export function applySharpeningPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0 || width <= 2 || height <= 2) return;

  try {
    const factor = (Math.min(100, amount) / 100) * 0.65;
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;
    const output = ctx.createImageData(width, height);
    const dst = output.data;

    const w4 = width * 4;
    for (let y = 1; y < height - 1; y++) {
      const row = y * w4;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + (x * 4);
        for (let c = 0; c < 3; c++) {
          const val =
            src[idx + c] * (1 + 4 * factor) -
            factor * (src[idx - 4 + c] + src[idx + 4 + c] + src[idx - w4 + c] + src[idx + w4 + c]);
          dst[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
        }
        dst[idx + 3] = src[idx + 3];
      }
    }

    // Preserve outer border pixels
    for (let x = 0; x < width; x++) {
      const topIdx = x * 4;
      const botIdx = ((height - 1) * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        dst[topIdx + c] = src[topIdx + c];
        dst[botIdx + c] = src[botIdx + c];
      }
    }
    for (let y = 0; y < height; y++) {
      const leftIdx = (y * width) * 4;
      const rightIdx = (y * width + width - 1) * 4;
      for (let c = 0; c < 4; c++) {
        dst[leftIdx + c] = src[leftIdx + c];
        dst[rightIdx + c] = src[rightIdx + c];
      }
    }

    ctx.putImageData(output, 0, 0);
  } catch {
    // Ignore context security or memory errors in edge cases
  }
}

