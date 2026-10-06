import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SideId,
  ImageSideState,
  ActiveTab,
  DEFAULT_ADJUSTMENTS,
  CropData,
  Point,
  ImageAdjustments,
} from '../types/image';
import { PrintSettings, DEFAULT_PRINT_SETTINGS } from '../types/print';
import {
  detectDocument,
  applyRealPerspectiveWarp,
  orderPoints,
  DEFAULT_FALLBACK_CROP,
} from '../utils/documentDetector';
import { applyImageAdjustments, calculateAutoAdjustments } from '../utils/imageAdjust';
import { composeFrontAndBack } from '../utils/printComposer';

/**
 * Creates a lightweight preview canvas (max 800px) from the original image at rotationDeg.
 */
export function createPreviewCanvas(
  img: HTMLImageElement,
  rotationDeg: number,
  maxDim = 800
): HTMLCanvasElement {
  const norm = ((rotationDeg % 360) + 360) % 360;
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const scale = Math.min(1.0, maxDim / Math.max(origW, origH));
  const scaledW = Math.round(origW * scale);
  const scaledH = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  if (norm === 90 || norm === 270) {
    canvas.width = scaledH;
    canvas.height = scaledW;
  } else {
    canvas.width = scaledW;
    canvas.height = scaledH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((norm * Math.PI) / 180);
  ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);

  return canvas;
}

/**
 * Creates full-resolution rotated canvas ONLY when needed for final export.
 */
