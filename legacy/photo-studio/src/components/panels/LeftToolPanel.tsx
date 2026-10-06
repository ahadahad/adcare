import React, { useState, useEffect } from 'react';
import {
  Crop,
  Scissors,
  Sliders,
  Smile,
  User,
  Check,
  X,
  Palette,
  Camera,
  Sparkles,
  Maximize2,
  Layers,
  Sun,
  Contrast,
  RotateCcw,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import {
  ActiveTool,
  ImageItem,
  AIStatusInfo,
  CropRect,
  AspectRatioOption,
  ObjectDetectionTarget,
  FilterType,
  ImageAdjustments,
  AIDetectionData,
  BackgroundSettings,
  SelectedAreaAdjustments,
  PassportSettings,
  CustomInchSize,
} from '../../types/editor';
import { FiltersTool } from '../tools/FiltersTool';
import { AdjustmentsTool } from '../tools/AdjustmentsTool';
import { BackgroundTool } from '../tools/BackgroundTool';
import { CropTool } from '../tools/CropTool';
import { PassportTool } from '../tools/PassportTool';

interface LeftToolPanelProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  activeImage: ImageItem | null;
  selectedObjectTarget: ObjectDetectionTarget;
  onSelectObjectTarget: (target: ObjectDetectionTarget) => void;
  onApplyObjectAction: () => void;
  onCancelObjectAction: () => void;
  areaAdjustments: SelectedAreaAdjustments;
  onUpdateAreaAdjustments: (adjustments: SelectedAreaAdjustments) => void;
  onTriggerSmoothPassportCrop: () => void;
  onInvertCutout?: () => void;
  onRemoveBackground: (provider?: 'removebg' | 'studio') => void;
  onAutoEnhance: () => void;
  onSwinIREnhance?: (options: {
    scale: 1 | 2 | 4;
    strength: number;
    preset?: 'natural' | 'portrait' | 'old_photo' | 'low_quality';
    isPreview?: boolean;
  }) => void;
  enhanceProgress?: { currentTile: number; totalTiles: number; percentage: number; message: string } | null;
  onCancelEnhance?: () => void;
  isRemovingBg?: boolean;
  isEnhancing?: boolean;
  isDetecting?: boolean;
  detectionData?: AIDetectionData | null;
  cropRect: CropRect | null;
  cropAspect: AspectRatioOption;
  customInchSize?: CustomInchSize;
  onSelectCropAspect: (aspect: AspectRatioOption, custom?: CustomInchSize) => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onResetCropArea: () => void;
  onSelectFilter: (filter: FilterType) => void;
  onUpdateAdjustments: (adjustments: ImageAdjustments) => void;
  onResetAdjustments: () => void;
  onChangeBackground?: (bg: BackgroundSettings) => void;
  aiStatus?: AIStatusInfo | null;
  onOpenPassportMode: () => void;
  onOpenAIAssistant: () => void;
  onOpenJointPhotoModal?: () => void;
  onChangePassport?: (passport: PassportSettings) => void;
  onApplyPassport?: () => void;
  onCancelPassport?: () => void;
}

