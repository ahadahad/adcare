import { ImageAdjustments } from '../types/image';

/**
 * Rotates a canvas by 0, 90, 180, or 270 degrees.
 */
export function rotateCanvas(inputCanvas: HTMLCanvasElement, rotationDeg: number): HTMLCanvasElement {
  const normalized = ((rotationDeg % 360) + 360) % 360;
  if (normalized === 0) return inputCanvas;

  const outCanvas = document.createElement('canvas');
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return inputCanvas;

  if (normalized === 90 || normalized === 270) {
    outCanvas.width = inputCanvas.height;
    outCanvas.height = inputCanvas.width;
  } else {
    outCanvas.width = inputCanvas.width;
    outCanvas.height = inputCanvas.height;
  }

  ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(inputCanvas, -inputCanvas.width / 2, -inputCanvas.height / 2);

  return outCanvas;
}

/**
 * Computes optimal color adjustments specifically tuned for Bangladeshi NID cards:
 * 1. Analyzes card background luminance and whitens off-white paper.
 * 2. Deepens Bengali text lines, signatures, and ID numbers.
 * 3. Boosts contrast and sharpness for crisp thermal/inkjet/laser printing.
 * 4. Enhances green & red national emblem vibrancy.
 */
export function calculateAutoAdjustments(canvas: HTMLCanvasElement): ImageAdjustments {
  try {
    const W = Math.min(canvas.width, 400);
    const H = Math.round((W * canvas.height) / canvas.width);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = W;
    tempCanvas.height = H;
    const tctx = tempCanvas.getContext('2d', { willReadFrequently: true });

    if (!tctx) {
      return {
        brightness: 5,
        contrast: 22,
        saturation: 18,
        levels: 25,
        textDeepen: 32,
        sharpen: 25,
        upscale: 1.0,
      };
    }

    tctx.drawImage(canvas, 0, 0, W, H);
    const imgData = tctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    let totalLum = 0;
    const lumHist = new Int32Array(256);

    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      lumHist[lum]++;
      totalLum += lum;
    }

    const numPixels = data.length / 4;
    const avgLum = totalLum / numPixels;

    // Find 85th percentile luminance (paper card background)
    let count = 0;
    let p85 = 210;
    for (let l = 255; l >= 0; l--) {
      count += lumHist[l];
      if (count >= numPixels * 0.15) {
        p85 = l;
        break;
      }
    }

    // Automatically calculate the exact levels required to turn the paper background into clean white
    const paperDeficit = Math.max(0, 245 - p85);
    const levelsScore = Math.min(55, Math.max(25, Math.round(paperDeficit * 0.85) + 22));
    const brightnessVal = avgLum < 160 ? Math.min(18, Math.round((160 - avgLum) * 0.25)) : 5;

    return {
      brightness: brightnessVal,
      contrast: 18,
      saturation: 10,
      levels: levelsScore,
      textDeepen: 40,
      sharpen: 30,
      upscale: 1.0,
    };
  } catch (err) {
    console.warn('Auto adjustment analysis error, using presets:', err);
    return {
      brightness: 5,
      contrast: 18,
      saturation: 10,
      levels: 32,
      textDeepen: 40,
      sharpen: 30,
      upscale: 1.0,
    };
  }
}

/**
 * Applies deterministic pixel processing for Brightness, Contrast, Saturation, Levels, Text Deepen, Sharpen, and Upscale.
 */
