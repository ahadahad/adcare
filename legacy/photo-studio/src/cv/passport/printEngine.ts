/**
 * High-Precision Multi-Copy Print Engine
 * 
 * Physical size (millimeters) is the single source of truth.
 * Unified architecture powering:
 * 1. Interactive Print Studio Workspace with Rulers & Viewport Zoom
 * 2. 300 DPI High-Resolution Sheet Export
 * 3. Exact Physical Dimension Vector PDF
 * 4. Exact Physical Millimeter Browser Printing (@page size: ...mm)
 */

import { jsPDF } from 'jspdf';
import { PhotoSpecification } from '../types';
import {
  PaperSizeKey,
  PAPER_SIZES,
  calculatePrintLayout,
  drawPhotoCover,
  createCoverPhotoCanvas,
  PrintLayout,
  PrintPhotoItem,
  PageSettings,
  arrangePhotoItems,
  DEFAULT_PAGE_SETTINGS,
} from './printLayout';

export interface PrintSheetOptions {
  paperSize: PaperSizeKey;
  copies: number;
  showCutLines: boolean;
  dpi?: number;
  marginMm?: number;
  gapMm?: number;
  spec?: PhotoSpecification | null;
  orientation?: 'portrait' | 'landscape';
}

export interface ItemsPrintOptions {
  paperKey: PaperSizeKey;
  paperWidthMm: number;
  paperHeightMm: number;
  dpi?: number;
  showCutLines?: boolean;
  measurementLines?: boolean;
  borderEnabled?: boolean;
  borderColor?: string;
  borderWidthMm?: number;
}

export class PrintEngine {
  /**
   * Calculates the unified print layout (single-photo grid mode)
   */
  public getLayout(options: PrintSheetOptions): PrintLayout {
    return calculatePrintLayout({
      paperSize: options.paperSize,
      copies: options.copies,
      marginMm: options.marginMm,
      gapMm: options.gapMm,
      dpi: options.dpi || 300,
      spec: options.spec,
      orientation: options.orientation,
    });
  }

  /**
   * Renders a multi-copy interactive canvas sheet from PrintPhotoItem array
   */
  public renderItemsSheetCanvas(
    items: PrintPhotoItem[],
    imageCanvasMap: Map<string, HTMLCanvasElement>,
    options: ItemsPrintOptions
  ): HTMLCanvasElement {
    const dpi = options.dpi || 300;
    const sheetW = Math.max(1, Math.round((options.paperWidthMm / 25.4) * dpi));
    const sheetH = Math.max(1, Math.round((options.paperHeightMm / 25.4) * dpi));

    const canvas = document.createElement('canvas');
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Print canvas context unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Pure white sheet
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetW, sheetH);

    const cutOffsetPx = Math.round((0.75 / 25.4) * dpi);
    const dashLengthPx = Math.max(2, Math.round((1.5 / 25.4) * dpi));

    // Get fallback canvas if specific ID not found
    const defaultCanvas = imageCanvasMap.values().next().value;

