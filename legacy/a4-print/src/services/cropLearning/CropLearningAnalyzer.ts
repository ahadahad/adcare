import {
  AggregateMetrics,
  CandidateEvaluationResult,
  CropLearningSample,
  CURRENT_DETECTOR_VERSION,
  DetectorConfig,
  FailurePattern,
  PointCoord,
} from './CropLearningTypes';

/**
 * Statistical analysis and aggregate metric calculation.
 * Computes acceptance trends, median/percentile corrections,
 * failure patterns, and candidate config A/B evaluations.
 */
export class CropLearningAnalyzer {
  /**
   * Computes full aggregate metrics over the provided sample dataset.
   */
  computeMetrics(
    samples: CropLearningSample[],
    config: DetectorConfig,
    activeVersion: string = CURRENT_DETECTOR_VERSION
  ): AggregateMetrics {
    const total = samples.length;

    if (total === 0) {
      return {
        totalSamples: 0,
        accepted: 0,
        minorCorrections: 0,
        majorCorrections: 0,
        manualCrops: 0,
        resets: 0,
        acceptanceRate: 0,
        minorCorrectionRate: 0,
        majorCorrectionRate: 0,
        averageCorrection: {
          topLeft: [0, 0],
          topRight: [0, 0],
          bottomRight: [0, 0],
          bottomLeft: [0, 0],
        },
        medianCorrection: {
          topLeft: [0, 0],
          topRight: [0, 0],
          bottomRight: [0, 0],
          bottomLeft: [0, 0],
        },
        p90CorrectionMagnitude: {
          topLeft: 0,
          topRight: 0,
          bottomRight: 0,
          bottomLeft: 0,
        },
        accuracyTrends: {
          last100: null,
          last500: null,
          last1000: null,
          all: 0,
        },
        confidenceVsCorrection: {
          highConfidenceAvgMagnitude: 0,
          mediumConfidenceAvgMagnitude: 0,
          lowConfidenceAvgMagnitude: 0,
        },
        failurePatterns: [],
        learningStatus: 'Collecting Data',
        detectorVersion: activeVersion,
      };
    }

    let accepted = 0;
    let minor = 0;
    let major = 0;
    let manual = 0;
    let resets = 0;

    const dxTL: number[] = [];
    const dyTL: number[] = [];
    const dxTR: number[] = [];
    const dyTR: number[] = [];
    const dxBR: number[] = [];
    const dyBR: number[] = [];
    const dxBL: number[] = [];
    const dyBL: number[] = [];

    const magTL: number[] = [];
    const magTR: number[] = [];
    const magBR: number[] = [];
    const magBL: number[] = [];

    const highConfMags: number[] = [];
    const medConfMags: number[] = [];
    const lowConfMags: number[] = [];

    for (const s of samples) {
      switch (s.userAction) {
        case 'accepted':
          accepted++;
          break;
        case 'minor_correction':
          minor++;
          break;
        case 'major_correction':
          major++;
          break;
        case 'manual_crop':
          manual++;
          break;
        case 'reset':
          resets++;
          break;
      }

      // Collect vector offsets (final - predicted)
      const dTLx = s.finalCorners.topLeft[0] - s.predictedCorners.topLeft[0];
      const dTLy = s.finalCorners.topLeft[1] - s.predictedCorners.topLeft[1];
      const dTRx = s.finalCorners.topRight[0] - s.predictedCorners.topRight[0];
      const dTRy = s.finalCorners.topRight[1] - s.predictedCorners.topRight[1];
      const dBRx = s.finalCorners.bottomRight[0] - s.predictedCorners.bottomRight[0];
      const dBRy = s.finalCorners.bottomRight[1] - s.predictedCorners.bottomRight[1];
      const dBLx = s.finalCorners.bottomLeft[0] - s.predictedCorners.bottomLeft[0];
      const dBLy = s.finalCorners.bottomLeft[1] - s.predictedCorners.bottomLeft[1];

      dxTL.push(dTLx);
      dyTL.push(dTLy);
      dxTR.push(dTRx);
      dyTR.push(dTRy);
      dxBR.push(dBRx);
      dyBR.push(dBRy);
      dxBL.push(dBLx);
      dyBL.push(dBLy);

      magTL.push(s.correctionMagnitude.topLeft);
      magTR.push(s.correctionMagnitude.topRight);
      magBR.push(s.correctionMagnitude.bottomRight);
      magBL.push(s.correctionMagnitude.bottomLeft);

      const maxMag = Math.max(
        s.correctionMagnitude.topLeft,
        s.correctionMagnitude.topRight,
        s.correctionMagnitude.bottomRight,
        s.correctionMagnitude.bottomLeft
      );

      if (s.detectorConfidence >= 0.85) {
        highConfMags.push(maxMag);
      } else if (s.detectorConfidence >= 0.65) {
        medConfMags.push(maxMag);
      } else {
        lowConfMags.push(maxMag);
      }
    }

    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const percentile90 = (arr: number[]) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
      return sorted[idx];
    };

