export interface Point {
  x: number; // 0 to 1 normalized coordinate
  y: number; // 0 to 1 normalized coordinate
}

export interface CropData {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface Candidate {
  corners: CropData;
  score: number;
  areaScore: number;
  aspectScore: number;
  rectangularityScore: number;
  edgeContinuityScore: number;
  geometryScore: number;
  centerScore: number;
  method: string;
  area: number;
  aspectRatio: number;
  isContainedInAnother?: boolean;
}

export interface DetectionResult {
  success: boolean;
  confidence: number;
  corners?: CropData;
  method?: string;
  candidates?: Candidate[];
}

export interface ImageAdjustments {
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  saturation: number;  // -100 to 100
  levels: number;      // 0 to 100 (Black/White level boost)
  textDeepen: number;  // 0 to 100 (Darkens text/ink lines)
  sharpen: number;     // 0 to 100 (Unsharp mask filter strength)
  upscale: number;     // 1.0 to 4.0 (Resampling multiplier)
}

export type SideId = 'front' | 'back';

export interface ImageSideState {
  id: SideId;
  sourceFile?: File;
  sourceUrl?: string;
  originalImage?: HTMLImageElement; // Touched NEVER - pristine uploaded source
  workingCanvas?: HTMLCanvasElement; // Rotated image in working orientation
  width: number;
  height: number;
  cropCorners: CropData; // 4 corners in 0..1 coordinates relative to working canvas
  isCropped: boolean; // false = in 4-corner selection/adjustment stage; true = final perspective cropped
  rotation: number; // 0, 90, 180, 270 degrees
  adjustments: ImageAdjustments;
  detectionResult?: DetectionResult;
  isProcessing: boolean;
  error?: string;
}

export type ActiveTab = 'both' | 'front' | 'back' | 'combined';

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  levels: 0,
  textDeepen: 0,
  sharpen: 0,
  upscale: 1.0,
};

export const DEFAULT_CROP: CropData = {
  topLeft: { x: 0.04, y: 0.04 },
  topRight: { x: 0.96, y: 0.04 },
  bottomRight: { x: 0.96, y: 0.96 },
  bottomLeft: { x: 0.04, y: 0.96 },
};