export const LeftToolPanel: React.FC<LeftToolPanelProps> = ({
  activeTool,
  onSelectTool,
  activeImage,
  selectedObjectTarget,
  onSelectObjectTarget,
  onApplyObjectAction,
  onCancelObjectAction,
  areaAdjustments,
  onUpdateAreaAdjustments,
  onTriggerSmoothPassportCrop,
  onInvertCutout,
  onRemoveBackground,
  onAutoEnhance,
  onSwinIREnhance,
  enhanceProgress = null,
  onCancelEnhance,
  isRemovingBg = false,
  isEnhancing = false,
  isDetecting = false,
  detectionData = null,
  cropRect,
  cropAspect,
  customInchSize,
  onSelectCropAspect,
  onApplyCrop,
  onCancelCrop,
  onResetCropArea,
  onSelectFilter,
  onUpdateAdjustments,
  onResetAdjustments,
  onChangeBackground,
  aiStatus,
  onOpenPassportMode,
  onOpenAIAssistant,
  onOpenJointPhotoModal,
  onChangePassport,
  onApplyPassport,
  onCancelPassport,
}) => {
  const [activeTab, setActiveTab] = useState<'object' | 'filters'>(() => {
    if (activeTool === 'filters') return 'filters';
    return 'object';
  });

  // Track if user attempted to select face/skin/hair before cropping
  const [faceSelectedAttempt, setFaceSelectedAttempt] = useState<boolean>(false);

  useEffect(() => {
    setFaceSelectedAttempt(false);
  }, [activeImage?.id]);

  useEffect(() => {
    if (activeTool === 'filters') {
      setActiveTab('filters');
    } else if (activeTool === 'object') {
      setActiveTab('object');
    }
  }, [activeTool]);

  const isRemoveBgConfigured = Boolean(aiStatus?.removeBg?.isConfigured);

  return (
    <aside
      id="shebaflow-left-panel"
      className="w-72 lg:w-80 h-[calc(100%-2rem)] max-h-[calc(100%-2rem)] bg-[#131C2E] border border-[#212F47] rounded-2xl flex flex-col select-none shrink-0 shadow-xl m-4 mr-0 z-20 overflow-hidden"
    >
      {/* Smoothly Scrollable Panel Body with all Tools, AI Controls & Adjustments */}
      <div
        id="shebaflow-tools-scroll-body"
        onWheel={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3.5 overscroll-contain scrollbar-thin scrollbar-thumb-slate-700/80 hover:scrollbar-thumb-cyan-500/50 scrollbar-track-transparent"
      >
        {/* Top Row: Studio Quick Actions (Crop, Remove BG, Auto Tone) */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          {/* Crop Button */}
          <button
            id="btn-tool-crop"
            onClick={activeTool === 'crop' ? onCancelCrop : onTriggerSmoothPassportCrop}
            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
              activeTool === 'crop'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950/40'
                : 'bg-[#162135] hover:bg-[#1C2B44] border-[#243552] text-slate-200 hover:text-white shadow-sm'
            }`}
            title={activeTool === 'crop' ? 'Exit Crop Mode' : 'Biometric & Custom Crop'}
          >
            <Crop className="w-4 h-4 stroke-[2]" />
            <span className="text-[11px]">{activeTool === 'crop' ? 'Exit Crop' : 'Crop'}</span>
          </button>

          {/* Remove BG Button */}
          <button
            id="btn-tool-remove-bg"
            onClick={() => onRemoveBackground()}
            disabled={isRemovingBg || !activeImage}
            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
              isRemovingBg
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-[#162135] hover:bg-[#1C2B44] border-[#243552] text-slate-200 hover:text-white shadow-sm'
            } active:scale-98 disabled:opacity-50`}
            title={
              isRemoveBgConfigured
                ? 'Remove background with remove.bg API'
                : 'Isolate subject & remove background'
            }
          >
            <Scissors className={`w-4 h-4 stroke-[2] ${isRemovingBg ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="text-[11px] truncate">
              {isRemovingBg ? 'Isolating...' : 'Remove BG'}
            </span>
          </button>

          {/* Auto Tone / Enhance Button */}
          <button
            id="btn-tool-auto-enhance"
            onClick={onAutoEnhance}
            disabled={isEnhancing || !activeImage}
            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
              isEnhancing
                ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                : 'bg-[#162135] hover:bg-[#1C2B44] border-[#243552] text-slate-200 hover:text-white shadow-sm'
            } active:scale-98 disabled:opacity-50`}
            title="Auto-enhance exposure, dynamic range & tonal curves"
          >
            <Sparkles className={`w-4 h-4 stroke-[2] ${isEnhancing ? 'animate-spin text-blue-300' : 'text-blue-400'}`} />
            <span className="text-[11px] truncate">
              {isEnhancing ? 'Enhancing...' : 'Auto Tone'}
            </span>
          </button>
        </div>

        {/* Inline Progress Alert when Processing */}
        {isEnhancing && (
          <div className="p-2.5 rounded-xl bg-[#0A101D] border border-blue-500/30 flex items-center justify-between text-xs text-blue-300 shadow-sm animate-in fade-in shrink-0">
            <span className="flex items-center gap-2 truncate">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
              <span className="text-[11px] truncate">{enhanceProgress?.message || 'Optimizing photo tone & exposure...'}</span>
            </span>
            {onCancelEnhance && (
              <button
                type="button"
                onClick={onCancelEnhance}
                className="text-[10px] font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 px-2 py-0.5 rounded-md border border-rose-500/30 transition-colors shrink-0"
              >
                Cancel
              </button>
            )}
          </div>
        )}

      {/* Segment Tabs: Object and Filter */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B1220] border border-[#1E2D45] rounded-xl shrink-0">
        <button
          id="tab-object"
          type="button"
          onClick={() => {
            setActiveTab('object');
            onSelectTool('object');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'object'
              ? 'bg-[#2563EB] text-white shadow-md shadow-blue-950/40'
              : 'bg-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Object</span>
        </button>

        <button
          id="tab-filters"
          type="button"
          onClick={() => {
            setActiveTab('filters');
            onSelectTool('filters');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'filters'
              ? 'bg-[#2563EB] text-white shadow-md shadow-blue-950/40'
              : 'bg-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Filter</span>
        </button>
      </div>

      {/* Tab Content: Object Detection & Retouching */}
      {activeTab === 'object' && (
        <div className="flex flex-col gap-4">
          {/* 3 Detection Targets (Face, Skin, Hair) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Face */}
            <button
              id="btn-detect-face"
              onClick={() => {
                if (!activeImage?.isCropped) {
                  setFaceSelectedAttempt(true);
                  onSelectObjectTarget('face');
                } else {
                  onSelectObjectTarget(selectedObjectTarget === 'face' ? 'none' : 'face');
                }
              }}
              className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border transition-all ${
                selectedObjectTarget === 'face' || (!activeImage?.isCropped && faceSelectedAttempt)
                  ? 'bg-blue-600/25 border-blue-400 text-blue-300 shadow-lg shadow-blue-950/40'
                  : 'bg-[#1A253A] hover:bg-[#202F49] border-[#293B58] text-slate-300'
              }`}
            >
              <Smile className="w-5 h-5" />
              <span className="text-xs font-semibold">Face</span>
            </button>

            {/* Skin */}
            <button
              id="btn-detect-skin"
              onClick={() => {
                if (!activeImage?.isCropped) {
                  setFaceSelectedAttempt(true);
                  onSelectObjectTarget('skin');
                } else {
                  onSelectObjectTarget(selectedObjectTarget === 'skin' ? 'none' : 'skin');
                }
              }}
              className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border transition-all ${
                selectedObjectTarget === 'skin'
                  ? 'bg-blue-600/25 border-blue-400 text-blue-300 shadow-lg shadow-blue-950/40'
                  : 'bg-[#1A253A] hover:bg-[#202F49] border-[#293B58] text-slate-300'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-semibold">Skin</span>
            </button>

            {/* Hair */}
            <button
              id="btn-detect-hair"
              onClick={() => {
                if (!activeImage?.isCropped) {
                  setFaceSelectedAttempt(true);
                  onSelectObjectTarget('hair');
                } else {
                  onSelectObjectTarget(selectedObjectTarget === 'hair' ? 'none' : 'hair');
                }
              }}
              className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border transition-all ${
                selectedObjectTarget === 'hair'
                  ? 'bg-blue-600/25 border-blue-400 text-blue-300 shadow-lg shadow-blue-950/40'
                  : 'bg-[#1A253A] hover:bg-[#202F49] border-[#293B58] text-slate-300'
              }`}
            >
              <Scissors className="w-5 h-5" />
              <span className="text-xs font-semibold">Hair</span>
            </button>
          </div>

          {/* Prompt caption / Crop Required Banner */}
          <div className="p-2.5 rounded-xl bg-[#0F172A] border border-[#233149] flex flex-col gap-1.5">
            {!activeImage?.isCropped && faceSelectedAttempt ? (
              <div className="flex flex-col items-center gap-1.5 text-center py-1 animate-in fade-in">
                <span className="text-[11px] text-amber-300 font-semibold">
                  Crop required before face detection
                </span>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Please crop the photo first using the toolbar under the photo. Face detection will run on the cropped image.
                </p>
                <button
                  type="button"
                  onClick={onTriggerSmoothPassportCrop}
                  className="mt-1 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/40 transition-all cursor-pointer"
                >
                  Open Crop Tool
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[#94A3B8] text-center leading-relaxed">
                {selectedObjectTarget === 'none' &&
                  'Select Face, Skin or Hair to detect and retouch with pixel-accurate contour masks.'}
                {selectedObjectTarget === 'face' &&
                  (detectionData?.face
                    ? 'Facial contour selected: Forehead, temples, cheeks, ears, chin & beard isolated.'
                    : 'Face detected: Natural facial contours isolated with soft edge feathering.')}
                {selectedObjectTarget === 'skin' &&
                  (detectionData?.skin
                    ? 'Skin areas selected: Visible skin across face, neck, shoulders & arms isolated.'
                    : 'All visible skin detected across face, neck and arms with soft edge feathering.')}
                {selectedObjectTarget === 'hair' &&
                  (detectionData?.hair
                    ? 'Hair boundary selected: Crown, hairline & strands isolated.'
                    : 'Hair contour detected: Texture & edge definition ready.')}
              </p>
            )}
          </div>

          {/* Real-time Brightness, Contrast, Warmth & Smoothing Controls */}
          {selectedObjectTarget !== 'none' && (
            <div className="p-3 rounded-xl bg-[#0F172A] border border-cyan-500/40 flex flex-col gap-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {selectedObjectTarget === 'face'
                      ? 'Face Area Adjustments'
                      : selectedObjectTarget === 'skin'
                      ? 'Skin Area Adjustments'
                      : 'Hair Area Adjustments'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateAreaAdjustments({
                      brightness: 0,
                      contrast: 0,
                      smoothness: 0,
                      warmth: 0,
                    })
                  }
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  title="Reset area adjustments"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Area Brightness Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>Brightness</span>
                  </span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {areaAdjustments.brightness > 0 ? `+${areaAdjustments.brightness}%` : `${areaAdjustments.brightness}%`}
                  </span>
                </div>
                <input
                  id="slider-area-brightness"
                  type="range"
                  min="-100"
                  max="100"
                  value={areaAdjustments.brightness}
                  onChange={(e) =>
                    onUpdateAreaAdjustments({
                      ...areaAdjustments,
                      brightness: Number(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Area Contrast Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 flex items-center gap-1">
                    <Contrast className="w-3 h-3 text-cyan-400" />
                    <span>Contrast</span>
                  </span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {areaAdjustments.contrast > 0 ? `+${areaAdjustments.contrast}%` : `${areaAdjustments.contrast}%`}
                  </span>
                </div>
                <input
                  id="slider-area-contrast"
                  type="range"
                  min="-100"
                  max="100"
                  value={areaAdjustments.contrast}
                  onChange={(e) =>
                    onUpdateAreaAdjustments({
                      ...areaAdjustments,
                      contrast: Number(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Area Smoothing Slider (for face & skin) */}
              {(selectedObjectTarget === 'face' || selectedObjectTarget === 'skin') && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Skin Softening</span>
                    </span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      {areaAdjustments.smoothness}%
                    </span>
                  </div>
                  <input
                    id="slider-area-smoothness"
                    type="range"
                    min="0"
                    max="50"
                    value={areaAdjustments.smoothness}
                    onChange={(e) =>
                      onUpdateAreaAdjustments({
                        ...areaAdjustments,
                        smoothness: Number(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              )}

              {/* Quick Portrait Presets */}
              <div className="grid grid-cols-3 gap-1 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateAreaAdjustments({
                      brightness: 18,
                      contrast: 10,
                      smoothness: selectedObjectTarget === 'hair' ? 0 : 15,
                      warmth: 6,
                    })
                  }
                  className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-cyan-200 text-center transition-all"
                >
                  Radiant
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateAreaAdjustments({
                      brightness: 12,
                      contrast: 20,
                      smoothness: selectedObjectTarget === 'hair' ? 0 : 10,
                      warmth: 0,
                    })
                  }
                  className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-cyan-200 text-center transition-all"
                >
                  Studio
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateAreaAdjustments({
                      brightness: 10,
                      contrast: 6,
                      smoothness: selectedObjectTarget === 'hair' ? 0 : 25,
                      warmth: 4,
                    })
                  }
                  className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-cyan-200 text-center transition-all"
                >
                  Smooth
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: Apply & Cancel */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              id="btn-object-apply"
              onClick={onApplyObjectAction}
              disabled={selectedObjectTarget === 'none' || !activeImage || isDetecting}
              className="w-full py-2.5 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white font-semibold text-xs tracking-wide shadow-md shadow-blue-950/30 transition-all active:scale-95"
            >
              Apply Adjustments
            </button>

            <button
              id="btn-object-cancel"
              onClick={onCancelObjectAction}
              className="w-full py-2.5 px-3 rounded-xl bg-transparent hover:bg-rose-500/10 border border-[#4C1D2E] text-rose-300/90 font-semibold text-xs tracking-wide transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Filters & Adjustments */}
      {activeTab === 'filters' && activeImage && (
        <div className="flex flex-col gap-3">
          <FiltersTool
            currentFilter={activeImage.filter}
            thumbnailUrl={activeImage.thumbnailUrl}
            onSelectFilter={onSelectFilter}
          />
          <div className="pt-2 border-t border-[#212F47]">
            <AdjustmentsTool
              adjustments={activeImage.adjustments}
              onChange={onUpdateAdjustments}
              onResetAll={onResetAdjustments}
            />
          </div>
        </div>
      )}
      </div>

      {/* Pinned Passport & AI Shortcuts Footer */}
      <div className="shrink-0 p-3 px-4 border-t border-[#212F47] bg-[#111A2B]/90 backdrop-blur-sm flex items-center justify-around text-xs text-slate-400">
        <button
          onClick={onOpenPassportMode}
          className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-[11px] font-medium py-1 px-3 rounded-lg hover:bg-[#15233D] transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Passport</span>
        </button>

        <button
          onClick={onOpenAIAssistant}
          className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-[11px] font-medium py-1 px-3 rounded-lg hover:bg-[#15233D] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Assist</span>
        </button>
      </div>
    </aside>
  );
};
