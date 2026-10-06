import React from 'react';
import { ImageAdjustments } from '../types/image';
import {
  RotateCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Contrast as ContrastIcon,
  Palette,
  FileCheck,
  Type,
  Zap,
  Maximize,
  Space,
  RotateCcw as ResetIcon,
  Wand2,
} from 'lucide-react';

interface AdjustmentPanelProps {
  adjustments: ImageAdjustments;
  rotation: number;
  printGapMm: number;
  onAdjustmentChange: (key: keyof ImageAdjustments, value: number) => void;
  onRotate: (direction: 'cw' | 'ccw') => void;
  onResetRotation: () => void;
  onResetAdjustments: () => void;
  onPrintGapChange: (value: number) => void;
  onPreparePrint: () => void;
  onApplyPreset?: (preset: 'original' | 'nid_clean' | 'photocopy') => void;
  hasImages: boolean;
  activeSideName: string;
}

export const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({
  adjustments,
  rotation,
  printGapMm,
  onAdjustmentChange,
  onRotate,
  onResetRotation,
  onResetAdjustments,
  onPrintGapChange,
  onPreparePrint,
  onApplyPreset,
  hasImages,
  activeSideName,
}) => {
  return (
    <div className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto shrink-0 select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            কালার ও প্রিন্ট মান ({activeSideName})
          </h2>
        </div>
        <button
          onClick={onResetAdjustments}
          className="text-[11px] font-medium text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
          title="Reset Adjustments"
        >
          <ResetIcon className="w-3 h-3" />
          <span>রিসেট</span>
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-4 text-xs text-slate-700">
        {/* 1. ONE-CLICK SMART PRESETS */}
        {onApplyPreset && (
          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Wand2 className="w-3.5 h-3.5 text-blue-600" />
              <span>এক-ক্লিকে ইমেজ প্রিসেট</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                onClick={() => onApplyPreset('original')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 shadow-2xs text-[11px] transition-all"
              >
                সাধারণ
              </button>
              <button
                onClick={() => onApplyPreset('nid_clean')}
                className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg border border-blue-200 shadow-2xs text-[11px] transition-all"
              >
                ক্লিয়ার NID
              </button>
              <button
                onClick={() => onApplyPreset('photocopy')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 shadow-2xs text-[11px] transition-all"
              >
                ফটোকপি
              </button>
            </div>
          </div>
        )}

        {/* 2. ROTATION CONTROLS */}
        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>ঘূর্ণন (Rotate): {rotation}°</span>
            </label>
            {rotation !== 0 && (
              <button
                onClick={onResetRotation}
                className="text-[10px] text-blue-600 hover:text-blue-700 underline font-medium"
              >
                0° সোজা
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onRotate('ccw')}
              className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-98"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>90° বামে</span>
            </button>
            <button
              onClick={() => onRotate('cw')}
              className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-98"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600" />
              <span>90° ডানে</span>
            </button>
          </div>
        </div>

        {/* 3. BASIC COLOR & LIGHT ADJUSTMENTS */}
        <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>মূল কালার এডজাস্টমেন্ট</span>
            </h3>
          </div>

          {/* Brightness */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <Sun className="w-3 h-3 text-amber-500" /> ব্রাইটনেস (Brightness)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.brightness}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={adjustments.brightness}
              onChange={(e) => onAdjustmentChange('brightness', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <ContrastIcon className="w-3 h-3 text-indigo-500" /> কনট্রাস্ট (Contrast)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.contrast}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={adjustments.contrast}
              onChange={(e) => onAdjustmentChange('contrast', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <Palette className="w-3 h-3 text-emerald-500" /> সেচুরেশন (Saturation)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.saturation}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={adjustments.saturation}
              onChange={(e) => onAdjustmentChange('saturation', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* 4. DOCUMENT ENHANCEMENTS */}
        <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>ডকুমেন্ট প্রিন্ট এনহান্সমেন্ট</span>
            </h3>
          </div>

          {/* White/Black Levels */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <Zap className="w-3 h-3 text-amber-500" /> ব্যাকগ্রাউন্ড পরিষ্কার (Levels)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.levels}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={adjustments.levels}
              onChange={(e) => onAdjustmentChange('levels', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Text Deepen */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <Type className="w-3 h-3 text-purple-600" /> বাংলা লেখা গাঢ়করণ (Text Deepen)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.textDeepen}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={adjustments.textDeepen}
              onChange={(e) => onAdjustmentChange('textDeepen', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Sharpen Filter */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <Sparkles className="w-3 h-3 text-cyan-600" /> এজ শার্পেন (Sharpen)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.sharpen}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={adjustments.sharpen}
              onChange={(e) => onAdjustmentChange('sharpen', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Upscale */}
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <Maximize className="w-3 h-3 text-rose-500" /> রেজোলিউশন (Upscale)
              </span>
              <span className="font-mono text-blue-600 font-semibold">{adjustments.upscale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="2.0"
              step="0.1"
              value={adjustments.upscale}
              onChange={(e) => onAdjustmentChange('upscale', Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* 5. COMPOSER PRINT GAP */}
        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <div className="flex justify-between font-medium text-[11px]">
            <span className="flex items-center gap-1 text-slate-700">
              <Space className="w-3.5 h-3.5 text-blue-600" /> দুই পৃষ্ঠার মাঝের গ্যাপ (Print Gap)
            </span>
            <span className="font-mono text-blue-600 font-semibold">{printGapMm} mm</span>
          </div>
          <input
            type="range"
            min="2"
            max="25"
            value={printGapMm}
            onChange={(e) => onPrintGapChange(Number(e.target.value))}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* PRIMARY PREPARE BUTTON */}
        <div className="pt-2 mt-auto">
          <button
            onClick={onPreparePrint}
            disabled={!hasImages}
            className="w-full py-3 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm border border-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileCheck className="w-4 h-4" />
            <span className="font-bn text-sm">NID প্রস্তুত ও প্রিন্ট লেআউট</span>
          </button>
        </div>
      </div>
    </div>
  );
};
