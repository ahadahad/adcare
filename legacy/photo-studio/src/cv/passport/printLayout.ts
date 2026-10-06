/**
 * Single Source of Truth Print Layout Engine
 * 
 * Physical size (millimeters) is the fundamental source of truth.
 * Calculation:
 *   pixels = (millimeters / 25.4) * DPI
 * 
 * Unified architecture powering:
 * 1. Interactive Print Studio Workspace with Rulers & Viewport Zoom
 * 2. 300 DPI High-Resolution Sheet Export
 * 3. Exact Physical Dimension Vector PDF
 * 4. Exact Physical Millimeter Browser Printing (@page size: ...mm)
 */

import { PhotoSpecification } from '../types';

export type PaperSizeKey = '4x6' | '5x7' | 'a4' | 'letter';

export interface PaperDefinition {
  id: PaperSizeKey;
  name: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  defaultOrientation: 'portrait' | 'landscape';
}

/**
 * Central Paper Definitions (Single source of truth)
 */
export const PAPER_SIZES: Record<PaperSizeKey, PaperDefinition> = {
  '4x6': {
    id: '4x6',
    name: '4 × 6" Photo Paper',
    shortLabel: '4 × 6"',
    widthMm: 101.6,
    heightMm: 152.4,
    defaultOrientation: 'portrait',
  },
  '5x7': {
    id: '5x7',
    name: '5 × 7" Photo Paper',
    shortLabel: '5 × 7"',
    widthMm: 127.0,
    heightMm: 177.8,
    defaultOrientation: 'portrait',
  },
  'a4': {
    id: 'a4',
    name: 'A4 Standard (210 × 297 mm)',
    shortLabel: 'A4',
    widthMm: 210.0,
    heightMm: 297.0,
    defaultOrientation: 'portrait',
  },
  'letter': {
    id: 'letter',
    name: 'US Letter (8.5 × 11")',
    shortLabel: 'Letter',
    widthMm: 215.9,
    heightMm: 279.4,
    defaultOrientation: 'portrait',
  },
};

/**
 * Standard Photo Dimensions (mm)
 */
export const PHOTO_PRESETS = {
  ppWide: { widthMm: 40, heightMm: 50, label: 'PP (40×50mm)' },
  ppStandard: { widthMm: 35, heightMm: 45, label: 'PP (35×45mm)' },
  stStandard: { widthMm: 20, heightMm: 25, label: 'ST (20×25mm)' },
};

/**
 * Interactive Photo Copy Layout Item
 */
export interface PrintPhotoItem {
  id: string;
  sourceImageId: string;
  photoType: 'pp' | 'st' | 'custom';
  name?: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation?: number;
  selected?: boolean;
}

/**
 * Print Studio Page Settings
 */
export interface PageSettings {
  perRow: number;
  gapMm: number;
  gapPx: number;
  topMarginMm: number;
  leftMarginMm: number;
  center: boolean;
  measurement: boolean;
  wide: boolean;
  borderEnabled: boolean;
  borderColor: string;
  borderWidthMm: number;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  perRow: 4,
  gapMm: 4,
  gapPx: 15,
  topMarginMm: 10,
  leftMarginMm: 10,
  center: true,
  measurement: true,
  wide: true,
  borderEnabled: true,
  borderColor: '#000000',
  borderWidthMm: 0.25,
};

/**
 * Arranges photo items into rows and columns on the paper sheet
 * based on Page Settings (perRow, gap, margins, centering).
 */
export function arrangePhotoItems(
  items: PrintPhotoItem[],
  settings: PageSettings,
  paperWidthMm: number,
  paperHeightMm: number
): PrintPhotoItem[] {
  if (items.length === 0) return [];

  const gap = settings.gapMm;
  const perRow = Math.max(1, settings.perRow);
  const topMargin = settings.topMarginMm;
  const leftMargin = settings.leftMarginMm;

  // Group items into rows
  const rows: PrintPhotoItem[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }

  let currentY = topMargin;
  const arranged: PrintPhotoItem[] = [];

  for (const row of rows) {
    const rowWidth = row.reduce((sum, it) => sum + it.widthMm, 0) + (row.length - 1) * gap;
    const startX = settings.center
      ? Math.max(leftMargin, (paperWidthMm - rowWidth) / 2)
      : leftMargin;

    let currentX = startX;
    let maxHeightInRow = 0;

    for (const item of row) {
      arranged.push({
        ...item,
        xMm: parseFloat(currentX.toFixed(3)),
        yMm: parseFloat(currentY.toFixed(3)),
      });
      currentX += item.widthMm + gap;
      if (item.heightMm > maxHeightInRow) {
        maxHeightInRow = item.heightMm;
      }
    }

    currentY += maxHeightInRow + gap;
  }

  return arranged;
}

