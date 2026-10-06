import React, { useState } from 'react';
import { Download, X, AlertTriangle, CheckCircle2, FileImage } from 'lucide-react';
import { ImageItem } from '../../types/editor';
import { renderCompositeCanvas, downloadCanvasBlob, loadImage } from '../../utils/canvas';

interface ExportModalProps {
  activeImage: ImageItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (filename: string) => void;
  onError: (err: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  activeImage,
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [quality, setQuality] = useState<number>(92);
  const [filename, setFilename] = useState<string>(
    activeImage.name.replace(/\.[^/.]+$/, '') || 'shebaFlow-photo'
  );
  const [dimensionMode, setDimensionMode] = useState<'current' | 'custom'>('current');
  const [customWidth, setCustomWidth] = useState<number>(activeImage.width);
  const [customHeight, setCustomHeight] = useState<number>(activeImage.height);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const isRotated = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
  const currentW = isRotated ? activeImage.height : activeImage.width;
  const currentH = isRotated ? activeImage.width : activeImage.height;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const img = await loadImage(activeImage.currentUrl);

      const dimensions =
        dimensionMode === 'custom' && customWidth > 0 && customHeight > 0
          ? { width: customWidth, height: customHeight }
          : undefined;

      const renderedCanvas = renderCompositeCanvas(img, activeImage, dimensions);
      await downloadCanvasBlob(renderedCanvas, format, quality, filename);
      onSuccess(`${filename}.${format === 'jpeg' ? 'jpg' : format}`);
      onClose();
    } catch (err: any) {
      onError(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const hasTransparency = activeImage.background.isTransparent;
  const showJpgTransparencyWarning = format === 'jpeg' && hasTransparency;

  return (
    <div
      id="export-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="export-modal-dialog"
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 flex flex-col gap-5 text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Photograph</h3>
              <p className="text-xs text-slate-400">Save finalized render to your device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filename Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">File Name</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
            />
            <span className="text-xs font-mono text-slate-400">
              .{format === 'jpeg' ? 'jpg' : format}
            </span>
          </div>
        </div>

        {/* Format Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Export Format</label>
          <div className="grid grid-cols-3 gap-2">
            {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`py-2 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-all ${
                  format === fmt
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                {fmt === 'jpeg' ? 'JPG' : fmt}
              </button>
            ))}
          </div>
        </div>

        {/* JPEG Transparency Warning (Section 28 requirement) */}
        {showJpgTransparencyWarning && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              JPG does not support transparency. Transparent areas will be rendered on a clean white
              background. For transparent cutout photos, select <strong>PNG</strong> or{' '}
              <strong>WebP</strong>.
            </p>
          </div>
        )}

        {/* Quality Slider (for JPG & WebP) */}
        {format !== 'png' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Quality Compression</span>
              <span className="font-mono text-emerald-400 font-semibold">{quality}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        )}

        {/* Resolution Options */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-300">Dimensions</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDimensionMode('current')}
              className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                dimensionMode === 'current'
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div>Current Size</div>
              <div className="text-[10px] font-mono text-slate-400">
                {currentW} × {currentH} px
              </div>
            </button>
            <button
              onClick={() => setDimensionMode('custom')}
              className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                dimensionMode === 'custom'
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div>Custom Resolution</div>
              <div className="text-[10px] text-slate-400">Specify W × H</div>
            </button>
          </div>

          {dimensionMode === 'custom' && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value, 10) || 100)}
                placeholder="Width"
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
              <span className="text-slate-400">×</span>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value, 10) || 100)}
                placeholder="Height"
                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          )}
        </div>

        {/* Action CTA */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-export"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{isExporting ? 'Exporting...' : 'Download Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