export function createFullResRotatedCanvas(
  img: HTMLImageElement,
  rotationDeg: number
): HTMLCanvasElement {
  const norm = ((rotationDeg % 360) + 360) % 360;
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  if (norm === 90 || norm === 270) {
    canvas.width = origH;
    canvas.height = origW;
  } else {
    canvas.width = origW;
    canvas.height = origH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((norm * Math.PI) / 180);
  ctx.drawImage(img, -origW / 2, -origH / 2);

  return canvas;
}

const createInitialSide = (id: SideId): ImageSideState => ({
  id,
  width: 0,
  height: 0,
  cropCorners: { ...DEFAULT_FALLBACK_CROP },
  isCropped: false,
  rotation: 0,
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  isProcessing: false,
});

export function useImageProcessing() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('both');

  // Auto-Select is ON by default
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(true);

  // Lightweight side states (no large buffers in state)
  const [frontSide, setFrontSide] = useState<ImageSideState>(() => createInitialSide('front'));
  const [backSide, setBackSide] = useState<ImageSideState>(() => createInitialSide('back'));

  // Display canvases for UI
  const [frontDisplayCanvas, setFrontDisplayCanvas] = useState<HTMLCanvasElement | null>(null);
  const [backDisplayCanvas, setBackDisplayCanvas] = useState<HTMLCanvasElement | null>(null);
  const [combinedCanvas, setCombinedCanvas] = useState<HTMLCanvasElement | null>(null);

  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Pristine full-resolution image refs
  const frontOriginalRef = useRef<HTMLImageElement | null>(null);
  const backOriginalRef = useRef<HTMLImageElement | null>(null);

  // Full-resolution cropped canvases stored in refs
  const frontFullResCroppedRef = useRef<HTMLCanvasElement | null>(null);
  const backFullResCroppedRef = useRef<HTMLCanvasElement | null>(null);

  // AbortController for canceling pending auto-detect tasks
  const detectAbortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((_msg?: string) => {
    // Silenced: user requested no notifications or popups
  }, []);

  // 1. FAST UPLOAD & LIGHTWEIGHT AUTO SELECT & AUTO CROP
  const loadSideImage = useCallback(async (side: SideId, file: File) => {
    if (detectAbortRef.current) {
      detectAbortRef.current.abort();
    }
    const abortController = new AbortController();
    detectAbortRef.current = abortController;

    if (side === 'front') {
      setFrontSide((prev) => ({ ...prev, isProcessing: true }));
    } else {
      setBackSide((prev) => ({ ...prev, isProcessing: true }));
    }
    setIsProcessingGlobal(true);

    try {
      const currentSide = side === 'front' ? frontSide : backSide;
      if (currentSide.sourceUrl) {
        URL.revokeObjectURL(currentSide.sourceUrl);
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        let done = false;
        img.onload = () => {
          if (!done) { done = true; resolve(); }
        };
        img.onerror = (e) => {
          if (!done) { done = true; reject(e); }
        };
        setTimeout(() => {
          if (!done) { done = true; resolve(); }
        }, 2000);
      });

      const originalRef = side === 'front' ? frontOriginalRef : backOriginalRef;
      originalRef.current = img;

      // Create small preview image
      const previewCanvas = createPreviewCanvas(img, 0, 800);

      // Run fast printed border detection
      const detResult = await detectDocument(previewCanvas, abortController.signal);
      const corners = detResult.corners || { ...DEFAULT_FALLBACK_CROP };

      // If auto-select is enabled, automatically perform the perspective crop immediately!
      let shouldAutoCrop = autoSelectEnabled;
      let finalCroppedCanvas: HTMLCanvasElement | null = null;
      let autoAdjustments = { ...DEFAULT_ADJUSTMENTS };

      if (shouldAutoCrop) {
        try {
          const fullResRotated = createFullResRotatedCanvas(img, 0);
          finalCroppedCanvas = await applyRealPerspectiveWarp(fullResRotated, corners);
          if (finalCroppedCanvas) {
            autoAdjustments = calculateAutoAdjustments(finalCroppedCanvas);
          }
        } catch (e) {
          console.warn('Auto warp error, switching to manual crop:', e);
          shouldAutoCrop = false;
        }
      }

      const sideState: ImageSideState = {
        id: side,
        sourceFile: file,
        sourceUrl: objectUrl,
        workingCanvas: previewCanvas,
        width: previewCanvas.width,
        height: previewCanvas.height,
        cropCorners: corners,
        isCropped: shouldAutoCrop,
        rotation: 0,
        adjustments: autoAdjustments,
        detectionResult: detResult,
        isProcessing: false,
      };

      const initialDisplay = finalCroppedCanvas
        ? applyImageAdjustments(finalCroppedCanvas, autoAdjustments, 0)
        : previewCanvas;

      if (side === 'front') {
        frontFullResCroppedRef.current = finalCroppedCanvas;
        setFrontSide(sideState);
        setFrontDisplayCanvas(initialDisplay);
        setActiveTab((prev) => (prev === 'both' ? 'both' : 'front'));
      } else {
        backFullResCroppedRef.current = finalCroppedCanvas;
        setBackSide(sideState);
        setBackDisplayCanvas(initialDisplay);
        setActiveTab((prev) => (prev === 'both' ? 'both' : 'back'));
      }
    } catch (err) {
      console.error('Error loading image:', err);
    } finally {
      setIsProcessingGlobal(false);
      if (side === 'front') {
        setFrontSide((prev) => ({ ...prev, isProcessing: false }));
      } else {
        setBackSide((prev) => ({ ...prev, isProcessing: false }));
      }
    }
  }, [frontSide, backSide, autoSelectEnabled]);

  // Load multiple files
  const loadMultipleImages = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      const targetSide: SideId = (!frontSide.sourceFile && backSide.sourceFile) ? 'front' : activeTab === 'back' ? 'back' : 'front';
      await loadSideImage(targetSide, files[0]);
    } else {
      await loadSideImage('front', files[0]);
      await loadSideImage('back', files[1]);
      setActiveTab('front');
    }
  }, [activeTab, frontSide.sourceFile, backSide.sourceFile, loadSideImage]);

  // Remove side image
  const removeSideImage = useCallback((side: SideId) => {
    if (side === 'front') {
      if (frontSide.sourceUrl) URL.revokeObjectURL(frontSide.sourceUrl);
      frontOriginalRef.current = null;
      frontFullResCroppedRef.current = null;
      setFrontSide(createInitialSide('front'));
      setFrontDisplayCanvas(null);
    } else {
      if (backSide.sourceUrl) URL.revokeObjectURL(backSide.sourceUrl);
      backOriginalRef.current = null;
      backFullResCroppedRef.current = null;
      setBackSide(createInitialSide('back'));
      setBackDisplayCanvas(null);
    }
  }, [frontSide.sourceUrl, backSide.sourceUrl]);

  // 2. AUTO SELECT ACTION: Detects printed border & automatically crops
  const autoSelect = useCallback(async (side: SideId) => {
    const original = side === 'front' ? frontOriginalRef.current : backOriginalRef.current;
    const currentSide = side === 'front' ? frontSide : backSide;
    if (!original) return;

    if (detectAbortRef.current) {
      detectAbortRef.current.abort();
    }
    const abortController = new AbortController();
    detectAbortRef.current = abortController;

    setIsProcessingGlobal(true);
    showToast('ডকুমেন্ট অটো-সিলেক্ট ও ক্রপ করা হচ্ছে...');

    try {
      const preview = currentSide.workingCanvas || createPreviewCanvas(original, currentSide.rotation, 800);
      const detResult = await detectDocument(preview, abortController.signal);
      const corners = detResult.corners || { ...DEFAULT_FALLBACK_CROP };

      // Perform perspective crop immediately
      const fullResRotated = createFullResRotatedCanvas(original, currentSide.rotation);
      const finalCroppedCanvas = await applyRealPerspectiveWarp(fullResRotated, corners);

      const updater = (prev: ImageSideState) => ({
        ...prev,
        cropCorners: corners,
        detectionResult: detResult,
        isCropped: true,
      });

      if (side === 'front') {
        frontFullResCroppedRef.current = finalCroppedCanvas;
        setFrontSide(updater);
        setFrontDisplayCanvas(finalCroppedCanvas);
      } else {
        backFullResCroppedRef.current = finalCroppedCanvas;
        setBackSide(updater);
        setBackDisplayCanvas(finalCroppedCanvas);
      }

      showToast('ডকুমেন্ট অটো-ক্রপ সম্পন্ন হয়েছে');
    } catch (err) {
      console.warn('Auto select failed:', err);
      showToast('অটো সিলেক্ট করা যায়নি। চার কোণা ঠিক করুন।');
    } finally {
      setIsProcessingGlobal(false);
    }
  }, [frontSide, backSide, showToast]);

  // Toggle Auto-Select
  const handleAutoSelectChange = useCallback((enabled: boolean) => {
    setAutoSelectEnabled(enabled);
    const activeSideId: SideId = activeTab === 'back' ? 'back' : 'front';
    const activeOriginal = activeSideId === 'front' ? frontOriginalRef.current : backOriginalRef.current;

    if (enabled && activeOriginal) {
      // Re-run auto crop
      autoSelect(activeSideId);
    } else if (!enabled && activeOriginal) {
      // Switch back to manual crop mode
      const currentSide = activeSideId === 'front' ? frontSide : backSide;
      const preview = currentSide.workingCanvas || createPreviewCanvas(activeOriginal, currentSide.rotation, 800);

      const updater = (prev: ImageSideState) => ({ ...prev, isCropped: false });
      if (activeSideId === 'front') {
        setFrontSide(updater);
        setFrontDisplayCanvas(preview);
      } else {
        setBackSide(updater);
        setBackDisplayCanvas(preview);
      }
      showToast('ম্যানুয়াল ক্রপ মোড সক্রিয় করা হয়েছে');
    }
  }, [activeTab, frontSide, backSide, autoSelect, showToast]);

  // 3. MANUAL CROP: Return to 4-corner adjustment stage
  const manualCrop = useCallback((side: SideId) => {
    const original = side === 'front' ? frontOriginalRef.current : backOriginalRef.current;
    const currentSide = side === 'front' ? frontSide : backSide;
    if (!original) return;

    const preview = currentSide.workingCanvas || createPreviewCanvas(original, currentSide.rotation, 800);

    const updater = (prev: ImageSideState) => ({
      ...prev,
      isCropped: false,
      workingCanvas: preview,
    });

    if (side === 'front') {
      setFrontSide(updater);
      setFrontDisplayCanvas(preview);
    } else {
      setBackSide(updater);
      setBackDisplayCanvas(preview);
    }
    showToast('ম্যানুয়াল ৪-কোণা অ্যাডজাস্ট মোড');
  }, [frontSide, backSide, showToast]);

  // 4. CORNER DRAGGING
  const updateCorner = useCallback((side: SideId, cornerKey: keyof CropData, point: Point) => {
    const clampedPoint = {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
    };

    const updater = (prev: ImageSideState) => ({
      ...prev,
      cropCorners: {
        ...prev.cropCorners,
        [cornerKey]: clampedPoint,
      },
    });

    if (side === 'front') {
      setFrontSide(updater);
    } else {
      setBackSide(updater);
    }
  }, []);

  // 5. CROP FINAL ("ক্রপ ফাইনাল করুন")
  const cropFinal = useCallback(async (side: SideId) => {
    const original = side === 'front' ? frontOriginalRef.current : backOriginalRef.current;
    const currentSide = side === 'front' ? frontSide : backSide;
    if (!original) return;

    setIsProcessingGlobal(true);
    try {
      const fullResRotated = createFullResRotatedCanvas(original, currentSide.rotation);
      const warpedFullRes = await applyRealPerspectiveWarp(fullResRotated, currentSide.cropCorners);

      if (side === 'front') {
        frontFullResCroppedRef.current = warpedFullRes;
        setFrontSide((prev) => ({ ...prev, isCropped: true }));
        setFrontDisplayCanvas(warpedFullRes);
      } else {
        backFullResCroppedRef.current = warpedFullRes;
        setBackSide((prev) => ({ ...prev, isCropped: true }));
        setBackDisplayCanvas(warpedFullRes);
      }
      showToast('ক্রপ সম্পন্ন হয়েছে');
    } catch (err) {
      console.error('Perspective transform error:', err);
      showToast('ক্রপ করতে সমস্যা হয়েছে');
    } finally {
      setIsProcessingGlobal(false);
    }
  }, [frontSide, backSide, showToast]);

  // 6. ROTATION
  const rotateSide = useCallback(async (side: SideId, direction: 'cw' | 'ccw' = 'cw') => {
    const original = side === 'front' ? frontOriginalRef.current : backOriginalRef.current;
    const currentSide = side === 'front' ? frontSide : backSide;
    if (!original) return;

    const delta = direction === 'cw' ? 90 : -90;
    const newRotation = (((currentSide.rotation + delta) % 360) + 360) % 360;
    const newPreview = createPreviewCanvas(original, newRotation, 800);

    const rotatePt = (p: Point) => {
      if (direction === 'cw') {
        return { x: Math.max(0, Math.min(1, 1 - p.y)), y: Math.max(0, Math.min(1, p.x)) };
      } else {
        return { x: Math.max(0, Math.min(1, p.y)), y: Math.max(0, Math.min(1, 1 - p.x)) };
      }
    };

    const pts = [
      rotatePt(currentSide.cropCorners.topLeft),
      rotatePt(currentSide.cropCorners.topRight),
      rotatePt(currentSide.cropCorners.bottomRight),
      rotatePt(currentSide.cropCorners.bottomLeft),
    ];
    const newCorners = orderPoints(pts);

    let newCroppedCanvas: HTMLCanvasElement | null = null;
    if (currentSide.isCropped) {
      const fullResRotated = createFullResRotatedCanvas(original, newRotation);
      newCroppedCanvas = await applyRealPerspectiveWarp(fullResRotated, newCorners);
    }

    const updater = (prev: ImageSideState) => ({
      ...prev,
      rotation: newRotation,
      workingCanvas: newPreview,
      width: newPreview.width,
      height: newPreview.height,
      cropCorners: newCorners,
      isCropped: prev.isCropped,
    });

    if (side === 'front') {
      frontFullResCroppedRef.current = newCroppedCanvas;
      setFrontSide(updater);
      setFrontDisplayCanvas(newCroppedCanvas || newPreview);
    } else {
      backFullResCroppedRef.current = newCroppedCanvas;
      setBackSide(updater);
      setBackDisplayCanvas(newCroppedCanvas || newPreview);
    }
    showToast('90° ঘোরানো হয়েছে');
  }, [frontSide, backSide, showToast]);

  // Reset side to pristine original
  const resetSide = useCallback((side: SideId) => {
    const original = side === 'front' ? frontOriginalRef.current : backOriginalRef.current;
    if (!original) return;

    const preview = createPreviewCanvas(original, 0, 800);

    const updater = (prev: ImageSideState) => ({
      ...prev,
      rotation: 0,
      workingCanvas: preview,
      width: preview.width,
      height: preview.height,
      cropCorners: { ...DEFAULT_FALLBACK_CROP },
      isCropped: false,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    });

    if (side === 'front') {
      frontFullResCroppedRef.current = null;
      setFrontSide(updater);
      setFrontDisplayCanvas(preview);
    } else {
      backFullResCroppedRef.current = null;
      setBackSide(updater);
      setBackDisplayCanvas(preview);
    }
    showToast('মূল ছবিতে রিসেট করা হয়েছে');
  }, [showToast]);

  // Reset all
  const resetAll = useCallback(() => {
    if (frontSide.sourceUrl) URL.revokeObjectURL(frontSide.sourceUrl);
    if (backSide.sourceUrl) URL.revokeObjectURL(backSide.sourceUrl);

    frontOriginalRef.current = null;
    backOriginalRef.current = null;
    frontFullResCroppedRef.current = null;
    backFullResCroppedRef.current = null;

    setFrontSide(createInitialSide('front'));
    setBackSide(createInitialSide('back'));
    setFrontDisplayCanvas(null);
    setBackDisplayCanvas(null);
    setCombinedCanvas(null);
    setPrintSettings(DEFAULT_PRINT_SETTINGS);
    setActiveTab('both');
    showToast('সবকিছু রিসেট করা হয়েছে');
  }, [frontSide.sourceUrl, backSide.sourceUrl, showToast]);

  // Swap sides
  const swapSides = useCallback(() => {
    const tempSide = { ...frontSide, id: 'back' as SideId };
    const tempBack = { ...backSide, id: 'front' as SideId };

    setFrontSide(tempBack);
    setBackSide(tempSide);

    const tempOrig = frontOriginalRef.current;
    frontOriginalRef.current = backOriginalRef.current;
    backOriginalRef.current = tempOrig;

    const tempFull = frontFullResCroppedRef.current;
    frontFullResCroppedRef.current = backFullResCroppedRef.current;
    backFullResCroppedRef.current = tempFull;

    const tempDisplay = frontDisplayCanvas;
    setFrontDisplayCanvas(backDisplayCanvas);
    setBackDisplayCanvas(tempDisplay);

    showToast('সামনের ও পিছনের দিক অদলবদল করা হয়েছে');
  }, [frontSide, backSide, frontDisplayCanvas, backDisplayCanvas, showToast]);

  // Auto Color Adjust
  const autoColorAdjust = useCallback((side: SideId | 'both') => {
    if (side === 'both') {
      const isFrontAdjusted =
        frontSide.adjustments.contrast !== 0 ||
        frontSide.adjustments.levels !== 0 ||
        frontSide.adjustments.textDeepen !== 0;
      const isBackAdjusted =
        backSide.adjustments.contrast !== 0 ||
        backSide.adjustments.levels !== 0 ||
        backSide.adjustments.textDeepen !== 0;
      const isAnyAdjusted = isFrontAdjusted || isBackAdjusted;

      if (isAnyAdjusted) {
        setFrontSide((prev) => ({ ...prev, adjustments: { ...DEFAULT_ADJUSTMENTS } }));
        setBackSide((prev) => ({ ...prev, adjustments: { ...DEFAULT_ADJUSTMENTS } }));
        showToast('উভয় পাশের কালার এডজাস্টমেন্ট রিসেট করা হয়েছে');
      } else {
        const frontCanvas = frontSide.isCropped ? frontFullResCroppedRef.current : frontSide.workingCanvas;
        const backCanvas = backSide.isCropped ? backFullResCroppedRef.current : backSide.workingCanvas;

        if (frontCanvas) {
          const frontAdj = calculateAutoAdjustments(frontCanvas);
          setFrontSide((prev) => ({ ...prev, adjustments: frontAdj }));
        }
        if (backCanvas) {
          const backAdj = calculateAutoAdjustments(backCanvas);
          setBackSide((prev) => ({ ...prev, adjustments: backAdj }));
        }
        showToast('উভয় পাশের অটো কালার ও ব্যাকগ্রাউন্ড ক্লিন করা হয়েছে');
      }
      return;
    }

    const currentSide = side === 'front' ? frontSide : backSide;
    const canvas = currentSide.isCropped
      ? (side === 'front' ? frontFullResCroppedRef.current : backFullResCroppedRef.current)
      : currentSide.workingCanvas;

    if (!canvas) return;

    const isAdjusted =
      currentSide.adjustments.contrast !== 0 ||
      currentSide.adjustments.levels !== 0 ||
      currentSide.adjustments.textDeepen !== 0;

    const newAdjustments = isAdjusted
      ? { ...DEFAULT_ADJUSTMENTS }
      : calculateAutoAdjustments(canvas);

    const updater = (prev: ImageSideState) => ({
      ...prev,
      adjustments: newAdjustments,
    });

    if (side === 'front') {
      setFrontSide(updater);
    } else {
      setBackSide(updater);
    }

    if (isAdjusted) {
      showToast('কালার এডজাস্টমেন্ট রিসেট করা হয়েছে');
    } else {
      showToast('অটো কালার ও ব্যাকগ্রাউন্ড ক্লিন করা হয়েছে');
    }
  }, [frontSide, backSide, showToast]);

  // Adjustments (supports 'front', 'back', or 'both')
  const updateAdjustment = useCallback((side: SideId | 'both', key: keyof ImageAdjustments, value: any) => {
    const updater = (prev: ImageSideState) => ({
      ...prev,
      adjustments: {
        ...prev.adjustments,
        [key]: value,
      },
    });

    if (side === 'front') {
      setFrontSide(updater);
    } else if (side === 'back') {
      setBackSide(updater);
    } else {
      setFrontSide(updater);
      setBackSide(updater);
    }
  }, []);

  // Toggle Upscale (1x <-> 2x HD) (supports 'front', 'back', or 'both')
  const toggleUpscale = useCallback((side: SideId | 'both') => {
    if (side === 'both') {
      const currentUpscale = frontSide.adjustments.upscale || 1.0;
      const nextUpscale = currentUpscale >= 2.0 ? 1.0 : 2.0;
      updateAdjustment('both', 'upscale', nextUpscale);
      showToast(
        nextUpscale > 1.0
          ? 'উভয় পাশে 2x HD সুপার-রেজোলিউশন আপস্কেল সক্রিয় হয়েছে'
          : 'উভয় পাশে স্বাভাবিক (1x) রেজোলিউশনে সেট করা হয়েছে'
      );
      return;
    }

    const currentSide = side === 'front' ? frontSide : backSide;
    const currentUpscale = currentSide.adjustments.upscale || 1.0;
    const nextUpscale = currentUpscale >= 2.0 ? 1.0 : 2.0;
    updateAdjustment(side, 'upscale', nextUpscale);
    showToast(
      nextUpscale > 1.0
        ? '2x HD সুপার-রেজোলিউশন আপস্কেল সক্রিয় হয়েছে'
        : 'স্বাভাবিক (1x) রেজোলিউশনে সেট করা হয়েছে'
    );
  }, [frontSide, backSide, updateAdjustment, showToast]);

  // Update display canvas when adjustments change
  useEffect(() => {
    const sourceCanvas = frontSide.isCropped ? frontFullResCroppedRef.current : frontSide.workingCanvas;
    if (sourceCanvas) {
      const adjusted = applyImageAdjustments(sourceCanvas, frontSide.adjustments, 0);
      setFrontDisplayCanvas(adjusted);
    }
  }, [frontSide.isCropped, frontSide.workingCanvas, frontSide.adjustments]);

  useEffect(() => {
    const sourceCanvas = backSide.isCropped ? backFullResCroppedRef.current : backSide.workingCanvas;
    if (sourceCanvas) {
      const adjusted = applyImageAdjustments(sourceCanvas, backSide.adjustments, 0);
      setBackDisplayCanvas(adjusted);
    }
  }, [backSide.isCropped, backSide.workingCanvas, backSide.adjustments]);

  // Combined A4 canvas for print preview
  useEffect(() => {
    if (!frontDisplayCanvas && !backDisplayCanvas) {
      setCombinedCanvas(null);
      return;
    }

    const baseW = Math.max(frontDisplayCanvas?.width || 0, backDisplayCanvas?.width || 0) || 800;
    const cardWidthMm = printSettings.cardWidthMm || 85.6;
    const pxPerMm = baseW / cardWidthMm;
    const gapPx = Math.max(4, Math.round(printSettings.printGapMm * pxPerMm));
    const combined = composeFrontAndBack(frontDisplayCanvas, backDisplayCanvas, gapPx);
    setCombinedCanvas(combined);
  }, [frontDisplayCanvas, backDisplayCanvas, printSettings.printGapMm]);

  return {
    activeTab,
    setActiveTab,
    autoSelectEnabled,
    setAutoSelectEnabled: handleAutoSelectChange,
    frontSide,
    backSide,
    frontDisplayCanvas,
    backDisplayCanvas,
    combinedCanvas,
    printSettings,
    setPrintSettings,
    previewOpen,
    setPreviewOpen,
    helpOpen,
    setHelpOpen,
    isProcessingGlobal,
    statusMessage,
    loadSideImage,
    loadMultipleImages,
    removeSideImage,
    swapSides,
    resetAll,
    resetSide,
    autoSelect,
    manualCrop,
    cropFinal,
    updateCorner,
    updateAdjustment,
    autoColorAdjust,
    toggleUpscale,
    rotateSide,
  };
}
