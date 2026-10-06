import React from 'react';
import { RefreshCw, ArrowLeftRight, FileCheck, HelpCircle, Sparkles } from 'lucide-react';

interface HeaderProps {
  onResetAll: () => void;
  onSwapSides: () => void;
  onOpenPreview: () => void;
  hasImages: boolean;
  onShowHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onResetAll,
  onSwapSides,
  onOpenPreview,
  hasImages,
  onShowHelp,
}) => {
  return (
    <header className="bg-white border-b border-slate-200/90 text-slate-800 px-4 lg:px-6 py-2.5 flex items-center justify-between shrink-0 select-none shadow-xs">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold text-base">
          🪪
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-slate-900">
              DocScan Print
            </h1>
            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
              NID & ID Card Pro
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-bn">
            এনআইডি ও স্মার্টকার্ড প্রিন্ট লেআউট টুল
          </p>
        </div>
      </div>

      {/* Zone 2: Navigation & Quick Tools */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          onClick={onSwapSides}
          disabled={!hasImages}
          title="Swap Front & Back Sides"
          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
          <span>অদলবদল (Swap)</span>
        </button>

        <button
          onClick={onResetAll}
          disabled={!hasImages}
          title="Reset All Adjustments & Images"
          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
          <span>রিসেট অল (Reset)</span>
        </button>

        <button
          onClick={onShowHelp}
          className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all flex items-center gap-1"
          title="সহায়িকা"
        >
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span className="hidden md:inline font-bn">সহায়িকা</span>
        </button>
      </div>

      {/* Zone 3: Primary Print Action */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPreview}
          disabled={!hasImages}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm border border-blue-700 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileCheck className="w-4 h-4" />
          <span className="font-bn text-sm">প্রিন্ট ও প্রিভিউ (Print Layout)</span>
        </button>
      </div>
    </header>
  );
};
