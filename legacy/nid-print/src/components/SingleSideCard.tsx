import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SideId, CropData, Point, ImageSideState } from '../types/image';
import {
  Sparkles,
  Crop,
  Upload,
  Scissors,
  Wand2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  FileImage,
  Trash2,
  Zap,
} from 'lucide-react';

interface SingleSideCardProps {
  side: SideId;
  title: string;
  sideState: ImageSideState;
  displayCanvas: HTMLCanvasElement | null;
  onAutoSelect: () => void;
  onManualCrop: () => void;
  onCropFinal: () => void;
  onAutoColor: () => void;
  onToggleUpscale?: () => void;
  onRotate: () => void;
  onDeleteImage?: () => void;
  onUpdateCorner: (cornerKey: keyof CropData, point: Point) => void;
  onUploadClick: () => void;
  onDropFile: (file: File) => void;
  isProcessing: boolean;
  compactMode?: boolean;
}

export const SingleSideCard: React.FC<SingleSideCardProps> = ({
  side,
  title,
  sideState,
  displayCanvas,
  onAutoSelect,
  onManualCrop,
  onCropFinal,
  onAutoColor,
  onToggleUpscale,
  onRotate,
  onDeleteImage,
  onUpdateCorner,
  onUploadClick,
  onDropFile,
  isProcessing,
  compactMode = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [activeHandle, setActiveHandle] = useState<keyof CropData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const croppedDisplayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const corners = sideState.cropCorners;
  const isCropped = sideState.isCropped;
  const hasImage = Boolean(sideState.sourceFile && sideState.workingCanvas);

  // Render working preview canvas onto display DOM canvas when not cropped
  useEffect(() => {
    if (!isCropped && sideState.workingCanvas && displayCanvasRef.current) {
      const working = sideState.workingCanvas;
      const canvas = displayCanvasRef.current;
      canvas.width = working.width;
      canvas.height = working.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(working, 0, 0);
      }
    }
  }, [isCropped, sideState.workingCanvas, side]);

  // Render cropped canvas onto display DOM canvas when cropped
  useEffect(() => {
    if (isCropped && displayCanvas && croppedDisplayCanvasRef.current) {
      const canvas = croppedDisplayCanvasRef.current;
      canvas.width = displayCanvas.width;
      canvas.height = displayCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(displayCanvas, 0, 0);
      }
    }
  }, [isCropped, displayCanvas, side]);

  // Fast coordinate conversion from DOM display to normalized 0..1 coordinates
  const getNormalizedCoords = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    const el = displayCanvasRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1, u)),
      y: Math.max(0, Math.min(1, v)),
    };
  }, []);

  // Drag listener
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!activeHandle) return;
      const pt = getNormalizedCoords(e);
      if (pt) {
        onUpdateCorner(activeHandle, pt);
      }
    };

    const handleUp = () => {
      setActiveHandle(null);
    };

    if (activeHandle) {
      window.addEventListener('mousemove', handleMove, { passive: true });
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: true });
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [activeHandle, getNormalizedCoords, onUpdateCorner]);

  // Handle local drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFile(e.dataTransfer.files[0]);
    }
  };

  // SVG polygon points for quadrilateral
  const polygonPoints = `${corners.topLeft.x * 100}% ${corners.topLeft.y * 100}%, ${
    corners.topRight.x * 100
  }% ${corners.topRight.y * 100}%, ${corners.bottomRight.x * 100}% ${
    corners.bottomRight.y * 100
  }%, ${corners.bottomLeft.x * 100}% ${corners.bottomLeft.y * 100}%`;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden relative select-none font-sans"
    >
      {/* 1. CARD HEADER & TOOLBAR */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
        {/* Title & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bn font-bold text-xs sm:text-sm text-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                hasImage ? (isCropped ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-300'
              }`}
            />
            <span>{title}</span>
          </div>

          {hasImage && (
            <span
              className={`text-[10px] font-bn px-2 py-0.5 rounded-full font-semibold border ${
                isCropped
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {isCropped ? '✓ ক্রপ সম্পন্ন' : '৪-কোণা অ্যাডজাস্ট'}
            </span>
          )}

          {hasImage && displayCanvas && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                sideState.adjustments.upscale > 1.0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {displayCanvas.width}×{displayCanvas.height}px
              {sideState.adjustments.upscale >= 3.5
                ? ' (4x UHD)'
                : sideState.adjustments.upscale > 1.0
                ? ' (2x HD)'
                : ''}
            </span>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* [অটো-সিলেক্ট] */}
          <button
            type="button"
            onClick={onAutoSelect}
            disabled={!hasImage || isProcessing}
            className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Automatically detect corners"
          >
            <Sparkles className={`w-3 h-3 text-blue-600 ${isProcessing ? 'animate-spin' : ''}`} />
            <span className="font-bn text-[11px]">অটো-সিলেক্ট</span>
          </button>

          {/* [ম্যানুয়াল ক্রপ] */}
          <button
            type="button"
            onClick={onManualCrop}
            disabled={!hasImage}
            className={`py-1 px-2.5 border font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer ${
              !isCropped
                ? 'bg-slate-800 text-white border-slate-900'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Adjust 4 corners manually"
          >
            <Crop className="w-3 h-3" />
            <span className="font-bn text-[11px]">ম্যানুয়াল ক্রপ</span>
          </button>

          {/* [ক্রপ ফাইনাল] */}
          {!isCropped && (
            <button
              type="button"
              onClick={onCropFinal}
              disabled={!hasImage || isProcessing}
              className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Apply perspective crop"
            >
              <Scissors className="w-3 h-3" />
              <span className="font-bn text-[11px]">ক্রপ ফাইনাল</span>
            </button>
          )}

          {/* [অটো কালার] */}
          <button
            type="button"
            onClick={onAutoColor}
            disabled={!hasImage || isProcessing}
            className={`py-1 px-2.5 border font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer ${
              sideState.adjustments.levels > 0 || sideState.adjustments.contrast > 0
                ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 ring-1 ring-purple-400/30 font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Auto color balance, background whitening, and text deepening"
          >
            <Wand2 className="w-3 h-3 text-purple-600" />
            <span className="font-bn text-[11px]">অটো কালার</span>
          </button>

          {/* [আপস্কেল / Upscale] */}
          {hasImage && onToggleUpscale && (
            <button
              type="button"
              onClick={onToggleUpscale}
              disabled={isProcessing}
              className={`py-1 px-2.5 border font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer ${
                sideState.adjustments.upscale > 1.0
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300 ring-1 ring-amber-400/30 font-bold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="2x HD রেজোলিউশন ও টেক্সট শার্পনিং আপস্কেল"
            >
              <Zap
                className={`w-3 h-3 ${
                  sideState.adjustments.upscale > 1.0
                    ? 'text-amber-600 fill-amber-500'
                    : 'text-slate-500'
                }`}
              />
              <span className="font-bn text-[11px]">
                {sideState.adjustments.upscale > 1.0 ? 'আপস্কেল ২x' : 'আপস্কেল'}
              </span>
            </button>
          )}

          {/* [রোটেট] */}
          <button
            type="button"
            onClick={onRotate}
            disabled={!hasImage || isProcessing}
            className="p-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* [ছবি মুছুন / Delete Image] */}
          {hasImage && onDeleteImage && (
            <button
              type="button"
              onClick={onDeleteImage}
              className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="এই ছবিটি মুছে ফেলুন (Delete Image)"
            >
              <Trash2 className="w-3 h-3 text-red-500" />
              <span className="font-bn text-[11px]">ছবি মুছুন</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. INTERACTIVE STAGE WORKSPACE */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-3 relative bg-[#f1f5f9]/50"
      >
        {hasImage ? (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full relative"
          >
            {!isCropped ? (
              /* STAGE A: 4-CORNER PERSPECTIVE ADJUSTMENT STAGE */
              <div className="relative inline-block overflow-visible touch-none shadow-md rounded-lg">
                <canvas
                  ref={displayCanvasRef}
                  className="max-h-[52vh] max-w-full object-contain block rounded-lg select-none pointer-events-none"
                />

                {/* SVG Quadrilateral Polygon */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={`${corners.topLeft.x * 100},${corners.topLeft.y * 100} ${
                      corners.topRight.x * 100
                    },${corners.topRight.y * 100} ${corners.bottomRight.x * 100},${
                      corners.bottomRight.y * 100
                    } ${corners.bottomLeft.x * 100},${corners.bottomLeft.y * 100}`}
                    fill="rgba(59, 130, 246, 0.18)"
                    stroke="#2563eb"
                    strokeWidth="0.8"
                    strokeDasharray="2 1"
                  />
                </svg>

                {/* Corner Drag Handles */}
                {(
                  [
                    { key: 'topLeft', pt: corners.topLeft, num: 1, label: 'Top Left' },
                    { key: 'topRight', pt: corners.topRight, num: 2, label: 'Top Right' },
                    { key: 'bottomRight', pt: corners.bottomRight, num: 3, label: 'Bottom Right' },
                    { key: 'bottomLeft', pt: corners.bottomLeft, num: 4, label: 'Bottom Left' },
                  ] as const
                ).map(({ key, pt, num, label }) => {
                  const isDragging = activeHandle === key;
                  return (
                    <div
                      key={key}
                      style={{
                        left: `${pt.x * 100}%`,
                        top: `${pt.y * 100}%`,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveHandle(key);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setActiveHandle(key);
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-30 group touch-none"
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform shadow-md ${
                          isDragging
                            ? 'bg-amber-500 border-white scale-125 ring-4 ring-amber-500/40'
                            : 'bg-blue-600 border-white hover:bg-blue-500 hover:scale-110 ring-2 ring-blue-500/30'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    </div>
                  );
                })}

                {/* Clean Buffering Overlay on Image */}
                {(sideState.isProcessing || isProcessing) && (
                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 flex items-center justify-center rounded-lg animate-in fade-in duration-150">
                    <div className="p-3.5 bg-white/95 rounded-2xl shadow-xl flex items-center justify-center border border-slate-100">
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* STAGE B: FINAL PERSPECTIVE-CROPPED NID CARD */
              <div className="relative inline-block overflow-hidden rounded-lg shadow-md border border-slate-200">
                <canvas
                  ref={croppedDisplayCanvasRef}
                  className="max-h-[52vh] max-w-full object-contain block rounded-lg"
                />

                {/* Clean Buffering Overlay on Image */}
                {(sideState.isProcessing || isProcessing) && (
                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 flex items-center justify-center rounded-lg animate-in fade-in duration-150">
                    <div className="p-3.5 bg-white/95 rounded-2xl shadow-xl flex items-center justify-center border border-slate-100">
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* EMPTY STATE DROPZONE OR INITIAL BUFFERING */
          sideState.isProcessing || isProcessing ? (
            <div className="w-full h-full min-h-[220px] max-h-[380px] p-6 text-center bg-white border-2 border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center gap-3">
              <div className="p-3.5 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm">
                <div className="w-8 h-8 rounded-full border-3 border-blue-200 border-t-blue-600 animate-spin" />
              </div>
            </div>
          ) : (
            <div
              onClick={onUploadClick}
              className="w-full h-full min-h-[220px] max-h-[380px] p-6 text-center bg-white border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-bn">
                  {title} যুক্ত করুন
                </h4>
                <p className="text-xs text-slate-500 font-bn mt-0.5">
                  ছবি ড্রপ করুন, ক্লিক করুন অথবা Ctrl + V চাপুন
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
