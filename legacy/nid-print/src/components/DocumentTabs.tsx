import React from 'react';
import { ActiveTab } from '../types/image';
import { Layers, Image as ImageIcon, Sparkles, BoxSelect } from 'lucide-react';

interface DocumentTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasFront: boolean;
  hasBack: boolean;
  onAutoCropSide?: (side: 'front' | 'back') => void;
  onSnapNidCrop?: (side: 'front' | 'back') => void;
  isAutoCropping?: boolean;
}

export const DocumentTabs: React.FC<DocumentTabsProps> = ({
  activeTab,
  onTabChange,
  hasFront,
  hasBack,
  onAutoCropSide,
  onSnapNidCrop,
  isAutoCropping,
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
      {/* Tab Selectors */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
        <button
          onClick={() => onTabChange('front')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'front'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>ফ্রন্ট পৃষ্ঠা (Front)</span>
          {hasFront && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>

        <button
          onClick={() => onTabChange('back')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'back'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
          <span>পিছনের পৃষ্ঠা (Back)</span>
          {hasBack && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>

        <button
          onClick={() => onTabChange('combined')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'combined'
              ? 'bg-white text-blue-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-purple-600" />
          <span>সম্মুখ ও পিছন একত্রে (Combined)</span>
          {hasFront && hasBack && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>
      </div>

      {/* Auto Crop & NID Snap Action Triggers */}
      {(activeTab === 'front' || activeTab === 'back') && (
        <div className="flex items-center gap-1.5">
          {onSnapNidCrop && (
            <button
              onClick={() => onSnapNidCrop(activeTab)}
              disabled={(activeTab === 'front' ? !hasFront : !hasBack)}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Snap to standard Bangladesh NID aspect ratio"
            >
              <BoxSelect className="w-3.5 h-3.5 text-slate-600" />
              <span>NID সাইজ ফ্রেম</span>
            </button>
          )}

          {onAutoCropSide && (
            <button
              onClick={() => onAutoCropSide(activeTab)}
              disabled={isAutoCropping || (activeTab === 'front' ? !hasFront : !hasBack)}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              title="Automatically detect card boundary"
            >
              <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isAutoCropping ? 'animate-spin' : ''}`} />
              <span>স্বয়ংক্রিয় অটো-ক্রপ (Auto Crop)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