    const round2 = (n: number) => Number(n.toFixed(4));

    // Accuracy trends helper
    const calcTrend = (limit: number): number | null => {
      if (samples.length < limit) return null;
      const subset = samples.slice(-limit);
      const acc = subset.filter((s) => s.userAction === 'accepted').length;
      return Number((acc / limit).toFixed(3));
    };

    const minRequired = config.learning.minSamples || 100;
    let learningStatus: AggregateMetrics['learningStatus'] = 'Collecting Data';
    if (total >= minRequired * 2) {
      learningStatus = 'Tuning Available';
    } else if (total >= minRequired) {
      learningStatus = 'Enough Data for Analysis';
    }

    const failurePatterns = this.detectFailurePatterns(samples);

    return {
      totalSamples: total,
      accepted,
      minorCorrections: minor,
      majorCorrections: major,
      manualCrops: manual,
      resets,
      acceptanceRate: Number((accepted / total).toFixed(3)),
      minorCorrectionRate: Number((minor / total).toFixed(3)),
      majorCorrectionRate: Number((major / total).toFixed(3)),

      averageCorrection: {
        topLeft: [round2(mean(dxTL)), round2(mean(dyTL))],
        topRight: [round2(mean(dxTR)), round2(mean(dyTR))],
        bottomRight: [round2(mean(dxBR)), round2(mean(dyBR))],
        bottomLeft: [round2(mean(dxBL)), round2(mean(dyBL))],
      },

      medianCorrection: {
        topLeft: [round2(median(dxTL)), round2(median(dyTL))],
        topRight: [round2(median(dxTR)), round2(median(dyTR))],
        bottomRight: [round2(median(dxBR)), round2(median(dyBR))],
        bottomLeft: [round2(median(dxBL)), round2(median(dyBL))],
      },

      p90CorrectionMagnitude: {
        topLeft: round2(percentile90(magTL)),
        topRight: round2(percentile90(magTR)),
        bottomRight: round2(percentile90(magBR)),
        bottomLeft: round2(percentile90(magBL)),
      },

      accuracyTrends: {
        last100: calcTrend(100),
        last500: calcTrend(500),
        last1000: calcTrend(1000),
        all: Number((accepted / total).toFixed(3)),
      },

      confidenceVsCorrection: {
        highConfidenceAvgMagnitude: round2(mean(highConfMags)),
        mediumConfidenceAvgMagnitude: round2(mean(medConfMags)),
        lowConfidenceAvgMagnitude: round2(mean(lowConfMags)),
      },

      failurePatterns,
      learningStatus,
      detectorVersion: activeVersion,
    };
  }

  /**
   * Diagnostic engine: Identifies actionable recurring failure modes.
   */
  private detectFailurePatterns(samples: CropLearningSample[]): FailurePattern[] {
    const patterns: FailurePattern[] = [];
    if (samples.length < 15) return patterns;

    const total = samples.length;

    // Pattern 1: Bottom-Right Overshoot
    const brOvershoot = samples.filter((s) => {
      const dy = s.finalCorners.bottomRight[1] - s.predictedCorners.bottomRight[1];
      return dy < -0.02; // User moved BR up noticeably
    }).length;

    if (brOvershoot / total > 0.15) {
      patterns.push({
        id: 'pat_br_overshoot',
        title: 'Bottom-right corner frequently overshoots',
        description: 'Users regularly pull the bottom-right corner upwards, indicating perspective shadow bias.',
        frequencyPercentage: Number(((brOvershoot / total) * 100).toFixed(1)),
        impact: 'medium',
        suggestedAction: 'Apply perspective-conditioned bottom edge retraction.',
      });
    }

    // Pattern 2: Top-Left Background Capture
    const tlShift = samples.filter((s) => {
      const mag = s.correctionMagnitude.topLeft;
      const dx = s.finalCorners.topLeft[0] - s.predictedCorners.topLeft[0];
      const dy = s.finalCorners.topLeft[1] - s.predictedCorners.topLeft[1];
      return mag > 0.025 && dx > 0.01 && dy > 0.01; // Pulled inward into document
    }).length;

    if (tlShift / total > 0.12) {
      patterns.push({
        id: 'pat_tl_background',
        title: 'Top-left corner frequently captures background',
        description: 'Detection latches slightly outside the top-left margin on dark or textured tables.',
        frequencyPercentage: Number(((tlShift / total) * 100).toFixed(1)),
        impact: 'medium',
        suggestedAction: 'Increase top-left edge gradient threshold.',
      });
    }

    // Pattern 3: Border Touching Failure
    const borderTouch = samples.filter((s) => {
      const prox = s.featureSummary?.boundaryProximity ?? 1.0;
      const wasAdjusted = s.userAction !== 'accepted';
      return prox < 0.015 && wasAdjusted;
    }).length;

    if (borderTouch / total > 0.1) {
      patterns.push({
        id: 'pat_boundary_touch',
        title: 'Document touching image boundary causes border detection distortion',
        description: 'When paper edges lie within 1.5% of the photo perimeter, corners stick to image edges.',
        frequencyPercentage: Number(((borderTouch / total) * 100).toFixed(1)),
        impact: 'high',
        suggestedAction: 'Enforce minimum boundary margin buffer when frame proximity < 0.01.',
      });
    }

    // Pattern 4: High Perspective Skew
    const highPerspectiveMajor = samples.filter((s) => {
      const score = s.featureSummary?.perspectiveScore ?? 0;
      return score > 0.25 && s.userAction === 'major_correction';
    }).length;

    if (highPerspectiveMajor / total > 0.08) {
      patterns.push({
        id: 'pat_perspective_skew',
        title: 'Strong perspective angle creates corner displacement',
        description: 'Tilted phone angles cause opposite edge ratios to diverge beyond linear threshold.',
        frequencyPercentage: Number(((highPerspectiveMajor / total) * 100).toFixed(1)),
        impact: 'high',
        suggestedAction: 'Increase perspective tolerance parameter in candidate configuration.',
      });
    }

    return patterns;
  }

  /**
   * Lightweight A/B evaluation simulator.
   * Compares candidate configuration vs current configuration against historical samples.
   */
  evaluateCandidateConfig(
    samples: CropLearningSample[],
    currentConfig: DetectorConfig,
    candidateConfig: DetectorConfig
  ): CandidateEvaluationResult {
    const total = samples.length;

    if (total < 20) {
      return {
        currentConfig,
        candidateConfig,
        simulatedSampleCount: total,
        currentAvgError: 0,
        candidateAvgError: 0,
        errorImprovementRatio: 0,
        predictedAcceptanceGain: 0,
        recommendation: 'gather_more_data',
      };
    }

    let currentTotalError = 0;
    let candidateTotalError = 0;
    let candidateSimulatedAccepted = 0;
    let currentSimulatedAccepted = 0;

    for (const s of samples) {
      const magAvg =
        (s.correctionMagnitude.topLeft +
          s.correctionMagnitude.topRight +
          s.correctionMagnitude.bottomRight +
          s.correctionMagnitude.bottomLeft) /
        4;

      currentTotalError += magAvg;
      if (magAvg <= currentConfig.learning.autoAcceptThreshold) {
        currentSimulatedAccepted++;
      }

      // Simulate candidate behavior based on parameter shifts
      let simulatedMag = magAvg;

      // If candidate has better perspective tolerance for high perspective docs:
      const persScore = s.featureSummary?.perspectiveScore || 0;
      if (persScore > 0.2 && candidateConfig.perspectiveTolerance > currentConfig.perspectiveTolerance) {
        simulatedMag *= 0.88; // 12% error reduction on perspective shots
      }

      // If candidate has better edgeThreshold tuning on small borders:
      const area = s.featureSummary?.documentAreaRatio || 0.5;
      if (area > 0.7 && candidateConfig.maxDocumentArea >= 0.98) {
        simulatedMag *= 0.92;
      }

      candidateTotalError += simulatedMag;
      if (simulatedMag <= candidateConfig.learning.autoAcceptThreshold) {
        candidateSimulatedAccepted++;
      }
    }

    const currentAvgError = Number((currentTotalError / total).toFixed(4));
    const candidateAvgError = Number((candidateTotalError / total).toFixed(4));

    const errorImprovementRatio =
      currentAvgError > 0
        ? Number(((currentAvgError - candidateAvgError) / currentAvgError).toFixed(3))
        : 0;

    const currentAcceptRate = currentSimulatedAccepted / total;
    const candidateAcceptRate = candidateSimulatedAccepted / total;
    const predictedAcceptanceGain = Number(((candidateAcceptRate - currentAcceptRate) * 100).toFixed(1));

    let recommendation: CandidateEvaluationResult['recommendation'] = 'keep_current';
    if (total >= 50 && errorImprovementRatio >= 0.05 && predictedAcceptanceGain >= 1.5) {
      recommendation = 'promote';
    } else if (total < 50) {
      recommendation = 'gather_more_data';
    }

    return {
      currentConfig,
      candidateConfig,
      simulatedSampleCount: total,
      currentAvgError,
      candidateAvgError,
      errorImprovementRatio,
      predictedAcceptanceGain,
      recommendation,
    };
  }
}

export const cropLearningAnalyzer = new CropLearningAnalyzer();
