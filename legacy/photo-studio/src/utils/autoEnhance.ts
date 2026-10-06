import { loadImageSource, getImageDimensions, SupportedImageSource } from './imageLoader';

export interface AutoEnhanceResult {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  sharpness: number;
  explanation: string;
}

/**
 * Intelligent Computer Vision Auto-Enhance
 * Computes luminance histogram, black/white points, dynamic range spread,
 * and saturation to determine the ideal studio grade tone mapping.
 */
export async function analyzeAndAutoEnhance(
  imageSource: SupportedImageSource
): Promise<AutoEnhanceResult> {
  if (!imageSource) {
    throw new Error('Enhance image source is missing');
  }

  const validSource = await loadImageSource(imageSource);
  const dims = getImageDimensions(validSource);

  const width = Math.min(600, dims.width || 600);
  const height = Math.round((width / (dims.width || 600)) * (dims.height || 600));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      brightness: 14,
      contrast: 20,
      saturation: 16,
      exposure: 8,
      sharpness: 28,
      explanation: 'Optimized tone curve, balanced contrast, and enhanced detail clarity.',
    };
  }

  ctx.drawImage(validSource, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Build luminance histogram & saturation metrics
  const hist = new Int32Array(256);
  let totalLuma = 0;
  let totalSat = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Standard Rec. 601 perceived luminance
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[luma]++;
    totalLuma += luma;

    // Saturation: (max - min) / max
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / 255;
    totalSat += sat;
  }

  const meanLuma = totalLuma / totalPixels;
  const avgSat = totalSat / totalPixels;

  // 2. Find 2nd percentile (black point) and 98th percentile (white point)
  let cumulative = 0;
  let p2 = 0;
  let p98 = 255;

  const targetP2 = totalPixels * 0.02;
  const targetP98 = totalPixels * 0.98;

  for (let i = 0; i < 256; i++) {
    cumulative += hist[i];
    if (p2 === 0 && cumulative >= targetP2) {
      p2 = i;
    }
    if (cumulative >= targetP98) {
      p98 = i;
      break;
    }
  }

  const spread = p98 - p2;

  // 3. Compute Adaptive Enhancements (Gentle, natural photographic tones)
  let brightness = 2;
  let contrast = 3;
  let saturation = 2;
  let exposure = 1;
  const sharpness = 2;
  let explanation = '';

  // Exposure & Brightness tuning
  if (meanLuma < 85) {
    // Dark / Underexposed
    brightness = 5;
    exposure = 3;
    contrast = 4;
    explanation = 'Gently illuminated deep shadows while preserving dynamic range.';
  } else if (meanLuma < 120) {
    // Slightly dim
    brightness = 3;
    exposure = 2;
    contrast = 3;
    explanation = 'Subtly balanced midtones and exposure.';
  } else if (meanLuma > 185) {
    // Overexposed / Hot highlights
    brightness = -3;
    exposure = -2;
    contrast = 2;
    explanation = 'Preserved natural highlight detail.';
  } else {
    // Balanced exposure
    brightness = 1;
    exposure = 1;
    contrast = 2;
    explanation = 'Subtly balanced exposure and natural studio tone.';
  }

  // Dynamic range / Contrast expansion (very subtle)
  if (spread < 130) {
    contrast += 2;
  }

  // Saturation / Vibrance tuning (natural, never oversaturated)
  if (avgSat < 0.18) {
    saturation = 3;
  } else if (avgSat > 0.45) {
    saturation = 0;
  } else {
    saturation = 1;
  }

  return {
    brightness: Math.min(6, Math.max(-6, Math.round(brightness))),
    contrast: Math.min(5, Math.max(0, Math.round(contrast))),
    saturation: Math.min(3, Math.max(0, Math.round(saturation))),
    exposure: Math.min(3, Math.max(-3, Math.round(exposure))),
    sharpness,
    explanation,
  };
}
