import React, { useRef } from 'react';
import { ImageAdjustments, SideId } from '../types/image';
import { CreditCard, Sliders, Wand2, RotateCcw, Zap, Type } from 'lucide-react';

interface SidebarProps {
  autoSelect: boolean;
  onAutoSelectChange: (val: boolean) => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onPasteClick: () => void;
  adjustments: ImageAdjustments;
  onAdjustmentChange: (key: keyof ImageAdjustments, value: number, target?: SideId | 'both') => void;
  onAutoColor?: (target?: SideId | 'both') => void;
  onResetAdjustments?: (target?: SideId | 'both') => void;
  onGenerateNid: () => void;
  hasImages: boolean;
  hasBothSides: boolean;
  targetSide: SideId | 'both';
  onTargetSideChange: (target: SideId | 'both') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  autoSelect,
  onAutoSelectChange,
  onFilesSelected,
  onPasteClick,
  adjustments,
  onAdjustmentChange,
  onAutoColor,
  onResetAdjustments,
  onGenerateNid,
  hasImages,
  hasBothSides,
  targetSide,
  onTargetSideChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <aside className="w-full lg:w-[320px] bg-white border-r border-slate-200/90 flex flex-col h-full p-4 lg:p-5 select-none shrink-0 overflow-y-auto">
      {/* 1. AUTO-SELECT TOGGLE (অটো-সিলেক্ট) */}
      <div className="flex items-center justify-between py-2 border-b border-slate-100 pb-3">
        <div>
          <label className="text-sm font-semibold text-slate-800 cursor-pointer font-bn block">
            অটো-সিলেক্ট ও ক্রপ:
          </label>
          <span className="text-[10px] text-slate-400 font-bn">
            ছবি আপলোডের সাথে সাথে স্বয়ংক্রিয় ক্রপ
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAutoSelectChange(!autoSelect)}
          className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
            autoSelect ? 'bg-[#2c3e50]' : 'bg-slate-300'
          }`}
          aria-label="Toggle Auto Select"
        >
          <div
            className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
              autoSelect ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 2. UPLOAD DROPZONE */}
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/jpg"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#546274]/40 hover:border-[#2c3e50] bg-slate-50/60 hover:bg-slate-100/70 rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer group"
        >
          <div className="text-slate-600 group-hover:text-slate-800 transition-colors">
            <div className="relative inline-block">
              <CreditCard className="w-8 h-8 text-slate-700" />
              <CreditCard className="w-6 h-6 text-slate-500 absolute -top-1 -right-2" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-800 font-bn">এক বা দুইপাশ একসাথে</p>
            <p className="text-xs font-bold text-slate-900 underline font-bn mt-0.5">
              আপলোড করুন
            </p>
          </div>

          <div
            onClick={(e) => {
              e.stopPropagation();
              onPasteClick();
            }}
            className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-white border border-slate-300 rounded px-2 py-0.5 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <kbd className="font-mono text-[10px] font-semibold text-slate-800">Ctrl + V</kbd>
            <span className="font-bn">দিয়ে পেস্ট করুন</span>
          </div>
        </div>
      </div>

      {/* 3. BASIC ADJUSTMENT SLIDERS */}
      <div className="mt-5 bg-[#f1f5f9] rounded-xl p-3.5 space-y-3 border border-slate-200/80 shadow-2xs">
        {/* Header with Side Target & Quick Actions */}
        <div className="space-y-2 pb-2.5 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 font-bn">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>
                কালার এডজাস্টমেন্ট{' '}
                {hasBothSides
                  ? targetSide === 'both'
                    ? '(উভয় পাশ)'
                    : targetSide === 'front'
                    ? '(সামনে)'
                    : '(পেছনে)'
                  : targetSide === 'back'
                  ? '(পেছনের পাশ)'
                  : '(সামনের পাশ)'}
              </span>
            </div>

            {/* Quick Auto Color & Reset buttons */}
            <div className="flex items-center gap-1">
              {onAutoColor && (
                <button
                  type="button"
                  onClick={() => onAutoColor(targetSide)}
                  disabled={!hasImages}
                  className="py-1 px-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-md text-[10px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                  title="অটো কালার ও ব্যাকগ্রাউন্ড পরিষ্কার"
                >
                  <Wand2 className="w-2.5 h-2.5" />
                  <span className="font-bn">অটো</span>
                </button>
              )}

              {onResetAdjustments && (
                <button
                  type="button"
                  onClick={() => onResetAdjustments(targetSide)}
                  disabled={!hasImages}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-40"
                  title="এডজাস্টমেন্ট রিসেট"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Segmented target toggle when both sides exist */}
          {hasBothSides && (
            <div className="flex items-center gap-1 bg-slate-200/90 p-0.5 rounded-lg text-[11px] font-bn font-semibold">
              <button
                type="button"
                onClick={() => onTargetSideChange('both')}
                className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                  targetSide === 'both'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="উভয় পাশের কালার একসাথে পরিবর্তন করুন"
              >
                উভয় পাশ
              </button>
              <button
                type="button"
                onClick={() => onTargetSideChange('front')}
                className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                  targetSide === 'front'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="শুধু সামনের পাশ পরিবর্তন করুন"
              >
                সামনে
              </button>
              <button
                type="button"
                onClick={() => onTargetSideChange('back')}
                className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                  targetSide === 'back'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="শুধু পেছনের পাশ পরিবর্তন করুন"
              >
                পেছনে
              </button>
            </div>
          )}
        </div>

        {/* Levels (Background Clean) */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span className="font-bn flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" /> ব্যাকগ্রাউন্ড পরিষ্কার:
            </span>
            <span className="font-mono text-[11px] text-blue-600">{adjustments.levels}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={adjustments.levels}
            onChange={(e) => onAdjustmentChange('levels', Number(e.target.value), targetSide)}
            className="w-full h-1.5 bg-slate-300 rounded-lg cursor-pointer accent-[#2563eb]"
          />
        </div>

        {/* Text Deepen */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span className="font-bn flex items-center gap-1">
              <Type className="w-3 h-3 text-purple-600" /> লেখা গাঢ়করণ (Text Deepen):
            </span>
            <span className="font-mono text-[11px] text-blue-600">{adjustments.textDeepen}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={adjustments.textDeepen}
            onChange={(e) => onAdjustmentChange('textDeepen', Number(e.target.value), targetSide)}
            className="w-full h-1.5 bg-slate-300 rounded-lg cursor-pointer accent-[#2563eb]"
          />
        </div>

        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span>Brightness:</span>
            <span className="font-mono text-[11px] text-blue-600">{adjustments.brightness}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={adjustments.brightness}
            onChange={(e) => onAdjustmentChange('brightness', Number(e.target.value), targetSide)}
            className="w-full h-1.5 bg-slate-300 rounded-lg cursor-pointer accent-[#2563eb]"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span>Contrast:</span>
            <span className="font-mono text-[11px] text-blue-600">{adjustments.contrast}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={adjustments.contrast}
            onChange={(e) => onAdjustmentChange('contrast', Number(e.target.value), targetSide)}
            className="w-full h-1.5 bg-slate-300 rounded-lg cursor-pointer accent-[#2563eb]"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span>Saturation:</span>
            <span className="font-mono text-[11px] text-blue-600">{adjustments.saturation}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={adjustments.saturation}
            onChange={(e) => onAdjustmentChange('saturation', Number(e.target.value), targetSide)}
            className="w-full h-1.5 bg-slate-300 rounded-lg cursor-pointer accent-[#2563eb]"
          />
        </div>

        {/* Upscale Resolution */}
        <div className="space-y-1.5 pt-2 border-t border-slate-200">
          <div className="flex justify-between text-xs font-semibold text-slate-800">
            <span className="font-bn">আপস্কেল রেজোলিউশন:</span>
            <span className="font-mono text-[11px] text-amber-600 font-bold">
              {(adjustments.upscale || 1.0) >= 3.5
                ? '4x UHD'
                : (adjustments.upscale || 1.0) >= 1.5
                ? '2x HD'
                : '1x Normal'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onAdjustmentChange('upscale', 1.0, targetSide)}
              className={`py-1 text-center rounded text-[11px] font-semibold transition-all cursor-pointer font-bn ${
                (adjustments.upscale || 1.0) <= 1.0
                  ? 'bg-[#2c3e50] text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-300'
              }`}
            >
              ১x সাধারণ
            </button>
            <button
              type="button"
              onClick={() => onAdjustmentChange('upscale', 2.0, targetSide)}
              className={`py-1 text-center rounded text-[11px] font-semibold transition-all cursor-pointer font-bn ${
                (adjustments.upscale || 1.0) >= 1.5 && (adjustments.upscale || 1.0) < 3.5
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-300'
              }`}
            >
              ২x HD
            </button>
            <button
              type="button"
              onClick={() => onAdjustmentChange('upscale', 4.0, targetSide)}
              className={`py-1 text-center rounded text-[11px] font-semibold transition-all cursor-pointer font-bn ${
                (adjustments.upscale || 1.0) >= 3.5
                  ? 'bg-purple-600 text-white shadow-2xs font-bold'
                  : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-300'
              }`}
            >
              ৪x UHD
            </button>
          </div>
        </div>
      </div>

      {/* 4. NID তৈরি করুন PRIMARY ACTION BUTTON */}
      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={onGenerateNid}
          disabled={!hasImages}
          className="w-full py-3.5 px-4 bg-[#2c3e50] hover:bg-[#1a252f] active:bg-[#121a22] text-white font-bold rounded-xl text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bn text-center flex items-center justify-center cursor-pointer"
        >
          <span>NID তৈরি ও প্রিন্ট প্রিভিউ</span>
        </button>
      </div>
    </aside>
  );
};
