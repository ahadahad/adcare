import React from 'react';
import { RotateCcw, Sun, Contrast, Droplets, Gauge, Eye, Sparkles } from 'lucide-react';
import { ImageAdjustments } from '../../types/editor';

interface AdjustmentsToolProps {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
  onResetAll: () => void;
}

export const AdjustmentsTool: React.FC<AdjustmentsToolProps> = ({
  adjustments,
  onChange,
  onResetAll,
}) => {
  const updateField = (field: keyof ImageAdjustments, value: number) => {
    onChange({
      ...adjustments,
      [field]: value,
    });
  };

  const sliders = [
    {
      id: 'brightness' as const,
      label: 'Brightness',
      icon: Sun,
      min: -100,
      max: 100,
      step: 1,
      defaultVal: 0,
      unit: '',
    },
    {
      id: 'contrast' as const,
      label: 'Contrast',
      icon: Contrast,
      min: -100,
      max: 100,
      step: 1,
      defaultVal: 0,
      unit: '',
    },
    {
      id: 'saturation' as const,
      label: 'Saturation',
      icon: Droplets,
      min: -100,
      max: 100,
      step: 1,
      defaultVal: 0,
      unit: '',
    },
    {
      id: 'exposure' as const,
      label: 'Exposure',
      icon: Gauge,
      min: -100,
      max: 100,
      step: 1,
      defaultVal: 0,
      unit: '',
    },
    {
      id: 'blur' as const,
      label: 'Blur',
      icon: Eye,
      min: 0,
      max: 20,
      step: 0.5,
      defaultVal: 0,
      unit: 'px',
    },
    {
      id: 'sharpness' as const,
      label: 'Sharpness / Clarity',
      icon: Sparkles,
      min: 0,
      max: 100,
      step: 1,
      defaultVal: 0,
      unit: '',
    },
  ];

  return (
    <div id="tool-adjustments" className="flex flex-col gap-4 text-slate-200">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-white">Adjustments</h3>
          <p className="text-xs text-slate-400">Fine-tune exposure, tones, and clarity</p>
        </div>
        <button
          onClick={onResetAll}
          id="btn-reset-adjustments"
          className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 px-2 py-1 rounded bg-slate-800/60 hover:bg-rose-500/10 transition-colors"
          title="Reset all adjustment sliders"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset All</span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {sliders.map((s) => {
          const Icon = s.icon;
          const currentVal = adjustments[s.id];
          const isModified = currentVal !== s.defaultVal;

          return (
            <div key={s.id} className="flex flex-col gap-1.5 group">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  <span className="font-medium">{s.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                      isModified
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {currentVal > 0 ? `+${currentVal}` : currentVal}
                    {s.unit}
                  </span>
                  {isModified && (
                    <button
                      onClick={() => updateField(s.id, s.defaultVal)}
                      className="text-slate-400 hover:text-slate-200 p-0.5"
                      title="Reset slider"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={currentVal}
                  onChange={(e) => updateField(s.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                  id={`slider-${s.id}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
