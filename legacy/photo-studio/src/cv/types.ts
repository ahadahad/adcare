/**
 * Computer Vision Types and Data Interfaces
 * Modular CV layer for face detection, landmarks, segmentation, passport positioning, and enhancement.
 */

export interface Point2D {
  x: number;
  y: number;
  z?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  id: string;
  boundingBox: BoundingBox;
  confidence: number;
  landmarks: {
    leftEye: Point2D;
    rightEye: Point2D;
    noseTip: Point2D;
    mouthCenter: Point2D;
    chinTip: Point2D;
    forehead?: Point2D;
  };
  faceCenter: Point2D;
  headRotationDegrees: number; // Roll angle in degrees
  faceHeightRatio: number; // Face height relative to total image height (0-1)
  faceWidthRatio: number;  // Face width relative to total image width (0-1)
  biometricOvalPath: string; // SVG path string for biometric guide overlay
}

export interface SegmentationResult {
  maskCanvas: HTMLCanvasElement;
  maskData?: Uint8ClampedArray;
  confidence: number;
  width: number;
  height: number;
  subjectType: 'person' | 'portrait' | 'object';
  dominantBgColor: string;
}

export interface HairSkinSegmentationResult {
  faceSkinMaskCanvas: HTMLCanvasElement;
  bodySkinMaskCanvas: HTMLCanvasElement;
  hairMaskCanvas?: HTMLCanvasElement;
  skinCoveragePercent: number;
  skinToneDescription: string;
  hairCoveragePercent?: number;
  hairColorDescription?: string;
  hairBounds?: { xmin: number; ymin: number; xmax: number; ymax: number };
  skinBounds?: { xmin: number; ymin: number; xmax: number; ymax: number };
  hairSvgPath?: string;
  skinSvgPath?: string;
}

export interface PhotoSpecification {
  id: string;
  name: string;
  country: string;
  category: 'passport' | 'visa' | 'id' | 'joint';
  widthPx: number;
  heightPx: number;
  physicalWidthMm: number;
  physicalHeightMm: number;
  dpi: number;
  backgroundColor: string; // Hex color code
  faceHeightMinRatio: number; // Typically 0.60 to 0.70 of frame height
  faceHeightMaxRatio: number; // Typically 0.70 to 0.80 of frame height
  eyeLinePositionRatio: number; // Distance from top margin (typically 0.40 - 0.45)
  isJoint?: boolean;
}

export interface PassportCropResult {
  cropRect: BoundingBox;
  spec: PhotoSpecification;
  eyeLineY: number;
  chinLineY: number;
  warnings: string[];
  isValid: boolean;
}

export interface BiometricValidationWarning {
  code:
    | 'NO_FACE'
    | 'MULTIPLE_FACES'
    | 'HEAD_TILTED'
    | 'FACE_TOO_LARGE'
    | 'FACE_TOO_SMALL'
    | 'FACE_OFF_CENTER'
    | 'EYES_OUT_OF_BOUNDS';
  message: string;
  severity: 'warning' | 'info' | 'error';
}

export interface EnhancementParameters {
  exposure: number;   // -100 to 100
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  sharpness: number;  // 0 to 100
  noiseReduction?: number; // 0 to 100
  whiteBalanceWarmth?: number; // -50 to 50
}
