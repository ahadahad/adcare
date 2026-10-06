import {
  CornersTuple,
  CropLearningSample,
  DetectorConfig,
  GeometricFeatureSummary,
  PointCoord,
} from './CropLearningTypes';

export interface LearnedRule {
  id: string;
  name: string;
  description: string;
  sampleSupportCount: number;
  confidence: number;
  condition: (features: GeometricFeatureSummary) => boolean;
  apply: (corners: CornersTuple) => CornersTuple;
}

/**
 * Rule-based correction layer.
 * Applies corrections ONLY when geometric conditions match verified historical patterns.
 * Never applies blind static offsets to all detections.
 */
export class CropLearningRulesEngine {
  /**
   * Generates active learned rules based on historical correction samples.
   * Only activates a rule when at least `minSamples` support it and directional bias is consistent.
   */
  generateRules(samples: CropLearningSample[], config: DetectorConfig): LearnedRule[] {
    const rules: LearnedRule[] = [];
    const minSamples = config.learning.minSamples || 100;

    if (!config.learning.enabled || samples.length < minSamples) {
      return rules;
    }

    // Filter samples with valid feature summaries
    const validSamples = samples.filter(
      (s) => s.featureSummary && (s.userAction === 'accepted' || s.userAction === 'minor_correction' || s.userAction === 'major_correction')
    );

    if (validSamples.length < minSamples) {
      return rules;
    }

    // -------------------------------------------------------------
    // RULE 1: High Perspective / Large Document Bottom Overshoot
    // Problem: When a document covers > 60% of the image with perspective tilt > 0.2,
    // perspective distortion often causes the bottom-right corner to overshoot downward.
    // -------------------------------------------------------------
    const largePerspectiveSamples = validSamples.filter(
      (s) => (s.featureSummary?.documentAreaRatio || 0) > 0.55 && (s.featureSummary?.perspectiveScore || 0) > 0.2
    );

    if (largePerspectiveSamples.length >= 25) {
      // Calculate directional bias on bottom-right corner
      let sumBrDy = 0;
      let brOvershootCount = 0;

      for (const s of largePerspectiveSamples) {
        const dy = s.finalCorners.bottomRight[1] - s.predictedCorners.bottomRight[1];
        sumBrDy += dy;
        // User dragged BR up (correction dy < -0.01)
        if (dy < -0.01) {
          brOvershootCount++;
        }
      }

      const brOvershootRatio = brOvershootCount / largePerspectiveSamples.length;
      const avgBrDy = sumBrDy / largePerspectiveSamples.length;

      // If at least 65% of large perspective samples show user dragging BR upwards:
      if (brOvershootRatio >= 0.65 && avgBrDy < -0.01) {
        // Safe conservative nudge (clamp to max 0.02)
        const nudgeY = Math.max(-0.02, avgBrDy * 0.7);

        rules.push({
          id: 'rule_br_perspective_overshoot',
          name: 'Perspective Bottom-Right Inset Correction',
          description: `Compensates for systematic bottom-right overshoot in high-perspective scans (detected in ${(brOvershootRatio * 100).toFixed(0)}% of matching samples).`,
          sampleSupportCount: largePerspectiveSamples.length,
          confidence: Number(brOvershootRatio.toFixed(2)),
          condition: (f: GeometricFeatureSummary) => f.documentAreaRatio > 0.55 && f.perspectiveScore > 0.2,
          apply: (corners: CornersTuple): CornersTuple => {
            const br: PointCoord = [
              corners.bottomRight[0],
              Math.max(0, Math.min(1, corners.bottomRight[1] + nudgeY)),
            ];
            return { ...corners, bottomRight: br };
          },
        });
      }
    }

    // -------------------------------------------------------------
    // RULE 2: Boundary Wall Inset Correction
    // Problem: When predicted corner touches the very edge of the image (< 0.01 distance),
    // but users frequently inset corners inward by 1-2% to avoid border artifacts.
    // -------------------------------------------------------------
    const touchingEdgeSamples = validSamples.filter(
      (s) => (s.featureSummary?.boundaryProximity || 1.0) < 0.015
    );

    if (touchingEdgeSamples.length >= 20) {
      let insetNeededCount = 0;
      let avgInsetMagnitude = 0;

      for (const s of touchingEdgeSamples) {
        const mag = Math.max(
          s.correctionMagnitude.topLeft,
          s.correctionMagnitude.topRight,
          s.correctionMagnitude.bottomRight,
          s.correctionMagnitude.bottomLeft
        );
        if (mag > 0.01 && mag < 0.06) {
          insetNeededCount++;
          avgInsetMagnitude += mag;
        }
      }

      const ratio = insetNeededCount / touchingEdgeSamples.length;
      if (ratio >= 0.6) {
        const safeInset = Math.min(0.015, (avgInsetMagnitude / Math.max(1, insetNeededCount)) * 0.6);

        rules.push({
          id: 'rule_boundary_inset_safety',
          name: 'Frame Boundary Margin Correction',
          description: 'Slightly insets corners when detection sticks directly to image pixel perimeter.',
          sampleSupportCount: touchingEdgeSamples.length,
          confidence: Number(ratio.toFixed(2)),
          condition: (f: GeometricFeatureSummary) => (f.boundaryProximity ?? 1.0) < 0.01,
          apply: (corners: CornersTuple): CornersTuple => {
            const insetPt = (p: PointCoord, dirX: number, dirY: number): PointCoord => {
              let nx = p[0];
              let ny = p[1];
              if (nx <= 0.01) nx += safeInset * dirX;
              if (nx >= 0.99) nx -= safeInset * dirX;
              if (ny <= 0.01) ny += safeInset * dirY;
              if (ny >= 0.99) ny -= safeInset * dirY;
              return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
            };

            return {
              topLeft: insetPt(corners.topLeft, 1, 1),
              topRight: insetPt(corners.topRight, 1, 1),
              bottomRight: insetPt(corners.bottomRight, 1, 1),
              bottomLeft: insetPt(corners.bottomLeft, 1, 1),
            };
          },
        });
      }
    }

    return rules;
  }

  /**
   * Applies active rules to raw corners if their geometric conditions are satisfied.
   */
  applyRules(
    rawCorners: CornersTuple,
    features: GeometricFeatureSummary,
    rules: LearnedRule[]
  ): CornersTuple {
    let tuned = { ...rawCorners };

    for (const rule of rules) {
      try {
        if (rule.condition(features)) {
          tuned = rule.apply(tuned);
        }
      } catch {
        // Fallback to raw corners on any error
      }
    }

    return tuned;
  }
}

export const cropLearningRulesEngine = new CropLearningRulesEngine();