    for (const item of items) {
      const source = imageCanvasMap.get(item.sourceImageId) || defaultCanvas;
      if (!source) continue;

      const dx = Math.round((item.xMm / 25.4) * dpi);
      const dy = Math.round((item.yMm / 25.4) * dpi);
      const dw = Math.round((item.widthMm / 25.4) * dpi);
      const dh = Math.round((item.heightMm / 25.4) * dpi);

      // Draw photo with strict COVER fit
      drawPhotoCover(ctx, source, dx, dy, dw, dh);

      // Photo boundary line / border
      if (options.borderEnabled) {
        ctx.save();
        ctx.strokeStyle = options.borderColor || '#000000';
        ctx.lineWidth = Math.max(1, Math.round(((options.borderWidthMm ?? 0.25) / 25.4) * dpi));
        ctx.strokeRect(dx, dy, dw, dh);
        ctx.restore();
      }

      // Cut guidelines
      if (options.showCutLines) {
        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = Math.max(1, Math.round((0.25 / 25.4) * dpi));
        ctx.setLineDash([dashLengthPx, dashLengthPx]);
        ctx.strokeRect(
          dx - cutOffsetPx,
          dy - cutOffsetPx,
          dw + cutOffsetPx * 2,
          dh + cutOffsetPx * 2
        );
        ctx.restore();
      }

      // Measurement lines
      if (options.measurementLines) {
        ctx.save();
        ctx.fillStyle = '#64748B';
        const fontSizePx = Math.max(8, Math.round((2.0 / 25.4) * dpi));
        ctx.font = `${fontSizePx}px sans-serif`;
        ctx.textAlign = 'center';
        // Top dimension
        ctx.fillText(`${Math.round(item.widthMm)}mm`, dx + dw / 2, dy - Math.max(2, cutOffsetPx + 2));
        // Side dimension
        ctx.save();
        ctx.translate(dx - Math.max(2, cutOffsetPx + 2), dy + dh / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${Math.round(item.heightMm)}mm`, 0, 0);
        ctx.restore();
        ctx.restore();
      }
    }

    return canvas;
  }

  /**
   * Generates authentic vector PDF for PrintPhotoItem[] layout
   */
  public async exportItemsToPdf(
    items: PrintPhotoItem[],
    imageCanvasMap: Map<string, HTMLCanvasElement>,
    options: ItemsPrintOptions,
    filename?: string
  ): Promise<void> {
    const orientation = options.paperWidthMm > options.paperHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [options.paperWidthMm, options.paperHeightMm],
      compress: true,
    });

    const defaultCanvas = imageCanvasMap.values().next().value;
    const cutOffset = 0.75;

    // Cache pre-cropped images to optimize performance
    const coverCache = new Map<string, string>();

    for (const item of items) {
      const source = imageCanvasMap.get(item.sourceImageId) || defaultCanvas;
      if (!source) continue;

      const cacheKey = `${item.sourceImageId}_${item.widthMm}x${item.heightMm}`;
      let photoDataUrl = coverCache.get(cacheKey);

      if (!photoDataUrl) {
        const coverCanvas = createCoverPhotoCanvas(source, item.widthMm, item.heightMm, 300);
        photoDataUrl = coverCanvas.toDataURL('image/jpeg', 0.98);
        coverCache.set(cacheKey, photoDataUrl);
      }

      // Place image at exact physical mm coordinates
      pdf.addImage(
        photoDataUrl,
        'JPEG',
        item.xMm,
        item.yMm,
        item.widthMm,
        item.heightMm,
        undefined,
        'FAST'
      );

      // Outer border
      if (options.borderEnabled) {
        pdf.saveGraphicsState();
        const hex = (options.borderColor || '#000000').replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(options.borderWidthMm ?? 0.25);
        pdf.rect(item.xMm, item.yMm, item.widthMm, item.heightMm);
        pdf.restoreGraphicsState();
      }

      // Cut guidelines
      if (options.showCutLines) {
        pdf.saveGraphicsState();
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineDashPattern([1.5, 1.5], 0);
        pdf.setLineWidth(0.2);
        pdf.rect(
          item.xMm - cutOffset,
          item.yMm - cutOffset,
          item.widthMm + cutOffset * 2,
          item.heightMm + cutOffset * 2
        );
        pdf.restoreGraphicsState();
      }
    }

    const defaultFilename = `shebaflow-print-${options.paperKey}-${items.length}photos.pdf`;
    pdf.save(filename || defaultFilename);
  }

  /**
   * Generates exact physical browser print document HTML for PrintPhotoItem[]
   */
  public generateBrowserPrintItemsHtml(
    items: PrintPhotoItem[],
    imageCanvasMap: Map<string, HTMLCanvasElement>,
    options: ItemsPrintOptions
  ): string {
    const cutOffset = 0.75;
    const defaultCanvas = imageCanvasMap.values().next().value;
    const coverCache = new Map<string, string>();

    let photosHtml = '';

    for (const item of items) {
      const source = imageCanvasMap.get(item.sourceImageId) || defaultCanvas;
      if (!source) continue;

      const cacheKey = `${item.sourceImageId}_${item.widthMm}x${item.heightMm}`;
      let photoDataUrl = coverCache.get(cacheKey);

      if (!photoDataUrl) {
        const coverCanvas = createCoverPhotoCanvas(source, item.widthMm, item.heightMm, 300);
        photoDataUrl = coverCanvas.toDataURL('image/jpeg', 0.98);
        coverCache.set(cacheKey, photoDataUrl);
      }

      const cutLineHtml = options.showCutLines
        ? `<div class="cut-line" style="left: ${item.xMm - cutOffset}mm; top: ${item.yMm - cutOffset}mm; width: ${item.widthMm + cutOffset * 2}mm; height: ${item.heightMm + cutOffset * 2}mm;"></div>`
        : '';

      const borderStyle = options.borderEnabled
        ? `border: ${options.borderWidthMm ?? 0.25}mm solid ${options.borderColor || '#000000'};`
        : 'border: none;';

      photosHtml += `
        <div class="photo" style="left: ${item.xMm}mm; top: ${item.yMm}mm; width: ${item.widthMm}mm; height: ${item.heightMm}mm; ${borderStyle}">
          <img src="${photoDataUrl}" alt="${item.name || 'Photo'}" />
        </div>
        ${cutLineHtml}
      `;
    }

    let pageSizeRule = `${options.paperWidthMm}mm ${options.paperHeightMm}mm`;
    if (options.paperKey === '4x6') {
      pageSizeRule = '101.6mm 152.4mm';
    } else if (options.paperKey === '5x7') {
      pageSizeRule = '127mm 177.8mm';
    } else if (options.paperKey === 'a4') {
      pageSizeRule = 'A4 portrait';
    } else if (options.paperKey === 'letter') {
      pageSizeRule = 'Letter portrait';
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>ShebaFlow Print Studio Sheet</title>
          <style>
            @page {
              size: ${pageSizeRule};
              margin: 0;
            }
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            html, body {
              margin: 0;
              padding: 0;
              background: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sheet {
              width: ${options.paperWidthMm}mm;
              height: ${options.paperHeightMm}mm;
              margin: 0;
              padding: 0;
              position: relative;
              background: white;
              overflow: hidden;
              box-sizing: border-box;
            }
            .photo {
              position: absolute;
              overflow: hidden;
              background: white;
              box-sizing: border-box;
            }
            .photo img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
            .cut-line {
              position: absolute;
              border: 0.25mm dashed #CBD5E1;
              box-sizing: border-box;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${photosHtml}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Executes browser printing for PrintPhotoItem[] layout
   */
  public executeBrowserPrintItems(
    items: PrintPhotoItem[],
    imageCanvasMap: Map<string, HTMLCanvasElement>,
    options: ItemsPrintOptions
  ): void {
    const html = this.generateBrowserPrintItemsHtml(items, imageCanvasMap, options);

    const oldFrame = document.getElementById('shebaflow-print-frame');
    if (oldFrame) {
      oldFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'shebaflow-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print error, falling back:', e);
            window.print();
          }
        }, 350);
        return;
      }
    } catch (err) {
      console.warn('Print iframe error:', err);
    }

    window.print();
  }

  /**
   * Single-canvas grid render (backward compatibility)
   */
  public renderPrintSheetCanvas(
    singlePhotoCanvas: HTMLCanvasElement,
    options: PrintSheetOptions,
    pageIndex = 0
  ): HTMLCanvasElement {
    const dpi = options.dpi || 300;
    const layout = this.getLayout({ ...options, dpi });

    const sheetW = Math.round((layout.paperWidthMm / 25.4) * dpi);
    const sheetH = Math.round((layout.paperHeightMm / 25.4) * dpi);

    const canvas = document.createElement('canvas');
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Print canvas context unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetW, sheetH);

    const activePage = layout.pages[pageIndex] || layout.pages[0];
    if (!activePage) return canvas;

    const cutOffsetPx = Math.round((layout.cutLineOffsetMm / 25.4) * dpi);
    const dashLengthPx = Math.max(2, Math.round((1.5 / 25.4) * dpi));

    for (const rect of activePage.photoRects) {
      const dx = Math.round((rect.xMm / 25.4) * dpi);
      const dy = Math.round((rect.yMm / 25.4) * dpi);
      const dw = Math.round((rect.widthMm / 25.4) * dpi);
      const dh = Math.round((rect.heightMm / 25.4) * dpi);

      drawPhotoCover(ctx, singlePhotoCanvas, dx, dy, dw, dh);

      ctx.save();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = Math.max(1, Math.round((0.2 / 25.4) * dpi));
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.restore();

      if (options.showCutLines) {
        ctx.save();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = Math.max(1, Math.round((0.25 / 25.4) * dpi));
        ctx.setLineDash([dashLengthPx, dashLengthPx]);
        ctx.strokeRect(
          dx - cutOffsetPx,
          dy - cutOffsetPx,
          dw + cutOffsetPx * 2,
          dh + cutOffsetPx * 2
        );
        ctx.restore();
      }
    }

    return canvas;
  }

  /**
   * Single-canvas PDF export (backward compatibility)
   */
  public async exportPrintSheetToPdf(
    singlePhotoCanvas: HTMLCanvasElement,
    options: PrintSheetOptions,
    filename?: string
  ): Promise<void> {
    const layout = this.getLayout({ ...options, dpi: 300 });

    const pdf = new jsPDF({
      orientation: layout.orientation,
      unit: 'mm',
      format: [layout.paperWidthMm, layout.paperHeightMm],
      compress: true,
    });

    const coverCanvas = createCoverPhotoCanvas(
      singlePhotoCanvas,
      layout.photoWidthMm,
      layout.photoHeightMm,
      300
    );
    const photoDataUrl = coverCanvas.toDataURL('image/jpeg', 0.98);
    const cutOffset = layout.cutLineOffsetMm;

    for (let p = 0; p < layout.pages.length; p++) {
      if (p > 0) {
        pdf.addPage([layout.paperWidthMm, layout.paperHeightMm], layout.orientation);
      }

      const page = layout.pages[p];
      for (const rect of page.photoRects) {
        pdf.addImage(
          photoDataUrl,
          'JPEG',
          rect.xMm,
          rect.yMm,
          rect.widthMm,
          rect.heightMm,
          undefined,
          'FAST'
        );

        if (options.showCutLines) {
          pdf.saveGraphicsState();
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineDashPattern([1.5, 1.5], 0);
          pdf.setLineWidth(0.2);
          pdf.rect(
            rect.xMm - cutOffset,
            rect.yMm - cutOffset,
            rect.widthMm + cutOffset * 2,
            rect.heightMm + cutOffset * 2
          );
          pdf.restoreGraphicsState();
        }
      }
    }

    const defaultFilename = `passport-sheet-${layout.paperKey}-${layout.totalCopies}copies.pdf`;
    pdf.save(filename || defaultFilename);
  }

  /**
   * Single-canvas browser print (backward compatibility)
   */
  public executeBrowserPrint(
    singlePhotoCanvas: HTMLCanvasElement,
    options: PrintSheetOptions
  ): void {
    const map = new Map<string, HTMLCanvasElement>();
    map.set('default', singlePhotoCanvas);

    const layout = this.getLayout({ ...options, dpi: 300 });
    const items: PrintPhotoItem[] = [];

    const activePage = layout.pages[0];
    if (activePage) {
      for (let i = 0; i < activePage.photoRects.length; i++) {
        const r = activePage.photoRects[i];
        items.push({
          id: `item-${i}`,
          sourceImageId: 'default',
          photoType: 'pp',
          xMm: r.xMm,
          yMm: r.yMm,
          widthMm: r.widthMm,
          heightMm: r.heightMm,
        });
      }
    }

    this.executeBrowserPrintItems(items, map, {
      paperKey: layout.paperKey,
      paperWidthMm: layout.paperWidthMm,
      paperHeightMm: layout.paperHeightMm,
      showCutLines: options.showCutLines,
    });
  }

  /**
   * Generates browser print HTML string for a single canvas (backward compatibility)
   */
  public generateBrowserPrintHtml(
    singlePhotoCanvas: HTMLCanvasElement,
    options: PrintSheetOptions
  ): string {
    const map = new Map<string, HTMLCanvasElement>();
    map.set('default', singlePhotoCanvas);

    const layout = this.getLayout({ ...options, dpi: 300 });
    const items: PrintPhotoItem[] = [];

    const activePage = layout.pages[0];
    if (activePage) {
      for (let i = 0; i < activePage.photoRects.length; i++) {
        const r = activePage.photoRects[i];
        items.push({
          id: `item-${i}`,
          sourceImageId: 'default',
          photoType: 'pp',
          xMm: r.xMm,
          yMm: r.yMm,
          widthMm: r.widthMm,
          heightMm: r.heightMm,
        });
      }
    }

    return this.generateBrowserPrintItemsHtml(items, map, {
      paperKey: layout.paperKey,
      paperWidthMm: layout.paperWidthMm,
      paperHeightMm: layout.paperHeightMm,
      showCutLines: options.showCutLines,
    });
  }
}

export const printEngine = new PrintEngine();
export { PAPER_SIZES, calculatePrintLayout, arrangePhotoItems, DEFAULT_PAGE_SETTINGS };
export type { PrintLayout, PaperSizeKey, PrintPhotoItem, PageSettings };
