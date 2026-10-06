export type FilterType =
  | 'original'
  | 'grayscale'
  | 'sepia'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'vintage'
  | 'soft'
  | 'highContrast';

export interface ImageAdjustments {
  brightness: number; // -100 to 100 (0 default)
  contrast: number; // -100 to 100 (0 default)
  saturation: number; // -100 to 100 (0 default)
  exposure: number; // -100 to 100 (0 default)
  blur: number; // 0 to 20 (0 default)
  sharpness: number; // 0 to 100 (0 default)
}

export interface BackgroundSettings {
  isTransparent: boolean;
  color: string; // e.g. '#FFFFFF'
}

export interface BorderSettings {
  enabled: boolean;
  color: string;
  width: number; // 0 to 40
  radius: number; // 0 to 40
}

export interface TransformSettings {
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AspectRatioOption =
  | 'free'
  | '2x2'
  | '1.4x1.8'
  | 'custom'
  | '1:1'
  | '4:5'
  | '3:4'
  | '4:3'
  | '16:9'
  | 'passport'
  | 'bd_passport'
  | 'bd_stamp'
  | 'custom_inch';

export interface CustomInchSize {
  widthInches: number;
  heightInches: number;
  dpi: number;
}

export interface PassportSettings {
  active: boolean;
  standard:
    | 'us'
    | 'uk'
    | 'eu'
    | 'ca'
    | 'schengen'
    | 'bd'
    | 'bd_standard'
    | 'bd_stamp'
    | 'joint_pension'
    | 'joint_standard'
    | 'joint_square'
    | 'joint_landscape'
    | 'joint_bd'
    | 'custom';
  widthMm: number;
  heightMm: number;
  aspectRatio: number;
  showGuides: boolean;
  targetWidthPx: number;
  targetHeightPx: number;
  isJoint?: boolean;
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  blur: 0,
  sharpness: 0,
};

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  isTransparent: false,
  color: '#FFFFFF',
};

export const DEFAULT_BORDER: BorderSettings = {
  enabled: false,
  color: '#FFFFFF',
  width: 2,
  radius: 0,
};

export const DEFAULT_TRANSFORM: TransformSettings = {
  rotation: 0,
  flipH: false,
  flipV: false,
};

export const DEFAULT_PASSPORT: PassportSettings = {
  active: false,
  standard: 'bd',
  widthMm: 45,
  heightMm: 55,
  aspectRatio: 45 / 55,
  showGuides: true,
  targetWidthPx: 531,
  targetHeightPx: 650,
};

export interface ImageItem {
  id: string;
  name: string;
  originalFile?: File;
  originalUrl: string; // Data URL or Object URL of original source
  currentUrl: string; // Current image source (after crop/resize)
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  thumbnailUrl: string;
  sizeBytes: number;
  mimeType: string;
  adjustments: ImageAdjustments;
  filter: FilterType;
  background: BackgroundSettings;
  border: BorderSettings;
  transform: TransformSettings;
  cropRect?: CropRect;
  isCropped?: boolean;
  passport: PassportSettings;
}

export interface HistorySnapshot {
  currentUrl: string;
  width: number;
  height: number;
  adjustments: ImageAdjustments;
  filter: FilterType;
  background: BackgroundSettings;
  border: BorderSettings;
  transform: TransformSettings;
  passport: PassportSettings;
  description: string;
}

export type ObjectDetectionTarget = 'none' | 'face' | 'skin' | 'hair';

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

export interface DetectionResult {
  target: 'face' | 'skin' | 'hair';
  box: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
  confidence: number;
  label: string;
  details?: {
    attributeTitle: string;
    attributeValue: string;
    suggestedEnhancement: string;
  };
}

export interface SelectedAreaAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  smoothness: number; // 0 to 50
  warmth: number; // -50 to 50
}

export interface AIDetectionData {
  face?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    confidence: number;
    attributes?: {
      lighting?: string;
      expression?: string;
      pose?: string;
    };
    suggestedAdjustments?: {
      brightness: number;
      contrast: number;
      saturation: number;
      sharpness?: number;
    };
    biometricContour?: {
      centerX: number;
      centerY: number;
      radiusX: number;
      radiusY: number;
      svgPath: string;
      landmarks: {
        leftEye: { x: number; y: number };
        rightEye: { x: number; y: number };
        noseTip: { x: number; y: number };
        mouthCenter: { x: number; y: number };
        chinTip: { x: number; y: number };
      };
      recommendedPassportCrop?: CropRect;
    };
  };
  skin?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    tone: string;
    suggestedAdjustments?: {
      brightness: number;
      blur: number;
      saturation: number;
    };
    coveragePercent?: number;
    svgPath?: string;
  };
  hair?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    texture: string;
    suggestedAdjustments?: {
      contrast: number;
      sharpness: number;
    };
    coveragePercent?: number;
    color?: string;
    svgPath?: string;
  };
  enhancement?: {
    brightness: number;
    contrast: number;
    saturation: number;
    exposure: number;
    sharpness: number;
    blur: number;
    explanation?: string;
  };
  summary?: string;
  provider?: string;
  model?: string;
}

export type ActiveTool =
  | 'adjustments'
  | 'crop'
  | 'resize'
  | 'rotateFlip'
  | 'filters'
  | 'background'
  | 'border'
  | 'passport'
  | 'ai'
  | 'print'
  | 'futureLabs'
  | 'object'
  | 'removeBg'
  | 'enhance';

export interface AIStatusInfo {
  configured: boolean;
  activeProvider: string;
  model: string;
  hasTokenHarborKey?: boolean;
  hasGeminiKey?: boolean;
  removeBg?: {
    isConfigured: boolean;
    hasUsableCredits?: boolean;
    message?: string;
  };
  swinIR?: {
    enabled: boolean;
    isConfigured: boolean;
  };
}
