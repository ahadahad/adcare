import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DocumentPage,
  DocumentAdjustments,
  DocumentMode,
  QuadCrop,
  PrintLayoutSettings,
  DEFAULT_PRINT_LAYOUT,
  UpscaleFactor,
} from './types';
import {
  loadImage,
  processDocumentImage,
  createDefaultAdjustments,
  createOptimizedCanvas,
  createPageCachedUrls,
} from './utils/imageProcessing';
import { detectDocument, applyRealPerspectiveWarp, calculateQuadArea } from './utils/documentDetector';
import { exportCanvasesToPdf, downloadCanvasImage } from './utils/pdfExport';
import { CropModal } from './components/CropModal';
import { PrintPageModal } from './components/PrintPageModal';
import { CropLearningDashboard } from './components/CropLearningDashboard';
import { cropLearningEngine } from './services/cropLearning/CropLearningEngine';
import {
  Printer,
  FileDown,
  Download,
  Undo2,
  Redo2,
  RotateCw,
  Columns2,
  Plus,
  X,
  Crop,
  Minus,
  RotateCcw,
  Upload,
  Brain,
  ChevronDown,
  Zap,
} from 'lucide-react';

export default function App() {
  // Start with empty pages (Do not load sample on startup)
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Professional Pan & Zoom Engine
  const [scale, setScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Comparison mode (split view)
  const [showCompare, setShowCompare] = useState<boolean>(false);

  // Manual Crop modal
  const [isManualCropOpen, setIsManualCropOpen] = useState<boolean>(false);

  // A4 Print Page Setup modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Developer Learning Dashboard modal
  const [isLearningDashboardOpen, setIsLearningDashboardOpen] = useState<boolean>(false);

  // Toast / feedback message
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Single Download Menu state & ref
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Close download menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    if (isDownloadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDownloadMenuOpen]);

  // Keyboard shortcut Ctrl+Shift+L for developer learning dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsLearningDashboardOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Slider throttling via requestAnimationFrame to keep UI at 60fps
  const sliderRafRef = useRef<number | null>(null);
  const pendingAdjRef = useRef<DocumentAdjustments | null>(null);

  // Calculate zoom scale to fit a given canvas width/height into the viewport
  const fitCanvasToScreen = useCallback((canvasW: number, canvasH: number) => {
    if (!viewportRef.current || !canvasW || !canvasH) return;
    const vp = viewportRef.current.getBoundingClientRect();
    const pad = 64; // Padding around the document in px
    const availW = Math.max(100, vp.width - pad);
    const availH = Math.max(100, vp.height - pad);
    const scaleW = availW / canvasW;
    const scaleH = availH / canvasH;
    const fitScale = Math.min(scaleW, scaleH);
    // Set scale so the whole document is fully zoomed out & visible
    setScale(Math.max(0.1, Math.min(1.0, Number(fitScale.toFixed(3)))));
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Fit active document into viewport
  const fitToScreen = useCallback(() => {
    const page = pages[activePageIndex];
    const canvas = page?.processedCanvas || page?.warpedCanvas;
    if (canvas) {
      fitCanvasToScreen(canvas.width, canvas.height);
    } else {
      setScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [activePageIndex, pages, fitCanvasToScreen]);

  const activePage = pages[activePageIndex] || null;

  // ----------------------------------------------------------------------
  // NATIVE NON-PASSIVE WHEEL LISTENER
  // Prevents the browser page/window from scrolling when zooming with the mouse wheel
  // ----------------------------------------------------------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      // Trackpad pinch gesture (ctrlKey) vs mouse wheel
      const zoomFactor = e.ctrlKey ? Math.exp(-e.deltaY * 0.01) : Math.exp(-e.deltaY * 0.002);

      setScale((currentScale) => {
        const newScale = Math.min(4.0, Math.max(0.08, Number((currentScale * zoomFactor).toFixed(3))));
        if (Math.abs(newScale - currentScale) < 0.0005) return currentScale;

        setPanOffset((currentOffset) => {
          const newPanX = mouseX - ((mouseX - currentOffset.x) / currentScale) * newScale;
          const newPanY = mouseY - ((mouseY - currentOffset.y) / currentScale) * newScale;
          return { x: newPanX, y: newPanY };
        });

        return newScale;
      });
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelNative);
    };
  }, []);

  // Re-process image when adjustments change
  const applyAdjustmentChange = useCallback(
    (newAdjustments: DocumentAdjustments, recordHistory = true) => {
      if (!activePage || !activePage.warpedCanvas) return;

      const processed = processDocumentImage(activePage.warpedCanvas, newAdjustments);
      const { previewUrl, thumbnailUrl } = createPageCachedUrls(processed);

      setPages((prevPages) =>
        prevPages.map((pg, idx) => {
          if (idx !== activePageIndex) return pg;

          let newHistory = pg.history;
          let newHistoryIndex = pg.historyIndex;

          if (recordHistory) {
            newHistory = pg.history.slice(0, pg.historyIndex + 1);
            newHistory.push(newAdjustments);
            newHistoryIndex = newHistory.length - 1;
          }

          return {
            ...pg,
            adjustments: newAdjustments,
            processedCanvas: processed,
            previewUrl,
            thumbnailUrl,
            history: newHistory,
            historyIndex: newHistoryIndex,
          };
        })
      );
    },
    [activePage, activePageIndex]
  );

  // Undo / Redo handlers
  const handleUndo = () => {
    if (!activePage || activePage.historyIndex <= 0) return;
    const targetIdx = activePage.historyIndex - 1;
    const targetAdj = activePage.history[targetIdx];
    applyAdjustmentChange(targetAdj, false);
    setPages((prev) =>
      prev.map((pg, idx) =>
        idx === activePageIndex ? { ...pg, historyIndex: targetIdx } : pg
      )
    );
  };

  const handleRedo = () => {
    if (!activePage || activePage.historyIndex >= activePage.history.length - 1) return;
    const targetIdx = activePage.historyIndex + 1;
    const targetAdj = activePage.history[targetIdx];
    applyAdjustmentChange(targetAdj, false);
    setPages((prev) =>
      prev.map((pg, idx) =>
        idx === activePageIndex ? { ...pg, historyIndex: targetIdx } : pg
      )
    );
  };

  // Rotate 90° clockwise
  const handleRotate = () => {
    if (!activePage) return;
    const newRot = (activePage.adjustments.rotation + 90) % 360;
    applyAdjustmentChange({
      ...activePage.adjustments,
      rotation: newRot,
    });
    showToast('Rotated 90°');
  };

  // Auto Crop handler - 100% automatic: detects page color, decides where to cut, and applies immediately with 0 manual clicks
  const handleAutoCrop = async () => {
    if (!activePage) return;
    showToast('Auto cropping: detecting page color & borders...');
    const img = await loadImage(activePage.originalSrc);
    // Optimized canvas capped at 2400px
    const canvas = createOptimizedCanvas(img, 2400);

    const detResult = await detectDocument(canvas);
    const corners = detResult.corners;
    const warped = await applyRealPerspectiveWarp(canvas, corners);
    const processed = processDocumentImage(warped, activePage.adjustments);
    const { previewUrl, thumbnailUrl } = createPageCachedUrls(processed);

    setPages((prev) =>
      prev.map((pg, idx) =>
        idx === activePageIndex
          ? {
              ...pg,
              cropPoints: corners,
              warpedCanvas: warped,
              processedCanvas: processed,
              previewUrl,
              thumbnailUrl,
            }
          : pg
      )
    );
    showToast(`✓ Auto cropped (${detResult.method})`);
    fitCanvasToScreen(processed.width, processed.height);

    // Asynchronously record anonymous geometric learning sample
    cropLearningEngine.recordCropSession({
      predictedCorners: detResult.rawCorners || corners,
      finalCorners: corners,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      detectorConfidence: detResult.confidence,
      detectionMethod: detResult.method,
    });
  };

  // Manual Crop Apply handler
  const handleManualCropApply = (warpedCanvas: HTMLCanvasElement, crop: QuadCrop) => {
    if (!activePage) return;
    const processed = processDocumentImage(warpedCanvas, activePage.adjustments);
    const { previewUrl, thumbnailUrl } = createPageCachedUrls(processed);

    setPages((prev) =>
      prev.map((pg, idx) =>
        idx === activePageIndex
          ? {
              ...pg,
              cropPoints: crop,
              warpedCanvas,
              processedCanvas: processed,
              previewUrl,
              thumbnailUrl,
            }
          : pg
      )
    );
    setIsManualCropOpen(false);
    showToast('✓ Crop applied');
    fitCanvasToScreen(processed.width, processed.height);
  };

  // Mode select
  const handleModeSelect = (mode: DocumentMode) => {
    if (!activePage) return;
    applyAdjustmentChange({
      ...activePage.adjustments,
      mode,
    });
  };

  // High-performance slider handling with requestAnimationFrame
  const handleSliderChange = (key: 'black' | 'color' | 'contrast', value: number) => {
    if (!activePage) return;
    const nextAdj: DocumentAdjustments = {
      ...activePage.adjustments,
      [key]: value,
    };

    // Instant UI update for slider knob
    setPages((prev) =>
      prev.map((pg, idx) =>
        idx === activePageIndex ? { ...pg, adjustments: nextAdj } : pg
      )
    );

    pendingAdjRef.current = nextAdj;

    if (sliderRafRef.current === null) {
      sliderRafRef.current = window.requestAnimationFrame(() => {
        sliderRafRef.current = null;
        if (pendingAdjRef.current) {
          applyAdjustmentChange(pendingAdjRef.current, false);
          pendingAdjRef.current = null;
        }
      });
    }
  };

  // Upscale resolution selection: 1x (Native original, default), 2x ("Good"), 4x ("Best")
  const handleSelectUpscale = (factor: UpscaleFactor) => {
    if (!activePage) return;
    const nextAdj: DocumentAdjustments = {
      ...activePage.adjustments,
      upscale: factor,
    };
    applyAdjustmentChange(nextAdj);
    showToast(factor === 4 ? '✓ Best Upscale (4x) Active' : factor === 2 ? '✓ Good Upscale (2x) Active' : '✓ Native 1x (No upscale)');
  };

  // Toast feedback helper
  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  // File upload handling - memory-optimized and fast
  // Upload file handler - detects as document and auto-crops immediately for seamless scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPages: DocumentPage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const src = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });

      const img = await loadImage(src);
      // Automatically cap giant phone photos to 2400px (300 DPI A4) for smooth 60fps performance
      const canvas = createOptimizedCanvas(img, 2400);

      // 1. Detect as document (page color, perspective edges, boundaries)
      const det = await detectDocument(canvas);
      let warpedCanvas = canvas;
      const area = calculateQuadArea(det.corners);

      // 2. If a document is detected inside the image, auto-crop immediately!
      if (det.success && area >= 0.08 && area <= 0.98) {
        try {
          warpedCanvas = await applyRealPerspectiveWarp(canvas, det.corners);
        } catch {
          warpedCanvas = canvas;
        }
      }

      // Default to 'normal' mode so uploaded images preserve original colors!
      const initialAdj = createDefaultAdjustments('normal');
      const processed = processDocumentImage(warpedCanvas, initialAdj);
      const { previewUrl, thumbnailUrl } = createPageCachedUrls(processed);

      newPages.push({
        id: 'page-' + Date.now() + '-' + i,
        name: file.name,
        originalSrc: src,
        warpedCanvas,
        cropPoints: det.corners,
        processedCanvas: processed,
        previewUrl,
        thumbnailUrl,
        adjustments: initialAdj,
        history: [initialAdj],
        historyIndex: 0,
      });
    }

    const nextActiveIndex = pages.length;
    setPages((prev) => [...prev, ...newPages]);
    setActivePageIndex(nextActiveIndex);
    showToast(`✓ Detected as Document · Auto cropped (${newPages.length} page${newPages.length > 1 ? 's' : ''})`);

    if (newPages.length > 0 && newPages[0].processedCanvas) {
      const firstW = newPages[0].processedCanvas.width;
      const firstH = newPages[0].processedCanvas.height;
      setTimeout(() => {
        fitCanvasToScreen(firstW, firstH);
      }, 50);
    }

    e.target.value = '';
  };

  // Drag and drop support - detects as document and auto-crops immediately
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newPages: DocumentPage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const src = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });

      const img = await loadImage(src);
      const canvas = createOptimizedCanvas(img, 2400);

      // 1. Detect as document
      const det = await detectDocument(canvas);
      let warpedCanvas = canvas;
      const area = calculateQuadArea(det.corners);

      // 2. If a document is detected inside the image, auto-crop immediately!
      if (det.success && area >= 0.08 && area <= 0.98) {
        try {
          warpedCanvas = await applyRealPerspectiveWarp(canvas, det.corners);
        } catch {
          warpedCanvas = canvas;
        }
      }

      const initialAdj = createDefaultAdjustments('normal');
      const processed = processDocumentImage(warpedCanvas, initialAdj);
      const { previewUrl, thumbnailUrl } = createPageCachedUrls(processed);

      newPages.push({
        id: 'page-' + Date.now() + '-' + i,
        name: file.name,
        originalSrc: src,
        warpedCanvas,
        cropPoints: det.corners,
        processedCanvas: processed,
        previewUrl,
        thumbnailUrl,
        adjustments: initialAdj,
        history: [initialAdj],
        historyIndex: 0,
      });
    }

    if (newPages.length > 0) {
      const nextActiveIndex = pages.length;
      setPages((prev) => [...prev, ...newPages]);
      setActivePageIndex(nextActiveIndex);
      showToast(`✓ Detected as Document · Auto cropped (${newPages.length} dropped page(s))`);

      if (newPages[0].processedCanvas) {
        const firstW = newPages[0].processedCanvas.width;
        const firstH = newPages[0].processedCanvas.height;
        setTimeout(() => {
          fitCanvasToScreen(firstW, firstH);
        }, 50);
      }
    }
  };

  // Delete page
  const handleDeletePage = (index: number) => {
    setPages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0) {
        setActivePageIndex(Math.min(activePageIndex, updated.length - 1));
      }
      return updated;
    });
  };

  // Print & Download actions
  const handlePrint = () => {
    if (pages.length === 0) return;
    setIsPrintModalOpen(true);
  };

  const handleExecuteDirectPrint = () => {
    window.print();
  };

  const handleUpdatePageLayout = (pageIndex: number, layout: PrintLayoutSettings) => {
    setPages((prev) =>
      prev.map((pg, idx) => (idx === pageIndex ? { ...pg, printLayout: layout } : pg))
    );
  };

  const handleApplyLayoutToAll = (layout: PrintLayoutSettings) => {
    setPages((prev) =>
      prev.map((pg) => ({ ...pg, printLayout: { ...layout } }))
    );
    showToast('✓ Applied layout to all pages');
  };

  const handleDownloadFormat = async (format: 'pdf' | 'jpg' | 'png') => {
    setIsDownloadMenuOpen(false);
    if (pages.length === 0) return;

    if (format === 'pdf') {
      const canvasesToExport = pages
        .map((p) => p.processedCanvas || p.warpedCanvas)
        .filter((c): c is HTMLCanvasElement => !!c);
      const layouts = pages.map((p) => p.printLayout);
      showToast('Exporting 300 DPI PDF...');
      await exportCanvasesToPdf(canvasesToExport, 'A4_Document_Print_Ready.pdf', layouts);
      showToast('✓ PDF Downloaded');
    } else {
      if (!activePage) return;
      const canvas = activePage.processedCanvas || activePage.warpedCanvas;
      if (canvas) {
        const baseName = activePage.name.replace(/\.[^/.]+$/, '');
        if (format === 'jpg') {
          downloadCanvasImage(canvas, `${baseName}_Print.jpg`, 'jpeg');
          showToast('✓ JPG Image Downloaded');
        } else {
          downloadCanvasImage(canvas, `${baseName}_Print.png`, 'png');
          showToast('✓ PNG Image Downloaded');
        }
      }
    }
  };

  const handleDownloadPdf = async () => {
    await handleDownloadFormat('pdf');
  };

  const handleDownloadImage = () => {
    handleDownloadFormat('png');
  };

  // Mouse pan dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (pages.length === 0) return;
    if (e.button !== 0 && e.button !== 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (!activePage) return;
    if (Math.abs(scale - 1.0) < 0.05) {
      fitToScreen();
    } else {
      setScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const canUndo = activePage ? activePage.historyIndex > 0 : false;
  const canRedo = activePage ? activePage.historyIndex < activePage.history.length - 1 : false;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="h-screen w-screen bg-[#f2f7f4] text-[#11281d] flex flex-col font-sans select-none overflow-hidden overscroll-none"
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* TOP HEADER BAR */}
      <header className="w-full bg-[#f8fbf9] border-b border-[#d8eadd] px-5 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs shrink-0">
        {/* Left: Document Print Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shadow-xs">
            <svg
              className="w-5 h-5 text-emerald-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0f241a] tracking-tight">Document Print</h1>
            <p className="text-xs text-[#52796f]">All kind of documents print ready.</p>
          </div>
        </div>

        {/* Center: Action Buttons (Undo, Redo, Rotate, Split) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="w-9 h-9 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-[#1c3a2c] disabled:opacity-40 shadow-2xs transition cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="w-9 h-9 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-[#1c3a2c] disabled:opacity-40 shadow-2xs transition cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleRotate}
            disabled={!activePage}
            className="w-9 h-9 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-[#1c3a2c] disabled:opacity-40 shadow-2xs transition cursor-pointer"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowCompare((c) => !c)}
            disabled={!activePage}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-2xs transition cursor-pointer disabled:opacity-40 ${
              showCompare
                ? 'bg-[#065f46] text-white border-[#065f46]'
                : 'bg-white border-[#cbe1d3] text-[#1c3a2c] hover:bg-slate-50'
            }`}
            title="Toggle Split / Compare View"
          >
            <Columns2 className="w-4 h-4" />
          </button>

          {/* Subtle Dev Trigger: Crop Learning System (Ctrl+Shift+L) */}
          <button
            onClick={() => setIsLearningDashboardOpen(true)}
            className="w-9 h-9 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-[#52796f] hover:text-[#064e3b] shadow-2xs transition cursor-pointer"
            title="Auto-Crop Learning System (Dev Panel - Ctrl+Shift+L)"
          >
            <Brain className="w-4 h-4 text-emerald-700" />
          </button>
        </div>

        {/* Right: Print, PDF download, Download Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            disabled={pages.length === 0}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-[#cbe1d3] text-[#11281d] px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition active:scale-98 disabled:opacity-40 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#11281d]" />
            <span>Print</span>
          </button>

          {/* Unified Single Download Button with Format Dropdown (PDF, JPG, PNG) */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
              disabled={pages.length === 0}
              className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition active:scale-98 disabled:opacity-40 cursor-pointer"
              title="Download as PDF, JPG, or PNG"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isDownloadMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDownloadMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-[#cbe1d3] shadow-xl p-1.5 z-50 animate-fade-in">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#52796f]">
                  Choose Download Format
                </div>

                {/* PDF Option */}
                <button
                  onClick={() => handleDownloadFormat('pdf')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-[#f2f7f4] transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs border border-red-200 shrink-0">
                    PDF
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#0f241a] group-hover:text-[#16a34a]">
                      PDF Document (.pdf)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Print-ready 300 DPI (all {pages.length} page{pages.length > 1 ? 's' : ''})
                    </span>
                  </div>
                </button>

                {/* JPG Option */}
                <button
                  onClick={() => handleDownloadFormat('jpg')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-[#f2f7f4] transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 shrink-0">
                    JPG
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#0f241a] group-hover:text-[#16a34a]">
                      JPG Photo (.jpg)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Standard compressed image
                    </span>
                  </div>
                </button>

                {/* PNG Option */}
                <button
                  onClick={() => handleDownloadFormat('png')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-[#f2f7f4] transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200 shrink-0">
                    PNG
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#0f241a] group-hover:text-[#16a34a]">
                      PNG Image (.png)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      High-resolution lossless image
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN THREE-COLUMN WORKSPACE */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 md:p-4 flex gap-4 overflow-hidden min-h-0">
        {/* LEFT COLUMN: PAGE THUMBNAILS STRIP */}
        <aside className="w-24 shrink-0 flex flex-col items-center justify-between pb-1">
          <div className="flex flex-col items-center gap-3 w-full overflow-y-auto max-h-[82vh] pr-0.5">
            {/* Dashed Add Page Box */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#16a34a] bg-white/80 hover:bg-emerald-50/70 flex items-center justify-center transition group shadow-2xs cursor-pointer"
              title="Add document page or scan (or drag & drop here)"
            >
              <Plus className="w-7 h-7 text-[#16a34a] group-hover:scale-110 transition-transform" />
            </button>

            {/* Document Page Thumbnails using cached thumbnail URLs */}
            {pages.map((pg, idx) => {
              const isActive = idx === activePageIndex;
              return (
                <div
                  key={pg.id}
                  onClick={() => {
                    setActivePageIndex(idx);
                    setTimeout(() => {
                      if (pg.processedCanvas) {
                        fitCanvasToScreen(pg.processedCanvas.width, pg.processedCanvas.height);
                      }
                    }, 50);
                  }}
                  className={`group relative w-20 h-24 rounded-xl bg-white overflow-hidden shadow-xs cursor-pointer border-2 transition ${
                    isActive
                      ? 'border-[#15803d] ring-2 ring-emerald-500/25'
                      : 'border-[#cbe1d3] hover:border-emerald-400'
                  }`}
                >
                  {pg.thumbnailUrl || pg.previewUrl ? (
                    <img
                      src={pg.thumbnailUrl || pg.previewUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-cover p-0.5 pointer-events-none select-none"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                      Page {idx + 1}
                    </div>
                  )}

                  {/* Red Circular Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(idx);
                    }}
                    className="w-4 h-4 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-[10px] font-bold absolute top-1 right-1 cursor-pointer hover:scale-115 shadow transition"
                    title="Delete Page"
                  >
                    <X className="w-3 h-3 stroke-[3]" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom Thumbnails Scroll Indicator */}
          <div className="flex items-center justify-center gap-1 w-full pt-1">
            <div className="flex items-center justify-between w-18 px-1.5 py-0.5 rounded-full bg-[#e1eee6] border border-[#cbe1d3] text-[#52796f] text-[10px]">
              <span className="cursor-pointer font-bold">&lt;</span>
              <div className="w-8 h-1 bg-[#8fa99b] rounded-full" />
              <span className="cursor-pointer font-bold">&gt;</span>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: MAIN DOCUMENT VIEWPORT */}
        <section className="flex-1 flex flex-col items-center min-w-0 min-h-0 h-full">
          {/* Main Canvas Viewport Container */}
          <div
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            className={`w-full flex-1 rounded-2xl bg-[#e8f2ec] border border-[#d2e7db] relative flex items-center justify-center overflow-hidden min-h-0 ${
              activePage ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {/* Real-time Toast Feedback Badge */}
            {feedbackMsg && (
              <div className="absolute top-4 z-40 bg-[#064e3b] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-emerald-400/40 animate-fade-in pointer-events-none">
                {feedbackMsg}
              </div>
            )}

            {activePage?.processedCanvas && activePage?.previewUrl ? (
              <div
                ref={paperRef}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.04s ease-out',
                }}
                className="flex items-center justify-center pointer-events-none select-none"
              >
                {showCompare ? (
                  // Split / Comparison View
                  <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-2xl border border-slate-300">
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-semibold text-slate-500 mb-1">Original Scan</span>
                      <img
                        src={activePage.originalSrc}
                        alt="Original"
                        style={{
                          width: `${activePage.processedCanvas.width}px`,
                          height: `${activePage.processedCanvas.height}px`,
                          maxWidth: 'none',
                          maxHeight: 'none',
                          display: 'block',
                        }}
                        className="object-contain border border-slate-200"
                      />
                    </div>
                    <div className="h-full w-px bg-slate-300 self-stretch" />
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-semibold text-emerald-700 mb-1">Processed</span>
                      <img
                        src={activePage.previewUrl}
                        alt="Processed"
                        style={{
                          width: `${activePage.processedCanvas.width}px`,
                          height: `${activePage.processedCanvas.height}px`,
                          maxWidth: 'none',
                          maxHeight: 'none',
                          display: 'block',
                        }}
                        className="object-contain border border-slate-200"
                      />
                    </div>
                  </div>
                ) : (
                  // Single Document Sheet: Render cached preview URL at exact resolution
                  <div className="relative bg-white shadow-2xl rounded-xs overflow-hidden flex items-center justify-center border border-slate-300">
                    <img
                      src={activePage.previewUrl}
                      alt={activePage.name}
                      style={{
                        width: `${activePage.processedCanvas.width}px`,
                        height: `${activePage.processedCanvas.height}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        display: 'block',
                      }}
                      className="pointer-events-none select-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              // Clean Empty State Dropzone (When no document is loaded)
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center text-center p-8 bg-white/70 hover:bg-white border-2 border-dashed border-[#16a34a]/60 hover:border-[#16a34a] rounded-2xl shadow-xs cursor-pointer transition max-w-md group"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-emerald-200">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-[#11281d] mb-1">
                  Upload or Drop Document Here
                </h3>
                <p className="text-xs text-[#52796f] mb-3">
                  Upload Birth Certificates, NID Cards, Passports, or Scans
                </p>
                <button
                  type="button"
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Choose Document Image
                </button>
              </div>
            )}
          </div>

          {/* Bottom Zoom & View Controls */}
          <div className="w-full flex items-center justify-between pt-2 px-2 text-xs shrink-0">
            {/* Left Controls: Minus, Plus, Reset View */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newScale = Math.max(0.1, Number((scale * 0.85).toFixed(3)));
                  setScale(newScale);
                }}
                disabled={!activePage}
                className="w-8 h-8 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-[#1c3a2c] disabled:opacity-40 shadow-2xs transition active:scale-95 cursor-pointer"
                title="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  const newScale = Math.min(4.0, Number((scale * 1.15).toFixed(3)));
                  setScale(newScale);
                }}
                disabled={!activePage}
                className="w-8 h-8 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 flex items-center justify-center text-[#1c3a2c] disabled:opacity-40 shadow-2xs transition active:scale-95 cursor-pointer"
                title="Zoom In"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  fitToScreen();
                  showToast('View reset to fit screen');
                }}
                disabled={!activePage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#cbe1d3] hover:bg-slate-50 text-[#1c3a2c] text-xs font-semibold disabled:opacity-40 shadow-2xs transition active:scale-95 ml-1 cursor-pointer"
                title="Reset View to Fit Screen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset view</span>
              </button>
            </div>

            {/* Right Status */}
            <div className="flex items-center gap-2 text-xs text-[#52796f] font-medium font-mono">
              <span className="hidden md:inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-[#064e3b] border border-emerald-300 text-[10px] font-bold">
                {activePage?.adjustments.upscale === 4
                  ? 'Upscale: Best (4x)'
                  : activePage?.adjustments.upscale === 2
                  ? 'Upscale: Good (2x)'
                  : 'Resolution: Native (1x)'}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-emerald-50 text-[#064e3b] border border-emerald-200 text-[10px] font-bold tracking-tight">
                {activePage?.printLayout?.pageSize === 'Legal'
                  ? 'Legal Scale: 216 × 356 mm (8.5 × 14 in)'
                  : 'A4 Scale: 210 × 297 mm (8.27 × 11.69 in)'}
              </span>
              <span>
                {activePage ? `${scale.toFixed(2)}x · mouse wheel to zoom` : 'Ready'}
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: CONTROL PANELS */}
        <aside className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
          {/* CARD 1: CROP */}
          <div className="bg-[#f4f9f6] border border-[#d2e7db] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1e3a2f] flex items-center">
              <span className="text-[#0d9488] font-black mr-1.5">|</span> CROP
            </h3>

            {/* Auto crop Button */}
            <button
              onClick={handleAutoCrop}
              disabled={!activePage}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-40 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-xs transition active:scale-98 cursor-pointer"
            >
              <Crop className="w-4 h-4" />
              <span>Auto crop</span>
            </button>

            {/* Manual crop Button */}
            <button
              onClick={() => setIsManualCropOpen(true)}
              disabled={!activePage}
              className="w-full bg-white hover:bg-slate-50 disabled:opacity-40 border border-[#c2e1d0] text-[#1e3a2f] font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-2xs transition active:scale-98 cursor-pointer"
            >
              <Crop className="w-4 h-4 text-[#1e3a2f]" />
              <span>Manual crop</span>
            </button>
          </div>

          {/* CARD 2: RESOLUTION / UPSCALE (Default: 1x Native - Never Auto Upscaled) */}
          <div className="bg-[#f4f9f6] border border-[#d2e7db] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1e3a2f] flex items-center">
                <span className="text-[#0d9488] font-black mr-1.5">|</span> RESOLUTION
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#16a34a] text-white">
                {activePage?.adjustments.upscale === 4
                  ? '4x Best'
                  : activePage?.adjustments.upscale === 2
                  ? '2x Good'
                  : '1x Native'}
              </span>
            </div>

            {/* 3 options: 1x (Native Default), 2x (Good), 4x (Best) */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleSelectUpscale(1)}
                disabled={!activePage}
                className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer disabled:opacity-40 flex flex-col items-center justify-center gap-0.5 ${
                  (activePage?.adjustments.upscale ?? 1) === 1
                    ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-xs'
                    : 'bg-white border-[#c2e1d0] text-[#1e3a2f] hover:bg-emerald-50/50'
                }`}
                title="Native: Exact original image resolution without upscaling (Default)"
              >
                <span className="text-xs font-black">1x</span>
                <span className={`text-[9px] ${(activePage?.adjustments.upscale ?? 1) === 1 ? 'text-emerald-100' : 'text-slate-500'}`}>
                  Native
                </span>
              </button>

              <button
                onClick={() => handleSelectUpscale(2)}
                disabled={!activePage}
                className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer disabled:opacity-40 flex flex-col items-center justify-center gap-0.5 ${
                  activePage?.adjustments.upscale === 2
                    ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-xs'
                    : 'bg-white border-[#c2e1d0] text-[#1e3a2f] hover:bg-emerald-50/50'
                }`}
                title="Good: 2x High-Definition Upscale"
              >
                <div className="flex items-center gap-0.5">
                  <Zap className={`w-3 h-3 ${activePage?.adjustments.upscale === 2 ? 'text-amber-300' : 'text-amber-500'}`} />
                  <span className="text-xs font-black">2x</span>
                </div>
                <span className={`text-[9px] ${activePage?.adjustments.upscale === 2 ? 'text-emerald-100' : 'text-slate-500'}`}>
                  Good
                </span>
              </button>

              <button
                onClick={() => handleSelectUpscale(4)}
                disabled={!activePage}
                className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer disabled:opacity-40 flex flex-col items-center justify-center gap-0.5 ${
                  activePage?.adjustments.upscale === 4
                    ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-xs'
                    : 'bg-white border-[#c2e1d0] text-[#1e3a2f] hover:bg-emerald-50/50'
                }`}
                title="Best: 4x Ultra-HD Super-Resolution"
              >
                <div className="flex items-center gap-0.5">
                  <Zap className={`w-3 h-3 ${activePage?.adjustments.upscale === 4 ? 'text-amber-300' : 'text-amber-500'}`} />
                  <span className="text-xs font-black">4x</span>
                </div>
                <span className={`text-[9px] ${activePage?.adjustments.upscale === 4 ? 'text-emerald-100' : 'text-slate-500'}`}>
                  Best
                </span>
              </button>
            </div>
          </div>

          {/* CARD 3: MODE */}
          <div className="bg-[#f4f9f6] border border-[#d2e7db] rounded-2xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1e3a2f] flex items-center">
              <span className="text-[#0d9488] font-black mr-1.5">|</span> MODE
            </h3>

            {/* 4 Mode Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleModeSelect('normal')}
                disabled={!activePage}
                className={`w-full py-2.5 rounded-xl text-xs font-medium text-center transition cursor-pointer disabled:opacity-40 ${
                  activePage?.adjustments.mode === 'normal'
                    ? 'bg-[#065f46] text-white font-semibold shadow-xs'
                    : 'bg-white border border-[#c2e1d0] text-[#1e3a2f] hover:bg-slate-50'
                }`}
              >
                Normal (original)
              </button>

              <button
                onClick={() => handleModeSelect('bw')}
                disabled={!activePage}
                className={`w-full py-2.5 rounded-xl text-xs font-medium text-center transition cursor-pointer disabled:opacity-40 ${
                  activePage?.adjustments.mode === 'bw'
                    ? 'bg-[#065f46] text-white font-semibold shadow-xs'
                    : 'bg-white border border-[#c2e1d0] text-[#1e3a2f] hover:bg-slate-50'
                }`}
              >
                Black & White
              </button>

              <button
                onClick={() => handleModeSelect('grayscale')}
                disabled={!activePage}
                className={`w-full py-2.5 rounded-xl text-xs font-medium text-center transition cursor-pointer disabled:opacity-40 ${
                  activePage?.adjustments.mode === 'grayscale'
                    ? 'bg-[#065f46] text-white font-semibold shadow-xs'
                    : 'bg-white border border-[#c2e1d0] text-[#1e3a2f] hover:bg-slate-50'
                }`}
              >
                Grayscale (Removes Background)
              </button>

              <button
                onClick={() => handleModeSelect('color')}
                disabled={!activePage}
                className={`w-full py-2.5 rounded-xl text-xs font-medium text-center transition cursor-pointer disabled:opacity-40 ${
                  activePage?.adjustments.mode === 'color'
                    ? 'bg-[#065f46] text-white font-semibold shadow-xs'
                    : 'bg-white border border-[#c2e1d0] text-[#1e3a2f] hover:bg-slate-50'
                }`}
              >
                Color
              </button>
            </div>
          </div>

          {/* CARD 4: ADJUSTMENTS */}
          <div className="bg-[#f4f9f6] border border-[#d2e7db] rounded-2xl p-3.5 flex flex-col gap-3 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1e3a2f] flex items-center">
              <span className="text-[#0d9488] font-black mr-1.5">|</span> ADJUSTMENTS
            </h3>

            {/* Black Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-[#1c3a2c]">
                <span>Black</span>
                <span className="font-mono">{activePage?.adjustments.black ?? 100}</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                disabled={!activePage}
                value={activePage?.adjustments.black ?? 100}
                onChange={(e) => handleSliderChange('black', parseInt(e.target.value))}
                className="slider-black cursor-pointer disabled:opacity-40"
              />
            </div>

            {/* Color Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-[#1c3a2c]">
                <span>Color</span>
                <span className="font-mono">{activePage?.adjustments.color ?? 0}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                disabled={!activePage}
                value={activePage?.adjustments.color ?? 0}
                onChange={(e) => handleSliderChange('color', parseInt(e.target.value))}
                className="slider-teal cursor-pointer disabled:opacity-40"
              />
            </div>

            {/* Contrast Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-[#1c3a2c]">
                <span>Contrast</span>
                <span className="font-mono">{activePage?.adjustments.contrast ?? 0}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                disabled={!activePage}
                value={activePage?.adjustments.contrast ?? 0}
                onChange={(e) => handleSliderChange('contrast', parseInt(e.target.value))}
                className="slider-teal cursor-pointer disabled:opacity-40"
              />
            </div>
          </div>
        </aside>
      </main>

      {/* Manual Perspective Crop Modal */}
      {isManualCropOpen && activePage && (
        <CropModal
          imageSrc={activePage.originalSrc}
          initialCrop={activePage.cropPoints}
          title="Manual Crop - 4 Corners (৪ কোণা টেনে সোজা করুন)"
          onApply={handleManualCropApply}
          onCancel={() => setIsManualCropOpen(false)}
        />
      )}

      {/* Developer Crop Learning Dashboard (Ctrl+Shift+L) */}
      <CropLearningDashboard
        isOpen={isLearningDashboardOpen}
        onClose={() => setIsLearningDashboardOpen(false)}
      />

      {/* Interactive A4 Print Page Modal with Resize and Free Rotate */}
      <PrintPageModal
        isOpen={isPrintModalOpen}
        pages={pages}
        activePageIndex={activePageIndex}
        onClose={() => setIsPrintModalOpen(false)}
        onUpdatePageLayout={handleUpdatePageLayout}
        onApplyLayoutToAll={handleApplyLayoutToAll}
        onPrint={handleExecuteDirectPrint}
      />

      {/* Hidden Print Container for exact physical printing (A4 or Legal) */}
      <div id="print-only-container">
        {pages.map((pg, sIdx) => {
          const canvas = pg.processedCanvas || pg.warpedCanvas;
          if (!canvas) return null;
          const layout = pg.printLayout || DEFAULT_PRINT_LAYOUT;
          const isLegal = layout.pageSize === 'Legal';
          const printW = isLegal ? '215.9mm' : '210mm';
          const printH = isLegal ? '355.6mm' : '297mm';
          return (
            <div
              key={sIdx}
              className={`print-page-break ${isLegal ? 'print-legal' : 'print-a4'}`}
              style={{
                width: printW,
                height: printH,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              <img
                src={pg.previewUrl || canvas.toDataURL('image/jpeg', 0.95)}
                alt=""
                style={{
                  position: 'absolute',
                  left: `${layout.x}%`,
                  top: `${layout.y}%`,
                  width: `${layout.widthPercent}%`,
                  transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
                  transformOrigin: 'center center',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
