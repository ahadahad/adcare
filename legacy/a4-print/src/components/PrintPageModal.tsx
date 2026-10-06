import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  DocumentPage,
  PrintLayoutSettings,
  DEFAULT_PRINT_LAYOUT,
  PageSize,
  PAGE_SIZES,
} from '../types';
import {
  Printer,
  X,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Move,
  Check,
  CreditCard,
  FileText,
  Sliders,
  Compass,
  Copy,
  Ruler,
  Grid,
  Scale,
} from 'lucide-react';

interface PrintPageModalProps {
  isOpen: boolean;
  pages: DocumentPage[];
  activePageIndex: number;
  onClose: () => void;
  onUpdatePageLayout: (pageIndex: number, layout: PrintLayoutSettings) => void;
  onApplyLayoutToAll: (layout: PrintLayoutSettings) => void;
  onPrint: () => void;
}

type DragMode = 'move' | 'rotate' | 'resize-br' | 'resize-tl' | 'resize-tr' | 'resize-bl' | null;

export const PrintPageModal: React.FC<PrintPageModalProps> = ({
  isOpen,
  pages,
  activePageIndex,
  onClose,
  onUpdatePageLayout,
  onApplyLayoutToAll,
  onPrint,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(activePageIndex);

  // Sync with prop when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentPageIndex(activePageIndex);
    }
  }, [isOpen, activePageIndex]);

  const activePage = pages[currentPageIndex] || pages[0];

  // Current page layout settings
  const currentLayout: PrintLayoutSettings = activePage?.printLayout || {
    ...DEFAULT_PRINT_LAYOUT,
  };

  const [layout, setLayout] = useState<PrintLayoutSettings>(currentLayout);

  // Display toggles: ruler and grid
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Sync state when page changes
  useEffect(() => {
    if (activePage?.printLayout) {
      setLayout(activePage.printLayout);
    } else {
      setLayout({ ...DEFAULT_PRINT_LAYOUT });
    }
  }, [currentPageIndex, activePage]);

  // Current paper dimensions based on selected Page Size (ONLY A4 or Legal)
  const currentPaperDim = PAGE_SIZES[layout.pageSize || 'A4'];

  // Paper & interaction refs
  const paperRef = useRef<HTMLDivElement>(null);
  const transformBoxRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialLayout: PrintLayoutSettings;
    paperRect: DOMRect | null;
    centerScreenX: number;
    centerScreenY: number;
  }>({
    pointerX: 0,
    pointerY: 0,
    initialLayout: { ...DEFAULT_PRINT_LAYOUT },
    paperRect: null,
    centerScreenX: 0,
    centerScreenY: 0,
  });

  // Aspect ratio of the current document image
  const [imgAspect, setImgAspect] = useState<number>(1.0);

  useEffect(() => {
    if (!activePage) return;
    const canvas = activePage.processedCanvas || activePage.warpedCanvas;
    if (canvas && canvas.width && canvas.height) {
      setImgAspect(canvas.width / canvas.height);
    } else {
      const img = new Image();
      img.src = activePage.originalSrc;
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setImgAspect(img.naturalWidth / img.naturalHeight);
        }
      };
    }
  }, [activePage]);

  // Real-world physical printed measurements on the selected page (A4 or Legal)
  const physicalDimensions = useMemo(() => {
    const widthMm = Number(((layout.widthPercent / 100) * currentPaperDim.widthMm).toFixed(1));
    const heightMm = Number((imgAspect > 0 ? widthMm / imgAspect : widthMm).toFixed(1));
    const widthCm = Number((widthMm / 10).toFixed(2));
    const heightCm = Number((heightMm / 10).toFixed(2));
    const widthIn = Number((widthMm / 25.4).toFixed(2));
    const heightIn = Number((heightMm / 25.4).toFixed(2));

    const centerMmX = (layout.x / 100) * currentPaperDim.widthMm;
    const centerMmY = (layout.y / 100) * currentPaperDim.heightMm;

    const leftMm = Math.max(0, Math.min(currentPaperDim.widthMm, centerMmX - widthMm / 2));
    const rightMm = Math.max(0, Math.min(currentPaperDim.widthMm, centerMmX + widthMm / 2));
    const topMm = Math.max(0, Math.min(currentPaperDim.heightMm, centerMmY - heightMm / 2));
    const bottomMm = Math.max(0, Math.min(currentPaperDim.heightMm, centerMmY + heightMm / 2));

    const leftIn = leftMm / 25.4;
    const rightIn = rightMm / 25.4;
    const topIn = topMm / 25.4;
    const bottomIn = bottomMm / 25.4;

    return {
      widthMm,
      heightMm,
      widthCm,
      heightCm,
      widthIn,
      heightIn,
      leftMm,
      rightMm,
      topMm,
      bottomMm,
      leftIn,
      rightIn,
      topIn,
      bottomIn,
      isNidCardSize: Math.abs(widthMm - 85.6) < 4,
    };
  }, [layout.widthPercent, layout.x, layout.y, imgAspect, currentPaperDim]);

  // Update layout helper
  const updateLayout = useCallback(
    (newLayout: Partial<PrintLayoutSettings>) => {
      setLayout((prev) => {
        const next = { ...prev, ...newLayout };
        onUpdatePageLayout(currentPageIndex, next);
        return next;
      });
    },
    [currentPageIndex, onUpdatePageLayout]
  );

  // Switch Page Size (ONLY 2 Options: 'A4' and 'Legal')
  const handleSelectPageSize = (size: PageSize) => {
    updateLayout({ pageSize: size });
  };

  // -------------------------------------------------------------
  // Interactive Pointer Handlers
  // -------------------------------------------------------------
  const handlePointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);

    const paper = paperRef.current;
    if (!paper) return;

    const paperRect = paper.getBoundingClientRect();
    const box = transformBoxRef.current;
    let centerScreenX = paperRect.left + (layout.x / 100) * paperRect.width;
    let centerScreenY = paperRect.top + (layout.y / 100) * paperRect.height;

    if (box) {
      const boxRect = box.getBoundingClientRect();
      centerScreenX = boxRect.left + boxRect.width / 2;
      centerScreenY = boxRect.top + boxRect.height / 2;
    }

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialLayout: { ...layout },
      paperRect,
      centerScreenX,
      centerScreenY,
    };

    setDragMode(mode);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const { pointerX, pointerY, initialLayout, paperRect, centerScreenX, centerScreenY } =
      dragStartRef.current;
    if (!paperRect) return;

    if (dragMode === 'move') {
      const deltaX = e.clientX - pointerX;
      const deltaY = e.clientY - pointerY;

      const deltaXPercent = (deltaX / paperRect.width) * 100;
      const deltaYPercent = (deltaY / paperRect.height) * 100;

      const newX = Math.max(5, Math.min(95, Number((initialLayout.x + deltaXPercent).toFixed(1))));
      const newY = Math.max(5, Math.min(95, Number((initialLayout.y + deltaYPercent).toFixed(1))));

      updateLayout({ x: newX, y: newY });
    } else if (dragMode === 'rotate') {
      const dx = e.clientX - centerScreenX;
      const dy = e.clientY - centerScreenY;

      const rad = Math.atan2(dy, dx);
      let deg = (rad * 180) / Math.PI + 90;

      while (deg > 180) deg -= 360;
      while (deg < -180) deg += 360;

      if (Math.abs(deg) < 2) deg = 0;
      if (Math.abs(deg - 90) < 2) deg = 90;
      if (Math.abs(deg + 90) < 2) deg = -90;
      if (Math.abs(Math.abs(deg) - 180) < 2) deg = 180;

      updateLayout({ rotation: Number(deg.toFixed(1)) });
    } else if (dragMode.startsWith('resize')) {
      const deltaX = e.clientX - pointerX;
      const deltaY = e.clientY - pointerY;
      const factor = dragMode === 'resize-tl' || dragMode === 'resize-bl' ? -1 : 1;

      const pixelDelta = (deltaX + deltaY * (dragMode.includes('t') ? -1 : 1)) * factor;
      const percentDelta = (pixelDelta / paperRect.width) * 60;

      const newWidth = Math.max(12, Math.min(100, Number((initialLayout.widthPercent + percentDelta).toFixed(1))));
      updateLayout({ widthPercent: newWidth });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
      setDragMode(null);
    }
  };

  // -------------------------------------------------------------
  // Quick Presets
  // -------------------------------------------------------------
  const handlePresetFitPage = () => {
    updateLayout({
      x: 50,
      y: 50,
      widthPercent: 92,
      rotation: 0,
    });
  };

  const handlePresetFullWidth = () => {
    updateLayout({
      x: 50,
      y: 50,
      widthPercent: 96,
      rotation: 0,
    });
  };

  const handlePresetNidCard = () => {
    // Standard ISO ID-1 card: 85.6mm wide
    const percent = Number(((85.6 / currentPaperDim.widthMm) * 100).toFixed(1));
    updateLayout({
      x: 50,
      y: 35,
      widthPercent: percent,
      rotation: 0,
    });
  };

  const handlePresetHalfPage = () => {
    updateLayout({
      x: 50,
      y: 30,
      widthPercent: 70,
      rotation: 0,
    });
  };

  // Alignment
  const handleAlign = (position: 'center' | 'top' | 'bottom') => {
    if (position === 'center') updateLayout({ x: 50, y: 50 });
    if (position === 'top') updateLayout({ x: 50, y: 28 });
    if (position === 'bottom') updateLayout({ x: 50, y: 72 });
  };

  // Step rotation
  const handleStepRotation = (step: number) => {
    let next = layout.rotation + step;
    while (next > 180) next -= 360;
    while (next < -180) next += 360;
    updateLayout({ rotation: Number(next.toFixed(1)) });
  };

  const handleRotate90 = (clockwise: boolean) => {
    handleStepRotation(clockwise ? 90 : -90);
  };

  const handleExecutePrint = () => {
    onUpdatePageLayout(currentPageIndex, layout);
    onClose();
    setTimeout(() => {
      onPrint();
    }, 150);
  };

  if (!isOpen || !activePage) return null;

  const imgSrc =
    activePage.previewUrl ||
    (activePage.processedCanvas || activePage.warpedCanvas)?.toDataURL('image/jpeg', 0.95) ||
    activePage.originalSrc;

  // Total paper dimensions in inches
  const totalWidthIn = currentPaperDim.widthIn;
  const totalHeightIn = currentPaperDim.heightIn;

  // Max whole inch for tick generation
  const maxWholeInchW = Math.floor(totalWidthIn);
  const maxWholeInchH = Math.floor(totalHeightIn);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f2f7f4] text-[#11281d] font-sans select-none overflow-hidden overscroll-none animate-fade-in">
      {/* TOP HEADER BAR */}
      <header className="w-full bg-[#f8fbf9] border-b border-[#d8eadd] px-5 py-2.5 flex items-center justify-between shadow-2xs shrink-0 z-30">
        {/* Left: Brand Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shadow-xs">
            <Printer className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#0f241a] tracking-tight">
                Print Page Setup (প্রিন্ট পেজ সেটআপ)
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#064e3b] border border-emerald-300 flex items-center gap-1">
                <Ruler className="w-3 h-3" />
                Real Physical Scale · {layout.pageSize} ({currentPaperDim.widthMm} × {currentPaperDim.heightMm} mm)
              </span>
            </div>
            <p className="text-xs text-[#52796f]">
              Resize, freely rotate, and position document with real-world measurement ruler
            </p>
          </div>
        </div>

        {/* Center: Multi-page Navigator if > 1 page */}
        {pages.length > 1 && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#cbe1d3] shadow-2xs">
            <button
              onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
              disabled={currentPageIndex === 0}
              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 text-[#11281d]" />
            </button>
            <span className="text-xs font-semibold text-[#0f241a] px-1">
              Page {currentPageIndex + 1} of {pages.length}
            </span>
            <button
              onClick={() => setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1))}
              disabled={currentPageIndex === pages.length - 1}
              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4 text-[#11281d]" />
            </button>

            <button
              onClick={() => onApplyLayoutToAll(layout)}
              className="ml-2 flex items-center gap-1 text-[11px] text-[#065f46] hover:underline font-semibold"
              title="Apply this size, rotation, and position to all pages"
            >
              <Copy className="w-3 h-3" />
              <span>Apply to all</span>
            </button>
          </div>
        )}

        {/* Right: Scale Toggles, Cancel & Print */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowRuler((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs ${
              showRuler
                ? 'bg-emerald-50 text-[#064e3b] border-emerald-300'
                : 'bg-white text-slate-600 border-[#cbe1d3] hover:bg-slate-50'
            }`}
            title="Toggle measurement scale ruler"
          >
            <Ruler className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>Ruler {showRuler ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowGrid((g) => !g)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs ${
              showGrid
                ? 'bg-emerald-50 text-[#064e3b] border-emerald-300'
                : 'bg-white text-slate-600 border-[#cbe1d3] hover:bg-slate-50'
            }`}
            title="Toggle 1-inch calibration grid"
          >
            <Grid className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>Grid {showGrid ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-[#cbe1d3] text-[#11281d] px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition active:scale-98 cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-600" />
            <span>Cancel</span>
          </button>

          <button
            onClick={handleExecutePrint}
            className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print Now (প্রিন্ট করুন)</span>
          </button>
        </div>
      </header>

      {/* WORKSPACE: CONTROLS SIDEBAR + REALISTIC PAPER SHEET WITH REAL SCALE RULER */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT CONTROLS SIDEBAR */}
        <aside className="w-84 bg-white border-r border-[#d8eadd] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 shadow-2xs">
          {/* 1. PAGE SIZE SELECTOR: STRICTLY 2 OPTIONS (A4 and Legal) */}
          <div className="bg-[#f0f7f3] border-2 border-[#16a34a]/30 rounded-2xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0f241a] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#16a34a]" />
                Page Size (পেজ সাইজ)
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#16a34a] text-white">
                {layout.pageSize}
              </span>
            </div>

            {/* Exactly 2 Options: A4 and Legal */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Option 1: A4 */}
              <button
                onClick={() => handleSelectPageSize('A4')}
                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  layout.pageSize === 'A4'
                    ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-xs'
                    : 'bg-white text-[#1c3a2c] border-[#cbe1d3] hover:bg-emerald-50/50'
                }`}
              >
                <span className="text-sm font-black tracking-wide">A4</span>
                <span className={`text-[10px] ${layout.pageSize === 'A4' ? 'text-emerald-100 font-medium' : 'text-slate-500 font-normal'}`}>
                  210 × 297 mm
                </span>
                <span className={`text-[9px] ${layout.pageSize === 'A4' ? 'text-emerald-200' : 'text-slate-400'}`}>
                  8.27 × 11.69 in
                </span>
              </button>

              {/* Option 2: Legal */}
              <button
                onClick={() => handleSelectPageSize('Legal')}
                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  layout.pageSize === 'Legal'
                    ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-xs'
                    : 'bg-white text-[#1c3a2c] border-[#cbe1d3] hover:bg-emerald-50/50'
                }`}
              >
                <span className="text-sm font-black tracking-wide">Legal</span>
                <span className={`text-[10px] ${layout.pageSize === 'Legal' ? 'text-emerald-100 font-medium' : 'text-slate-500 font-normal'}`}>
                  216 × 356 mm
                </span>
                <span className={`text-[9px] ${layout.pageSize === 'Legal' ? 'text-emerald-200' : 'text-slate-400'}`}>
                  8.50 × 14.00 in
                </span>
              </button>
            </div>
          </div>

          {/* 2. REAL-WORLD PHYSICAL PRINT SCALE CARD */}
          <div className="bg-[#f2f7f4] border border-[#cbe1d3] rounded-2xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#0f241a] uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#16a34a]" />
                Physical Print Size
              </span>
              <span className="text-[10px] font-mono text-[#52796f] font-semibold">
                on {layout.pageSize}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white p-2 rounded-xl border border-[#d8eadd]">
                <span className="text-[10px] text-[#52796f] block">Width</span>
                <span className="text-sm font-black text-[#0f241a] font-mono mt-0.5 block">
                  {physicalDimensions.widthIn} in
                </span>
                <span className="text-[9px] text-[#52796f] font-mono">
                  ({physicalDimensions.widthCm} cm / {physicalDimensions.widthMm} mm)
                </span>
              </div>

              <div className="bg-white p-2 rounded-xl border border-[#d8eadd]">
                <span className="text-[10px] text-[#52796f] block">Height</span>
                <span className="text-sm font-black text-[#0f241a] font-mono mt-0.5 block">
                  {physicalDimensions.heightIn} in
                </span>
                <span className="text-[9px] text-[#52796f] font-mono">
                  ({physicalDimensions.heightCm} cm / {physicalDimensions.heightMm} mm)
                </span>
              </div>
            </div>

            {physicalDimensions.isNidCardSize && (
              <div className="bg-emerald-100/70 border border-emerald-300 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#064e3b] flex items-center gap-1.5">
                <Check className="w-3 h-3 text-[#16a34a] shrink-0" />
                <span>Exact standard NID / Smart Card size (85.6 × 54 mm)</span>
              </div>
            )}
          </div>

          {/* 3. Quick Size Presets */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#52796f] uppercase tracking-wider block">
              Standard Scale Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePresetFitPage}
                className="flex items-center gap-1.5 p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-left"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                <div>
                  <span className="block leading-tight font-bold">Fit Page</span>
                  <span className="text-[9px] text-[#52796f] font-mono">92% printable</span>
                </div>
              </button>

              <button
                onClick={handlePresetFullWidth}
                className="flex items-center gap-1.5 p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-left"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div>
                  <span className="block leading-tight font-bold">Full Width</span>
                  <span className="text-[9px] text-[#52796f] font-mono">96% width</span>
                </div>
              </button>

              <button
                onClick={handlePresetNidCard}
                className="flex items-center gap-1.5 p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-left bg-emerald-50/50"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <div>
                  <span className="block leading-tight font-bold text-[#064e3b]">NID Card</span>
                  <span className="text-[9px] text-[#064e3b] font-mono">8.56 × 5.40 cm</span>
                </div>
              </button>

              <button
                onClick={handlePresetHalfPage}
                className="flex items-center gap-1.5 p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-left"
              >
                <Minimize2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <div>
                  <span className="block leading-tight font-bold">Half Page</span>
                  <span className="text-[9px] text-[#52796f] font-mono">2 per sheet</span>
                </div>
              </button>
            </div>
          </div>

          {/* 4. Size / Scale Slider */}
          <div className="space-y-2 bg-[#f8fbf9] p-3 rounded-xl border border-[#d8eadd]">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#0f241a] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#16a34a]" />
                Image Scale (% of {layout.pageSize})
              </span>
              <span className="font-bold text-[#065f46] font-mono text-sm">
                {layout.widthPercent}%
              </span>
            </div>
            <input
              type="range"
              min="12"
              max="100"
              step="0.5"
              value={layout.widthPercent}
              onChange={(e) => updateLayout({ widthPercent: parseFloat(e.target.value) })}
              className="slider-teal cursor-pointer w-full"
            />
            <div className="flex justify-between text-[10px] text-[#52796f] font-mono">
              <span>Card</span>
              <span>Half (70%)</span>
              <span>Full (92%)</span>
            </div>
          </div>

          {/* 5. Free Rotate Controls ("free rote") */}
          <div className="space-y-3 bg-[#f8fbf9] p-3 rounded-xl border border-[#d8eadd]">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#0f241a] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#16a34a]" />
                Free Rotation (ঘোরান)
              </span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-[#065f46] font-mono text-sm px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  {layout.rotation > 0 ? `+${layout.rotation}°` : `${layout.rotation}°`}
                </span>
                {layout.rotation !== 0 && (
                  <button
                    onClick={() => updateLayout({ rotation: 0 })}
                    className="text-[10px] text-slate-500 hover:text-red-600 cursor-pointer font-semibold underline ml-1"
                    title="Reset to 0°"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Continuous Free Rotate Slider (-180 to +180 deg) */}
            <input
              type="range"
              min="-180"
              max="180"
              step="0.5"
              value={layout.rotation}
              onChange={(e) => updateLayout({ rotation: parseFloat(e.target.value) })}
              className="slider-teal cursor-pointer w-full"
            />

            {/* Micro-tuning & 90 deg Turn Buttons */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStepRotation(-5)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[11px] font-semibold text-[#1c3a2c] cursor-pointer"
                  title="Rotate -5°"
                >
                  -5°
                </button>
                <button
                  onClick={() => handleStepRotation(-1)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[11px] font-semibold text-[#1c3a2c] cursor-pointer"
                  title="Rotate -1°"
                >
                  -1°
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRotate90(false)}
                  className="p-1.5 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1c3a2c] cursor-pointer"
                  title="Rotate 90° Counter-Clockwise"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRotate90(true)}
                  className="p-1.5 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1c3a2c] cursor-pointer"
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStepRotation(1)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[11px] font-semibold text-[#1c3a2c] cursor-pointer"
                  title="Rotate +1°"
                >
                  +1°
                </button>
                <button
                  onClick={() => handleStepRotation(5)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[11px] font-semibold text-[#1c3a2c] cursor-pointer"
                  title="Rotate +5°"
                >
                  +5°
                </button>
              </div>
            </div>
          </div>

          {/* 6. Alignment */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#52796f] uppercase tracking-wider block">
              Page Alignment
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleAlign('top')}
                className="p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-center"
              >
                Top
              </button>
              <button
                onClick={() => handleAlign('center')}
                className="p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-center"
              >
                Center
              </button>
              <button
                onClick={() => handleAlign('bottom')}
                className="p-2 rounded-xl border border-[#cbe1d3] hover:bg-[#f2f7f4] text-xs font-semibold text-[#1c3a2c] transition cursor-pointer text-center"
              >
                Bottom
              </button>
            </div>
          </div>
        </aside>

        {/* REALISTIC SHEET VIEWPORT WITH REAL SCALE RULER (LIKE UPLOADED IMAGE) */}
        <main
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex-1 bg-[#e8f1eb] p-6 flex flex-col items-center justify-center overflow-auto relative touch-none"
        >
          {/* Paper and Ruler Assembly */}
          <div
            style={{
              height: '80vh',
              maxHeight: '860px',
              aspectRatio: showRuler
                ? `${currentPaperDim.widthMm + 14} / ${currentPaperDim.heightMm + 14}`
                : `${currentPaperDim.widthMm} / ${currentPaperDim.heightMm}`,
            }}
            className="flex flex-col relative select-none shadow-2xl rounded-sm"
          >
            {/* TOP HORIZONTAL RULER (LIKE UPLOADED IMAGE) */}
            {showRuler && (
              <div className="flex w-full shrink-0 items-end">
                {/* Top-Left Corner Box matching screenshot */}
                <div
                  style={{ width: '28px', height: '28px' }}
                  className="bg-[#ebf5ee] border-t border-l border-r border-b border-[#8faea0] flex items-center justify-center shrink-0 relative"
                >
                  {/* Subtle origin crosshairs at corner */}
                  <div className="w-full h-full relative">
                    <div className="absolute right-0 bottom-0 w-2 h-0.5 bg-[#4d7c64]" />
                    <div className="absolute right-0 bottom-0 w-0.5 h-2 bg-[#4d7c64]" />
                    <span className="absolute left-1 top-1 text-[8px] font-mono font-bold text-[#2d5542]">
                      in
                    </span>
                  </div>
                </div>

                {/* Horizontal Scale SVG Ruler (Pale Green Background matching uploaded image) */}
                <div
                  style={{ height: '28px' }}
                  className="flex-1 bg-[#ebf5ee] border-t border-r border-[#8faea0] relative overflow-hidden"
                >
                  <svg
                    viewBox={`0 0 ${totalWidthIn * 100} 28`}
                    preserveAspectRatio="none"
                    className="w-full h-full block"
                  >
                    {/* Background pale green */}
                    <rect x="0" y="0" width={totalWidthIn * 100} height="28" fill="#ebf5ee" />

                    {/* Ruler Baseline Separator */}
                    <line
                      x1="0"
                      y1="27.5"
                      x2={totalWidthIn * 100}
                      y2="27.5"
                      stroke="#8faea0"
                      strokeWidth="1"
                    />

                    {/* Inch Ticks with Subdivisions matching screenshot (1/8 inch intervals) */}
                    {Array.from({ length: maxWholeInchW + 1 }).map((_, inch) => {
                      const inchX = inch * 100;
                      return (
                        <g key={`inch_group_${inch}`}>
                          {/* 0 to 7 intermediate 1/8th ticks */}
                          {Array.from({ length: 8 }).map((__, subIdx) => {
                            const tickX = inchX + subIdx * 12.5;
                            if (tickX > totalWidthIn * 100) return null;

                            // Whole inch
                            if (subIdx === 0) {
                              return (
                                <g key={`sub_0_${inch}`}>
                                  {/* Major tick hanging down to baseline */}
                                  <line
                                    x1={tickX}
                                    y1={inch === 0 ? 0 : 15}
                                    x2={tickX}
                                    y2={27.5}
                                    stroke="#204c35"
                                    strokeWidth="1.2"
                                  />
                                  {/* Inch Number text */}
                                  {inch > 0 && (
                                    <text
                                      x={tickX}
                                      y="11.5"
                                      fontSize="9"
                                      fontFamily="system-ui, -apple-system, sans-serif"
                                      fontWeight="500"
                                      fill="#2d5542"
                                      textAnchor="middle"
                                    >
                                      {inch}
                                    </text>
                                  )}
                                </g>
                              );
                            }

                            // 1/2 inch tick (subIdx = 4)
                            if (subIdx === 4) {
                              return (
                                <line
                                  key={`sub_4_${inch}`}
                                  x1={tickX}
                                  y1={18}
                                  x2={tickX}
                                  y2={27.5}
                                  stroke="#3d6c54"
                                  strokeWidth="1"
                                />
                              );
                            }

                            // 1/4 and 3/4 inch ticks (subIdx = 2, 6)
                            if (subIdx === 2 || subIdx === 6) {
                              return (
                                <line
                                  key={`sub_26_${inch}_${subIdx}`}
                                  x1={tickX}
                                  y1={21}
                                  x2={tickX}
                                  y2={27.5}
                                  stroke="#4d7c64"
                                  strokeWidth="0.9"
                                />
                              );
                            }

                            // 1/8 inch ticks (subIdx = 1, 3, 5, 7)
                            return (
                              <line
                                key={`sub_18_${inch}_${subIdx}`}
                                x1={tickX}
                                y1={23.5}
                                x2={tickX}
                                y2={27.5}
                                stroke="#68977f"
                                strokeWidth="0.75"
                              />
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Active Document Horizontal Projection Highlight on Top Scale */}
                    <rect
                      x={physicalDimensions.leftIn * 100}
                      y="16"
                      width={Math.max(2, (physicalDimensions.rightIn - physicalDimensions.leftIn) * 100)}
                      height="11"
                      fill="#16a34a"
                      fillOpacity="0.3"
                    />
                    <line
                      x1={physicalDimensions.leftIn * 100}
                      y1="0"
                      x2={physicalDimensions.leftIn * 100}
                      y2="28"
                      stroke="#16a34a"
                      strokeWidth="1.2"
                    />
                    <line
                      x1={physicalDimensions.rightIn * 100}
                      y1="0"
                      x2={physicalDimensions.rightIn * 100}
                      y2="28"
                      stroke="#16a34a"
                      strokeWidth="1.2"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* BODY ROW: LEFT VERTICAL RULER + PAPER SHEET */}
            <div className="flex flex-1 min-h-0 w-full">
              {/* LEFT VERTICAL RULER (LIKE UPLOADED IMAGE) */}
              {showRuler && (
                <div
                  style={{ width: '28px' }}
                  className="h-full bg-[#ebf5ee] border-l border-b border-[#8faea0] relative overflow-hidden shrink-0"
                >
                  <svg
                    viewBox={`0 0 28 ${totalHeightIn * 100}`}
                    preserveAspectRatio="none"
                    className="w-full h-full block"
                  >
                    {/* Background pale green */}
                    <rect x="0" y="0" width="28" height={totalHeightIn * 100} fill="#ebf5ee" />

                    {/* Vertical Baseline Separator */}
                    <line
                      x1="27.5"
                      y1="0"
                      x2="27.5"
                      y2={totalHeightIn * 100}
                      stroke="#8faea0"
                      strokeWidth="1"
                    />

                    {/* Inch Ticks with Subdivisions matching screenshot */}
                    {Array.from({ length: maxWholeInchH + 1 }).map((_, inch) => {
                      const inchY = inch * 100;
                      return (
                        <g key={`v_inch_group_${inch}`}>
                          {Array.from({ length: 8 }).map((__, subIdx) => {
                            const tickY = inchY + subIdx * 12.5;
                            if (tickY > totalHeightIn * 100) return null;

                            // Whole inch
                            if (subIdx === 0) {
                              return (
                                <g key={`v_sub_0_${inch}`}>
                                  {/* Major tick extending to right baseline */}
                                  <line
                                    x1={inch === 0 ? 0 : 15}
                                    y1={tickY}
                                    x2={27.5}
                                    y2={tickY}
                                    stroke="#204c35"
                                    strokeWidth="1.2"
                                  />
                                  {/* Inch Number text */}
                                  {inch > 0 && (
                                    <text
                                      x="8.5"
                                      y={tickY + 3}
                                      fontSize="9"
                                      fontFamily="system-ui, -apple-system, sans-serif"
                                      fontWeight="500"
                                      fill="#2d5542"
                                      textAnchor="middle"
                                    >
                                      {inch}
                                    </text>
                                  )}
                                </g>
                              );
                            }

                            // 1/2 inch tick
                            if (subIdx === 4) {
                              return (
                                <line
                                  key={`v_sub_4_${inch}`}
                                  x1={18}
                                  y1={tickY}
                                  x2={27.5}
                                  y2={tickY}
                                  stroke="#3d6c54"
                                  strokeWidth="1"
                                />
                              );
                            }

                            // 1/4 and 3/4 inch ticks
                            if (subIdx === 2 || subIdx === 6) {
                              return (
                                <line
                                  key={`v_sub_26_${inch}_${subIdx}`}
                                  x1={21}
                                  y1={tickY}
                                  x2={27.5}
                                  y2={tickY}
                                  stroke="#4d7c64"
                                  strokeWidth="0.9"
                                />
                              );
                            }

                            // 1/8 inch ticks
                            return (
                              <line
                                key={`v_sub_18_${inch}_${subIdx}`}
                                x1={23.5}
                                y1={tickY}
                                x2={27.5}
                                y2={tickY}
                                stroke="#68977f"
                                strokeWidth="0.75"
                              />
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Active Document Vertical Projection Highlight on Left Scale */}
                    <rect
                      x="16"
                      y={physicalDimensions.topIn * 100}
                      width="11"
                      height={Math.max(2, (physicalDimensions.bottomIn - physicalDimensions.topIn) * 100)}
                      fill="#16a34a"
                      fillOpacity="0.3"
                    />
                    <line
                      x1="0"
                      y1={physicalDimensions.topIn * 100}
                      x2="28"
                      y2={physicalDimensions.topIn * 100}
                      stroke="#16a34a"
                      strokeWidth="1.2"
                    />
                    <line
                      x1="0"
                      y1={physicalDimensions.bottomIn * 100}
                      x2="28"
                      y2={physicalDimensions.bottomIn * 100}
                      stroke="#16a34a"
                      strokeWidth="1.2"
                    />
                  </svg>
                </div>
              )}

              {/* Physical Paper Sheet (A4: 210/297, Legal: 215.9/355.6) */}
              <div
                ref={paperRef}
                style={{
                  aspectRatio: `${currentPaperDim.widthMm} / ${currentPaperDim.heightMm}`,
                }}
                className="flex-1 bg-white border border-[#8faea0] overflow-hidden select-none relative"
              >
                {/* 1-Inch Calibration Grid Overlay */}
                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #16a34a 1px, transparent 1px),
                        linear-gradient(to bottom, #16a34a 1px, transparent 1px)
                      `,
                      backgroundSize: `calc(100% / ${totalWidthIn}) calc(100% / ${totalHeightIn})`,
                    }}
                  />
                )}

                {/* Safe Printable Margin Guide */}
                <div className="absolute inset-[2.4%] border border-dashed border-[#a3c9b4] pointer-events-none rounded-xs">
                  <span className="absolute top-1 left-1.5 text-[8px] font-mono text-[#52796f]/80 uppercase tracking-widest font-semibold">
                    {layout.pageSize} Printable Area ({currentPaperDim.widthMm} × {currentPaperDim.heightMm} mm)
                  </span>
                </div>

                {/* Document Image with Interactive Transform Box */}
                <div
                  ref={transformBoxRef}
                  style={{
                    position: 'absolute',
                    left: `${layout.x}%`,
                    top: `${layout.y}%`,
                    width: `${layout.widthPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                  onPointerDown={(e) => handlePointerDown('move', e)}
                  className="cursor-move group z-10"
                >
                  {/* Outer Bounding Box Ring */}
                  <div className="relative border-2 border-[#16a34a] shadow-lg rounded-xs overflow-visible">
                    {/* The Document Image */}
                    <img
                      src={imgSrc}
                      alt="Print layout preview"
                      draggable={false}
                      className="w-full h-auto block select-none pointer-events-none rounded-xs"
                    />

                    {/* Top Protruding Rotation Arm & Handle ("Free Rotate") */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-32px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                      }}
                      onPointerDown={(e) => handlePointerDown('rotate', e)}
                      className="flex flex-col items-center cursor-grab active:cursor-grabbing z-30"
                      title="Drag in a circle to freely rotate"
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-white border-2 border-[#16a34a] shadow-md flex items-center justify-center text-[#16a34a] transition-transform ${
                          dragMode === 'rotate'
                            ? 'scale-125 bg-[#16a34a] text-white ring-4 ring-[#16a34a]/30'
                            : 'hover:scale-115'
                        }`}
                      >
                        <RotateCw className="w-3 h-3" />
                      </div>
                      {/* Stem line */}
                      <div className="w-0.5 h-2 bg-[#16a34a]" />
                    </div>

                    {/* 4 Corner Resize Handles */}
                    <div
                      onPointerDown={(e) => handlePointerDown('resize-tl', e)}
                      className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-white border-2 border-[#16a34a] shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-20"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown('resize-tr', e)}
                      className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white border-2 border-[#16a34a] shadow-md cursor-nesw-resize hover:scale-125 transition-transform z-20"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown('resize-bl', e)}
                      className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-white border-2 border-[#16a34a] shadow-md cursor-nesw-resize hover:scale-125 transition-transform z-20"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown('resize-br', e)}
                      className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-white border-2 border-[#16a34a] shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-20"
                    />

                    {/* Live Physical Dimensions Floating Chip */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-28px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                      }}
                      className="px-2.5 py-0.5 rounded-full bg-[#064e3b] text-white text-[10px] font-mono font-bold shadow-md whitespace-nowrap pointer-events-none flex items-center gap-1.5"
                    >
                      <span>
                        {physicalDimensions.widthIn} × {physicalDimensions.heightIn} in
                      </span>
                      <span className="text-emerald-200">
                        ({physicalDimensions.widthCm} × {physicalDimensions.heightCm} cm)
                      </span>
                      {layout.rotation !== 0 && (
                        <span className="text-emerald-300">
                          [{layout.rotation > 0 ? `+${layout.rotation}°` : `${layout.rotation}°`}]
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
