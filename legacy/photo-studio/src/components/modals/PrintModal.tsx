import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  X,
  FileText,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Trash2,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Info,
  Layers,
  Sparkles,
  Pipette,
} from 'lucide-react';
import { ImageItem } from '../../types/editor';
import { renderCompositeCanvas, loadImage } from '../../utils/canvas';
import {
  findPassportSpecification,
  printEngine,
  PAPER_SIZES,
  PaperSizeKey,
  PrintPhotoItem,
  PageSettings,
  DEFAULT_PAGE_SETTINGS,
  arrangePhotoItems,
  PHOTO_PRESETS,
} from '../../cv';

interface PrintModalProps {
  activeImage: ImageItem;
  images?: ImageItem[];
  isOpen: boolean;
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  activeImage,
  images = [],
  isOpen,
  onClose,
}) => {
  // Paper & Orientation
  const [paperKey, setPaperKey] = useState<PaperSizeKey>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  // Page Settings from Reference UI
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);

  // Layout Items on the Paper
  const [items, setItems] = useState<PrintPhotoItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Zoom & Viewport scale
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [autoFitScale, setAutoFitScale] = useState<number>(3.0); // displayPixelsPerMm

  // Export States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingJpg, setIsExportingJpg] = useState(false);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; itemX: number; itemY: number; id: string } | null>(null);

  // Workspace container ref for auto-fit calculation
  const workspaceContainerRef = useRef<HTMLDivElement>(null);

  // Workspace background panning state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ scrollLeft: number; scrollTop: number; clientX: number; clientY: number } | null>(null);

  // Source composite canvases cache
  const sourceCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [canvasesReady, setCanvasesReady] = useState(false);

  // All available images
  const allImages = useMemo(() => {
    if (images && images.length > 0) {
      // Ensure activeImage is at the front
      const others = images.filter((img) => img.id !== activeImage.id);
      return [activeImage, ...others];
    }
    return [activeImage];
  }, [images, activeImage]);

  // Paper physical dimensions
  const paperDef = PAPER_SIZES[paperKey] || PAPER_SIZES['a4'];
  const paperWidthMm = orientation === 'portrait'
    ? Math.min(paperDef.widthMm, paperDef.heightMm)
    : Math.max(paperDef.widthMm, paperDef.heightMm);
  const paperHeightMm = orientation === 'portrait'
    ? Math.max(paperDef.widthMm, paperDef.heightMm)
    : Math.min(paperDef.widthMm, paperDef.heightMm);

  // Calculate base display scale (pixels per mm)
  const displayScale = (autoFitScale * zoomPercent) / 100;

  // Active passport specification
  const activeSpec = findPassportSpecification(activeImage.passport?.standard);

  // Compute composite canvases for all images
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const buildCanvases = async () => {
      const map = new Map<string, HTMLCanvasElement>();

      for (const imgItem of allImages) {
        try {
          const imgEl = await loadImage(imgItem.currentUrl);
          if (isCancelled) return;
          const canvas = renderCompositeCanvas(imgEl, imgItem);
          map.set(imgItem.id, canvas);
        } catch (err) {
          console.warn('Failed to render composite for', imgItem.id, err);
        }
      }

      if (!isCancelled) {
        sourceCanvasesRef.current = map;
        setCanvasesReady(true);
      }
    };

    buildCanvases();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, allImages]);

  // Initial layout setup when opening: default 2 PP copies for the active photo (matching reference screenshot)
  useEffect(() => {
    if (!isOpen) return;

    const ppDim = pageSettings.wide ? PHOTO_PRESETS.ppWide : PHOTO_PRESETS.ppStandard;
    const initialItems: PrintPhotoItem[] = [
      {
        id: `pp-${activeImage.id}-0`,
        sourceImageId: activeImage.id,
        photoType: 'pp',
        name: ppDim.label,
        widthMm: ppDim.widthMm,
        heightMm: ppDim.heightMm,
        xMm: 0,
        yMm: 0,
      },
      {
        id: `pp-${activeImage.id}-1`,
        sourceImageId: activeImage.id,
        photoType: 'pp',
        name: ppDim.label,
        widthMm: ppDim.widthMm,
        heightMm: ppDim.heightMm,
        xMm: 0,
        yMm: 0,
      },
    ];

    const arranged = arrangePhotoItems(initialItems, pageSettings, paperWidthMm, paperHeightMm);
    setItems(arranged);
  }, [isOpen, activeImage.id]);

  // Auto-fit paper into workspace viewport
  const handleAutoFit = useCallback(() => {
    if (!workspaceContainerRef.current) return;
    const { clientWidth, clientHeight } = workspaceContainerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    // Available space accounting for padding and rulers
    const availableW = clientWidth - 80;
    const availableH = clientHeight - 80;

    const scaleX = availableW / paperWidthMm;
    const scaleY = availableH / paperHeightMm;
    const optimalScale = Math.max(0.5, Math.min(scaleX, scaleY, 4.0));

    setAutoFitScale(optimalScale);
    setZoomPercent(100);

    // Reset scroll smoothly to top-left
    workspaceContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [paperWidthMm, paperHeightMm]);

  // Recalculate auto-fit when paper or orientation changes or on open
  useEffect(() => {
    if (isOpen) {
      // Allow DOM to layout
      const timer = setTimeout(() => {
        handleAutoFit();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, paperKey, orientation, handleAutoFit]);

  // Mouse wheel zoom support with Ctrl / Meta key
  useEffect(() => {
    if (!isOpen) return;
    const el = workspaceContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomPercent((prev) => Math.max(30, Math.min(300, prev + delta)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  // Keyboard shortcut: Ctrl+P or Cmd+P to print
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          handleRemoveSelectedItem();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItemId, items]);

  // Update layout when PageSettings or Paper changes
  const applySettingsToItems = (newSettings: PageSettings, currentItems: PrintPhotoItem[]) => {
    // If wide setting changed, update PP dimensions
    const ppDim = newSettings.wide ? PHOTO_PRESETS.ppWide : PHOTO_PRESETS.ppStandard;
    const updated = currentItems.map((it) => {
      if (it.photoType === 'pp') {
        return {
          ...it,
          widthMm: ppDim.widthMm,
          heightMm: ppDim.heightMm,
          name: ppDim.label,
        };
      }
      return it;
    });

    const arranged = arrangePhotoItems(updated, newSettings, paperWidthMm, paperHeightMm);
    setItems(arranged);
  };

  // Stepper handlers for Photos & Copies
  const getPhotoCopyCounts = (imageId: string) => {
    const ppCount = items.filter((it) => it.sourceImageId === imageId && it.photoType === 'pp').length;
    const stCount = items.filter((it) => it.sourceImageId === imageId && it.photoType === 'st').length;
    return { ppCount, stCount };
  };

  const handleAddCopy = (imageId: string, type: 'pp' | 'st') => {
    const isPp = type === 'pp';
    const ppDim = pageSettings.wide ? PHOTO_PRESETS.ppWide : PHOTO_PRESETS.ppStandard;
    const widthMm = isPp ? ppDim.widthMm : PHOTO_PRESETS.stStandard.widthMm;
    const heightMm = isPp ? ppDim.heightMm : PHOTO_PRESETS.stStandard.heightMm;
    const name = isPp ? ppDim.label : PHOTO_PRESETS.stStandard.label;

    const newItem: PrintPhotoItem = {
      id: `${type}-${imageId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sourceImageId: imageId,
      photoType: type,
      name,
      widthMm,
      heightMm,
      xMm: 0,
      yMm: 0,
    };

    const nextItems = [...items, newItem];
    const arranged = arrangePhotoItems(nextItems, pageSettings, paperWidthMm, paperHeightMm);
    setItems(arranged);
  };

  const handleRemoveCopy = (imageId: string, type: 'pp' | 'st') => {
    // Find last item matching imageId and type
    let lastIndex = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].sourceImageId === imageId && items[i].photoType === type) {
        lastIndex = i;
        break;
      }
    }

    if (lastIndex >= 0) {
      const nextItems = items.filter((_, idx) => idx !== lastIndex);
      const arranged = arrangePhotoItems(nextItems, pageSettings, paperWidthMm, paperHeightMm);
      setItems(arranged);
      if (selectedItemId === items[lastIndex].id) {
        setSelectedItemId(null);
      }
    }
  };

  const handleResetImageCopies = (imageId: string) => {
    const nextItems = items.filter((it) => it.sourceImageId !== imageId);
    const arranged = arrangePhotoItems(nextItems, pageSettings, paperWidthMm, paperHeightMm);
    setItems(arranged);
    setSelectedItemId(null);
  };

  const handleFillPage = (imageId: string) => {
    const ppDim = pageSettings.wide ? PHOTO_PRESETS.ppWide : PHOTO_PRESETS.ppStandard;
    const perRow = pageSettings.perRow;
    const availableHeight = paperHeightMm - pageSettings.topMarginMm * 2;
    const maxRows = Math.max(1, Math.floor((availableHeight + pageSettings.gapMm) / (ppDim.heightMm + pageSettings.gapMm)));
    const totalToFill = perRow * maxRows;

    const newItems: PrintPhotoItem[] = [];
    for (let i = 0; i < totalToFill; i++) {
      newItems.push({
        id: `pp-${imageId}-${Date.now()}-${i}`,
        sourceImageId: imageId,
        photoType: 'pp',
        name: ppDim.label,
        widthMm: ppDim.widthMm,
        heightMm: ppDim.heightMm,
        xMm: 0,
        yMm: 0,
      });
    }

    const arranged = arrangePhotoItems(newItems, pageSettings, paperWidthMm, paperHeightMm);
    setItems(arranged);
  };

  const handleRemoveSelectedItem = () => {
    if (!selectedItemId) return;
    const nextItems = items.filter((it) => it.id !== selectedItemId);
    const arranged = arrangePhotoItems(nextItems, pageSettings, paperWidthMm, paperHeightMm);
    setItems(arranged);
    setSelectedItemId(null);
  };

  // Page Settings handlers
  const handleUpdateSetting = <K extends keyof PageSettings>(key: K, value: PageSettings[K]) => {
    const next = { ...pageSettings, [key]: value };
    if (key === 'gapPx') {
      // Keep gapMm in sync (approx 3.78 px per mm at 96 DPI)
      next.gapMm = parseFloat(((value as number) / 3.78).toFixed(1));
    } else if (key === 'gapMm') {
      next.gapPx = Math.round((value as number) * 3.78);
    }
    setPageSettings(next);
    applySettingsToItems(next, items);
  };

  const handleResetSettings = () => {
    setPageSettings(DEFAULT_PAGE_SETTINGS);
    applySettingsToItems(DEFAULT_PAGE_SETTINGS, items);
  };

  // Drag-and-drop interactive arrangement
  const handlePointerDownItem = (e: React.PointerEvent, item: PrintPhotoItem) => {
    e.stopPropagation();
    setSelectedItemId(item.id);
    isDraggingRef.current = true;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      itemX: item.xMm,
      itemY: item.yMm,
      id: item.id,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveItem = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const deltaX_px = e.clientX - dragStartRef.current.clientX;
    const deltaY_px = e.clientY - dragStartRef.current.clientY;

    const deltaX_mm = deltaX_px / displayScale;
    const deltaY_mm = deltaY_px / displayScale;

    const targetId = dragStartRef.current.id;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === targetId && dragStartRef.current) {
          const newX = Math.max(0, Math.min(paperWidthMm - it.widthMm, dragStartRef.current.itemX + deltaX_mm));
          const newY = Math.max(0, Math.min(paperHeightMm - it.heightMm, dragStartRef.current.itemY + deltaY_mm));
          return {
            ...it,
            xMm: parseFloat(newX.toFixed(2)),
            yMm: parseFloat(newY.toFixed(2)),
          };
        }
        return it;
      })
    );
  };

  const handlePointerUpItem = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  // Workspace background panning
  const handleWorkspacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking on a photo item or button, do not start background pan
    if ((e.target as HTMLElement).closest('[data-print-item]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setSelectedItemId(null);

    if (workspaceContainerRef.current) {
      setIsPanning(true);
      panStartRef.current = {
        scrollLeft: workspaceContainerRef.current.scrollLeft,
        scrollTop: workspaceContainerRef.current.scrollTop,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleWorkspacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current || !workspaceContainerRef.current) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    workspaceContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    workspaceContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleWorkspacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  };

  // Print & Export Actions
  const handlePrint = () => {
    printEngine.executeBrowserPrintItems(items, sourceCanvasesRef.current, {
      paperKey,
      paperWidthMm,
      paperHeightMm,
      showCutLines: pageSettings.measurement,
      measurementLines: false,
      borderEnabled: pageSettings.borderEnabled,
      borderColor: pageSettings.borderColor,
      borderWidthMm: pageSettings.borderWidthMm,
    });
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await printEngine.exportItemsToPdf(
        items,
        sourceCanvasesRef.current,
        {
          paperKey,
          paperWidthMm,
          paperHeightMm,
          showCutLines: pageSettings.measurement,
          borderEnabled: pageSettings.borderEnabled,
          borderColor: pageSettings.borderColor,
          borderWidthMm: pageSettings.borderWidthMm,
        },
        `shebaflow-print-sheet-${paperKey}-${items.length}photos.pdf`
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadJpg = async () => {
    setIsExportingJpg(true);
    try {
      const printCanvas = printEngine.renderItemsSheetCanvas(
        items,
        sourceCanvasesRef.current,
        {
          paperKey,
          paperWidthMm,
          paperHeightMm,
          dpi: 300,
          showCutLines: pageSettings.measurement,
          measurementLines: pageSettings.measurement,
          borderEnabled: pageSettings.borderEnabled,
          borderColor: pageSettings.borderColor,
          borderWidthMm: pageSettings.borderWidthMm,
        }
      );

      const link = document.createElement('a');
      link.download = `shebaflow-print-sheet-${paperKey}-300dpi.jpg`;
      link.href = printCanvas.toDataURL('image/jpeg', 0.98);
      link.click();
    } finally {
      setIsExportingJpg(false);
    }
  };

  if (!isOpen) return null;

  // Pixel dimensions of paper on screen
  const paperWidthPx = Math.round(paperWidthMm * displayScale);
  const paperHeightPx = Math.round(paperHeightMm * displayScale);

  // Ruler tick intervals in mm
  const rulerMaxXMm = Math.ceil(paperWidthMm);
  const rulerMaxYMm = Math.ceil(paperHeightMm);

  return (
    <div
      id="print-studio-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-[#0B1120] text-slate-200 select-none animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <header className="h-14 bg-[#111827] border-b border-[#1F2937] px-4 flex items-center justify-between z-30 shrink-0 shadow-md">
        {/* Left: Branding & Paper Selection */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Printer className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide leading-tight">Print Studio</h2>
              <p className="text-[10px] text-emerald-400 font-mono">Real Paper Layout • 300 DPI</p>
            </div>
          </div>

          {/* Paper Format Selector */}
          <div className="flex items-center gap-1.5 bg-[#1F2937] p-1 rounded-lg border border-slate-700">
            {(Object.keys(PAPER_SIZES) as PaperSizeKey[]).map((key) => {
              const p = PAPER_SIZES[key];
              const isSelected = paperKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setPaperKey(key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                  title={`${p.name} (${p.widthMm} × ${p.heightMm} mm)`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1F2937] hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-white transition-all"
            title="Rotate Paper Orientation"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="capitalize">{orientation}</span>
          </button>
        </div>

        {/* Center: Zoom & Viewport Controls */}
        <div className="flex items-center gap-1.5 bg-[#1F2937] p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setZoomPercent((z) => Math.max(30, z - 15))}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono font-medium text-slate-300 px-2 min-w-[50px] text-center">
            {zoomPercent}%
          </span>

          <button
            onClick={() => setZoomPercent((z) => Math.min(300, z + 15))}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            onClick={handleAutoFit}
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            title="Fit Sheet to Viewport"
          >
            Fit
          </button>

          <button
            onClick={() => setZoomPercent(100)}
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            title="Actual Screen Scale"
          >
            100%
          </button>
        </div>

        {/* Right: Export & Print Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 transition-all disabled:opacity-40"
            title="Export Vector PDF with Exact Physical Millimeters"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
          </button>

          {/* Download 300 DPI JPG */}
          <button
            onClick={handleDownloadJpg}
            disabled={isExportingJpg || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 transition-all disabled:opacity-40"
            title="Download 300 DPI High-Resolution Sheet for Photo Labs"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isExportingJpg ? 'Exporting...' : '300 DPI JPG'}</span>
          </button>

          {/* Send to Printer */}
          <button
            id="btn-send-to-printer"
            onClick={handlePrint}
            disabled={items.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-40"
            title="Send to Printer (Ctrl+P)"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>Print Sheet</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Close Print Studio (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Studio Body: Left Sidebar + Right Interactive Paper Workspace */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT SIDEBAR: PHOTOS & COPIES, PAGE SETTINGS, PRINT HELP */}
        <aside
          id="print-studio-left-sidebar"
          className="w-full md:w-80 lg:w-84 max-h-[35vh] md:max-h-none bg-[#131C2E] border-b md:border-b-0 md:border-r border-[#212F47] flex flex-col select-none shrink-0 z-20 overflow-y-auto overscroll-contain custom-scrollbar p-4 gap-4"
        >
          {/* 1. PHOTOS & COPIES SECTION */}
          <div className="flex flex-col gap-2.5 pb-4 border-b border-[#212F47]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                PHOTOS & COPIES
              </h3>
              <span className="text-[11px] font-mono font-medium text-emerald-400">
                {items.length} {items.length === 1 ? 'copy' : 'copies'} on sheet
              </span>
            </div>

            {/* List of Photos available to place */}
            <div className="flex flex-col gap-3">
              {allImages.map((img) => {
                const { ppCount, stCount } = getPhotoCopyCounts(img.id);
                const isSelected = selectedItemId && items.find((it) => it.id === selectedItemId)?.sourceImageId === img.id;

                return (
                  <div
                    key={img.id}
                    className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-slate-900/90 border-cyan-500/50 shadow-md shadow-cyan-950/20'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Header: Thumbnail + Photo Name */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-14 rounded-md overflow-hidden bg-slate-900 border border-slate-700 shrink-0 flex items-center justify-center shadow-inner">
                        <img
                          src={img.thumbnailUrl || img.currentUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-white block truncate">
                          {img.name || 'Passport Photo'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {activeSpec?.name || 'Standard Passport'}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => handleFillPage(img.id)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium hover:underline"
                            title="Auto-fill the page with this photo"
                          >
                            Fill Page
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            onClick={() => handleResetImageCopies(img.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-medium hover:underline"
                            title="Remove all copies of this photo"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* PP Copy Controls: PP [-] 2 [+] */}
                    <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-xs font-bold text-white font-mono">PP</span>
                        <span className="text-[10px] text-slate-400">
                          {pageSettings.wide ? '40×50mm' : '35×45mm'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRemoveCopy(img.id, 'pp')}
                          disabled={ppCount <= 0}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 flex items-center justify-center transition-all"
                          title="Decrease PP copies"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <span className="w-7 text-center font-mono text-xs font-bold text-emerald-400">
                          {ppCount}
                        </span>
                        <button
                          onClick={() => handleAddCopy(img.id, 'pp')}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all"
                          title="Increase PP copies"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* ST Copy Controls: ST [-] 0 [+] */}
                    <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-xs font-bold text-white font-mono">ST</span>
                        <span className="text-[10px] text-slate-400">20×25mm</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRemoveCopy(img.id, 'st')}
                          disabled={stCount <= 0}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 flex items-center justify-center transition-all"
                          title="Decrease ST copies"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <span className="w-7 text-center font-mono text-xs font-bold text-cyan-400">
                          {stCount}
                        </span>
                        <button
                          onClick={() => handleAddCopy(img.id, 'st')}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all"
                          title="Increase ST copies"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. PAGE SETTINGS SECTION (From Reference UI) */}
          <div className="flex flex-col gap-3 pb-4 border-b border-[#212F47]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                PAGE SETTINGS
              </h3>
              <button
                onClick={handleResetSettings}
                className="text-[11px] text-slate-400 hover:text-white font-medium hover:underline flex items-center gap-1"
                title="Reset layout settings to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Settings</span>
              </button>
            </div>

            {/* Per Row */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Per Row</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateSetting('perRow', Math.max(1, pageSettings.perRow - 1))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  -
                </button>
                <span className="w-6 text-center font-mono text-xs font-bold text-white">
                  {pageSettings.perRow}
                </span>
                <button
                  onClick={() => handleUpdateSetting('perRow', Math.min(10, pageSettings.perRow + 1))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Gap (px / mm) */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-slate-300 block">Gap</label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {pageSettings.gapPx} px ({pageSettings.gapMm} mm)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateSetting('gapPx', Math.max(0, pageSettings.gapPx - 5))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={pageSettings.gapPx}
                  onChange={(e) => handleUpdateSetting('gapPx', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 py-1 px-1 text-center bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                />
                <button
                  onClick={() => handleUpdateSetting('gapPx', Math.min(100, pageSettings.gapPx + 5))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Top Margin (mm) */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Top Margin (mm)</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateSetting('topMarginMm', Math.max(0, pageSettings.topMarginMm - 2))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={pageSettings.topMarginMm}
                  onChange={(e) => handleUpdateSetting('topMarginMm', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 py-1 px-1 text-center bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                />
                <button
                  onClick={() => handleUpdateSetting('topMarginMm', Math.min(80, pageSettings.topMarginMm + 2))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Left Margin (mm) */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Left Margin (mm)</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateSetting('leftMarginMm', Math.max(0, pageSettings.leftMarginMm - 2))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={pageSettings.leftMarginMm}
                  onChange={(e) => handleUpdateSetting('leftMarginMm', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 py-1 px-1 text-center bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white"
                />
                <button
                  onClick={() => handleUpdateSetting('leftMarginMm', Math.min(80, pageSettings.leftMarginMm + 2))}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Checkboxes: Center, Measurement (cut line), Wide (40×50mm) */}
            <div className="space-y-2 pt-1">
              {/* Center Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={pageSettings.center}
                  onChange={(e) => handleUpdateSetting('center', e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="font-medium">Center</span>
              </label>

              {/* Measurement (cut line) Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={pageSettings.measurement}
                  onChange={(e) => handleUpdateSetting('measurement', e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="font-medium">Measurement (cut line)</span>
              </label>

              {/* Wide (40×50mm) Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={pageSettings.wide}
                  onChange={(e) => handleUpdateSetting('wide', e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="font-medium">Wide (40×50mm)</span>
              </label>

              {/* Border Option with Color Select Option */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={pageSettings.borderEnabled}
                    onChange={(e) => handleUpdateSetting('borderEnabled', e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="font-medium">Photo Border</span>
                </label>

                {pageSettings.borderEnabled && (
                  <div className="pl-6 flex flex-col gap-2 pt-1 animate-in fade-in duration-150">
                    <span className="text-[11px] text-slate-400 font-medium">Border Color:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Black', hex: '#000000' },
                        { label: 'Light Gray', hex: '#CBD5E1' },
                        { label: 'Slate', hex: '#475569' },
                        { label: 'White', hex: '#FFFFFF' },
                        { label: 'Red', hex: '#EF4444' },
                        { label: 'Cyan', hex: '#06B6D4' },
                      ].map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => handleUpdateSetting('borderColor', swatch.hex)}
                          className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
                            pageSettings.borderColor?.toLowerCase() === swatch.hex.toLowerCase()
                              ? 'scale-110 ring-2 ring-emerald-400 border-white'
                              : 'border-slate-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                          title={`${swatch.label} (${swatch.hex})`}
                        >
                          {pageSettings.borderColor?.toLowerCase() === swatch.hex.toLowerCase() && (
                            <Check
                              className={`w-3 h-3 stroke-[3] ${
                                swatch.hex === '#FFFFFF' || swatch.hex === '#CBD5E1'
                                  ? 'text-slate-900'
                                  : 'text-white'
                              }`}
                            />
                          )}
                        </button>
                      ))}

                      {/* Custom Color Input */}
                      <label
                        className="w-6 h-6 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 relative overflow-hidden"
                        title="Pick Custom Color"
                      >
                        <Pipette className="w-3 h-3 text-cyan-400" />
                        <input
                          type="color"
                          value={pageSettings.borderColor || '#000000'}
                          onChange={(e) => handleUpdateSetting('borderColor', e.target.value)}
                          className="absolute opacity-0 w-0 h-0 cursor-pointer"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Color:</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-600 inline-block"
                          style={{ backgroundColor: pageSettings.borderColor }}
                        />
                        <span className="text-slate-300 font-bold">{pageSettings.borderColor}</span>
                      </div>
                    </div>

                    {/* Width Buttons */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 text-[11px] font-medium">Width:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { label: 'Thin (0.2mm)', mm: 0.2 },
                          { label: 'Normal (0.35mm)', mm: 0.35 },
                          { label: 'Thick (0.6mm)', mm: 0.6 },
                        ].map((bw) => (
                          <button
                            key={bw.label}
                            type="button"
                            onClick={() => handleUpdateSetting('borderWidthMm', bw.mm)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all border ${
                              Math.abs((pageSettings.borderWidthMm || 0.25) - bw.mm) < 0.05
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-bold'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {bw.label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selected Item Controls (if an item on the canvas is clicked) */}
          {selectedItemId && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-cyan-200 block">Selected Photo</span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {items.find((it) => it.id === selectedItemId)?.name}
                </span>
              </div>
              <button
                onClick={handleRemoveSelectedItem}
                className="flex items-center gap-1 py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition-all"
                title="Remove this copy"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          )}

          {/* 3. BOTTOM PRINT SHORTCUT & PRINTER SETUP INSTRUCTIONS */}
          <div className="mt-auto p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Printer Setup Guide:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              In your printer dialog, set scale to <strong>Actual Size (100%)</strong>. Disable <em>"Fit to Page"</em> so physical millimeters match scissors and lab dimensions exactly.
            </p>
            <span className="text-[10px] font-mono text-amber-400/80">
              Shortcut: <strong>Ctrl + P</strong>
            </span>
          </div>
        </aside>

        {/* RIGHT SIDE: LARGE WORKSPACE WITH TOP & LEFT RULERS AND WHITE PAPER CANVAS */}
        <div
          ref={workspaceContainerRef}
          id="print-studio-workspace"
          onPointerDown={handleWorkspacePointerDown}
          onPointerMove={handleWorkspacePointerMove}
          onPointerUp={handleWorkspacePointerUp}
          className={`flex-1 bg-[#1A2234] overflow-auto relative flex p-6 sm:p-8 select-none custom-scrollbar ${
            isPanning ? 'cursor-grabbing' : 'cursor-default'
          }`}
          style={{
            backgroundImage: 'radial-gradient(circle, #25334D 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            touchAction: 'pan-x pan-y',
          }}
        >
          {/* Paper and Rulers Container - m-auto ensures centered when small and zero-clipped when overflowing */}
          <div
            className="relative flex flex-col shrink-0 m-auto"
            style={{
              width: paperWidthPx + 28,
              height: paperHeightPx + 28,
            }}
          >
            {/* Top Row: [Corner Unit Box] + [Top Ruler] */}
            <div className="flex shrink-0">
              {/* Corner Box: Toggle cm / inch */}
              <button
                onClick={() => setUnit(unit === 'cm' ? 'in' : 'cm')}
                className="w-7 h-7 bg-[#0E1524] border border-[#2B3A55] text-[10px] font-bold font-mono text-slate-400 hover:text-white flex items-center justify-center shrink-0 z-10 transition-colors"
                title={`Ruler unit: ${unit.toUpperCase()} (Click to toggle)`}
              >
                {unit}
              </button>

              {/* Top Ruler SVG */}
              <div
                className="h-7 bg-[#0E1524] border-t border-b border-r border-[#2B3A55] overflow-hidden shrink-0 relative"
                style={{ width: paperWidthPx }}
              >
                <svg
                  width={paperWidthPx}
                  height={28}
                  className="w-full h-full pointer-events-none select-none block"
                >
                  {Array.from({ length: rulerMaxXMm + 1 }).map((_, m) => {
                    const x = m * displayScale;
                    if (x > paperWidthPx) return null;

                    const isMajor = m % 10 === 0;
                    const isMid = m % 5 === 0;

                    if (isMajor) {
                      const num = m / 10;
                      return (
                        <g key={`top-m-${m}`}>
                          <line
                            x1={x}
                            y1={12}
                            x2={x}
                            y2={28}
                            stroke="#94A3B8"
                            strokeWidth={1}
                          />
                          <text
                            x={x + 2}
                            y={11}
                            fill="#94A3B8"
                            fontSize={9}
                            fontFamily="monospace"
                          >
                            {num}
                          </text>
                        </g>
                      );
                    } else if (isMid) {
                      return (
                        <line
                          key={`top-m-${m}`}
                          x1={x}
                          y1={17}
                          x2={x}
                          y2={28}
                          stroke="#64748B"
                          strokeWidth={0.8}
                        />
                      );
                    } else {
                      return (
                        <line
                          key={`top-m-${m}`}
                          x1={x}
                          y1={22}
                          x2={x}
                          y2={28}
                          stroke="#334155"
                          strokeWidth={0.5}
                        />
                      );
                    }
                  })}
                </svg>
              </div>
            </div>

            {/* Bottom Row: [Left Ruler] + [White Paper Sheet] */}
            <div className="flex shrink-0">
              {/* Left Ruler SVG */}
              <div
                className="w-7 bg-[#0E1524] border-l border-b border-r border-[#2B3A55] overflow-hidden shrink-0 relative"
                style={{ height: paperHeightPx }}
              >
                <svg
                  width={28}
                  height={paperHeightPx}
                  className="w-full h-full pointer-events-none select-none block"
                >
                  {Array.from({ length: rulerMaxYMm + 1 }).map((_, m) => {
                    const y = m * displayScale;
                    if (y > paperHeightPx) return null;

                    const isMajor = m % 10 === 0;
                    const isMid = m % 5 === 0;

                    if (isMajor) {
                      const num = m / 10;
                      return (
                        <g key={`left-m-${m}`}>
                          <line
                            x1={12}
                            y1={y}
                            x2={28}
                            y2={y}
                            stroke="#94A3B8"
                            strokeWidth={1}
                          />
                          <text
                            x={10}
                            y={y + 8}
                            fill="#94A3B8"
                            fontSize={9}
                            fontFamily="monospace"
                            textAnchor="end"
                          >
                            {num}
                          </text>
                        </g>
                      );
                    } else if (isMid) {
                      return (
                        <line
                          key={`left-m-${m}`}
                          x1={17}
                          y1={y}
                          x2={28}
                          y2={y}
                          stroke="#64748B"
                          strokeWidth={0.8}
                        />
                      );
                    } else {
                      return (
                        <line
                          key={`left-m-${m}`}
                          x1={22}
                          y1={y}
                          x2={28}
                          y2={y}
                          stroke="#334155"
                          strokeWidth={0.5}
                        />
                      );
                    }
                  })}
                </svg>
              </div>

              {/* WHITE PAPER SHEET WORKSPACE */}
              <div
                id="white-paper-sheet"
                className="relative bg-white shadow-2xl overflow-hidden cursor-crosshair"
                style={{
                  width: paperWidthPx,
                  height: paperHeightPx,
                }}
              >
                {/* Subtle Printable Margins Boundary Guide */}
                <div
                  className="absolute pointer-events-none border border-dashed border-slate-300/80"
                  style={{
                    left: pageSettings.leftMarginMm * displayScale,
                    top: pageSettings.topMarginMm * displayScale,
                    width: (paperWidthMm - pageSettings.leftMarginMm * 2) * displayScale,
                    height: (paperHeightMm - pageSettings.topMarginMm * 2) * displayScale,
                  }}
                />

                {/* Render Each Photo Item on the Sheet */}
                {items.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  const itemWidthPx = item.widthMm * displayScale;
                  const itemHeightPx = item.heightMm * displayScale;
                  const itemLeftPx = item.xMm * displayScale;
                  const itemTopPx = item.yMm * displayScale;
                  const cutOffsetPx = 0.75 * displayScale;

                  const sourceCanvas = sourceCanvasesRef.current.get(item.sourceImageId);

                  return (
                    <div
                      key={item.id}
                      data-print-item="true"
                      onPointerDown={(e) => handlePointerDownItem(e, item)}
                      onPointerMove={handlePointerMoveItem}
                      onPointerUp={handlePointerUpItem}
                      className={`absolute select-none cursor-move group transition-shadow ${
                        isSelected ? 'z-20' : 'z-10'
                      }`}
                      style={{
                        left: itemLeftPx,
                        top: itemTopPx,
                        width: itemWidthPx,
                        height: itemHeightPx,
                      }}
                      title={`${item.name} (${item.widthMm} × ${item.heightMm} mm) - Drag to Reposition`}
                    >
                      {/* Photo Image Box with visible borders */}
                      <div
                        className={`w-full h-full overflow-hidden bg-slate-100 transition-all ${
                          isSelected
                            ? 'ring-2 ring-cyan-400 ring-offset-1 shadow-lg'
                            : 'shadow-sm'
                        }`}
                        style={{
                          border: pageSettings.borderEnabled
                            ? `${Math.max(1, Math.round((pageSettings.borderWidthMm || 0.25) * displayScale))}px solid ${pageSettings.borderColor || '#000000'}`
                            : 'none',
                        }}
                      >
                        {sourceCanvas ? (
                          <img
                            src={sourceCanvas.toDataURL()}
                            alt={item.name}
                            className="w-full h-full object-cover pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 text-[10px]">
                            Loading
                          </div>
                        )}
                      </div>

                      {/* Measurement Dimensions & Cut Lines (When enabled) */}
                      {pageSettings.measurement && (
                        <>
                          {/* Cut Guideline (+0.75mm dashed line) */}
                          <div
                            className="absolute pointer-events-none border border-dashed border-slate-400"
                            style={{
                              left: -cutOffsetPx,
                              top: -cutOffsetPx,
                              width: itemWidthPx + cutOffsetPx * 2,
                              height: itemHeightPx + cutOffsetPx * 2,
                            }}
                          />

                          {/* Dimension labels: Top (width) & Left (height) */}
                          <div
                            className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-500 font-semibold bg-white/90 px-1 rounded shadow-xs pointer-events-none whitespace-nowrap"
                          >
                            {Math.round(item.widthMm)}mm
                          </div>
                          <div
                            className="absolute top-1/2 -left-3.5 -translate-y-1/2 -translate-x-full text-[9px] font-mono text-slate-500 font-semibold bg-white/90 px-1 rounded shadow-xs pointer-events-none whitespace-nowrap"
                          >
                            {Math.round(item.heightMm)}mm
                          </div>
                        </>
                      )}

                      {/* Selected Item Corner Indicator */}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-2 ring-white pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
