/**
 * PRIVACY NOTICE:
 * The learning system stores only anonymous crop geometry and detection metadata locally.
 * Uploaded images, pixel buffers, document content, or personal identifiers are NEVER stored as training data.
 */

export type PointCoord = [number, number]; // [normalizedX, normalizedY] where 0.0 <= x,y <= 1.0

export interface CornersTuple {
  topLeft: PointCoord;
  topRight: PointCoord;
  bottomRight: PointCoord;
  bottomLeft: PointCoord;
}

export type UserActionType =
  | 'accepted'
  | 'minor_correction'
  | 'major_correction'
  | 'manual_crop'
  | 'reset';

export interface GeometricFeatureSummary {
  aspectRatio: number; // Width / Height of the quadrilateral
  documentAreaRatio: number; // Area of quad / Total image area (0.0 to 1.0)
  rectangularity: number; // Similarity to a pure rectangle (0.0 to 1.0)
  perspectiveScore: number; // Asymmetry / trapezoidal deformation score (0.0 = flat, 1.0 = sharp perspective)
  edgeStrength?: number; // Normalized contrast / edge confidence (0.0 to 1.0)
  boundaryProximity?: number; // Minimum distance to any of the 4 outer image edges (0.0 to 0.5)
}

export interface CropLearningSample {
  id: string;
  timestamp: number;
  imageWidth: number;
  imageHeight: number;

  predictedCorners: CornersTuple;
  finalCorners: CornersTuple;

  correctionMagnitude: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };

  rotation: number;
  detectorConfidence: number;
  detectionMethod: string;
  detectorVersion: string;

  userAction: UserActionType;
  featureSummary?: GeometricFeatureSummary;
}

export interface DetectorLearningConfig {
  enabled: boolean;
  minSamples: number; // Minimum samples required before applying statistical self-tuning (default: 100)
  maxSamples: number; // Hard ceiling on IndexedDB stored samples (default: 5000)
  autoTune: boolean;
  autoAcceptThreshold: number; // Corner displacement <= 0.005 is classified as 'accepted'
  minorCorrectionThreshold: number; // Corner displacement <= 0.03 is 'minor_correction'
  majorCorrectionThreshold: number; // Corner displacement > 0.03 is 'major_correction'
}

export interface DetectorConfig {
  minDocumentArea: number;
  maxDocumentArea: number;
  minRectangularity: number;
  edgeThreshold: number;
  perspectiveTolerance: number;
  learning: DetectorLearningConfig;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  minDocumentArea: 0.1,
  maxDocumentArea: 0.98,
  minRectangularity: 0.75,
  edgeThreshold: 0.25,
  perspectiveTolerance: 0.35,
  learning: {
    enabled: true,
    minSamples: 100,
    maxSamples: 5000,
    autoTune: true,
    autoAcceptThreshold: 0.005,
    minorCorrectionThreshold: 0.03,
    majorCorrectionThreshold: 0.08,
  },
};

export const CURRENT_DETECTOR_VERSION = '2.1.0';

export interface FailurePattern {
  id: string;
  title: string;
  description: string;
  frequencyPercentage: number;
  impact: 'low' | 'medium' | 'high';
  suggestedAction: string;
}

export interface AggregateMetrics {
  totalSamples: number;
  accepted: number;
  minorCorrections: number;
  majorCorrections: number;
  manualCrops: number;
  resets: number;

  acceptanceRate: number; // Automatic Acceptance Rate (0.0 to 1.0)
  minorCorrectionRate: number;
  majorCorrectionRate: number;

  averageCorrection: {
    topLeft: PointCoord;
    topRight: PointCoord;
    bottomRight: PointCoord;
    bottomLeft: PointCoord;
  };

  medianCorrection: {
    topLeft: PointCoord;
    topRight: PointCoord;
    bottomRight: PointCoord;
    bottomLeft: PointCoord;
  };

  p90CorrectionMagnitude: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };

  accuracyTrends: {
    last100: number | null;
    last500: number | null;
    last1000: number | null;
    all: number;
  };

  confidenceVsCorrection: {
    highConfidenceAvgMagnitude: number;
    mediumConfidenceAvgMagnitude: number;
    lowConfidenceAvgMagnitude: number;
  };

  failurePatterns: FailurePattern[];
  learningStatus: 'Collecting Data' | 'Enough Data for Analysis' | 'Tuning Available';
  detectorVersion: string;
}

export interface CandidateEvaluationResult {
  currentConfig: DetectorConfig;
  candidateConfig: DetectorConfig;
  simulatedSampleCount: number;
  currentAvgError: number;
  candidateAvgError: number;
  errorImprovementRatio: number; // e.g. 0.12 = 12% improvement
  predictedAcceptanceGain: number; // e.g. +4.5%
  recommendation: 'promote' | 'keep_current' | 'gather_more_data';
}
