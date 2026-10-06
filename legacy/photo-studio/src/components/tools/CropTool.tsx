import React from 'react';
import { Crop as CropIcon, Check, X, Maximize2 } from 'lucide-react';
import { AspectRatioOption, CropRect } from '../../types/editor';

interface CropToolProps {
  aspectRatio: AspectRatioOption;
  onSelectAspectRatio: (aspect: AspectRatioOption) => void;
  cropRect: CropRect | null;
  imageDimensions: { width: number; height: number };
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onResetCropArea: () => void;
}

export const CropTool: React.FC<CropToolProps> = ({
  aspectRatio,
  onSelectAspectRatio,
  cropRect,
  imageDimensions,
  onApplyCrop,
  onCancelCrop,
  onResetCropArea,
}) => {
  const presets: { id: AspectRatioOption; label: string; ratioDesc: string }[] = [
    { id: 'free', label: 'Free', ratioDesc: 'Any shape' },
    { id: '2x2', label: '2*2', ratioDesc: '2 × 2 in (Square)' },
    { id: '1.4x1.8', label: '1.4*1.8', ratioDesc: '1.4 × 1.8 in (Passport)' },
    { id: 'custom', label: 'Custom', ratioDesc: 'Custom dimensions' },
  ];

  const currentCropW = cropRect ? Math.round(cropRect.width) : imageDimensions.width;
  const currentCropH = cropRect ? Math.round(cropRect.height) : imageDimensions.height;

  return (
    <div id="tool-crop" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Crop Tool</h3>
        <p className="text-xs text-slate-400">
          Drag handles on the canvas to crop your photo
        </p>
      </div>

      {/* Aspect Ratio Presets */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Aspect Ratio</label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => {
            const isSelected = aspectRatio === preset.id;
            return (
              <button
                key={preset.id}
                id={`aspect-btn-${preset.id}`}
                onClick={() => onSelectAspectRatio(preset.id)}
                className={`flex flex-col text-left p-2 rounded-lg border text-xs transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <span>{preset.label}</span>
                <span className="text-[10px] text-slate-400 font-normal">{preset.ratioDesc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Crop Dimensions Readout */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-slate-300">Crop Size:</span>
        </div>
        <div className="font-mono text-xs font-semibold text-emerald-400">
          {currentCropW} × {currentCropH} px
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          id="btn-apply-crop"
          onClick={onApplyCrop}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 transition-all shadow-md shadow-emerald-500/20"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>Apply Crop</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onResetCropArea}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <span>Reset Box</span>
          </button>
          <button
            onClick={onCancelCrop}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
