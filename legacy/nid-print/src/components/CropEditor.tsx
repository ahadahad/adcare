import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CropData, Point } from '../types/image';
import { Check, RotateCcw, ZoomIn, ZoomOut, Maximize2, BoxSelect } from 'lucide-react';
import { getDefaultNidCrop } from '../utils/opencvCrop';

interface CropEditorProps {
  imageSrc: string;
  initialCrop?: CropData;
  onApplyCrop: (crop: CropData) => void;
  onCancel: () => void;
}

export const CropEditor: React.FC<CropEditorProps> = ({
  imageSrc,
  initialCrop,
  onApplyCrop,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [crop, setCrop] = useState<CropData>(
    initialCrop || {
      topLeft: { x: 0.05, y: 0.05 },
      topRight: { x: 0.95, y: 0.05 },
      bottomRight: { x: 0.95, y: 0.95 },
      bottomLeft: { x: 0.05, y: 0.95 },
    }
  );

  const [activeHandle, setActiveHandle] = useState<keyof CropData | null>(null);
  const [zoom, setZoom] = useState(1);

  const updateCorner = useCallback((key: keyof CropData, point: Point) => {
    setCrop((prev) => ({
      ...prev,
      [key]: {
        x: Math.max(0, Math.min(1, point.x)),
        y: Math.max(0, Math.min(1, point.y)),
      },
    }));
  }, []);

  const getRelativeCoords = (e: MouseEvent | TouchEvent): Point | null => {
    if (!containerRef.current || !imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!activeHandle) return;
      const coords = getRelativeCoords(e);
      if (coords) {
        updateCorner(activeHandle, coords);
      }
    };

    const handleUp = () => {
      setActiveHandle(null);
    };

    if (activeHandle) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [activeHandle, updateCorner]);

  const handleResetCrop = () => {
    setCrop({
      topLeft: { x: 0.02, y: 0.02 },
      topRight: { x: 0.98, y: 0.02 },
      bottomRight: { x: 0.98, y: 0.98 },
      bottomLeft: { x: 0.02, y: 0.98 },
    });
  };

  const handleSnapStandardNid = () => {
    if (imgRef.current) {
      const aspect = (imgRef.current.naturalWidth || 1) / (imgRef.current.naturalHeight || 1);
      setCrop(getDefaultNidCrop(aspect));
    }
  };

  const polygonPoints = `${crop.topLeft.x * 100}% ${crop.topLeft.y * 100}%, ${
    crop.topRight.x * 100
  }% ${crop.topRight.y * 100}%, ${crop.bottomRight.x * 100}% ${
    crop.bottomRight.y * 100
  }%, ${crop.bottomLeft.x * 100}% ${crop.bottomLeft.y * 100}%`;

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-lg">
      {/* Editor Header Bar */}
      <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">৪-কোণা ম্যানুয়াল ক্রপ এডিটর</h3>
            <p className="text-[11px] text-slate-500 font-bn">কোণাগুলো টেনে আইডি কার্ডের চারপাশে নিখুঁতভাবে বসান</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSnapStandardNid}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-all"
            title="Snap to standard NID ratio (85.6 : 54)"
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span className="font-bn">NID সাইজ ফ্রেম</span>
          </button>

          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1 hover:text-slate-900 text-slate-500 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] px-2 font-mono text-slate-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1 hover:text-slate-900 text-slate-500 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleResetCrop}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>রিসেট</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-200/50 relative select-none"
      >
        <div
          className="relative inline-block transition-transform duration-100 shadow-xl rounded-lg overflow-hidden bg-white"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop target"
            className="max-h-[62vh] max-w-full object-contain pointer-events-none block"
          />

          {/* SVG Overlay Mask for Dimmed Area outside crop */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="crop-mask-white">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <polygon points={polygonPoints} fill="black" />
              </mask>
            </defs>

            {/* Darkened overlay outside crop */}
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(15, 23, 42, 0.65)"
              mask="url(#crop-mask-white)"
            />

            {/* Document boundary line */}
            <polygon
              points={polygonPoints}
              fill="rgba(37, 99, 235, 0.15)"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
          </svg>

          {/* Draggable Corner Handles */}
          {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as Array<keyof CropData>).map(
            (handle) => {
              const pt = crop[handle];
              const isDragging = activeHandle === handle;

              const labelMap: Record<keyof CropData, string> = {
                topLeft: '১ (TL)',
                topRight: '২ (TR)',
                bottomRight: '৩ (BR)',
                bottomLeft: '৪ (BL)',
              };

              return (
                <div
                  key={handle}
                  onMouseDown={() => setActiveHandle(handle)}
                  onTouchStart={() => setActiveHandle(handle)}
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 group"
                >
                  {/* Glowing handle ring */}
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-md ${
                      isDragging
                        ? 'bg-amber-500 border-white scale-125 ring-4 ring-amber-500/40'
                        : 'bg-blue-600 border-white hover:bg-blue-500 hover:scale-110 ring-2 ring-blue-500/30'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>

                  {/* Corner Label */}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap opacity-90 group-hover:opacity-100 pointer-events-none">
                    {labelMap[handle]}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-500 font-bn">
          ডকুমেন্টের ৪টি কোণা ড্র্যাগ করে সঠিক স্থানে বসিয়ে 'ক্রপ প্রয়োগ করুন' বাটনে ক্লিক করুন।
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-all"
          >
            বাতিল (Cancel)
          </button>
          <button
            onClick={() => onApplyCrop(crop)}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>ক্রপ প্রয়োগ করুন (Apply Crop)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
