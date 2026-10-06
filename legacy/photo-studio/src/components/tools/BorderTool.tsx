import React from 'react';
import { Square, Check, Pipette } from 'lucide-react';
import { BorderSettings } from '../../types/editor';

interface BorderToolProps {
  border: BorderSettings;
  onChange: (border: BorderSettings) => void;
}

export const BorderTool: React.FC<BorderToolProps> = ({ border, onChange }) => {
  const presets = [
    { label: 'None', width: 0, enabled: false },
    { label: 'Thin (4px)', width: 4, enabled: true },
    { label: 'Medium (12px)', width: 12, enabled: true },
    { label: 'Thick (24px)', width: 24, enabled: true },
  ];

  const colorPresets = ['#FFFFFF', '#000000', '#10B981', '#06B6D4', '#6366F1', '#F59E0B'];

  return (
    <div id="tool-border" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Frame & Border</h3>
        <p className="text-xs text-slate-400">Add a stylish outline and rounded corners</p>
      </div>

      {/* Enable / Disable Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <Square className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Enable Border</span>
        </div>
        <button
          id="toggle-border"
          onClick={() => onChange({ ...border, enabled: !border.enabled })}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            border.enabled ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
              border.enabled ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Width Presets */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Border Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p, idx) => {
            const isSelected =
              (!p.enabled && !border.enabled) ||
              (border.enabled && p.enabled && border.width === p.width);

            return (
              <button
                key={idx}
                onClick={() =>
                  onChange({
                    ...border,
                    enabled: p.enabled,
                    width: p.width || border.width || 4,
                  })
                }
                className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Width Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">Border Width</span>
          <span className="font-mono text-emerald-400 text-[11px]">{border.width}px</span>
        </div>
        <input
          id="slider-border-width"
          type="range"
          min={0}
          max={50}
          value={border.width}
          onChange={(e) =>
            onChange({
              ...border,
              enabled: true,
              width: parseInt(e.target.value, 10),
            })
          }
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
      </div>

      {/* Corner Radius Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">Corner Radius</span>
          <span className="font-mono text-emerald-400 text-[11px]">{border.radius}px</span>
        </div>
        <input
          id="slider-border-radius"
          type="range"
          min={0}
          max={60}
          value={border.radius}
          onChange={(e) =>
            onChange({
              ...border,
              radius: parseInt(e.target.value, 10),
            })
          }
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
      </div>

      {/* Border Color */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Border Color</label>
        <div className="flex items-center gap-2 mb-2">
          {colorPresets.map((hex) => (
            <button
              key={hex}
              onClick={() => onChange({ ...border, color: hex })}
              className={`w-7 h-7 rounded-full border border-slate-700 flex items-center justify-center transition-transform ${
                border.color.toLowerCase() === hex.toLowerCase() ? 'scale-110 ring-2 ring-emerald-400' : ''
              }`}
              style={{ backgroundColor: hex }}
            >
              {border.color.toLowerCase() === hex.toLowerCase() && (
                <Check
                  className={`w-3.5 h-3.5 ${
                    hex === '#FFFFFF' ? 'text-slate-900' : 'text-white'
                  }`}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Pipette className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">Custom Color:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400">{border.color}</span>
            <input
              type="color"
              value={border.color}
              onChange={(e) => onChange({ ...border, color: e.target.value })}
              className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
