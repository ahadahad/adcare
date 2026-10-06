/**
 * Face Region Types & Interfaces
 * Pure semantic segmentation architecture for Human Face & Ear detection.
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

export interface FaceRoi {
  /**
   * Safe Region of Interest in working preview coordinates
   */
  previewRoi: Rect;

  /**
   * Safe Region of Interest in original full-resolution coordinates
   */
  originalRoi: Rect;

  /**
   * Landmark-derived jawline boundary points (from left ear base to right ear base under chin)
   * in working preview coordinates
   */
  jawlinePoints: Point2D[];

  /**
   * Landmark-derived jawline boundary points in original image coordinates
   */
  originalJawlinePoints: Point2D[];

  /**
   * Key anatomical levels in preview coordinates
   */
  chinTip: Point2D;
  foreheadCenter: Point2D;
  noseTip: Point2D;
  leftEyebrowTopY: number;
  rightEyebrowTopY: number;

  /**
   * Lateral ear bounding regions in working preview coordinates
   */
  leftEarRegion: Rect;
  rightEarRegion: Rect;

  /**
   * Raw normalized landmarks (0.0 to 1.0)
   */
  normalizedLandmarks: Array<{ x: number; y: number; z?: number }>;

  /**
   * Working preview dimensions
   */
  previewWidth: number;
  previewHeight: number;

  /**
   * Original image dimensions
   */
  originalWidth: number;
  originalHeight: number;
}

export interface FaceRegionResult {
  /**
   * 8-bit alpha mask buffer at working preview resolution (width x height)
   * Values 0 to 255 (0 = background/excluded, 255 = selected face/ears)
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
   * Active face region bounding box in original image coordinates
   */
  bounds: Rect;

  /**
   * Active face region bounding box in preview coordinates
   */
  previewBounds: Rect;

  /**
   * Pre-rendered mask canvas at preview resolution
   */
  maskCanvas: HTMLCanvasElement;

  /**
   * Pre-rendered overlay canvas (semi-transparent fill + cyan boundary line) at preview resolution
   */
  overlayCanvas: HTMLCanvasElement;
}
