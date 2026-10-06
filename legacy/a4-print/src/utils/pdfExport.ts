import jsPDF from 'jspdf';
import { PAGE_SIZES, PrintLayoutSettings } from '../types';

/**
 * Exports canvases as a multi-page or single-page high-resolution PDF (A4 or Legal)
 */
export async function exportCanvasesToPdf(
  canvases: HTMLCanvasElement[],
  filename: string = 'Document_Print_Ready.pdf',
  layouts?: (PrintLayoutSettings | undefined)[]
): Promise<void> {
  if (canvases.length === 0) return;

  const firstLayout = layouts && layouts[0];
  const firstPageSize = firstLayout?.pageSize === 'Legal' ? PAGE_SIZES.Legal : PAGE_SIZES.A4;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [firstPageSize.widthMm, firstPageSize.heightMm],
    compress: true,
  });

  for (let i = 0; i < canvases.length; i++) {
    const layout = layouts && layouts[i];
    const paperDim = layout?.pageSize === 'Legal' ? PAGE_SIZES.Legal : PAGE_SIZES.A4;

    if (i > 0) {
      doc.addPage([paperDim.widthMm, paperDim.heightMm], 'portrait');
    }

    const canvas = canvases[i];

    if (layout) {
      // High-res 300 DPI render canvas (A4: 2480x3508, Legal: 2550x4200)
      const renderW = layout.pageSize === 'Legal' ? 2550 : 2480;
      const renderH = layout.pageSize === 'Legal' ? 4200 : 3508;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = renderW;
      pageCanvas.height = renderH;
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        const centerX = (layout.x / 100) * pageCanvas.width;
        const centerY = (layout.y / 100) * pageCanvas.height;
        const drawW = (layout.widthPercent / 100) * pageCanvas.width;
        const drawH = drawW * (canvas.height / canvas.width);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((layout.rotation * Math.PI) / 180);
        ctx.drawImage(canvas, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(imgData, 'JPEG', 0, 0, paperDim.widthMm, paperDim.heightMm);
        continue;
      }
    }

    // Default centered fit
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const marginMm = 5;
    const availW = paperDim.widthMm - marginMm * 2;
    const availH = paperDim.heightMm - marginMm * 2;

    const imgRatio = canvas.width / canvas.height;
    const pageRatio = availW / availH;

    let targetW = availW;
    let targetH = availH;
    let x = marginMm;
    let y = marginMm;

    if (imgRatio > pageRatio) {
      targetH = availW / imgRatio;
      y = marginMm + (availH - targetH) / 2;
    } else {
      targetW = availH * imgRatio;
      x = marginMm + (availW - targetW) / 2;
    }

    doc.addImage(imgData, 'JPEG', x, y, targetW, targetH);
  }

  doc.save(filename);
}

/**
 * Downloads a canvas as a PNG or JPEG file
 */
export function downloadCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string = 'Document_Print.png',
  format: 'png' | 'jpeg' = 'png'
): void {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.95 : 1.0);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
