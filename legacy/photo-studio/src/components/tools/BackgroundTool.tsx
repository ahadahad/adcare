import React, { useState } from 'react';
import {
  Check,
  Pipette,
  Scissors,
  Sparkles,
  Zap,
  ArrowLeftRight,
  Info,
} from 'lucide-react';
import { BackgroundSettings, AIStatusInfo } from '../../types/editor';
import {
  BACKGROUND_COLOR_OPTIONS,
  BACKGROUND_COLOR_CATEGORIES,
} from '../../data/backgroundColors';
import { ColorPickerPopover } from '../common/ColorPickerPopover';

interface BackgroundToolProps {
  background: BackgroundSettings;
  onChange: (bg: BackgroundSettings) => void;
  onRemoveBackground?: (provider?: 'removebg' | 'studio') => void;
  onInvertCutout?: () => void;
  isRemovingBg?: boolean;
  aiStatus?: AIStatusInfo | null;
}

export const BackgroundTool: React.FC<BackgroundToolProps> = ({
  background,
  onChange,
  onRemoveBackground,
  onInvertCutout,
  isRemovingBg = false,
  aiStatus,
}) => {
  const [cutoutProvider, setCutoutProvider] = useState<'removebg' | 'studio'>('removebg');

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showCustomColorBox, setShowCustomColorBox] = useState(false);

  const isRemoveBgConfigured = Boolean(aiStatus?.removeBg?.isConfigured);

  const filteredPresets =
    activeCategory === 'all'
      ? BACKGROUND_COLOR_OPTIONS
      : BACKGROUND_COLOR_OPTIONS.filter((opt) => opt.category === activeCategory);

  const handleTriggerCutout = () => {
    if (onRemoveBackground) {
      onRemoveBackground(cutoutProvider);
    }
  };

  return (
    <div id="tool-background" className="flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Background & Subject Cutout</h3>
        <p className="text-xs text-slate-400">
          Isolate subjects with remove.bg and set custom canvas backdrops
        </p>
      </div>

      {/* AI Subject Cutout Section */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white">AI Subject Isolation</span>
          </div>
        </div>

        {/* Engine Provider Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setCutoutProvider('removebg')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all ${
              cutoutProvider === 'removebg'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>remove.bg API</span>
          </button>

          <button
            type="button"
            onClick={() => setCutoutProvider('studio')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all ${
              cutoutProvider === 'studio'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Studio Fast Vision</span>
          </button>
        </div>

        {/* Info label about provider */}
        <div className="text-[11px] text-slate-400 leading-relaxed">
          {cutoutProvider === 'removebg' ? (
            <div className="flex flex-col gap-1.5">
              <p>
                Calls the official{' '}
                <strong className="text-cyan-300">remove.bg API</strong> for hair-level alpha
                segmentation and edge transparency.
              </p>
              {aiStatus?.removeBg?.hasUsableCredits === false && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-amber-200">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    <span>0 remove.bg credits remaining</span>
                  </div>
                  <p className="text-amber-200/80 leading-normal text-[10.5px]">
                    Your remove.bg account free quota is exhausted. Studio Fast Vision will isolate your subject with zero credits required.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p>
              Uses high-precision studio edge detection with local alpha matting for instant cutouts without needing external API credits.
            </p>
          )}
        </div>

        {/* Action Button */}
        {onRemoveBackground && (
          <button
            id="btn-trigger-remove-bg-tool"
            onClick={handleTriggerCutout}
            disabled={isRemovingBg}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-cyan-950/40 transition-all active:scale-98 disabled:opacity-50"
          >
            <Scissors className={`w-4 h-4 ${isRemovingBg ? 'animate-spin' : ''}`} />
            <span>
              {isRemovingBg
                ? 'Removing Background...'
                : cutoutProvider === 'removebg'
                ? 'Remove Background (remove.bg)'
                : 'Remove Background (Studio)'}
            </span>
          </button>
        )}

        {/* Invert Cutout Button (Keep Subject vs Keep Background) */}
        {onInvertCutout && (
          <button
            id="btn-invert-cutout-mask"
            onClick={onInvertCutout}
            disabled={isRemovingBg}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-cyan-300 text-xs font-semibold tracking-wide transition-all active:scale-98 disabled:opacity-50"
            title="Swap transparency: Invert mask between isolated subject and background"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Invert Cutout Mask (Subject ↔ Background)</span>
          </button>
        )}
      </div>

      {/* Transparent Option */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Alpha / Transparency</label>
        <button
          id="btn-bg-transparent"
          onClick={() => onChange({ isTransparent: true, color: '#FFFFFF' })}
          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
            background.isTransparent
              ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-semibold'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg border border-slate-700 overflow-hidden shadow-inner"
              style={{
                backgroundImage: `linear-gradient(45deg, #334155 25%, transparent 25%), 
                                  linear-gradient(-45deg, #334155 25%, transparent 25%), 
                                  linear-gradient(45deg, transparent 75%, #334155 75%), 
                                  linear-gradient(-45deg, transparent 75%, #334155 75%)`,
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                backgroundColor: '#1E293B',
              }}
            />
            <div className="text-left">
              <div>Transparent Canvas</div>
              <div className="text-[10px] text-slate-400 font-normal">
                Checkerboard pattern (ideal for PNG/WebP)
              </div>
            </div>
          </div>
          {background.isTransparent && <Check className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Backdrop Color Presets & Categories */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">Backdrop Colors & Presets</label>
          <span className="text-[10px] text-cyan-400 font-mono">
            {filteredPresets.length} Options
          </span>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
          {BACKGROUND_COLOR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`py-1 px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all border ${
                activeCategory === cat.id
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Color Presets Grid */}
        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 overscroll-contain">
          {filteredPresets.map((preset) => {
            const isSelected =
              !background.isTransparent &&
              background.color.toLowerCase() === preset.value.toLowerCase();

            return (
              <button
                key={preset.id}
                id={`bg-preset-${preset.id}`}
                onClick={() => onChange({ isTransparent: false, color: preset.value })}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-slate-850 border-cyan-400 ring-1 ring-cyan-400/50 shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                }`}
                title={preset.description || preset.label}
              >
                <div
                  className="w-7 h-7 rounded-full border border-black/20 shadow-sm flex items-center justify-center relative shrink-0"
                  style={
                    preset.isGradient
                      ? { background: preset.value }
                      : { backgroundColor: preset.value }
                  }
                >
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 ${preset.darkText ? 'text-slate-900' : 'text-white'}`}
                    />
                  )}
                </div>
                <div className="flex flex-col items-center w-full min-w-0">
                  <span className="text-[11px] font-medium text-slate-200 truncate w-full">
                    {preset.label}
                  </span>
                  {preset.category === 'passport' && (
                    <span className="text-[9px] text-cyan-400/90 font-mono truncate w-full">
                      ID Standard
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Picker with Hex Input & In-Panel Color Box */}
      <div className="flex flex-col gap-2">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <button
            type="button"
            id="btn-toggle-custom-color-box"
            onClick={() => setShowCustomColorBox((prev) => !prev)}
            className="flex items-center gap-2 text-left hover:opacity-90 transition-opacity"
          >
            <div
              className="w-5 h-5 rounded-md border border-white/20 shadow-sm flex items-center justify-center shrink-0"
              style={{
                backgroundColor:
                  background.isTransparent || background.color.includes('gradient')
                    ? '#FFFFFF'
                    : background.color,
              }}
            >
              <Pipette className="w-3 h-3 text-cyan-400" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Custom Color Box</span>
              <span className="text-[10px] text-cyan-400/90 font-mono">
                {showCustomColorBox ? 'Click to close' : 'Click to open picker'}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <input
              id="color-picker-bg-hex"
              type="text"
              value={background.isTransparent ? 'Transparent' : background.color}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('#') || val.startsWith('rgb')) {
                  onChange({ isTransparent: false, color: val });
                }
              }}
              placeholder="#FFFFFF"
              className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 text-center uppercase"
            />
            <button
              type="button"
              id="btn-bg-custom-palette-toggle"
              onClick={() => setShowCustomColorBox((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                showCustomColorBox
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/50'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
              title="Toggle Custom Color Box"
            >
              <Pipette className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Custom Color Box Popover (Opens right on color side) */}
        <ColorPickerPopover
          color={
            background.isTransparent || background.color.includes('gradient')
              ? '#FFFFFF'
              : background.color
          }
          onChange={(newColor) =>
            onChange({
              isTransparent: false,
              color: newColor,
            })
          }
          isOpen={showCustomColorBox}
          onClose={() => setShowCustomColorBox(false)}
          anchorSide="inline"
        />
      </div>
    </div>
  );
};
