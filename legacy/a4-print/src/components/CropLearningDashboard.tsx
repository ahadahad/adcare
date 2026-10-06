import React, { useState, useEffect } from 'react';
import { cropLearningEngine } from '../services/cropLearning/CropLearningEngine';
import {
  AggregateMetrics,
  CandidateEvaluationResult,
  CURRENT_DETECTOR_VERSION,
  DetectorConfig,
} from '../services/cropLearning/CropLearningTypes';
import { LearnedRule } from '../services/cropLearning/CropLearningRules';
import {
  Brain,
  Download,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Cpu,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';

interface CropLearningDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CropLearningDashboard: React.FC<CropLearningDashboardProps> = ({
  isOpen,
  onClose,
}) => {
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null);
  const [activeRules, setActiveRules] = useState<LearnedRule[]>([]);
  const [candidateEval, setCandidateEval] = useState<CandidateEvaluationResult | null>(null);
  const [config, setConfig] = useState<DetectorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await cropLearningEngine.getDashboardData();
      setMetrics(data.metrics);
      setActiveRules(data.activeRules);
      setCandidateEval(data.candidateEvaluation);
      setConfig(data.config);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleExport = async () => {
    try {
      const jsonStr = await cropLearningEngine.exportLearningData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crop_learning_data_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback('Learning dataset exported (JSON). Zero images included.');
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback('Export failed.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleClear = async () => {
    await cropLearningEngine.clearAllLearningData();
    setShowConfirmClear(false);
    await loadData();
    setFeedback('All local learning samples cleared.');
    setTimeout(() => setFeedback(null), 3000);
  };

  // Developer utility: Seeds anonymous geometric samples to test learning engine
  const handleSeedSamples = async () => {
    setLoading(true);
    for (let i = 0; i < 110; i++) {
      // Simulate realistic scanning variance with a slight systematic bottom-right overshoot
      const isHighPerspective = i % 3 === 0;
      const baseArea = 0.65;
      const predBR: [number, number] = [0.92, 0.94];
      // 70% of high perspective samples user moves BR up slightly to 0.91
      const finalBR: [number, number] = isHighPerspective ? [0.915, 0.912] : [0.919, 0.938];

      await cropLearningEngine.recordCropSession({
        predictedCorners: {
          topLeft: { x: 0.08, y: 0.06 },
          topRight: { x: 0.91, y: 0.07 },
          bottomRight: { x: predBR[0], y: predBR[1] },
          bottomLeft: { x: 0.07, y: 0.92 },
        },
        finalCorners: {
          topLeft: { x: 0.081, y: 0.061 },
          topRight: { x: 0.908, y: 0.069 },
          bottomRight: { x: finalBR[0], y: finalBR[1] },
          bottomLeft: { x: 0.072, y: 0.918 },
        },
        imageWidth: 1920,
        imageHeight: 1080,
        detectorConfidence: 0.92,
        detectionMethod: 'Simulated Universal Detector',
      });
    }
    await cropLearningEngine.refreshState();
    await loadData();
    setFeedback('Generated 110 anonymous geometric benchmark samples.');
    setTimeout(() => setFeedback(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-[#f8fbf9] border border-[#d8eadd] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#11281d]">
        {/* Header */}
        <header className="px-6 py-4 border-b border-[#d8eadd] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shadow-xs">
              <Brain className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0f241a] tracking-tight">
                  Auto-Crop Learning System (Dev Panel)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#064e3b] border border-emerald-300">
                  v{CURRENT_DETECTOR_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#52796f]">
                Privacy-friendly local geometric correction learning & self-tuning engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 text-xs font-semibold text-[#1c3a2c] shadow-2xs transition cursor-pointer"
              title="Export anonymized geometry JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#16a34a]" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => setShowConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-700 shadow-2xs transition cursor-pointer"
              title="Clear all stored learning data"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Clear Data</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-slate-600 shadow-2xs transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Feedback Alert */}
        {feedback && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f2f7f4]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-[#16a34a]" />
              <p className="text-xs font-semibold">Analyzing local correction samples...</p>
            </div>
          ) : (
            <>
              {/* Privacy Notice Banner */}
              <div className="bg-white border border-[#cbe1d3] rounded-xl p-4 flex items-start gap-3 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-[#0f241a]">Strict On-Device Privacy Architecture</p>
                  <p className="text-[#52796f] leading-relaxed">
                    The learning system stores only anonymous crop geometry and detection metadata
                    locally in IndexedDB. Uploaded images, pixel data, document content, and personal
                    information are <strong>NEVER</strong> stored or uploaded.
                  </p>
                </div>
              </div>

              {/* Status & Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#52796f] uppercase tracking-wider block">
                    Automatic Acceptance Rate
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-[#0f241a]">
                      {metrics ? `${(metrics.acceptanceRate * 100).toFixed(1)}%` : '0%'}
                    </span>
                    <TrendingUp className="w-4 h-4 text-[#16a34a]" />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Zero or negligible manual adjustment
                  </span>
                </div>

                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#52796f] uppercase tracking-wider block">
                    Total Local Samples
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-[#0f241a]">
                      {metrics ? metrics.totalSamples.toLocaleString() : 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Capacity: {config?.learning.maxSamples || 5000} (FIFO pruning)
                  </span>
                </div>

                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#52796f] uppercase tracking-wider block">
                    Learning Status
                  </span>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        metrics?.learningStatus === 'Tuning Available'
                          ? 'bg-emerald-500 animate-pulse'
                          : metrics?.learningStatus === 'Enough Data for Analysis'
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-sm font-bold text-[#0f241a]">
                      {metrics?.learningStatus || 'Collecting Data'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Min required for tuning: {config?.learning.minSamples || 100}
                  </span>
                </div>

                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#52796f] uppercase tracking-wider block">
                    Active Learned Rules
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-[#064e3b]">
                      {activeRules.length}
                    </span>
                    <Cpu className="w-4 h-4 text-[#16a34a]" />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Conditional self-tuning rules
                  </span>
                </div>
              </div>

              {/* Action Breakdown & Accuracy Trends */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Breakdown */}
                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-[#0f241a] uppercase tracking-wider">
                    Detection Quality Classification
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#16a34a]" />
                        Accepted Automatically (&le; 0.5%):
                      </span>
                      <span className="font-semibold text-[#0f241a]">
                        {metrics?.accepted} ({((metrics?.acceptanceRate || 0) * 100).toFixed(1)}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                        Minor Corrections (&le; 3%):
                      </span>
                      <span className="font-semibold text-[#0f241a]">
                        {metrics?.minorCorrections} (
                        {((metrics?.minorCorrectionRate || 0) * 100).toFixed(1)}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                        Major Corrections (&gt; 3%):
                      </span>
                      <span className="font-semibold text-[#0f241a]">
                        {metrics?.majorCorrections} (
                        {((metrics?.majorCorrectionRate || 0) * 100).toFixed(1)}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                        Manual Crops / Resets:
                      </span>
                      <span className="font-semibold text-[#0f241a]">
                        {(metrics?.manualCrops || 0) + (metrics?.resets || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Accuracy Trends */}
                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-[#0f241a] uppercase tracking-wider">
                    Automatic Acceptance Trends
                  </h3>
                  <div className="grid grid-cols-4 gap-2 text-center pt-2">
                    <div className="p-2.5 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-[#52796f] block">Last 100</span>
                      <span className="text-sm font-bold text-[#0f241a] mt-1 block">
                        {metrics?.accuracyTrends.last100 !== null
                          ? `${(metrics!.accuracyTrends.last100 * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-[#52796f] block">Last 500</span>
                      <span className="text-sm font-bold text-[#0f241a] mt-1 block">
                        {metrics?.accuracyTrends.last500 !== null
                          ? `${(metrics!.accuracyTrends.last500 * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-[#52796f] block">Last 1000</span>
                      <span className="text-sm font-bold text-[#0f241a] mt-1 block">
                        {metrics?.accuracyTrends.last1000 !== null
                          ? `${(metrics!.accuracyTrends.last1000 * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-[#52796f] block">All-Time</span>
                      <span className="text-sm font-bold text-[#0f241a] mt-1 block">
                        {metrics ? `${(metrics.accuracyTrends.all * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Corner Correction Vectors (Average & Median) */}
              <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-[#0f241a] uppercase tracking-wider">
                  Geometric Correction Offsets &amp; 90th Percentile
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#e2eee5] text-[#52796f]">
                        <th className="pb-2 font-semibold">Corner</th>
                        <th className="pb-2 font-semibold">Avg Displacement (dx, dy)</th>
                        <th className="pb-2 font-semibold">Median Offset</th>
                        <th className="pb-2 font-semibold">P90 Maximum Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 font-medium">Top-Left</td>
                        <td className="py-2 text-slate-700">
                          dx: {metrics?.averageCorrection.topLeft[0]} | dy:{' '}
                          {metrics?.averageCorrection.topLeft[1]}
                        </td>
                        <td className="py-2 text-slate-700">
                          {metrics?.medianCorrection.topLeft[0]},{' '}
                          {metrics?.medianCorrection.topLeft[1]}
                        </td>
                        <td className="py-2 font-semibold text-[#0f241a]">
                          {metrics?.p90CorrectionMagnitude.topLeft}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Top-Right</td>
                        <td className="py-2 text-slate-700">
                          dx: {metrics?.averageCorrection.topRight[0]} | dy:{' '}
                          {metrics?.averageCorrection.topRight[1]}
                        </td>
                        <td className="py-2 text-slate-700">
                          {metrics?.medianCorrection.topRight[0]},{' '}
                          {metrics?.medianCorrection.topRight[1]}
                        </td>
                        <td className="py-2 font-semibold text-[#0f241a]">
                          {metrics?.p90CorrectionMagnitude.topRight}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Bottom-Right</td>
                        <td className="py-2 text-slate-700">
                          dx: {metrics?.averageCorrection.bottomRight[0]} | dy:{' '}
                          {metrics?.averageCorrection.bottomRight[1]}
                        </td>
                        <td className="py-2 text-slate-700">
                          {metrics?.medianCorrection.bottomRight[0]},{' '}
                          {metrics?.medianCorrection.bottomRight[1]}
                        </td>
                        <td className="py-2 font-semibold text-[#0f241a]">
                          {metrics?.p90CorrectionMagnitude.bottomRight}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Bottom-Left</td>
                        <td className="py-2 text-slate-700">
                          dx: {metrics?.averageCorrection.bottomLeft[0]} | dy:{' '}
                          {metrics?.averageCorrection.bottomLeft[1]}
                        </td>
                        <td className="py-2 text-slate-700">
                          {metrics?.medianCorrection.bottomLeft[0]},{' '}
                          {metrics?.medianCorrection.bottomLeft[1]}
                        </td>
                        <td className="py-2 font-semibold text-[#0f241a]">
                          {metrics?.p90CorrectionMagnitude.bottomLeft}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detected Failure Patterns */}
              <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0f241a] uppercase tracking-wider">
                    Automatic Failure Pattern Detection
                  </h3>
                  <span className="text-[11px] text-[#52796f]">
                    {metrics?.failurePatterns.length || 0} patterns identified
                  </span>
                </div>

                {metrics?.failurePatterns && metrics.failurePatterns.length > 0 ? (
                  <div className="space-y-2.5">
                    {metrics.failurePatterns.map((pat) => (
                      <div
                        key={pat.id}
                        className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 flex items-start gap-2.5 text-xs"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-950">{pat.title}</span>
                            <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                              {pat.frequencyPercentage}% of samples
                            </span>
                          </div>
                          <p className="text-slate-700">{pat.description}</p>
                          <p className="text-[#064e3b] font-medium pt-0.5">
                            &rarr; Suggestion: {pat.suggestedAction}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-2">
                    No recurring failure patterns detected. Detection is performing stably within
                    tolerances.
                  </p>
                )}
              </div>

              {/* Candidate A/B Configuration Simulator */}
              {candidateEval && (
                <div className="bg-white border border-[#cbe1d3] p-4 rounded-xl shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#0f241a] uppercase tracking-wider">
                      Detector Self-Tuning &amp; A/B Testing Simulator
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        candidateEval.recommendation === 'promote'
                          ? 'bg-emerald-100 text-emerald-800'
                          : candidateEval.recommendation === 'gather_more_data'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Recommendation: {candidateEval.recommendation.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Simulates candidate parameter changes against historical sample records before
                    applying any updates to production.
                  </p>

                  <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-slate-500 block">Simulated Samples</span>
                      <span className="text-sm font-bold text-[#0f241a] mt-0.5 block">
                        {candidateEval.simulatedSampleCount}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-slate-500 block">Error Reduction</span>
                      <span className="text-sm font-bold text-[#16a34a] mt-0.5 block">
                        {(candidateEval.errorImprovementRatio * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#f8fbf9] border border-[#d8eadd]">
                      <span className="text-[10px] text-slate-500 block">
                        Predicted Acceptance Gain
                      </span>
                      <span className="text-sm font-bold text-[#16a34a] mt-0.5 block">
                        +{candidateEval.predictedAcceptanceGain}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Developer Test Tools */}
              {metrics && metrics.totalSamples < 50 && (
                <div className="border border-dashed border-[#cbe1d3] rounded-xl p-4 flex items-center justify-between bg-white/70">
                  <div className="text-xs">
                    <span className="font-semibold text-[#0f241a] block">
                      Developer Benchmark Seeder
                    </span>
                    <span className="text-slate-500">
                      Populate with 110 anonymous geometric benchmark samples to observe rule
                      generation and A/B metrics.
                    </span>
                  </div>
                  <button
                    onClick={handleSeedSamples}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 text-xs font-semibold text-[#1c3a2c] shadow-2xs transition cursor-pointer shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span>Seed Samples</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Clear Confirmation Modal */}
        {showConfirmClear && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 border border-red-200 shadow-2xl max-w-sm w-full space-y-4 text-xs">
              <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Clear All Learning Data?</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                This will permanently delete all anonymous geometric correction samples and reset
                self-tuning rules to factory baseline.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
