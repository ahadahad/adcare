import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QuadCrop, Point2D } from '../types';
import {
  detectDocument,
  applyRealPerspectiveWarp,
  orderPoints,
  adjustCropMargin,
  calculateQuadArea,
} from '../utils/documentDetector';
import { cropLearningEngine } from '../services/cropLearning/CropLearningEngine';
import {
  Crop,
  Check,
  X,
  RotateCw,
  Sparkles,
  Maximize2,
  RefreshCw,
  Eye,
  Sliders,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  initialCrop?: QuadCrop;
  targetAspectRatio?: number;
  onApply: (warpedCanvas: HTMLCanvasElement, crop: QuadCrop) => void;
  onCancel: () => void;
  title?: string;
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
type EdgeKey = 'top' | 'right' | 'bottom' | 'left';

export const CropModal: React.FC<CropModalProps> = ({
  imageSrc,
  initialCrop,
  onApply,
  onCancel,
  title = 'Crop & Deskew Document',
}) => {
  const [activeImageSrc, setActiveImageSrc] = useState(imageSrc);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [corners, setCorners] = useState<QuadCrop | null>(null);
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);
  const [activeEdge, setActiveEdge] = useState<EdgeKey | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<'free' | 'a4' | 'legal' | 'nid'>('free');
  const [detectionBadge, setDetectionBadge] = useState<string>('AI Edge Detector');

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Drag tracking refs
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const initialCornersOnDragRef = useRef<QuadCrop | null>(null);

  // Privacy-friendly learning session refs
  const predictedCornersRef = useRef<QuadCrop | null>(null);
  const detectionMethodRef = useRef<string>('Universal Auto-Detector');
  const isManualResetRef = useRef<boolean>(false);

  // Load image on mount
  useEffect(() => {
    setActiveImageSrc(imageSrc);
    isManualResetRef.current = false;
    const img = new Image();
    img.src = imageSrc;
    img.onload = async () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      if (initialCrop) {
        setCorners(initialCrop);
        predictedCornersRef.current = initialCrop;
      } else {
        setIsDetecting(true);
        try {
          const det = await detectDocument(img);
          setCorners(det.corners);
          predictedCornersRef.current = det.rawCorners || det.corners;
          detectionMethodRef.current = det.method;
          setDetectionBadge(det.method);
        } finally {
          setIsDetecting(false);
        }
      }
      setImageLoaded(true);
    };
  }, [imageSrc, initialCrop]);

  // Recalculate displayed dimensions directly from image element
  const updateSize = useCallback(() => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDisplaySize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!imageRef.current || !imageLoaded) return;
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageLoaded, activeImageSrc, updateSize]);

  // Normalized to display coordinates
  const toDisplay = useCallback(
    (p: Point2D): Point2D => {
      if (!displaySize.width || !displaySize.height) return { x: 0, y: 0 };
      return {
        x: p.x * displaySize.width,
        y: p.y * displaySize.height,
      };
    },
    [displaySize]
  );

  // Client coordinate to normalized (0..1) directly against image bounding box
  const toNormalized = useCallback(
    (clientX: number, clientY: number): Point2D => {
      if (!imageRef.current) return { x: 0, y: 0 };
      const rect = imageRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      return {
        x: Math.max(0, Math.min(1, clientX / rect.width)),
        y: Math.max(0, Math.min(1, clientY / rect.height)),
      };
    },
    []
  );

  // Drag start for corner pin
  const handleCornerPointerDown = (corner: CornerKey, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setActiveCorner(corner);
    setActiveEdge(null);
  };

  // Drag start for edge midpoint handle
  const handleEdgePointerDown = (edge: EdgeKey, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!imageRef.current || !corners) return;
    (e.target as Element).setPointerCapture(e.pointerId);

    const rect = imageRef.current.getBoundingClientRect();
    dragStartPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    initialCornersOnDragRef.current = { ...corners };
    setActiveEdge(edge);
    setActiveCorner(null);
  };

  // Pointer move handler (handles both corners and edge dragging)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!imageRef.current || !corners) return;
    const rect = imageRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (activeCorner) {
      const normPt = toNormalized(clientX, clientY);
      setCorners((prev) => (prev ? { ...prev, [activeCorner]: normPt } : prev));
      return;
    }

    if (activeEdge && dragStartPosRef.current && initialCornersOnDragRef.current) {
      const dxNorm = (clientX - dragStartPosRef.current.x) / (rect.width || 1);
      const dyNorm = (clientY - dragStartPosRef.current.y) / (rect.height || 1);
      const init = initialCornersOnDragRef.current;

      const clampPt = (p: Point2D, dx: number, dy: number): Point2D => ({
        x: Math.max(0, Math.min(1, p.x + dx)),
        y: Math.max(0, Math.min(1, p.y + dy)),
      });

      if (activeEdge === 'top') {
        setCorners({
          ...init,
          topLeft: clampPt(init.topLeft, 0, dyNorm),
          topRight: clampPt(init.topRight, 0, dyNorm),
        });
      } else if (activeEdge === 'bottom') {
        setCorners({
          ...init,
          bottomLeft: clampPt(init.bottomLeft, 0, dyNorm),
          bottomRight: clampPt(init.bottomRight, 0, dyNorm),
        });
      } else if (activeEdge === 'left') {
        setCorners({
          ...init,
          topLeft: clampPt(init.topLeft, dxNorm, 0),
          bottomLeft: clampPt(init.bottomLeft, dxNorm, 0),
        });
      } else if (activeEdge === 'right') {
        setCorners({
          ...init,
          topRight: clampPt(init.topRight, dxNorm, 0),
          bottomRight: clampPt(init.bottomRight, dxNorm, 0),
        });
      }
    }
  };

  const handlePointerUp = () => {
    setActiveCorner(null);
    setActiveEdge(null);
    dragStartPosRef.current = null;
    initialCornersOnDragRef.current = null;
  };

  // Magnifier Loupe: 3.5x zoom while dragging
  useEffect(() => {
    if (!activeCorner || !corners || !imageRef.current || !loupeCanvasRef.current) return;

    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = corners[activeCorner];
    const img = imageRef.current;
    const natX = pt.x * (img.naturalWidth || 1);
    const natY = pt.y * (img.naturalHeight || 1);

    const loupeSize = 114;
    const zoom = 3.4;
    const sampleW = loupeSize / zoom;
    const sampleH = loupeSize / zoom;

    ctx.clearRect(0, 0, loupeSize, loupeSize);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      img,
      natX - sampleW / 2,
      natY - sampleH / 2,
      sampleW,
      sampleH,
      0,
      0,
      loupeSize,
      loupeSize
    );

    // Crosshair reticle
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, loupeSize / 2);
    ctx.lineTo(loupeSize / 2 - 5, loupeSize / 2);
    ctx.moveTo(loupeSize / 2 + 5, loupeSize / 2);
    ctx.lineTo(loupeSize, loupeSize / 2);
    ctx.moveTo(loupeSize / 2, 0);
    ctx.lineTo(loupeSize / 2, loupeSize / 2 - 5);
    ctx.moveTo(loupeSize / 2, loupeSize / 2 + 5);
    ctx.lineTo(loupeSize / 2, loupeSize);
    ctx.stroke();

    // Center target dot
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(loupeSize / 2, loupeSize / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }, [activeCorner, corners]);

  // Rotate 90° Clockwise
  const handleRotate = () => {
    if (!imageRef.current || !corners) return;
    const curW = naturalSize.width;
    const curH = naturalSize.height;
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = curH;
    rotCanvas.height = curW;
    const ctx = rotCanvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(curH / 2, curW / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(imageRef.current, -curW / 2, -curH / 2);

    const newUrl = rotCanvas.toDataURL('image/jpeg', 0.95);
    setActiveImageSrc(newUrl);
    setNaturalSize({ width: curH, height: curW });

    setCorners({
      topLeft: { x: Math.max(0, Math.min(1, 1 - corners.bottomLeft.y)), y: Math.max(0, Math.min(1, corners.bottomLeft.x)) },
      topRight: { x: Math.max(0, Math.min(1, 1 - corners.topLeft.y)), y: Math.max(0, Math.min(1, corners.topLeft.x)) },
      bottomRight: { x: Math.max(0, Math.min(1, 1 - corners.topRight.y)), y: Math.max(0, Math.min(1, corners.topRight.x)) },
      bottomLeft: { x: Math.max(0, Math.min(1, 1 - corners.bottomRight.y)), y: Math.max(0, Math.min(1, corners.bottomRight.x)) },
    });
  };

  // Reset to full frame
  const handleResetFull = () => {
    isManualResetRef.current = true;
    setSelectedRatio('free');
    setCorners({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    });
  };

  // Expand Margin (+3%)
  const handleExpandMargin = () => {
    if (!corners) return;
    setCorners(adjustCropMargin(corners, 0.03));
  };

  // Shrink Margin (-3%)
  const handleShrinkMargin = () => {
    if (!corners) return;
    setCorners(adjustCropMargin(corners, -0.03));
  };

  // Apply predefined aspect ratio template
  const handleSelectRatio = (ratio: 'free' | 'a4' | 'legal' | 'nid') => {
    setSelectedRatio(ratio);
    if (!corners) return;

    if (ratio === 'free') return;

    let targetAspect = 1.0;
    if (ratio === 'a4') targetAspect = 1 / 1.4142; // Portrait A4
    else if (ratio === 'legal') targetAspect = 8.5 / 14; // Portrait Legal
    else if (ratio === 'nid') targetAspect = 85.6 / 53.98; // Landscape Card (1.585)

    const cx = (corners.topLeft.x + corners.topRight.x + corners.bottomRight.x + corners.bottomLeft.x) / 4;
    const cy = (corners.topLeft.y + corners.topRight.y + corners.bottomRight.y + corners.bottomLeft.y) / 4;

    const curW = Math.max(
      Math.hypot(corners.topRight.x - corners.topLeft.x, corners.topRight.y - corners.topLeft.y),
      Math.hypot(corners.bottomRight.x - corners.bottomLeft.x, corners.bottomRight.y - corners.bottomLeft.y)
    );

    const halfW = Math.min(0.48, Math.max(0.15, curW / 2));
    const halfH = Math.min(0.48, halfW / targetAspect);

    setCorners({
      topLeft: { x: Math.max(0, cx - halfW), y: Math.max(0, cy - halfH) },
      topRight: { x: Math.min(1, cx + halfW), y: Math.max(0, cy - halfH) },
      bottomRight: { x: Math.min(1, cx + halfW), y: Math.min(1, cy + halfH) },
      bottomLeft: { x: Math.max(0, cx - halfW), y: Math.min(1, cy + halfH) },
    });
  };

  // Re-run Auto Detect
  const handleAutoDetect = async () => {
    if (!imageRef.current) return;
    setIsDetecting(true);
    isManualResetRef.current = false;
    try {
      const res = await detectDocument(imageRef.current);
      if (res.corners) {
        setCorners(res.corners);
        predictedCornersRef.current = res.rawCorners || res.corners;
        detectionMethodRef.current = res.method;
        setDetectionBadge(res.method);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Live Straightened Preview Generator
  const generatePreview = useCallback(async () => {
    if (!imageRef.current || !corners) return;
    setIsGeneratingPreview(true);
    try {
      const ordered = orderPoints([corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]);
      const warped = await applyRealPerspectiveWarp(imageRef.current, ordered);
      setPreviewCanvas(warped);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [corners]);

  // When switching to Preview tab, generate warped canvas
  useEffect(() => {
    if (activeTab === 'preview') {
      generatePreview();
    }
  }, [activeTab, generatePreview]);

  // Apply crop
  const handleApply = async () => {
    if (!imageRef.current || !corners) return;
    const ordered = orderPoints([corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]);
    const warped = await applyRealPerspectiveWarp(imageRef.current, ordered);

    // Asynchronously record anonymous geometric learning sample
    const pred = predictedCornersRef.current || corners;
    cropLearningEngine.recordCropSession({
      predictedCorners: pred,
      finalCorners: ordered,
      imageWidth: naturalSize.width,
      imageHeight: naturalSize.height,
      detectionMethod: detectionMethodRef.current,
      isManualReset: isManualResetRef.current,
    });

    onApply(warped, ordered);
  };

  if (!imageLoaded || !corners) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-[#d8eadd]">
          <RefreshCw className="h-8 w-8 animate-spin text-[#16a34a]" />
          <p className="text-sm font-semibold text-[#0f241a]">Detecting Document Edges...</p>
        </div>
      </div>
    );
  }

  const dTL = toDisplay(corners.topLeft);
  const dTR = toDisplay(corners.topRight);
  const dBR = toDisplay(corners.bottomRight);
  const dBL = toDisplay(corners.bottomLeft);
  const polygonPoints = `${dTL.x},${dTL.y} ${dTR.x},${dTR.y} ${dBR.x},${dBR.y} ${dBL.x},${dBL.y}`;

  // Edge midpoints
  const edgeMidpoints = {
    top: { x: (dTL.x + dTR.x) / 2, y: (dTL.y + dTR.y) / 2 },
    right: { x: (dTR.x + dBR.x) / 2, y: (dTR.y + dBR.y) / 2 },
    bottom: { x: (dBR.x + dBL.x) / 2, y: (dBR.y + dBL.y) / 2 },
    left: { x: (dBL.x + dTL.x) / 2, y: (dBL.y + dTL.y) / 2 },
  };

  const activeDisplayPt = activeCorner ? toDisplay(corners[activeCorner]) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/60 backdrop-blur-sm select-none animate-fade-in"
    >
      {/* FLOATING DIALOG CONTAINER */}
      <div className="relative w-full max-w-5xl h-full max-h-[92vh] flex flex-col bg-[#f8fbf9] border border-[#cbe1d3] rounded-3xl shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <header className="w-full bg-white border-b border-[#d8eadd] px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 z-30">
          {/* Left: Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shadow-xs">
              <Crop className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#0f241a] tracking-tight">
                  {title}
                </h2>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#065f46]">
                  {detectionBadge}
                </span>
              </div>
              <p className="text-[11px] text-[#52796f]">
                Drag 4 corners or edge handles to straighten the document
              </p>
            </div>
          </div>

          {/* Center Tabs: Edit vs Live Preview */}
          <div className="flex items-center bg-[#e8f2eb] p-1 rounded-xl border border-[#d2e7db]">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white text-[#0f241a] shadow-2xs'
                  : 'text-[#52796f] hover:text-[#0f241a]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit Corners</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-[#0f241a] shadow-2xs'
                  : 'text-[#52796f] hover:text-[#0f241a]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          </div>

          {/* Right: Close Button */}
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Close dialog (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* SECONDARY TOOLBAR: Aspect Ratios & Quick Adjustment */}
        <div className="w-full bg-[#f1f7f3] border-b border-[#d8eadd] px-4 sm:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#52796f] uppercase tracking-wider mr-1">
              Preset:
            </span>
            <button
              onClick={() => handleSelectRatio('free')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRatio === 'free'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'bg-white border border-[#cbe1d3] text-[#1e3a2f] hover:bg-slate-50'
              }`}
            >
              Perspective Free
            </button>
            <button
              onClick={() => handleSelectRatio('a4')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRatio === 'a4'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'bg-white border border-[#cbe1d3] text-[#1e3a2f] hover:bg-slate-50'
              }`}
            >
              A4 Page
            </button>
            <button
              onClick={() => handleSelectRatio('legal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRatio === 'legal'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'bg-white border border-[#cbe1d3] text-[#1e3a2f] hover:bg-slate-50'
              }`}
            >
              Legal
            </button>
            <button
              onClick={() => handleSelectRatio('nid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRatio === 'nid'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'bg-white border border-[#cbe1d3] text-[#1e3a2f] hover:bg-slate-50'
              }`}
            >
              ID / NID Card
            </button>
          </div>

          {/* Margin Adjusters & Actions */}
          <div className="flex items-center gap-1.5">
            {/* Margin Expand / Shrink */}
            <button
              onClick={handleExpandMargin}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1e3a2f] font-semibold text-xs shadow-2xs transition cursor-pointer"
              title="Expand border outwards (+3%)"
            >
              <ZoomOut className="w-3 h-3 text-[#16a34a]" />
              <span>Expand</span>
            </button>
            <button
              onClick={handleShrinkMargin}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1e3a2f] font-semibold text-xs shadow-2xs transition cursor-pointer"
              title="Shrink border inwards (-3%)"
            >
              <ZoomIn className="w-3 h-3 text-[#16a34a]" />
              <span>Shrink</span>
            </button>

            {/* Rotate */}
            <button
              onClick={handleRotate}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1e3a2f] font-semibold text-xs shadow-2xs transition cursor-pointer"
              title="Rotate 90° clockwise"
            >
              <RotateCw className="w-3 h-3 text-[#16a34a]" />
              <span>Rotate</span>
            </button>

            {/* AI Auto Detect */}
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-40"
              title="Auto detect document corners with AI"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>{isDetecting ? 'Detecting...' : 'Auto Detect'}</span>
            </button>

            {/* Full Image */}
            <button
              onClick={handleResetFull}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1e3a2f] font-semibold text-xs shadow-2xs transition cursor-pointer"
              title="Reset crop to full frame"
            >
              <Maximize2 className="w-3 h-3 text-slate-500" />
              <span>Full</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA: CANVAS or LIVE PREVIEW */}
        <div className="relative flex-1 overflow-hidden flex items-center justify-center p-4 sm:p-6 bg-[#e6f0e9]">
          {activeTab === 'edit' ? (
            // CORNER EDITING CANVAS
            <div className="relative flex items-center justify-center max-h-[72vh] max-w-[85vw] overflow-visible">
              <div
                ref={containerRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  width: displaySize.width ? `${displaySize.width}px` : 'auto',
                  height: displaySize.height ? `${displaySize.height}px` : 'auto',
                }}
                className="relative inline-block select-none shadow-2xl rounded-sm overflow-visible touch-none border border-slate-300 bg-white"
              >
                <img
                  ref={imageRef}
                  src={activeImageSrc}
                  alt="Original document"
                  onLoad={updateSize}
                  className="block max-h-[70vh] max-w-[80vw] object-contain rounded-sm select-none pointer-events-none"
                />

                {/* Darkened overlay for area outside document */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: `${displaySize.width}px`,
                    height: `${displaySize.height}px`,
                    overflow: 'visible',
                  }}
                  viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
                >
                  <defs>
                    <mask id="modalCropMask">
                      <rect width="100%" height="100%" fill="white" />
                      <polygon points={polygonPoints} fill="black" />
                    </mask>
                  </defs>
                  {/* High-contrast dimmed background outside document */}
                  <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.58)"
                    mask="url(#modalCropMask)"
                  />

                  {/* Black outline stroke for visibility on bright paper */}
                  <polygon
                    points={polygonPoints}
                    fill="rgba(16, 185, 129, 0.12)"
                    stroke="#000000"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Vibrant emerald cut-line on top */}
                  <polygon
                    points={polygonPoints}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </svg>

              {/* 4 Edge Midpoint Drag Handles (allows moving an entire edge) */}
              {(['top', 'right', 'bottom', 'left'] as EdgeKey[]).map((edge) => {
                const mp = edgeMidpoints[edge];
                const isHovered = activeEdge === edge;

                return (
                  <div
                    key={edge}
                    onPointerDown={(e) => handleEdgePointerDown(edge, e)}
                    style={{
                      left: `${mp.x}px`,
                      top: `${mp.y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute z-20 flex items-center justify-center rounded-full cursor-pointer transition-transform ${
                      isHovered
                        ? 'w-6 h-6 bg-[#16a34a] ring-4 ring-[#16a34a]/30 scale-110 shadow-lg'
                        : 'w-5 h-5 bg-white border border-[#16a34a] shadow-md hover:scale-115'
                    }`}
                    title={`Drag ${edge} edge`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isHovered ? 'bg-white' : 'bg-[#16a34a]'}`} />
                  </div>
                );
              })}

              {/* 4 Corner Pins */}
              {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as CornerKey[]).map((corner) => {
                const p = toDisplay(corners[corner]);
                const isHovered = activeCorner === corner;

                return (
                  <div
                    key={corner}
                    onPointerDown={(e) => handleCornerPointerDown(corner, e)}
                    style={{
                      left: `${p.x}px`,
                      top: `${p.y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute z-30 flex h-7 w-7 items-center justify-center rounded-full cursor-grab active:cursor-grabbing transition-transform ${
                      isHovered
                        ? 'scale-125 ring-4 ring-[#16a34a]/40 bg-[#16a34a] text-white shadow-xl'
                        : 'bg-white text-[#16a34a] shadow-lg border-2 border-[#16a34a] hover:scale-115'
                    }`}
                    title="Drag corner to adjust"
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${isHovered ? 'bg-white' : 'bg-[#16a34a]'}`} />
                  </div>
                );
              })}

              {/* Magnifier Loupe: 3.5x Zoom While Dragging Corner */}
              {activeCorner && activeDisplayPt && (
                <div
                  style={{
                    left: `${activeDisplayPt.x}px`,
                    top: `${activeDisplayPt.y - 88}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute z-40 flex flex-col items-center pointer-events-none drop-shadow-2xl animate-fade-in"
                >
                  <div className="relative h-[114px] w-[114px] rounded-full overflow-hidden border-2 border-[#16a34a] bg-white shadow-2xl ring-4 ring-[#16a34a]/25">
                    <canvas
                      ref={loupeCanvasRef}
                      width={114}
                      height={114}
                      className="w-full h-full block"
                    />
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : (
            // LIVE STRAIGHTENED PREVIEW
            <div className="relative max-h-[72vh] max-w-[85vw] flex flex-col items-center justify-center">
              {isGeneratingPreview ? (
                <div className="flex flex-col items-center gap-2 p-8 bg-white rounded-2xl shadow-xl border border-[#cbe1d3]">
                  <RefreshCw className="w-7 h-7 text-[#16a34a] animate-spin" />
                  <span className="text-xs font-semibold text-[#0f241a]">Deskewing Document...</span>
                </div>
              ) : previewCanvas ? (
                <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-300 flex flex-col items-center">
                  <img
                    src={previewCanvas.toDataURL('image/jpeg', 0.92)}
                    alt="Straightened preview"
                    className="max-h-[64vh] max-w-[78vw] object-contain rounded-lg shadow-sm"
                  />
                  <div className="pt-2 text-[11px] font-medium text-[#52796f]">
                    Straightened &amp; Deskewed Preview ({previewCanvas.width} × {previewCanvas.height} px)
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-medium">Click Preview to generate deskew view</div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <footer className="w-full bg-white border-t border-[#d8eadd] px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 z-30">
          {/* Left helper text */}
          <div className="text-xs text-[#52796f] flex items-center gap-2">
            <span>
              Area:{' '}
              <strong className="text-[#0f241a] font-mono">
                {Math.round(calculateQuadArea(corners) * 100)}%
              </strong>
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              Tip: Drag edge handles to move whole borders
            </span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-[#cbe1d3] bg-white hover:bg-slate-50 text-[#1e3a2f] text-xs font-semibold shadow-2xs transition active:scale-98 cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold shadow-xs transition active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4 text-white" />
              <span>Apply &amp; Straighten (ঠিক আছে)</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
