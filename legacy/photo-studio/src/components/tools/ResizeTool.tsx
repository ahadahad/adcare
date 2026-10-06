import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Check, RefreshCw } from 'lucide-react';

interface ResizeToolProps {
  currentWidth: number;
  currentHeight: number;
  onApplyResize: (newWidth: number, newHeight: number) => void;
}

export const ResizeTool: React.FC<ResizeToolProps> = ({
  currentWidth,
  currentHeight,
  onApplyResize,
}) => {
  const [width, setWidth] = useState<number>(currentWidth);
  const [height, setHeight] = useState<number>(currentHeight);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWidth(currentWidth);
    setHeight(currentHeight);
  }, [currentWidth, currentHeight]);

  const handleWidthChange = (valStr: string) => {
    const val = parseInt(valStr, 10);
    if (isNaN(val)) {
      setWidth(0);
      return;
    }
    setWidth(val);
    if (lockAspect && currentWidth > 0) {
      const computedH = Math.round((val / currentWidth) * currentHeight);
      setHeight(computedH);
    }
  };

  const handleHeightChange = (valStr: string) => {
    const val = parseInt(valStr, 10);
    if (isNaN(val)) {
      setHeight(0);
      return;
    }
    setHeight(val);
    if (lockAspect && currentHeight > 0) {
      const computedW = Math.round((val / currentHeight) * currentWidth);
      setWidth(computedW);
    }
  };

  const handlePreset = (presetW: number, presetH: number) => {
    setWidth(presetW);
    setHeight(presetH);
  };

  const validateAndApply = () => {
    if (width < 1 || height < 1) {
      setError('Width and height must be at least 1 pixel.');
      return;
    }
    if (width > 8000 || height > 8000) {
      setError('Maximum supported dimension is 8000 pixels.');
      return;
    }
    setError(null);
    onApplyResize(width, height);
  };

  const presets = [
    { label: 'Profile Avatar', w: 400, h: 400 },
    { label: 'Instagram Square', w: 1080, h: 1080 },
    { label: 'Social Landscape', w: 1200, h: 630 },
    { label: 'Story / Reel', w: 1080, h: 1920 },
    { label: 'Passport (US 2×2)', w: 600, h: 600 },
    { label: 'EU ID (35×45mm)', w: 827, h: 1063 },
  ];

  return (
    <div id="tool-resize" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Resize Canvas</h3>
        <p className="text-xs text-slate-400">Scale dimensions with high quality interpolation</p>
      </div>

      {/* Current vs New Dimension Badge */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-400 block text-[11px]">Current Size:</span>
          <span className="font-mono text-slate-200 font-medium">
            {currentWidth} × {currentHeight} px
          </span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 block text-[11px]">New Target:</span>
          <span className="font-mono text-emerald-400 font-semibold">
            {width} × {height} px
          </span>
        </div>
      </div>

      {/* Dimension Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-slate-400 font-medium">Width (px)</label>
          <input
            id="input-resize-width"
            type="number"
            min={1}
            max={8000}
            value={width || ''}
            onChange={(e) => handleWidthChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <button
          onClick={() => setLockAspect(!lockAspect)}
          id="btn-lock-aspect"
          className={`mt-5 p-2.5 rounded-lg border transition-all ${
            lockAspect
              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
        >
          {lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-slate-400 font-medium">Height (px)</label>
          <input
            id="input-resize-height"
            type="number"
            min={1}
            max={8000}
            value={height || ''}
            onChange={(e) => handleHeightChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Quick Presets */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Preset Dimensions</label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handlePreset(preset.w, preset.h)}
              className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-left transition-all"
            >
              <div className="text-xs font-medium text-slate-200">{preset.label}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {preset.w} × {preset.h}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Apply Button */}
      <button
        id="btn-apply-resize"
        onClick={validateAndApply}
        disabled={width === currentWidth && height === currentHeight}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 disabled:opacity-40 disabled:hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 mt-2"
      >
        <Check className="w-4 h-4 stroke-[2.5]" />
        <span>Apply Resize</span>
      </button>
    </div>
  );
};