export function applyImageAdjustments(
  inputCanvas: HTMLCanvasElement,
  adjustments: ImageAdjustments,
  rotationDeg = 0
): HTMLCanvasElement {
  // First apply rotation
  const rotated = rotateCanvas(inputCanvas, rotationDeg);

  const { brightness, contrast, saturation, levels, textDeepen, sharpen, upscale } = adjustments;

  // Check if any adjustments are active
  const isDefault =
    brightness === 0 &&
    contrast === 0 &&
    saturation === 0 &&
    levels === 0 &&
    textDeepen === 0 &&
    sharpen === 0 &&
    upscale <= 1.0;

  if (isDefault) {
    return rotated;
  }

  // Create target output canvas with potential upscale factor (1x to 4x)
  const scaleFactor = Math.max(1.0, Math.min(4.0, upscale || 1.0));
  const targetWidth = Math.round(rotated.width * scaleFactor);
  const targetHeight = Math.round(rotated.height * scaleFactor);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return rotated;

  // Use multi-step high-quality resampling for super-resolution
  if (scaleFactor > 1.5) {
    // Intermediate step to avoid single-jump interpolation blur
    const midW = Math.round(rotated.width * (scaleFactor * 0.65));
    const midH = Math.round(rotated.height * (scaleFactor * 0.65));
    const midCanvas = document.createElement('canvas');
    midCanvas.width = midW;
    midCanvas.height = midH;
    const midCtx = midCanvas.getContext('2d');
    if (midCtx) {
      midCtx.imageSmoothingEnabled = true;
      midCtx.imageSmoothingQuality = 'high';
      midCtx.drawImage(rotated, 0, 0, midW, midH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(midCanvas, 0, 0, targetWidth, targetHeight);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(rotated, 0, 0, targetWidth, targetHeight);
    }
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(rotated, 0, 0, targetWidth, targetHeight);
  }

  // Read pixel buffer
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;
  const len = data.length;

  // Precalculate contrast factor (-100 to 100)
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  // Saturation factor
  const satVal = (saturation + 100) / 100;

  // Brightness offset
  const brightOffset = (brightness / 100) * 255;

  // Levels threshold (white/black point correction tuned for document scanning)
  const blackPoint = (levels / 100) * 35;
  const whitePoint = 255 - (levels / 100) * 65;

  // Text deepen factor
  const textDeepenFactor = 1 + (textDeepen / 100) * 1.8;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Brightness
    if (brightness !== 0) {
      r += brightOffset;
      g += brightOffset;
      b += brightOffset;
    }

    // 2. Contrast
    if (contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // 3. Saturation
    if (saturation !== 0) {
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
      r = gray + satVal * (r - gray);
      g = gray + satVal * (g - gray);
      b = gray + satVal * (b - gray);
    }

    // 4. Levels (Stretch contrast for crisp document background)
    if (levels > 0) {
      r = ((r - blackPoint) * 255) / Math.max(1, whitePoint - blackPoint);
      g = ((g - blackPoint) * 255) / Math.max(1, whitePoint - blackPoint);
      b = ((b - blackPoint) * 255) / Math.max(1, whitePoint - blackPoint);

      // Smooth highlight roll-off: whiten paper highlights to spotless clean background
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 212) {
        const t = Math.min(1.0, (lum - 212) / 36);
        const boost = t * (255 - lum);
        r += boost;
        g += boost;
        b += boost;
      }
    }

    // 5. Text Deepen (Target dark ink/text lines, numbers, barcodes)
    if (textDeepen > 0) {
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance < 155) {
        const darkenRatio = Math.pow(luminance / 155, textDeepenFactor);
        r *= darkenRatio;
        g *= darkenRatio;
        b *= darkenRatio;
      }
    }

    // Clamp 0..255
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  // Write back basic pixel adjustments
  ctx.putImageData(imgData, 0, 0);

  // 6. Super-Resolution Edge & Detail Reconstruction
  if (scaleFactor > 1.0) {
    applySuperResolutionKernel(ctx, targetWidth, targetHeight, scaleFactor);
  }

  // 7. Text & Document Edge Sharpen (produces clean, laser-sharp typography)
  const effectiveSharpen = Math.max(sharpen, 12);
  if (effectiveSharpen > 0) {
    applySharpenFilter(ctx, targetWidth, targetHeight, effectiveSharpen / 100);
  }

  return outCanvas;
}

/**
 * Super-Resolution Edge Reconstruction & Text Deepening Kernel for Document Scans
 */
function applySuperResolutionKernel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scaleFactor: number
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const copy = new Uint8ClampedArray(data);

  // Strength scales with upscale ratio
  const strength = scaleFactor >= 3.5 ? 0.95 : 0.65;
  const threshold = 5;

  for (let y = 1; y < height - 1; y++) {
    const rowIdx = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (rowIdx + x) * 4;

      const topIdx = ((y - 1) * width + x) * 4;
      const botIdx = ((y + 1) * width + x) * 4;
      const leftIdx = (rowIdx + (x - 1)) * 4;
      const rightIdx = (rowIdx + (x + 1)) * 4;

      // Luminance: 0.299 R + 0.587 G + 0.114 B
      const lumCenter = (copy[idx] * 77 + copy[idx + 1] * 150 + copy[idx + 2] * 29) >> 8;
      const lumTop = (copy[topIdx] * 77 + copy[topIdx + 1] * 150 + copy[topIdx + 2] * 29) >> 8;
      const lumBot = (copy[botIdx] * 77 + copy[botIdx + 1] * 150 + copy[botIdx + 2] * 29) >> 8;
      const lumLeft = (copy[leftIdx] * 77 + copy[leftIdx + 1] * 150 + copy[leftIdx + 2] * 29) >> 8;
      const lumRight = (copy[rightIdx] * 77 + copy[rightIdx + 1] * 150 + copy[rightIdx + 2] * 29) >> 8;

      const neighborAvg = (lumTop + lumBot + lumLeft + lumRight) >> 2;
      const diff = lumCenter - neighborAvg;

      if (Math.abs(diff) > threshold) {
        // High frequency detail (letters, numbers, barcode, lines)
        for (let c = 0; c < 3; c++) {
          const val = copy[idx + c] + diff * strength;
          data[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
        }

        // Ink boundary deepening for text clarity
        if (lumCenter < 145) {
          data[idx] = Math.round(data[idx] * 0.90);
          data[idx + 1] = Math.round(data[idx + 1] * 0.90);
          data[idx + 2] = Math.round(data[idx + 2] * 0.90);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Applies unsharp mask convolution matrix for crisp text edges.
 */
function applySharpenFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number
) {
  const srcData = ctx.getImageData(0, 0, width, height);
  const src = srcData.data;
  const dstData = ctx.createImageData(width, height);
  const dst = dstData.data;

  const center = 1 + 4 * strength;
  const edge = -strength;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const top = src[((y - 1) * width + x) * 4 + c];
        const left = src[(y * width + (x - 1)) * 4 + c];
        const right = src[(y * width + (x + 1)) * 4 + c];
        const bottom = src[((y + 1) * width + x) * 4 + c];
        const curr = src[idx + c];

        const val = curr * center + (top + left + right + bottom) * edge;
        dst[idx + c] = Math.max(0, Math.min(255, val));
      }
      dst[idx + 3] = src[idx + 3];
    }
  }

  // Preserve border pixels
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
    const rightIdx = (y * width + (width - 1)) * 4;
    for (let c = 0; c < 4; c++) {
      dst[leftIdx + c] = src[leftIdx + c];
      dst[rightIdx + c] = src[rightIdx + c];
    }
  }

  ctx.putImageData(dstData, 0, 0);
}
