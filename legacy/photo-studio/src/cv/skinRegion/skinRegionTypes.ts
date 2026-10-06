/**
 * Skin Region Types & Interfaces
 * Pure semantic segmentation architecture for Human Skin detection across all visible skin.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalibratedSkinModel {
  meanCb: number;
  meanCr: number;
  stdCb: number;
  stdCr: number;
  meanY: number;
  meanHue: number;
  meanSat: number;
  isCalibrated: boolean;
}

export interface SkinRegionResult {
  /**
   * 8-bit alpha mask buffer at working preview resolution (width x height)
   * Values 0 to 255 (0 = background/clothes/hair/eyes/mouth, 255 = selected skin)
   */
  alpha: Uint8ClampedArray;

  /**
   * Working preview resolution dimensions (never 4K/6K)
   */
  width: number;
  height: number;

  /**
   * Original image dimensions
   */
  originalWidth: number;
  originalHeight: number;

  /**
   * Vector contour boundary points scaled to original full-image coordinates
   * (for rendering sharp outline on PhotoCanvas)
   */
  contourPoints: Point2D[];

  /**
   * Vector contour boundary points in working preview coordinates
   */
  previewContourPoints: Point2D[];

  /**
   * Active skin region bounding box in original image coordinates
   */
  bounds: Rect;

  /**
   * Active skin region bounding box in preview coordinates
   */
  previewBounds: Rect;

  /**
   * Pre-rendered mask canvas at preview resolution (grayscale/alpha)
   */
  maskCanvas: HTMLCanvasElement;

  /**
   * Pre-rendered overlay canvas (semi-transparent fill + cyan boundary line) at preview resolution
   */
  overlayCanvas: HTMLCanvasElement;

  /**
   * Total skin pixel coverage percentage of image (e.g. 18.5%)
   */
  skinCoveragePercent: number;

  /**
   * Calibrated skin tone classification (e.g. "Warm Golden", "Fair Ivory", "Deep Bronze")
   */
  skinToneDescription: string;

  /**
   * Calibrated skin model parameters
   */
  skinModel: CalibratedSkinModel;
}
