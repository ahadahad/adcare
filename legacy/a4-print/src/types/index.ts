export type DocumentMode = 'normal' | 'bw' | 'grayscale' | 'color';

export type UpscaleFactor = 1 | 2 | 4;

export interface DocumentAdjustments {
  mode: DocumentMode;
  black: number; // 0 to 200, default 100
  color: number; // -100 to 100, default 0
  contrast: number; // -100 to 100, default 0
  rotation: number; // 0, 90, 180, 270
  upscale: UpscaleFactor; // 1 = "1x Native (No upscale)", 2 = "Good (2x)", 4 = "Best (4x)"
}

export interface Point2D {
  x: number;
  y: number;
}

export interface QuadCrop {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export type PageSize = 'A4' | 'Legal';

export interface PaperDimensions {
  name: PageSize;
  widthMm: number;
  heightMm: number;
  widthIn: number;
  heightIn: number;
}

export const PAGE_SIZES: Record<PageSize, PaperDimensions> = {
  A4: {
    name: 'A4',
    widthMm: 210,
    heightMm: 297,
    widthIn: 8.268,
    heightIn: 11.693,
  },
  Legal: {
    name: 'Legal',
    widthMm: 215.9,
    heightMm: 355.6,
    widthIn: 8.5,
    heightIn: 14.0,
  },
};

export const A4_DIMENSIONS: PaperDimensions = PAGE_SIZES.A4;

export interface PrintLayoutSettings {
  x: number; // percentage of paper width (center = 50)
  y: number; // percentage of paper height (center = 50)
  widthPercent: number; // percentage of paper width occupied by document
  rotation: number; // free rotation angle in degrees (-180 to +180)
  pageSize: PageSize; // strictly 'A4' | 'Legal'
}

export const DEFAULT_PRINT_LAYOUT: PrintLayoutSettings = {
  x: 50,
  y: 50,
  widthPercent: 92,
  rotation: 0,
  pageSize: 'A4',
};

export interface DocumentPage {
  id: string;
  name: string;
  originalSrc: string;
  warpedCanvas?: HTMLCanvasElement;
  cropPoints?: QuadCrop;
  processedCanvas?: HTMLCanvasElement;
  previewUrl?: string; // Cached data URL for instant 60fps rendering without re-encoding
  thumbnailUrl?: string; // Tiny cached thumbnail URL for sidebar
  adjustments: DocumentAdjustments;
  history: DocumentAdjustments[];
  historyIndex: number;
  printLayout?: PrintLayoutSettings;
}
