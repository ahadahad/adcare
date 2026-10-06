/**
 * Combines Front Image Canvas and Back Image Canvas vertically with an adjustable gap.
 * Preserves exact aspect ratio and original document quality.
 */
export function composeFrontAndBack(
  frontCanvas: HTMLCanvasElement | null,
  backCanvas: HTMLCanvasElement | null,
  gapPx = 24,
  targetAspectWidth = 0,
  targetAspectHeight = 0
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (!frontCanvas && !backCanvas) {
    canvas.width = 800;
    canvas.height = 1000;
    return canvas;
  }

  // If only one side exists
  if (frontCanvas && !backCanvas) {
    canvas.width = frontCanvas.width;
    canvas.height = frontCanvas.height;
    ctx.drawImage(frontCanvas, 0, 0);
    return canvas;
  }

  if (!frontCanvas && backCanvas) {
    canvas.width = backCanvas.width;
    canvas.height = backCanvas.height;
    ctx.drawImage(backCanvas, 0, 0);
    return canvas;
  }

  // Both sides exist
  const fW = frontCanvas!.width;
  const fH = frontCanvas!.height;
  const bW = backCanvas!.width;
  const bH = backCanvas!.height;

  // Determine standard width for vertical stacking
  const maxWidth = Math.max(fW, bW);

  // Calculate scaled height for both sides so they have matching width
  const fScaledH = Math.round((fH * maxWidth) / fW);
  const bScaledH = Math.round((bH * maxWidth) / bW);

  const totalWidth = maxWidth;
  const totalHeight = fScaledH + gapPx + bScaledH;

  canvas.width = totalWidth;
  canvas.height = totalHeight;

  // Fill crisp white background behind document scan
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Draw Front on top
  ctx.drawImage(frontCanvas!, 0, 0, totalWidth, fScaledH);

  // Draw Back below gap
  ctx.drawImage(backCanvas!, 0, fScaledH + gapPx, totalWidth, bScaledH);

  // Optional: If target aspect width & height are specified (e.g. Bangladesh NID standard card bounds),
  // we can ensure card dimensions align cleanly without stretching.
  if (targetAspectWidth > 0 && targetAspectHeight > 0) {
    // Canvas is ready
  }

  return canvas;
}
