import React, { useRef, useEffect, useState } from 'react';
import { ImageAdjustments, SideId } from '../types/image';
import { PrintSettings } from '../types/print';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  Sliders,
  Space,
  Palette,
  Zap,
  Type,
  Maximize,
  Copy,
  Check,
  Sparkles,
  Wand2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Edit2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  combinedCanvas: HTMLCanvasElement | null;
  adjustments: ImageAdjustments;
  frontAdjustments?: ImageAdjustments;
  backAdjustments?: ImageAdjustments;
  printSettings: PrintSettings;
  nidNumber: string;
  isReadingNid?: boolean;
  onNidNumberChange?: (val: string) => void;
  onAdjustmentChange: (key: keyof ImageAdjustments, value: number, target: SideId | 'both') => void;
  onPrintSettingsChange: (settings: Partial<PrintSettings>) => void;
  onAutoColor?: (target: SideId | 'both') => void;
  onDownloadPng: () => void;
  onDownloadJpeg: () => void;
  onDownloadPdf: () => void;
  onDirectPrint: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  combinedCanvas,
  adjustments,
  frontAdjustments,
  backAdjustments,
  printSettings,
  nidNumber,
  isReadingNid,
  onNidNumberChange,
  onAdjustmentChange,
  onPrintSettingsChange,
  onAutoColor,
  onDownloadPng,
  onDownloadJpeg,
  onDownloadPdf,
  onDirectPrint,
}) => {
  const canvasRef1 = useRef<HTMLCanvasElement>(null);

  // Fine-tuning collapsible toggle (open by default)
  const [showSliders, setShowSliders] = useState(true);
  const [isEditingNid, setIsEditingNid] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<'both' | 'front' | 'back'>('both');
  const [isZoomed, setIsZoomed] = useState(false);

  const currentAdjustments =
    adjustTarget === 'back'
      ? backAdjustments || adjustments
      : adjustTarget === 'front'
      ? frontAdjustments || adjustments
      : frontAdjustments || adjustments;

  useEffect(() => {
    if (combinedCanvas && canvasRef1.current) {
      canvasRef1.current.width = combinedCanvas.width;
      canvasRef1.current.height = combinedCanvas.height;
      const ctx = canvasRef1.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        ctx.drawImage(combinedCanvas, 0, 0);
      }
    }
  }, [combinedCanvas, isOpen, frontAdjustments, backAdjustments, adjustments, printSettings.printGapMm]);

  if (!isOpen) return null;

  const isLandscape = printSettings.copies === 2;

  const handleSelectOneCopy = () => {
    onPrintSettingsChange({ copies: 1, orientation: 'portrait' });
  };

  const handleSelectTwoCopies = () => {
    onPrintSettingsChange({ copies: 2, orientation: 'landscape' });
  };

  const handleResetAdjustments = () => {
    onAdjustmentChange('brightness', 0, adjustTarget);
    onAdjustmentChange('contrast', 0, adjustTarget);
    onAdjustmentChange('saturation', 0, adjustTarget);
    onAdjustmentChange('levels', 0, adjustTarget);
    onAdjustmentChange('textDeepen', 0, adjustTarget);
    onAdjustmentChange('sharpen', 0, adjustTarget);
  };

  const cleanNid = nidNumber.trim() || '1234567890';
  const displayNid = cleanNid.toLowerCase().startsWith('nid-') ? cleanNid : `nid-${cleanNid}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] max-h-[820px] flex flex-col overflow-hidden text-slate-800">
        {/* ========================================================================= */}
        {/* 1. MODAL TOP HEADER */}
        {/* ========================================================================= */}
        <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 font-bn">
                <span>NID কার্ড ভিউ ও প্রিন্ট</span>
                <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                  Standard {printSettings.cardWidthMm}mm NID
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-bn">
                আসল সাইজ: ৮.৬ সেমি × ৫.৪ সেমি • প্রিন্ট বাটনে চাপলে ফুল পেজ প্রিন্ট প্রিভিউ দেখতে পাবেন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. MAIN BODY GRID */}
        {/* ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* --------------------------------------------------------------------- */}
          {/* LEFT: JUST NID CARD (Crisp, High-Resolution, No simulated A4 sheet) */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-7 bg-slate-100/70 p-3 sm:p-5 flex flex-col items-center justify-between overflow-hidden border-r border-slate-200">
            {/* Top Indicator Badge & 1:1 Zoom Inspection Toggle */}
            <div className="w-full flex items-center justify-between px-1 gap-2 flex-wrap">
              <div className="text-xs text-slate-700 font-bn flex items-center gap-2 font-semibold bg-white px-3.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>NID কার্ড (সামনে ও পেছনের পাশ - ভাঁজ রেখা সহ)</span>
              </div>

              {/* 1:1 Pixel Zoom / Fit Inspection Toggle */}
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className={`text-xs font-bn flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-2xs transition-all cursor-pointer font-semibold ${
                  isZoomed
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="১০০% আসল পিক্সেল সাইজে কার্ডের টেক্সট ও কোয়ালিটি ইনসপেক্ট করুন"
              >
                {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                <span>{isZoomed ? 'স্ক্রিনে ফিট করুন' : '১০০% পিক্সেল জুম (১:১)'}</span>
              </button>
            </div>

            {/* Direct High-Resolution NID Card Container */}
            <div
              className={`w-full flex-1 flex items-center justify-center p-2 min-h-0 ${
                isZoomed ? 'overflow-auto max-h-[60vh]' : 'overflow-hidden'
              }`}
            >
              {combinedCanvas ? (
                <div
                  className={`flex items-center justify-center relative shadow-xl rounded-xl border border-slate-300 bg-white p-2 transition-all ${
                    isZoomed
                      ? 'm-auto'
                      : 'max-h-[58vh] sm:max-h-[62vh] max-w-full'
                  }`}
                >
                  <canvas
                    ref={canvasRef1}
                    className={`block rounded-lg select-none ${
                      isZoomed
                        ? 'max-w-none max-h-none'
                        : 'max-h-[54vh] sm:max-h-[58vh] max-w-full object-contain'
                    }`}
                  />
                </div>
              ) : (
                <div className="text-center text-slate-400 font-bn text-sm bg-white p-8 rounded-xl border border-dashed border-slate-300">
                  কোন NID কার্ডের ছবি যুক্ত করা হয়নি
                </div>
              )}
            </div>

            {/* Bottom Dimension & Resolution Badge */}
            <div className="text-[11px] sm:text-xs text-slate-700 font-mono bg-white px-4 py-1.5 rounded-full border border-slate-300 shadow-2xs flex items-center gap-2 font-bn flex-wrap justify-center">
              <span className="font-bold text-emerald-700">সাইজ:</span>
              <span className="font-mono font-semibold">
                ৮.৬ সেমি ({printSettings.cardWidthMm} মিমি) × ৫.৪ সেমি ({printSettings.cardHeightMm} মিমি)
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-blue-700">রেজোলিউশন:</span>
              <span className="font-mono font-semibold text-blue-800">
                {combinedCanvas ? `${combinedCanvas.width} × ${combinedCanvas.height} px` : '—'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  (currentAdjustments.upscale || 1.0) >= 3.5
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : (currentAdjustments.upscale || 1.0) >= 1.5
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {(currentAdjustments.upscale || 1.0) >= 3.5
                  ? '✓ ৬০০ DPI (Ultra HD)'
                  : (currentAdjustments.upscale || 1.0) >= 1.5
                  ? '✓ ৩০০ DPI (HD Print)'
                  : '১৫০ DPI (Standard)'}
              </span>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* RIGHT: CONTROLS & CLEAN ACTION BUTTONS */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-5 bg-white p-4 sm:p-5 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="space-y-3.5">
              {/* SECTION A: PRINT COPIES & CARD SIZE */}
              <div className="space-y-2 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wide">
                  <span className="flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                    <span>প্রিন্ট কপি ও সাইজ</span>
                  </span>
                </div>

                {/* Copies Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSelectOneCopy}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      printSettings.copies === 1
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-bn font-bold text-xs">১ কপি (Portrait)</div>
                      <div className={`text-[10px] ${printSettings.copies === 1 ? 'text-blue-100' : 'text-slate-400'}`}>
                        A4 লম্বালম্বি
                      </div>
                    </div>
                    {printSettings.copies === 1 && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectTwoCopies}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      printSettings.copies === 2
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-bn font-bold text-xs">২ কপি (Landscape)</div>
                      <div className={`text-[10px] ${printSettings.copies === 2 ? 'text-blue-100' : 'text-slate-400'}`}>
                        A4 পাশাপাশি
                      </div>
                    </div>
                    {printSettings.copies === 2 && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Dimension Toggle Pills */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => onPrintSettingsChange({ cardWidthMm: 85.6, cardHeightMm: 54.0 })}
                    className={`py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer text-xs font-bn ${
                      printSettings.cardWidthMm <= 86
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>আসল সাইজ (৮৫.৬ মিমি)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintSettingsChange({ cardWidthMm: 90.6, cardHeightMm: 57.5 })}
                    className={`py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer text-xs font-bn ${
                      printSettings.cardWidthMm > 86
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>লেমিনেটিং বর্ডার (৯০.৬ মিমি)</span>
                  </button>
                </div>

                {/* Upscale Resolution Selection */}
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 font-bn flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>আপস্কেল রেজোলিউশন (Super Resolution):</span>
                    </span>
                    <span className="font-mono text-[11px] text-amber-600 font-bold">
                      {(currentAdjustments.upscale || 1.0) >= 3.5
                        ? '4x UHD'
                        : (currentAdjustments.upscale || 1.0) >= 1.5
                        ? '2x HD (300 DPI)'
                        : '1x Normal'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAdjustmentChange('upscale', 1.0, adjustTarget)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer text-xs font-bn ${
                        (currentAdjustments.upscale || 1.0) <= 1.0
                          ? 'bg-slate-800 text-white border-slate-900 shadow-2xs font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>১x সাধারণ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onAdjustmentChange('upscale', 2.0, adjustTarget)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer text-xs font-bn ${
                        (currentAdjustments.upscale || 1.0) >= 1.5 && (currentAdjustments.upscale || 1.0) < 3.5
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>২x HD (৩০০ DPI)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onAdjustmentChange('upscale', 4.0, adjustTarget)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer text-xs font-bn ${
                        (currentAdjustments.upscale || 1.0) >= 3.5
                          ? 'bg-purple-600 text-white border-purple-700 shadow-2xs font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>৪x Ultra HD</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION B: AUTOMATIC NID NUMBER BADGE (Clean & Non-Intrusive) */}
              <div className="bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 font-bn">ফাইল নাম:</span>
                  {!isEditingNid ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {displayNid}
                      </span>
                      {isReadingNid ? (
                        <span className="text-[10px] text-blue-600 font-bn flex items-center gap-1">
                          <Sparkles className="w-3 h-3 animate-spin text-blue-500" />
                          <span>ফটো থেকে নম্বর রিড হচ্ছে...</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bn">
                          ✓ ফটো থেকে রিডকৃত
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={nidNumber}
                      onChange={(e) => onNidNumberChange?.(e.target.value)}
                      placeholder="e.g. 1234567890"
                      className="font-mono text-xs px-2 py-0.5 border border-blue-400 rounded bg-white text-slate-900 w-36 outline-none ring-2 ring-blue-100"
                      autoFocus
                      onBlur={() => setIsEditingNid(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setIsEditingNid(false);
                      }}
                    />
                  )}
                </div>

                {onNidNumberChange && (
                  <button
                    type="button"
                    onClick={() => setIsEditingNid(!isEditingNid)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bn flex items-center gap-1 cursor-pointer shrink-0"
                    title="NID নম্বর পরিবর্তন করুন"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingNid ? 'সংরক্ষণ' : 'পরিবর্তন'}</span>
                  </button>
                )}
              </div>

              {/* SECTION C: FINE TUNING ADJUSTMENT (COLLAPSIBLE) */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowSliders(!showSliders)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    <span>ফাইন-টিউনিং এডজাস্টমেন্ট</span>
                    {showSliders ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onAutoColor && (
                      <button
                        type="button"
                        onClick={() => onAutoColor(adjustTarget)}
                        className="py-1 px-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-md text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        title="স্বয়ংক্রিয় কালার ও ব্যাকগ্রাউন্ড পরিষ্কার"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>অটো কালার</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetAdjustments}
                      className="p-1 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md transition-colors cursor-pointer"
                      title="এডজাস্টমেন্ট রিসেট"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {showSliders && (
                  <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-slate-200/80 text-xs">
                    {/* Target Selector: Both (Default) vs Front vs Back */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 pt-1">
                      <span className="text-[11px] font-semibold text-slate-600 font-bn">
                        প্রয়োগ হবে:
                      </span>
                      <div className="flex items-center gap-1 bg-slate-200/90 p-0.5 rounded-lg text-[11px] font-bn">
                        <button
                          type="button"
                          onClick={() => setAdjustTarget('both')}
                          className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                            adjustTarget === 'both'
                              ? 'bg-blue-600 text-white shadow-2xs font-bold'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          উভয় পাশ (Both)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustTarget('front')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            adjustTarget === 'front'
                              ? 'bg-blue-600 text-white shadow-2xs font-bold'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          সামনের দিক
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustTarget('back')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            adjustTarget === 'back'
                              ? 'bg-blue-600 text-white shadow-2xs font-bold'
                              : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          পেছনের দিক
                        </button>
                      </div>
                    </div>

                    {/* Folding Gap */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-medium text-[11px]">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Space className="w-3 h-3 text-blue-600" /> কার্ড ফোল্ডিং গ্যাপ (Gap)
                        </span>
                        <span className="font-mono text-blue-600 font-semibold">{printSettings.printGapMm} mm</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="15"
                        value={printSettings.printGapMm}
                        onChange={(e) => onPrintSettingsChange({ printGapMm: Number(e.target.value) })}
                        className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Levels */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-medium text-[11px]">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Zap className="w-3 h-3 text-amber-500" /> ব্যাকগ্রাউন্ড পরিষ্কার (Levels)
                        </span>
                        <span className="font-mono text-blue-600 font-semibold">{currentAdjustments.levels}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentAdjustments.levels}
                        onChange={(e) => onAdjustmentChange('levels', Number(e.target.value), adjustTarget)}
                        className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Text Deepen */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-medium text-[11px]">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Type className="w-3 h-3 text-purple-600" /> লেখা গাঢ়করণ (Text Deepen)
                        </span>
                        <span className="font-mono text-blue-600 font-semibold">{currentAdjustments.textDeepen}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentAdjustments.textDeepen}
                        onChange={(e) => onAdjustmentChange('textDeepen', Number(e.target.value), adjustTarget)}
                        className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-medium text-[11px]">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Palette className="w-3 h-3 text-emerald-600" /> সেচুরেশন (Saturation)
                        </span>
                        <span className="font-mono text-blue-600 font-semibold">{currentAdjustments.saturation}</span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={currentAdjustments.saturation}
                        onChange={(e) => onAdjustmentChange('saturation', Number(e.target.value), adjustTarget)}
                        className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===================================================================== */}
            {/* SECTION D: CLEAN ACTION BAR (DOWNLOAD & DIRECT PRINT) */}
            {/* ===================================================================== */}
            <div className="space-y-2 pt-3 border-t border-slate-200 mt-2">
              {/* Direct Print Button (Primary) */}
              <button
                type="button"
                onClick={onDirectPrint}
                className="w-full py-3.5 px-4 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md border border-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer font-bn"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {printSettings.copies === 1
                    ? 'প্রিন্ট করুন (A4 Portrait - ১ কপি)'
                    : 'প্রিন্ট করুন (A4 Landscape - ২ কপি)'}
                </span>
              </button>

              {/* Download Buttons Row: Automatic naming by NID number */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className="py-2 px-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title={`Download as ${displayNid}.pdf`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PDF ডাউনলোড</span>
                </button>

                <button
                  type="button"
                  onClick={onDownloadPng}
                  className="py-2 px-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                  title={`Download as ${displayNid}.png`}
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>PNG</span>
                </button>

                <button
                  type="button"
                  onClick={onDownloadJpeg}
                  className="py-2 px-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                  title={`Download as ${displayNid}.jpg`}
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>JPEG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