export interface PrintPhotoRect {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PrintPageLayout {
  pageIndex: number;
  photoRects: PrintPhotoRect[];
}

export interface PrintLayout {
  paperKey: PaperSizeKey;
  paperName: string;
  paperWidthMm: number;
  paperHeightMm: number;
  dpi: number;
  orientation: 'portrait' | 'landscape';

  photoWidthMm: number;
  photoHeightMm: number;

  copies: number;
  totalCopies: number;
  copiesPerPage: number;
  totalPages: number;

  marginMm: number;
  gapMm: number;
  cutLineOffsetMm: number;

  columns: number;
  rows: number;

  pages: PrintPageLayout[];
  photoRects: PrintPhotoRect[];
}

export interface CalculatePrintLayoutOptions {
  paperSize: PaperSizeKey;
  photoWidthMm?: number;
  photoHeightMm?: number;
  copies: number;
  marginMm?: number;
  gapMm?: number;
  dpi?: number;
  spec?: PhotoSpecification | null;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Calculates a mathematically exact, centered physical layout for single-photo grids.
 * Used for automated calculation and backward compatibility.
 */
export function calculatePrintLayout(options: CalculatePrintLayoutOptions): PrintLayout {
  const paperDef = PAPER_SIZES[options.paperSize] || PAPER_SIZES['4x6'];
  const dpi = options.dpi || 300;
  const marginMm = options.marginMm ?? 8;
  const gapMm = options.gapMm ?? 4;
  const cutLineOffsetMm = 0.75;

  let photoWidthMm = 35;
  let photoHeightMm = 45;
  if (options.spec) {
    photoWidthMm = options.spec.physicalWidthMm;
    photoHeightMm = options.spec.physicalHeightMm;
  } else if (options.photoWidthMm && options.photoHeightMm) {
    photoWidthMm = options.photoWidthMm;
    photoHeightMm = options.photoHeightMm;
  }

  const orientation = options.orientation || paperDef.defaultOrientation;
  let paperWidthMm = Math.min(paperDef.widthMm, paperDef.heightMm);
  let paperHeightMm = Math.max(paperDef.widthMm, paperDef.heightMm);

  if (orientation === 'landscape') {
    paperWidthMm = Math.max(paperDef.widthMm, paperDef.heightMm);
    paperHeightMm = Math.min(paperDef.widthMm, paperDef.heightMm);
  }

  const availableWidthMm = Math.max(1, paperWidthMm - marginMm * 2);
  const availableHeightMm = Math.max(1, paperHeightMm - marginMm * 2);

  const maxCols = Math.max(1, Math.floor((availableWidthMm + gapMm) / (photoWidthMm + gapMm)));
  const maxRows = Math.max(1, Math.floor((availableHeightMm + gapMm) / (photoHeightMm + gapMm)));
  const maxCopiesPerPage = Math.max(1, maxCols * maxRows);

  const totalCopies = Math.max(1, options.copies);
  const totalPages = Math.ceil(totalCopies / maxCopiesPerPage);

  const pages: PrintPageLayout[] = [];
  let remainingCopies = totalCopies;

  for (let p = 0; p < totalPages; p++) {
    const pageCopies = Math.min(remainingCopies, maxCopiesPerPage);
    remainingCopies -= pageCopies;

    let cols = Math.min(pageCopies, maxCols);
    let rows = Math.ceil(pageCopies / cols);

    if (pageCopies === 12 && maxCols >= 4 && maxRows >= 3) {
      cols = 4;
      rows = 3;
    } else if (pageCopies === 12 && maxCols >= 3 && maxRows >= 4) {
      cols = 3;
      rows = 4;
    } else if (pageCopies === 8 && maxCols >= 4 && maxRows >= 2) {
      cols = 4;
      rows = 2;
    } else if (pageCopies === 8 && maxCols >= 2 && maxRows >= 4) {
      cols = 2;
      rows = 4;
    } else if (pageCopies === 6 && maxCols >= 3 && maxRows >= 2) {
      cols = 3;
      rows = 2;
    } else if (pageCopies === 6 && maxCols >= 2 && maxRows >= 3) {
      cols = 2;
      rows = 3;
    } else if (pageCopies === 4 && maxCols >= 2 && maxRows >= 2) {
      cols = 2;
      rows = 2;
    } else if (pageCopies === 2 && maxCols >= 2) {
      cols = 2;
      rows = 1;
    }

    const totalBlockWidthMm = cols * photoWidthMm + (cols - 1) * gapMm;
    const totalBlockHeightMm = rows * photoHeightMm + (rows - 1) * gapMm;
    const startXMm = Math.max(marginMm, (paperWidthMm - totalBlockWidthMm) / 2);
    const startYMm = Math.max(marginMm, (paperHeightMm - totalBlockHeightMm) / 2);

    const pagePhotoRects: PrintPhotoRect[] = [];

    for (let i = 0; i < pageCopies; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const xMm = startXMm + col * (photoWidthMm + gapMm);
      const yMm = startYMm + row * (photoHeightMm + gapMm);

      pagePhotoRects.push({
        xMm: parseFloat(xMm.toFixed(3)),
        yMm: parseFloat(yMm.toFixed(3)),
        widthMm: parseFloat(photoWidthMm.toFixed(3)),
        heightMm: parseFloat(photoHeightMm.toFixed(3)),
      });
    }

    pages.push({
      pageIndex: p,
      photoRects: pagePhotoRects,
    });
  }

  const firstPageCopies = pages[0]?.photoRects.length || 1;
  const defCols = Math.min(firstPageCopies, maxCols);
  const defRows = Math.ceil(firstPageCopies / defCols);

  return {
    paperKey: paperDef.id,
    paperName: paperDef.name,
    paperWidthMm,
    paperHeightMm,
    dpi,
    orientation,
    photoWidthMm,
    photoHeightMm,
    copies: totalCopies,
    totalCopies,
    copiesPerPage: maxCopiesPerPage,
    totalPages,
    marginMm,
    gapMm,
    cutLineOffsetMm,
    columns: defCols,
    rows: defRows,
    pages,
    photoRects: pages[0]?.photoRects || [],
  };
}

/**
 * Draws a source image into target destination with strict COVER fit (aspect ratio preserved, no distortion)
 */
export function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const sw = (source as any).naturalWidth || (source as any).width;
  const sh = (source as any).naturalHeight || (source as any).height;
  if (!sw || !sh) return;

