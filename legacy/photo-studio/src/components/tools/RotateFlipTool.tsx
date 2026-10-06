import React from 'react';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, RefreshCw } from 'lucide-react';
import { TransformSettings } from '../../types/editor';

interface RotateFlipToolProps {
  transform: TransformSettings;
  onRotate: (direction: 'cw' | 'ccw') => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onResetTransform: () => void;
}

export const RotateFlipTool: React.FC<RotateFlipToolProps> = ({
  transform,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
  onResetTransform,
}) => {
  const isTransformed =
    transform.rotation !== 0 || transform.flipH || transform.flipV;

  return (
    <div id="tool-rotate-flip" className="flex flex-col gap-4 text-slate-200">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-white">Rotate & Flip</h3>
          <p className="text-xs text-slate-400">Orient your image horizontally or vertically</p>
        </div>
        {isTransformed && (
          <button
            onClick={onResetTransform}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 px-2 py-1 rounded bg-slate-800/60 hover:bg-rose-500/10 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Rotation Status */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400">Current Angle:</span>
        <span className="font-mono text-emerald-400 font-semibold">{transform.rotation}°</span>
      </div>

      {/* Rotate Buttons */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Rotate 90°</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn-rotate-ccw"
            onClick={() => onRotate('ccw')}
            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-xs font-medium text-slate-200 active:scale-98 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>Rotate Left</span>
          </button>
          <button
            id="btn-rotate-cw"
            onClick={() => onRotate('cw')}
            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-xs font-medium text-slate-200 active:scale-98 transition-all"
          >
            <RotateCw className="w-4 h-4 text-emerald-400" />
            <span>Rotate Right</span>
          </button>
        </div>
      </div>

      {/* Flip Buttons */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Mirror / Flip</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn-flip-h"
            onClick={onFlipHorizontal}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
              transform.flipH
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <FlipHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Flip Horizontal</span>
          </button>
          <button
            id="btn-flip-v"
            onClick={onFlipVertical}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
              transform.flipV
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <FlipVertical className="w-4 h-4 text-cyan-400" />
            <span>Flip Vertical</span>
          </button>
        </div>
      </div>
    </div>
  );
};
