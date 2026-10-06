import React from 'react';
import { ActiveTab } from '../types/image';
import { ArrowLeftRight, Columns, Square, RotateCcw, Wand2 } from 'lucide-react';

interface MainAreaHeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onResetAll: () => void;
  onSwapSides: () => void;
  onAutoColorBoth?: () => void;
  hasFront: boolean;
  hasBack: boolean;
}

export const MainAreaHeader: React.FC<MainAreaHeaderProps> = ({
  activeTab,
  onSelectTab,
  onResetAll,
  onSwapSides,
  onAutoColorBoth,
  hasFront,
  hasBack,
}) => {
  return (
    <div className="bg-white px-4 sm:px-6 py-2.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {/* Front / Back / Both Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* [উভয় দিক একসাথে (Both Sides)] */}
        <button
          type="button"
          onClick={() => onSelectTab('both')}
          className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all font-bn cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'both'
              ? 'bg-[#2c3e50] text-white shadow-xs border-2 border-slate-900'
              : 'bg-[#e2e8f0] text-slate-700 hover:bg-[#cbd5e1] border border-slate-300/80 font-medium'
          }`}
          title="উভয় পাশ একসাথে দেখুন"
        >
          <Columns className="w-4 h-4" />
          <span>উভয় দিক একসাথে</span>
          {hasFront && hasBack && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        {/* [সামনের দিক (Front)] */}
        <button
          type="button"
          onClick={() => onSelectTab('front')}
          className={`px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all font-bn cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'front'
              ? 'bg-[#2c3e50] text-white shadow-xs border-2 border-slate-900'
              : 'bg-[#e2e8f0] text-slate-700 hover:bg-[#cbd5e1] border border-slate-300/80 font-medium'
          }`}
        >
          <Square className="w-3.5 h-3.5" />
          <span>সামনের দিক</span>
          {hasFront && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>

        {/* [পেছনের দিক (Back)] */}
        <button
          type="button"
          onClick={() => onSelectTab('back')}
          className={`px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all font-bn cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'back'
              ? 'bg-[#2c3e50] text-white shadow-xs border-2 border-slate-900'
              : 'bg-[#e2e8f0] text-slate-700 hover:bg-[#cbd5e1] border border-slate-300/80 font-medium'
          }`}
        >
          <Square className="w-3.5 h-3.5" />
          <span>পেছনের দিক</span>
          {hasBack && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>
      </div>

      {/* Top-Right: Swap Sides & Reset All (Clean, non-repetitive) */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium font-bn flex-wrap">
        {/* Auto Color Both button */}
        {hasFront && hasBack && onAutoColorBoth && (
          <button
            type="button"
            onClick={onAutoColorBoth}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors border border-purple-300 cursor-pointer font-bold shadow-2xs"
            title="উভয় পাশের কালার ও ব্যাকগ্রাউন্ড একসাথে অটো পরিষ্কার করুন"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-600" />
            <span>উভয় পাশে অটো কালার</span>
          </button>
        )}

        {/* Swap Sides button */}
        <button
          type="button"
          onClick={onSwapSides}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-300 cursor-pointer"
          title="সামনের ও পেছনের দিক অদলবদল করুন"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
          <span>পাশ অদলবদল (Swap)</span>
        </button>

        {/* Reset All button */}
        <button
          type="button"
          onClick={onResetAll}
          className="flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer"
          title="সবকিছু মুছে নতুন করে শুরু করুন"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>সব রিসেট</span>
        </button>
      </div>
    </div>
  );
};
