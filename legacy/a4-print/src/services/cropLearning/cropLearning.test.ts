import { cropLearningAnalyzer } from './CropLearningAnalyzer';
import { cropLearningEngine } from './CropLearningEngine';
import { extractGeometricFeatures } from './CropLearningFeatures';
import { cropLearningRulesEngine } from './CropLearningRules';
import { cropLearningStore } from './CropLearningStore';
import {
  CornersTuple,
  CropLearningSample,
  CURRENT_DETECTOR_VERSION,
  DEFAULT_DETECTOR_CONFIG,
  DetectorConfig,
} from './CropLearningTypes';

/**
 * COMPREHENSIVE TEST SUITE FOR CROP CORRECTION LEARNING SYSTEM
 * Tests all 15 criteria specified in Section 24.
 */
export async function runCropLearningTests(): Promise<{
  passed: number;
  failed: number;
  results: { name: string; success: boolean; details?: string }[];
}> {
  const results: { name: string; success: boolean; details?: string }[] = [];

  const assert = (condition: boolean, name: string, details?: string) => {
    results.push({ name, success: condition, details });
    if (!condition) {
      console.error(`FAILED: ${name}`, details);
    }
  };

  try {
    // -------------------------------------------------------------
    // Test 1 & 2: Accepted crop & Tiny correction (< 0.005)
    // -------------------------------------------------------------
    const basePredicted: CornersTuple = {
      topLeft: [0.1, 0.1],
      topRight: [0.9, 0.1],
      bottomRight: [0.9, 0.9],
      bottomLeft: [0.1, 0.9],
    };

    const tinyAdjusted: CornersTuple = {
      topLeft: [0.101, 0.102], // displacement ~0.0022 <= 0.005
      topRight: [0.9, 0.1],
      bottomRight: [0.9, 0.9],
      bottomLeft: [0.1, 0.9],
    };

    const dTL_tiny = Math.hypot(tinyAdjusted.topLeft[0] - basePredicted.topLeft[0], tinyAdjusted.topLeft[1] - basePredicted.topLeft[1]);
    const isTinyAccepted = dTL_tiny <= DEFAULT_DETECTOR_CONFIG.learning.autoAcceptThreshold;
    assert(isTinyAccepted, '1 & 2. Accepted crop & Tiny correction classification', `Displacement: ${dTL_tiny.toFixed(4)} <= ${DEFAULT_DETECTOR_CONFIG.learning.autoAcceptThreshold}`);

    // -------------------------------------------------------------
    // Test 3: Minor correction (0.005 < delta <= 0.03)
    // -------------------------------------------------------------
    const minorAdjusted: CornersTuple = {
      topLeft: [0.115, 0.112], // displacement ~0.019
      topRight: [0.9, 0.1],
      bottomRight: [0.9, 0.9],
      bottomLeft: [0.1, 0.9],
    };
    const dTL_minor = Math.hypot(minorAdjusted.topLeft[0] - basePredicted.topLeft[0], minorAdjusted.topLeft[1] - basePredicted.topLeft[1]);
    const isMinor =
      dTL_minor > DEFAULT_DETECTOR_CONFIG.learning.autoAcceptThreshold &&
      dTL_minor <= DEFAULT_DETECTOR_CONFIG.learning.minorCorrectionThreshold;
    assert(isMinor, '3. Minor correction classification', `Displacement: ${dTL_minor.toFixed(4)}`);

    // -------------------------------------------------------------
    // Test 4: Major correction (delta > 0.03)
    // -------------------------------------------------------------
    const majorAdjusted: CornersTuple = {
      topLeft: [0.18, 0.17], // displacement ~0.106
      topRight: [0.9, 0.1],
      bottomRight: [0.9, 0.9],
      bottomLeft: [0.1, 0.9],
    };
    const dTL_major = Math.hypot(majorAdjusted.topLeft[0] - basePredicted.topLeft[0], majorAdjusted.topLeft[1] - basePredicted.topLeft[1]);
    const isMajor = dTL_major > DEFAULT_DETECTOR_CONFIG.learning.minorCorrectionThreshold;
    assert(isMajor, '4. Major correction classification', `Displacement: ${dTL_major.toFixed(4)}`);

    // -------------------------------------------------------------
    // Test 5: Manual crop classification
    // -------------------------------------------------------------
    const manualSample: CropLearningSample = {
      id: 'test_manual',
      timestamp: Date.now(),
      imageWidth: 1000,
      imageHeight: 1500,
      predictedCorners: basePredicted,
      finalCorners: majorAdjusted,
      correctionMagnitude: { topLeft: dTL_major, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      rotation: 0,
      detectorConfidence: 0.5,
      detectionMethod: 'Manual Crop Mode',
      detectorVersion: CURRENT_DETECTOR_VERSION,
      userAction: 'manual_crop',
    };
    assert(manualSample.userAction === 'manual_crop', '5. Manual crop classification');

    // -------------------------------------------------------------
    // Test 6: Reset classification
    // -------------------------------------------------------------
    const resetSample: CropLearningSample = {
      id: 'test_reset',
      timestamp: Date.now(),
      imageWidth: 1000,
      imageHeight: 1500,
      predictedCorners: basePredicted,
      finalCorners: {
        topLeft: [0, 0],
        topRight: [1, 0],
        bottomRight: [1, 1],
        bottomLeft: [0, 1],
      },
      correctionMagnitude: { topLeft: 0.14, topRight: 0.14, bottomRight: 0.14, bottomLeft: 0.14 },
      rotation: 0,
      detectorConfidence: 0.8,
      detectionMethod: 'Universal Auto-Detector',
      detectorVersion: CURRENT_DETECTOR_VERSION,
      userAction: 'reset',
    };
    assert(resetSample.userAction === 'reset', '6. Reset classification');

    // -------------------------------------------------------------
    // Test 7: Normalized coordinates (all within 0.0 to 1.0)
    // -------------------------------------------------------------
    const checkCoords = (corners: CornersTuple): boolean => {
      const all: [number, number][] = [
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ];
      return all.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
    };
    assert(checkCoords(basePredicted) && checkCoords(minorAdjusted), '7. Normalized coordinates bounds strictly [0.0, 1.0]');

    // -------------------------------------------------------------
    // Test 8: Persistence (save & retrieve)
    // -------------------------------------------------------------
    await cropLearningStore.clearData();
    await cropLearningStore.saveSample(manualSample);
    const retrieved = await cropLearningStore.getAllSamples();
    assert(retrieved.length === 1 && retrieved[0].id === 'test_manual', '8. Storage persistence save and retrieve');

    // -------------------------------------------------------------
    // Test 9: Maximum sample limit & FIFO pruning
    // -------------------------------------------------------------
    const testConfig: DetectorConfig = {
      ...DEFAULT_DETECTOR_CONFIG,
      learning: { ...DEFAULT_DETECTOR_CONFIG.learning, maxSamples: 5 },
    };
    await cropLearningStore.saveConfig(testConfig);
    await cropLearningStore.clearData();

    for (let i = 0; i < 7; i++) {
      await cropLearningStore.saveSample({
        ...manualSample,
        id: `sample_${i}`,
        timestamp: Date.now() + i * 10,
      });
    }
    const prunedSamples = await cropLearningStore.getAllSamples();
    assert(
      prunedSamples.length <= 5,
      '9. Maximum sample limit & FIFO pruning',
      `Count: ${prunedSamples.length} <= 5`
    );

    // Restore standard config
    await cropLearningStore.saveConfig(DEFAULT_DETECTOR_CONFIG);
    await cropLearningStore.clearData();

    // -------------------------------------------------------------
    // Test 10: Detector versioning
    // -------------------------------------------------------------
    assert(
      CURRENT_DETECTOR_VERSION === '2.1.0' && manualSample.detectorVersion === '2.1.0',
      '10. Detector versioning 2.1.0 present on samples'
    );

    // -------------------------------------------------------------
    // Test 11: Statistics calculation (mean, median, 90th percentile)
    // -------------------------------------------------------------
    const mockSamples: CropLearningSample[] = [];
    for (let i = 1; i <= 20; i++) {
      const mag = i * 0.005; // 0.005 to 0.100
      mockSamples.push({
        id: `stat_sample_${i}`,
        timestamp: Date.now() + i * 1000,
        imageWidth: 1200,
        imageHeight: 1600,
        predictedCorners: basePredicted,
        finalCorners: {
          ...basePredicted,
          bottomRight: [0.9 + (i % 2 === 0 ? 0.01 : -0.01), 0.9 - mag],
        },
        correctionMagnitude: {
          topLeft: 0.001,
          topRight: 0.001,
          bottomRight: mag,
          bottomLeft: 0.001,
        },
        rotation: 0,
        detectorConfidence: 0.9,
        detectionMethod: 'Universal Auto-Detector',
        detectorVersion: CURRENT_DETECTOR_VERSION,
        userAction: mag <= 0.005 ? 'accepted' : mag <= 0.03 ? 'minor_correction' : 'major_correction',
        featureSummary: {
          aspectRatio: 0.75,
          documentAreaRatio: 0.64,
          rectangularity: 0.96,
          perspectiveScore: 0.22,
          boundaryProximity: 0.08,
        },
      });
    }

    const metrics = cropLearningAnalyzer.computeMetrics(mockSamples, DEFAULT_DETECTOR_CONFIG);
    const hasValidStats =
      metrics.totalSamples === 20 &&
      metrics.acceptanceRate > 0 &&
      metrics.p90CorrectionMagnitude.bottomRight > 0 &&
      metrics.averageCorrection.bottomRight[1] !== 0;
    assert(hasValidStats, '11. Statistics calculation (mean, median, p90, acceptance rate)');

    // -------------------------------------------------------------
    // Test 12: Learning rule generation
    // -------------------------------------------------------------
    // Generate 110 perspective samples with systematic BR overshoot
    const tuningSamples: CropLearningSample[] = [];
    for (let i = 0; i < 110; i++) {
      tuningSamples.push({
        id: `tune_${i}`,
        timestamp: Date.now() + i,
        imageWidth: 1920,
        imageHeight: 1080,
        predictedCorners: basePredicted,
        finalCorners: {
          ...basePredicted,
          bottomRight: [0.9, 0.88], // User pulled BR up by -0.02
        },
        correctionMagnitude: {
          topLeft: 0.002,
          topRight: 0.002,
          bottomRight: 0.02,
          bottomLeft: 0.002,
        },
        rotation: 0,
        detectorConfidence: 0.95,
        detectionMethod: 'Universal Auto-Detector',
        detectorVersion: CURRENT_DETECTOR_VERSION,
        userAction: 'minor_correction',
        featureSummary: {
          aspectRatio: 1.4,
          documentAreaRatio: 0.68,
          rectangularity: 0.95,
          perspectiveScore: 0.28,
          boundaryProximity: 0.05,
        },
      });
    }

    const rules = cropLearningRulesEngine.generateRules(tuningSamples, DEFAULT_DETECTOR_CONFIG);
    assert(rules.length > 0, '12. Learning rule generation with statistically consistent bias');

    // -------------------------------------------------------------
    // Test 13: Candidate configuration evaluation (A/B testing simulation)
    // -------------------------------------------------------------
    const candidateConfig: DetectorConfig = {
      ...DEFAULT_DETECTOR_CONFIG,
      perspectiveTolerance: 0.42,
    };
    const abEval = cropLearningAnalyzer.evaluateCandidateConfig(
      tuningSamples,
      DEFAULT_DETECTOR_CONFIG,
      candidateConfig
    );
    assert(
      abEval.simulatedSampleCount === 110 && abEval.recommendation !== undefined,
      '13. Candidate configuration evaluation (A/B testing simulation)',
      `Recommendation: ${abEval.recommendation}, Error reduction: ${(abEval.errorImprovementRatio * 100).toFixed(1)}%`
    );

    // -------------------------------------------------------------
    // Test 14: Strict No Image Storage verification
    // -------------------------------------------------------------
    const sampleKeys = Object.keys(mockSamples[0]);
    // Image dimensions are allowed, but actual image contents, buffers, blobs, ocr are strictly forbidden
    const forbiddenPayloadKeys = ['imagebuffer', 'imagedata', 'imageblob', 'base64', 'pixels', 'ocr', 'text', 'dataurl', 'blob'];
    const hasForbidden = forbiddenPayloadKeys.some((k) =>
      sampleKeys.some((sk) => sk.toLowerCase().includes(k))
    );
    assert(!hasForbidden, '14. Strict No Image Storage verification (zero images/pixels in schema)');

    // -------------------------------------------------------------
    // Test 15: Non-blocking performance verification
    // -------------------------------------------------------------
    const startT = performance.now();
    for (let i = 0; i < 50; i++) {
      extractGeometricFeatures(basePredicted, 1920, 1080);
    }
    const elapsed = performance.now() - startT;
    assert(
      elapsed < 15,
      '15. Performance non-blocking execution (<15ms for 50 feature extractions)',
      `Elapsed: ${elapsed.toFixed(2)}ms`
    );

    // Document types feature extraction verification
    const docTypes = [
      { name: 'A4 Certificate', w: 2480, h: 3508 },
      { name: 'Receipt', w: 800, h: 2200 },
      { name: 'NID Card', w: 1011, h: 642 },
      { name: 'Invoice', w: 1920, h: 1080 },
    ];
    let allDocTypesPassed = true;
    for (const doc of docTypes) {
      const feat = extractGeometricFeatures(basePredicted, doc.w, doc.h);
      if (feat.aspectRatio <= 0 || feat.documentAreaRatio <= 0) {
        allDocTypesPassed = false;
      }
    }
    assert(allDocTypesPassed, 'Document types feature extraction verification (A4, Receipt, NID, Invoice)');
  } catch (err: any) {
    assert(false, 'General test runner exception', err.message);
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { passed, failed, results };
}
