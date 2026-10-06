import { Point2D, QuadCrop } from '../../types';
import { cropLearningAnalyzer } from './CropLearningAnalyzer';
import { extractGeometricFeatures } from './CropLearningFeatures';
import { cropLearningRulesEngine, LearnedRule } from './CropLearningRules';
import { cropLearningStore } from './CropLearningStore';
import {
  AggregateMetrics,
  CandidateEvaluationResult,
  CornersTuple,
  CropLearningSample,
  CURRENT_DETECTOR_VERSION,
  DEFAULT_DETECTOR_CONFIG,
  DetectorConfig,
  PointCoord,
  UserActionType,
} from './CropLearningTypes';

/**
 * PRIVACY DECLARATION:
 * The learning engine operates strictly on anonymous geometric coordinate tuples.
 * Images, canvas pixels, buffers, documents, or OCR data are NEVER processed or stored.
 */
export class CropLearningEngine {
  private activeRules: LearnedRule[] = [];
  private cachedConfig: DetectorConfig = { ...DEFAULT_DETECTOR_CONFIG };
  private initialized = false;

  constructor() {
    this.refreshState().catch(() => {});
  }

  /**
   * Initializes config and rules from local IndexedDB.
   */
  async refreshState(): Promise<void> {
    try {
      this.cachedConfig = await cropLearningStore.getConfig();
      const samples = await cropLearningStore.getAllSamples();
      this.activeRules = cropLearningRulesEngine.generateRules(samples, this.cachedConfig);
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  /**
   * Safe conversion from QuadCrop to normalized [x, y] tuple.
   */
  private quadToTuple(q: QuadCrop): CornersTuple {
    return {
      topLeft: [Number(q.topLeft.x.toFixed(4)), Number(q.topLeft.y.toFixed(4))],
      topRight: [Number(q.topRight.x.toFixed(4)), Number(q.topRight.y.toFixed(4))],
      bottomRight: [Number(q.bottomRight.x.toFixed(4)), Number(q.bottomRight.y.toFixed(4))],
      bottomLeft: [Number(q.bottomLeft.x.toFixed(4)), Number(q.bottomLeft.y.toFixed(4))],
    };
  }

  /**
   * Safe conversion from CornersTuple back to QuadCrop.
   */
  private tupleToQuad(t: CornersTuple): QuadCrop {
    return {
      topLeft: { x: t.topLeft[0], y: t.topLeft[1] },
      topRight: { x: t.topRight[0], y: t.topRight[1] },
      bottomRight: { x: t.bottomRight[0], y: t.bottomRight[1] },
      bottomLeft: { x: t.bottomLeft[0], y: t.bottomLeft[1] },
    };
  }

  /**
   * Applies rule-based learned corrections to raw detection.
   * Architecture:
   * RAW DETECTION -> GEOMETRY VALIDATION -> LEARNED RULES -> FINAL CORNERS
   * If learning is disabled or insufficient samples exist, returns rawCorners unaltered.
   */
  applyLearnedCorrection(
    rawCorners: QuadCrop,
    imageWidth: number,
    imageHeight: number
  ): QuadCrop {
    if (!this.cachedConfig.learning.enabled || this.activeRules.length === 0) {
      return rawCorners;
    }

    try {
      const tuple = this.quadToTuple(rawCorners);
      const features = extractGeometricFeatures(tuple, imageWidth, imageHeight);
      const tunedTuple = cropLearningRulesEngine.applyRules(tuple, features, this.activeRules);
      return this.tupleToQuad(tunedTuple);
    } catch {
      return rawCorners;
    }
  }

  /**
   * Records an anonymous crop session whenever the user finishes editing / applies a crop.
   * Runs asynchronously in the background so dragging or editing is NEVER blocked.
   */
  async recordCropSession(params: {
    predictedCorners: QuadCrop;
    finalCorners: QuadCrop;
    imageWidth: number;
    imageHeight: number;
    rotation?: number;
    detectorConfidence?: number;
    detectionMethod?: string;
    isManualReset?: boolean;
    isFullManualCrop?: boolean;
    edgeStrength?: number;
  }): Promise<void> {
    if (!this.cachedConfig.learning.enabled) return;

    // Use queueMicrotask / Promise to guarantee asynchronous recording
    queueMicrotask(async () => {
      try {
        const pred = this.quadToTuple(params.predictedCorners);
        const fin = this.quadToTuple(params.finalCorners);

        const dTL = Math.hypot(fin.topLeft[0] - pred.topLeft[0], fin.topLeft[1] - pred.topLeft[1]);
        const dTR = Math.hypot(fin.topRight[0] - pred.topRight[0], fin.topRight[1] - pred.topRight[1]);
        const dBR = Math.hypot(fin.bottomRight[0] - pred.bottomRight[0], fin.bottomRight[1] - pred.bottomRight[1]);
        const dBL = Math.hypot(fin.bottomLeft[0] - pred.bottomLeft[0], fin.bottomLeft[1] - pred.bottomLeft[1]);

        const maxDisplacement = Math.max(dTL, dTR, dBR, dBL);

        // Infer user action based on configurable thresholds
        let userAction: UserActionType = 'accepted';
        if (params.isManualReset) {
          userAction = 'reset';
        } else if (params.isFullManualCrop) {
          userAction = 'manual_crop';
        } else if (maxDisplacement <= this.cachedConfig.learning.autoAcceptThreshold) {
          userAction = 'accepted';
        } else if (maxDisplacement <= this.cachedConfig.learning.minorCorrectionThreshold) {
          userAction = 'minor_correction';
        } else {
          userAction = 'major_correction';
        }

        const featureSummary = extractGeometricFeatures(
          fin,
          params.imageWidth,
          params.imageHeight,
          params.edgeStrength
        );

        const sample: CropLearningSample = {
          id: `sample_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          imageWidth: params.imageWidth,
          imageHeight: params.imageHeight,
          predictedCorners: pred,
          finalCorners: fin,
          correctionMagnitude: {
            topLeft: Number(dTL.toFixed(4)),
            topRight: Number(dTR.toFixed(4)),
            bottomRight: Number(dBR.toFixed(4)),
            bottomLeft: Number(dBL.toFixed(4)),
          },
          rotation: params.rotation || 0,
          detectorConfidence: Number((params.detectorConfidence ?? 0.95).toFixed(2)),
          detectionMethod: params.detectionMethod || 'Universal Auto-Detector',
          detectorVersion: CURRENT_DETECTOR_VERSION,
          userAction,
          featureSummary,
        };

        await cropLearningStore.saveSample(sample);

        // Refresh rules periodically if autoTune is active
        if (this.cachedConfig.learning.autoTune) {
          const count = await cropLearningStore.getSampleCount();
          if (count % 25 === 0) {
            this.refreshState().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Silent crop learning recording fallback:', err);
      }
    });
  }

  /**
   * Retrieves full aggregated data for developer dashboard.
   */
  async getDashboardData(): Promise<{
    metrics: AggregateMetrics;
    activeRules: LearnedRule[];
    candidateEvaluation: CandidateEvaluationResult;
    config: DetectorConfig;
  }> {
    const config = await cropLearningStore.getConfig();
    const samples = await cropLearningStore.getAllSamples();
    const metrics = cropLearningAnalyzer.computeMetrics(samples, config, CURRENT_DETECTOR_VERSION);

    // Formulate a tuned candidate configuration for A/B testing evaluation
    const candidateConfig: DetectorConfig = {
      ...config,
      perspectiveTolerance: 0.42, // Candidate with enhanced perspective leeway
      edgeThreshold: 0.22,
    };

    const candidateEvaluation = cropLearningAnalyzer.evaluateCandidateConfig(
      samples,
      config,
      candidateConfig
    );

    return {
      metrics,
      activeRules: this.activeRules,
      candidateEvaluation,
      config,
    };
  }

  /**
   * Updates detector learning configuration.
   */
  async updateConfig(newConfig: DetectorConfig): Promise<void> {
    this.cachedConfig = { ...newConfig };
    await cropLearningStore.saveConfig(newConfig);
    await this.refreshState();
  }

  /**
   * Clears learning data with confirmation.
   */
  async clearAllLearningData(): Promise<void> {
    await cropLearningStore.clearData();
    this.activeRules = [];
    await this.refreshState();
  }

  /**
   * Exports dataset as JSON.
   */
  async exportLearningData(): Promise<string> {
    return cropLearningStore.exportData();
  }

  getActiveRules(): LearnedRule[] {
    return [...this.activeRules];
  }
}

export const cropLearningEngine = new CropLearningEngine();