  const sourceAspect = sw / sh;
  const targetAspect = dw / dh;

  let cropX = 0;
  let cropY = 0;
  let cropW = sw;
  let cropH = sh;

  if (sourceAspect > targetAspect) {
    // Source is wider than target: crop left and right
    cropW = sh * targetAspect;
    cropX = (sw - cropW) / 2;
  } else if (sourceAspect < targetAspect) {
    // Source is taller than target: crop top and bottom
    cropH = sw / targetAspect;
    cropY = (sh - cropH) / 2;
  }

  ctx.drawImage(
    source,
    Math.round(cropX),
    Math.round(cropY),
    Math.round(cropW),
    Math.round(cropH),
    Math.round(dx),
    Math.round(dy),
    Math.round(dw),
    Math.round(dh)
  );
}

/**
 * Creates an exact-aspect-ratio cropped copy of the source photo
 * Ensures PDF export and browser print never stretch the image
 */
export function createCoverPhotoCanvas(
  source: CanvasImageSource,
  targetWidthMm: number,
  targetHeightMm: number,
  dpi = 300
): HTMLCanvasElement {
  const targetW = Math.max(1, Math.round((targetWidthMm / 25.4) * dpi));
  const targetH = Math.max(1, Math.round((targetHeightMm / 25.4) * dpi));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D Canvas unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawPhotoCover(ctx, source, 0, 0, targetW, targetH);
  return canvas;
}
