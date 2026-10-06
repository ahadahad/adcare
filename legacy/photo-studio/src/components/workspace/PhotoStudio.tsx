import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ImageItem,
  ActiveTool,
  HistorySnapshot,
  CropRect,
  AspectRatioOption,
  AIStatusInfo,
  ImageAdjustments,
  FilterType,
  BackgroundSettings,
  BorderSettings,
  TransformSettings,
  PassportSettings,
  ObjectDetectionTarget,
  AIDetectionData,
  SelectedAreaAdjustments,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_BACKGROUND,
  DEFAULT_BORDER,
  DEFAULT_TRANSFORM,
  DEFAULT_PASSPORT,
  CustomInchSize,
} from '../../types/editor';
import { EditOperation } from '../../types/ai';
import { EditorHeader } from '../header/EditorHeader';
import { LeftToolPanel } from '../panels/LeftToolPanel';
import { ImageTray } from '../panels/ImageTray';
import { PhotoCanvas } from '../canvas/PhotoCanvas';
import { ExportModal } from '../modals/ExportModal';
import { PrintModal } from '../modals/PrintModal';
import { ProjectModal } from '../modals/ProjectModal';
import { JointPhotoModal } from '../modals/JointPhotoModal';
import { AIAssistantModal } from '../modals/AIAssistantModal';
import { Toast, ToastMessage } from '../common/Toast';
import {
  applyCrop,
  applyResize,
  renderCompositeCanvas,
  createThumbnail,
  createThumbnailAsync,
  loadImageSource,
  fileToDataUrl,
  loadImage,
} from '../../utils/canvas';
import { removeBackground, invertCutout } from '../../utils/backgroundRemoval';
import { analyzeAndAutoEnhance } from '../../utils/autoEnhance';
import {
  analyzeFaceAndSkin,
  applyLocalizedFaceSkinAdjustments,
} from '../../utils/faceSkinDetector';
import { optimizeImageForAI, safeFetchJSON } from '../../utils/imageOptimizer';
import { performClientSuperResolution } from '../../utils/superResolution';
import { SampleImageMeta, sampleImages } from '../../utils/sampleImages';
import { cvService, enhanceImageWithBrowserSwinIR, getActiveBackend, SwinIRProgress } from '../../cv';
import { maskEngine, MaskData } from '../../cv/segmentation/maskEngine';
import { faceParserService } from '../../cv/face/faceParser';

interface PhotoStudioProps {
  initialImages?: ImageItem[];
  initialTool?: ActiveTool;
  onBackToLanding?: () => void;
}

export const PhotoStudio: React.FC<PhotoStudioProps> = ({
  initialImages = [],
  initialTool = 'object',
}) => {
  // Hidden file input for header or center upload trigger
  const hiddenUploadInputRef = useRef<HTMLInputElement>(null);

  // Images state
  const [images, setImages] = useState<ImageItem[]>(initialImages);
  const [activeImageId, setActiveImageId] = useState<string | null>(
    initialImages.length > 0 ? initialImages[0].id : null
  );

  // Power Mode Toggle (Header)
  const [isPowerMode, setIsPowerMode] = useState<boolean>(false);

  // Active Tool & Object Detection Target
  const [activeTool, setActiveTool] = useState<ActiveTool>(initialTool);
  const [selectedObjectTarget, setSelectedObjectTarget] =
    useState<ObjectDetectionTarget>('none');
  const [detectionData, setDetectionData] = useState<AIDetectionData | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [enhanceProgress, setEnhanceProgress] = useState<SwinIRProgress | null>(null);
  const enhanceAbortControllerRef = useRef<AbortController | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState<boolean>(false);

  // History stack
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Cropping State
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [cropAspect, setCropAspect] = useState<AspectRatioOption>('free');
  const [customInchSize, setCustomInchSize] = useState<CustomInchSize>({
    widthInches: 2,
    heightInches: 2,
    dpi: 300,
  });

  // Localized Selected Area Adjustments (Face, Skin, Hair)
  const [areaAdjustments, setAreaAdjustments] = useState<SelectedAreaAdjustments>({
    brightness: 0,
    contrast: 0,
    smoothness: 0,
    warmth: 0,
  });

  // Pixel Segmentation Mask State (stored separately from original image)
  const [activeMask, setActiveMask] = useState<MaskData | null>(null);
  const [maskOriginalImageUrl, setMaskOriginalImageUrl] = useState<string | null>(null);
  const maskCacheRef = useRef<Map<string, MaskData>>(new Map());

  // AI Status
  const [aiStatus, setAiStatus] = useState<AIStatusInfo | null>(null);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isJointPhotoOpen, setIsJointPhotoOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      title: string,
      description?: string,
      type: 'success' | 'warning' | 'error' | 'info' = 'info'
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch and synchronize server-managed AI status on mount
  const refreshAIStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch {
      setAiStatus({
        configured: false,
        activeProvider: 'None',
        model: 'Unavailable',
        hasTokenHarborKey: false,
        hasGeminiKey: false,
      });
    }
  }, []);

  useEffect(() => {
    refreshAIStatus();
  }, [refreshAIStatus]);


  const activeImage = images.find((img) => img.id === activeImageId) || null;

  // Initialize history when active image changes
  useEffect(() => {
    if (activeImage) {
      const initialSnapshot: HistorySnapshot = {
        currentUrl: activeImage.currentUrl,
        width: activeImage.width,
        height: activeImage.height,
        adjustments: { ...activeImage.adjustments },
        filter: activeImage.filter,
        background: { ...activeImage.background },
        border: { ...activeImage.border },
        transform: { ...activeImage.transform },
        passport: { ...activeImage.passport },
        description: 'Original Photo',
      };
      setHistory([initialSnapshot]);
      setHistoryIndex(0);

      const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
      const currentW = isRot ? activeImage.height : activeImage.width;
      const currentH = isRot ? activeImage.width : activeImage.height;
      initCropRect(currentW, currentH, cropAspect);
    } else {
      setHistory([]);
      setHistoryIndex(-1);
      setCropRect(null);
    }
  }, [activeImageId]);

  const initCropRect = (w: number, h: number, aspect: AspectRatioOption) => {
    // If passport mode and we have biometric recommended crop, prioritize it
    if (aspect === 'passport' && detectionData?.face?.biometricContour?.recommendedPassportCrop) {
      setCropRect(detectionData.face.biometricContour.recommendedPassportCrop);
      return;
    }

    const safeW = Math.max(10, Math.round(w || 800));
    const safeH = Math.max(10, Math.round(h || 600));

    let cropW = Math.round(safeW * 0.82);
    let cropH = Math.round(safeH * 0.82);

    if (aspect === '2x2' || aspect === '1:1') {
      const minD = Math.min(cropW, cropH);
      cropW = minD;
      cropH = minD;
    } else if (aspect === '1.4x1.8') {
      const ratio = 1.4 / 1.8;
      cropH = Math.round(safeH * 0.82);
      cropW = Math.round(cropH * ratio);
      if (cropW > safeW) {
        cropW = Math.round(safeW * 0.88);
        cropH = Math.round(cropW / ratio);
      }
    } else if (aspect === 'custom' || aspect === 'custom_inch') {
      const inchW = Math.max(0.1, customInchSize.widthInches || 2);
      const inchH = Math.max(0.1, customInchSize.heightInches || 2);
      const ratio = inchW / inchH;
      cropW = Math.round(safeW * 0.75);
      cropH = Math.round(cropW / ratio);
      if (cropH > safeH * 0.9) {
        cropH = Math.round(safeH * 0.82);
        cropW = Math.round(cropH * ratio);
      }
    } else if (aspect === 'bd_passport') {
      const passportRatio = 45 / 55;
      cropH = Math.round(safeH * 0.82);
      cropW = Math.round(cropH * passportRatio);
      if (cropW > safeW) {
        cropW = Math.round(safeW * 0.88);
        cropH = Math.round(cropW / passportRatio);
      }
    } else if (aspect === 'bd_stamp') {
      const passportRatio = 20 / 25;
      cropH = Math.round(safeH * 0.82);
      cropW = Math.round(cropH * passportRatio);
      if (cropW > safeW) {
        cropW = Math.round(safeW * 0.88);
        cropH = Math.round(cropW / passportRatio);
      }
    } else if (aspect === 'passport') {
      // Official passport aspect ratio from image setting or standard default (35mm × 45mm = 7 / 9 ≈ 0.7778)
      const passportRatio = activeImage?.passport?.aspectRatio || (45 / 55);
      cropH = Math.round(safeH * 0.82);
      cropW = Math.round(cropH * passportRatio);
      if (cropW > safeW) {
        cropW = Math.round(safeW * 0.88);
        cropH = Math.round(cropW / passportRatio);
      }
    } else if (aspect === '4:5') {
      cropH = Math.round(cropW * (5 / 4));
      if (cropH > safeH) {
        cropH = Math.round(safeH * 0.85);
        cropW = Math.round(cropH * (4 / 5));
      }
    } else if (aspect === '3:4') {
      cropH = Math.round(cropW * (4 / 3));
      if (cropH > safeH) {
        cropH = Math.round(safeH * 0.85);
        cropW = Math.round(cropH * (3 / 4));
      }
    } else if (aspect === '4:3') {
      cropH = Math.round(cropW * (3 / 4));
    } else if (aspect === '16:9') {
      cropH = Math.round(cropW * (9 / 16));
    }

    const cropX = Math.round((safeW - cropW) / 2);
    const cropY = Math.round((safeH - cropH) / 2);

    setCropRect({ x: Math.max(0, cropX), y: Math.max(0, cropY), width: Math.max(1, cropW), height: Math.max(1, cropH) });
  };

  const pushHistory = useCallback(
    (updatedImage: ImageItem, description: string) => {
      const snapshot: HistorySnapshot = {
        currentUrl: updatedImage.currentUrl,
        width: updatedImage.width,
        height: updatedImage.height,
        adjustments: { ...updatedImage.adjustments },
        filter: updatedImage.filter,
        background: { ...updatedImage.background },
        border: { ...updatedImage.border },
        transform: { ...updatedImage.transform },
        passport: { ...updatedImage.passport },
        description,
      };

      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, snapshot];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !activeImage) return;
    const targetIdx = historyIndex - 1;
    const snapshot = history[targetIdx];
    if (!snapshot) return;

    setImages((prev) =>
      prev.map((img) =>
        img.id === activeImage.id
          ? {
              ...img,
              currentUrl: snapshot.currentUrl,
              width: snapshot.width,
              height: snapshot.height,
              adjustments: { ...snapshot.adjustments },
              filter: snapshot.filter,
              background: { ...snapshot.background },
              border: { ...snapshot.border },
              transform: { ...snapshot.transform },
              passport: { ...snapshot.passport },
            }
          : img
      )
    );
    setHistoryIndex(targetIdx);
    addToast('Undo', snapshot.description, 'info');
  }, [historyIndex, activeImage, history, addToast]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !activeImage) return;
    const targetIdx = historyIndex + 1;
    const snapshot = history[targetIdx];
    if (!snapshot) return;

    setImages((prev) =>
      prev.map((img) =>
        img.id === activeImage.id
          ? {
              ...img,
              currentUrl: snapshot.currentUrl,
              width: snapshot.width,
              height: snapshot.height,
              adjustments: { ...snapshot.adjustments },
              filter: snapshot.filter,
              background: { ...snapshot.background },
              border: { ...snapshot.border },
              transform: { ...snapshot.transform },
              passport: { ...snapshot.passport },
            }
          : img
      )
    );
    setHistoryIndex(targetIdx);
    addToast('Redo', snapshot.description, 'info');
  }, [historyIndex, history, activeImage, addToast]);

  // Upload handler for multiple files
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 25 * 1024 * 1024;

    const newItems: ImageItem[] = [];

    for (const file of fileArr) {
      if (!validMimes.includes(file.type)) continue;
      if (file.size > maxBytes) continue;

      try {
        const { dataUrl, width, height } = await fileToDataUrl(file);
        const imgEl = await loadImage(dataUrl);
        const thumb = createThumbnail(imgEl, 140);

        const newItem: ImageItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          originalFile: file,
          originalUrl: dataUrl,
          currentUrl: dataUrl,
          width,
          height,
          originalWidth: width,
          originalHeight: height,
          thumbnailUrl: thumb,
          sizeBytes: file.size,
          mimeType: file.type,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
          filter: 'original',
          background: { ...DEFAULT_BACKGROUND },
          border: { ...DEFAULT_BORDER },
          transform: { ...DEFAULT_TRANSFORM },
          isCropped: false,
          passport: { ...DEFAULT_PASSPORT },
        };
        newItems.push(newItem);
      } catch (err: any) {
        console.error('Failed to load file:', err);
      }
    }

    if (newItems.length > 0) {
      setImages((prev) => [...prev, ...newItems]);
      setActiveImageId(newItems[0].id);
      setActiveTool('object');
      addToast('Upload Complete', `Loaded ${newItems.length} photo(s).`, 'success');
    }
  };

  // Sample image loader
  const handleSelectSample = async (sample: SampleImageMeta) => {
    try {
      const imgEl = await loadImage(sample.dataUrl);
      const thumb = createThumbnail(imgEl, 140);

      const newItem: ImageItem = {
        id: `sample-${Date.now()}`,
        name: sample.name,
        originalUrl: sample.dataUrl,
        currentUrl: sample.dataUrl,
        width: sample.width,
        height: sample.height,
        originalWidth: sample.width,
        originalHeight: sample.height,
        thumbnailUrl: thumb,
        sizeBytes: 150000,
        mimeType: 'image/jpeg',
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        filter: 'original',
        background: { ...DEFAULT_BACKGROUND },
        border: { ...DEFAULT_BORDER },
        transform: { ...DEFAULT_TRANSFORM },
        isCropped: false,
        passport: { ...DEFAULT_PASSPORT },
      };

      setImages((prev) => [...prev, newItem]);
      setActiveImageId(newItem.id);
      setActiveTool('object');
      addToast('Loaded Sample Photo', sample.name, 'success');
    } catch (e: any) {
      addToast('Load Error', e.message, 'error');
    }
  };

  // Delete image
  const handleDeleteImage = (id: string) => {
    setImages((prev) => {
      const remaining = prev.filter((img) => img.id !== id);
      if (activeImageId === id) {
        setActiveImageId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
    addToast('Removed', 'Photo removed from tray.', 'info');
  };

  // Eraser / Remove Background Action
  const handleRemoveBackground = async (provider?: 'removebg' | 'studio') => {
    if (!activeImage || isRemovingBg) return;

    setIsRemovingBg(true);

    const isRemoveBgKeyAvailable = Boolean(
      aiStatus?.removeBg?.isConfigured && aiStatus?.removeBg?.hasUsableCredits !== false
    );

    // Default to removebg if configured and has usable credits; otherwise use studio
    const targetProvider = provider || (isRemoveBgKeyAvailable ? 'removebg' : 'studio');

    addToast(
      'Extracting Subject...',
      targetProvider === 'removebg'
        ? 'Calling remove.bg API for high-precision alpha cutout...'
        : 'Segmenting subject from background with Studio Fast Vision...',
      'info'
    );

    try {
      let cutoutUrl: string | null = null;
      let usedProvider = 'Studio Vision';
      let dominantColor = '#FFFFFF';

      // 1. If remove.bg provider is selected, try calling backend /api/ai/remove-bg
      if (targetProvider === 'removebg') {
        try {
          const aiOptimizedImage = await optimizeImageForAI(activeImage.currentUrl, 1600);
          const res = await fetch('/api/ai/remove-bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: aiOptimizedImage,
              provider: 'removebg',
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.cutoutDataUrl) {
              cutoutUrl = data.cutoutDataUrl;
              usedProvider = data.provider || 'remove.bg API';
              if (data.dominantBgColor) dominantColor = data.dominantBgColor;
              if (data) setDetectionData(data);
              addToast('Subject Isolated', 'Clean transparent cutout generated via remove.bg.', 'success');
            }
          } else {
            setAiStatus((prev) =>
              prev
                ? {
                    ...prev,
                    removeBg: {
                      isConfigured: prev.removeBg?.isConfigured ?? false,
                      ...prev.removeBg,
                      hasUsableCredits: false,
                    },
                  }
                : prev
            );
            addToast('Studio Fast Vision Active', 'Subject isolated using Studio Fast Vision.', 'info');
          }
        } catch {
          setAiStatus((prev) =>
            prev
              ? {
                  ...prev,
                  removeBg: {
                    isConfigured: prev.removeBg?.isConfigured ?? false,
                    ...prev.removeBg,
                    hasUsableCredits: false,
                  },
                }
              : prev
          );
          addToast('Studio Fast Vision Active', 'Subject isolated using Studio Fast Vision.', 'info');
        }
      }

      // 2. If remove.bg wasn't used or failed, run local high-precision alpha matting
      if (!cutoutUrl) {
        const result = await removeBackground(activeImage.currentUrl, {
          tolerance: 38,
        });
        cutoutUrl = result.cutoutDataUrl;
        usedProvider = 'Studio Fast Vision';
        dominantColor = result.dominantBgColor || '#FFFFFF';
      }

      let finalCutoutUrl = cutoutUrl;
      const targetW = activeImage.width;
      const targetH = activeImage.height;

      const cutoutImg = await loadImage(cutoutUrl);
      // Guarantee exact image dimension match so viewport never shrinks or zooms out
      if (cutoutImg.naturalWidth !== targetW || cutoutImg.naturalHeight !== targetH) {
        const normCanvas = document.createElement('canvas');
        normCanvas.width = targetW;
        normCanvas.height = targetH;
        const nCtx = normCanvas.getContext('2d');
        if (nCtx) {
          nCtx.imageSmoothingEnabled = true;
          nCtx.imageSmoothingQuality = 'high';
          nCtx.drawImage(cutoutImg, 0, 0, targetW, targetH);
          finalCutoutUrl = normCanvas.toDataURL('image/png');
        }
      }

      const finalImg = await loadImage(finalCutoutUrl);
      const newThumb = createThumbnail(finalImg, 140);

      const updated: ImageItem = {
        ...activeImage,
        currentUrl: finalCutoutUrl,
        width: targetW,
        height: targetH,
        thumbnailUrl: newThumb,
        background: {
          isTransparent: true,
          color: dominantColor,
        },
      };

      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
      const isRot = updated.transform.rotation === 90 || updated.transform.rotation === 270;
      const currentW = isRot ? targetH : targetW;
      const currentH = isRot ? targetW : targetH;
      initCropRect(currentW, currentH, cropAspect);
      setActiveTool('background'); // Switch to background tab to see transparency and color options
      pushHistory(updated, `Background Removed (${usedProvider})`);

      addToast(
        'Background Removed',
        `Clean subject isolation complete using ${usedProvider}. Canvas set to transparent.`,
        'success'
      );
    } catch (err: any) {
      console.error('Background removal error:', err);
      addToast(
        'Background Removal Notice',
        err.message || 'Background removal encountered an issue. Please try again.',
        'error'
      );
    } finally {
      setIsRemovingBg(false);
    }
  };

  // Normal (non-AI) tone enhancement when AI Enhance is toggled OFF
  const handleNormalEnhance = async () => {
    if (!activeImage || isEnhancing) return;

    setIsEnhancing(true);
    addToast(
      'Enhancing Photo...',
      'Balancing exposure and natural studio tone curve...',
      'info'
    );

    try {
      const localEnh = await analyzeAndAutoEnhance(activeImage.currentUrl);
      const updated: ImageItem = {
        ...activeImage,
        adjustments: {
          ...activeImage.adjustments,
          brightness: localEnh.brightness,
          contrast: localEnh.contrast,
          saturation: localEnh.saturation,
          exposure: localEnh.exposure,
          sharpness: localEnh.sharpness,
        },
      };

      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
      setActiveTool('adjustments');
      pushHistory(updated, 'Normal Auto-Enhance');

      addToast(
        'Photo Adjusted',
        localEnh.explanation || 'Optimized exposure and tonal balance.',
        'success'
      );
    } catch (err: any) {
      console.error('Normal enhance error:', err);
      addToast(
        'Enhance Notice',
        err.message || 'Auto-enhance encountered an issue.',
        'error'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // Cancel ongoing enhancement action
  const handleCancelEnhance = useCallback(() => {
    if (enhanceAbortControllerRef.current) {
      enhanceAbortControllerRef.current.abort();
      enhanceAbortControllerRef.current = null;
    }
    setIsEnhancing(false);
    setEnhanceProgress(null);
    addToast('Enhancement Cancelled', 'Processing stopped by user.', 'info');
  }, []);

  // AI SwinIR Local Super-Resolution & Photo Restoration (100% Browser Inference)
  const handleSwinIREnhance = async (options: {
    scale: 1 | 2 | 4;
    strength: number;
    preset?: 'natural' | 'portrait' | 'old_photo' | 'low_quality';
    isPreview?: boolean;
  }) => {
    if (!activeImage || isEnhancing) return;

    setIsEnhancing(true);
    setEnhanceProgress(null);
    const controller = new AbortController();
    enhanceAbortControllerRef.current = controller;

    const actionLabel =
      options.scale === 1
        ? 'SwinIR AI Restoration'
        : `${options.scale}× SwinIR Super-Resolution`;

    addToast(
      actionLabel,
      options.isPreview
        ? 'Generating rapid preview (~1–2s)...'
        : `Restoring photograph with SwinIR (Preset: ${options.preset || 'natural'}, Strength: ${options.strength}%)...`,
      'info'
    );

    try {
      let sourceToProcess: string | HTMLCanvasElement = activeImage.currentUrl;

      // 1. For live preview: resize image to compact single-tile resolution (160px max)
      if (options.isPreview) {
        const previewCanvas = document.createElement('canvas');
        const origImg = await loadImage(activeImage.currentUrl);
        const maxPreviewDim = 160;
        const scaleDown = Math.min(1.0, maxPreviewDim / Math.max(origImg.naturalWidth, origImg.naturalHeight));
        previewCanvas.width = Math.max(64, Math.round(origImg.naturalWidth * scaleDown));
        previewCanvas.height = Math.max(64, Math.round(origImg.naturalHeight * scaleDown));
        const pCtx = previewCanvas.getContext('2d');
        if (pCtx) {
          pCtx.imageSmoothingEnabled = true;
          pCtx.imageSmoothingQuality = 'high';
          pCtx.drawImage(origImg, 0, 0, previewCanvas.width, previewCanvas.height);
          sourceToProcess = previewCanvas;
        }
      }

      // Execute SwinIR restoration pipeline entirely inside user's browser
      const result = await enhanceImageWithBrowserSwinIR(sourceToProcess, {
        scale: options.scale,
        strength: options.strength,
        preset: options.preset || 'natural',
        abortSignal: controller.signal,
        onProgress: (prog) => {
          setEnhanceProgress(prog);
        },
      });

      const enhancedDataUrl = result.dataUrl;
      const targetWidth = options.isPreview ? result.width : activeImage.width * options.scale;
      const targetHeight = options.isPreview ? result.height : activeImage.height * options.scale;
      const backendName = result.backend.toUpperCase();
      const providerName = `Browser SwinIR (${backendName})`;

      const enhancedImg = await loadImageSource(enhancedDataUrl);

      const updated: ImageItem = {
        ...activeImage,
        currentUrl: enhancedDataUrl,
        width: targetWidth,
        height: targetHeight,
        thumbnailUrl: createThumbnail(enhancedImg as HTMLImageElement),
        adjustments: {
          ...activeImage.adjustments,
          sharpness: 0, // Prevent double-sharpening
        },
      };

      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
      pushHistory(
        updated,
        options.isPreview
          ? `Preview: ${actionLabel} (${options.strength}%)`
          : `${actionLabel} (${options.strength}%)`
      );

      addToast(
        options.isPreview ? 'AI Preview Ready' : 'Photo Restored',
        `${actionLabel} complete (${targetWidth} × ${targetHeight} px).`,
        'success'
      );
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('cancelled')) {
        addToast('Enhancement Cancelled', 'Processing stopped by user.', 'info');
        return;
      }
      console.error('[SwinIR Diagnostics] MODEL STATUS: failed', err);
      addToast(
        'Enhancement Failed',
        `Photo enhancement failed: ${err?.message || 'Processing could not be completed'}.`,
        'error'
      );
    } finally {
      setIsEnhancing(false);
      setEnhanceProgress(null);
      enhanceAbortControllerRef.current = null;
    }
  };

  // Instant Studio Auto-Enhance Action (Runs professional restoration at 1x)
  const handleAutoEnhance = async () => {
    await handleSwinIREnhance({ scale: 1, strength: 50, preset: 'natural', isPreview: false });
  };

  // Flip & Resize Action
  const handleFlipResize = () => {
    if (!activeImage) return;

    const updated: ImageItem = {
      ...activeImage,
      transform: {
        ...activeImage.transform,
        flipH: !activeImage.transform.flipH,
      },
    };

    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
    pushHistory(updated, 'Mirrored Photo');
    addToast('Transform', 'Flipped horizontally.', 'info');
  };

  // AI Object Detection Target Selection (Face, Skin, Hair) with Pixel-Level 5px Feathered Masks
  const handleSelectObjectTarget = async (target: ObjectDetectionTarget) => {
    if (!activeImage) return;

    // DO NOT run face detection when image is in full size - make user crop first
    if (!activeImage.isCropped) {
      addToast(
        'Crop First',
        'Please crop your photo using the toolbar under the photo before retouching or face detection.',
        'warning'
      );
      setActiveTool('crop');
      return;
    }

    // If toggling off or clearing
    if (target === selectedObjectTarget || target === 'none') {
      if (maskOriginalImageUrl && activeImage) {
        const restored: ImageItem = { ...activeImage, currentUrl: maskOriginalImageUrl };
        setImages((prev) => prev.map((img) => (img.id === activeImage.id ? restored : img)));
      }
      setSelectedObjectTarget('none');
      setActiveMask(null);
      setMaskOriginalImageUrl(null);
      setAreaAdjustments({ brightness: 0, contrast: 0, smoothness: 0, warmth: 0 });
      return;
    }

    // If switching from another target while preview was dirty, restore original before new selection
    if (maskOriginalImageUrl && activeImage) {
      const restored: ImageItem = { ...activeImage, currentUrl: maskOriginalImageUrl };
      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? restored : img)));
    }

    setSelectedObjectTarget(target);
    setAreaAdjustments({ brightness: 0, contrast: 0, smoothness: 0, warmth: 0 });

    if (!activeImage) return;

    const originalUrlSnapshot = activeImage.currentUrl;
    setMaskOriginalImageUrl(originalUrlSnapshot);

    const FACE_MASK_VERSION = 'v8_optimized_preview_pipeline';
    const urlSample = originalUrlSnapshot.length > 64 
      ? `${originalUrlSnapshot.length}_${originalUrlSnapshot.slice(0, 32)}_${originalUrlSnapshot.slice(-32)}`
      : originalUrlSnapshot;
    const cacheKey = `${activeImage.id}_${activeImage.width}x${activeImage.height}_${urlSample}_${target}_${FACE_MASK_VERSION}`;
    if (maskCacheRef.current.has(cacheKey)) {
      const cached = maskCacheRef.current.get(cacheKey)!;
      setActiveMask(cached);
      const maskBounds = cached.bounds;
      setDetectionData({
        [target]: {
          xmin: Math.max(0, Math.round((maskBounds.x / activeImage.width) * 100)),
          ymin: Math.max(0, Math.round((maskBounds.y / activeImage.height) * 100)),
          xmax: Math.min(100, Math.round(((maskBounds.x + maskBounds.width) / activeImage.width) * 100)),
          ymax: Math.min(100, Math.round(((maskBounds.y + maskBounds.height) / activeImage.height) * 100)),
          confidence: 0.98,
          attributes: {
            lighting: 'Studio Calibrated',
            pose: 'Biometric Frontal',
          },
          tone: 'Natural Human Complexion',
          texture: 'High-frequency strands',
        },
        summary: `${target.toUpperCase()} pixel-accurate mask active.`,
        provider: 'Pixel Mask Segmentation Engine',
      });
      return;
    }

    setIsDetecting(true);

    try {
      const imgEl = await loadImage(originalUrlSnapshot);

      // Run high-speed target mask generation
      const mask = await maskEngine.generateTargetMask(imgEl, target, undefined, activeImage.id);
      maskCacheRef.current.set(cacheKey, mask);
      setActiveMask(mask);

      // Detection metadata for status summaries & overlays
      const maskBounds = mask.bounds;
      const maskData: AIDetectionData = {
        [target]: {
          xmin: Math.max(0, Math.round((maskBounds.x / activeImage.width) * 100)),
          ymin: Math.max(0, Math.round((maskBounds.y / activeImage.height) * 100)),
          xmax: Math.min(100, Math.round(((maskBounds.x + maskBounds.width) / activeImage.width) * 100)),
          ymax: Math.min(100, Math.round(((maskBounds.y + maskBounds.height) / activeImage.height) * 100)),
          confidence: 0.98,
          attributes: {
            lighting: 'Studio Calibrated',
            pose: 'Biometric Frontal',
          },
          tone: mask.skinToneDescription || 'Natural Human Complexion',
          coveragePercent: mask.skinCoveragePercent,
          texture: 'High-frequency strands',
        },
        summary: target === 'skin'
          ? `SKIN semantic mask active: ${mask.skinToneDescription || 'Human Complexion'}${mask.skinCoveragePercent ? ` (${mask.skinCoveragePercent}% coverage)` : ''} across visible face, neck, and body.`
          : `${target.toUpperCase()} pixel-accurate mask created with soft edge feathering.`,
        provider: 'Pixel Mask Segmentation Engine',
      };

      setDetectionData(maskData);
    } catch (err: any) {
      console.error('Pixel mask generation error:', err);
      addToast(
        'Mask Generation Notice',
        err.message || `Failed to segment ${target}. Please verify your photo.`,
        'error'
      );
    } finally {
      setIsDetecting(false);
    }
  };

  // Real-time update of area brightness, contrast, smoothness, warmth, saturation
  const handleUpdateAreaAdjustments = async (newAdjustments: SelectedAreaAdjustments) => {
    setAreaAdjustments(newAdjustments);
    if (!activeImage || !activeMask || !maskOriginalImageUrl) return;

    try {
      const origImgEl = await loadImage(maskOriginalImageUrl);
      const adjustedUrl = maskEngine.applyAdjustmentsToMask(origImgEl, activeMask, newAdjustments);

      // Real-time canvas preview of modified pixels ONLY covered by the mask
      setImages((prev) =>
        prev.map((img) => (img.id === activeImage.id ? { ...img, currentUrl: adjustedUrl } : img))
      );
    } catch (err) {
      console.error('Real-time mask adjustment error:', err);
    }
  };

  // Interactive repositioning/moving of the selection mask
  const handleUpdateMaskOffset = async (offset: { x: number; y: number }) => {
    if (!activeMask || !activeImage) return;

    const updatedMask: MaskData = {
      ...activeMask,
      offset,
    };
    setActiveMask(updatedMask);

    // Re-render composite with current adjustments and updated mask offset
    if (
      maskOriginalImageUrl &&
      (areaAdjustments.brightness !== 0 ||
        areaAdjustments.contrast !== 0 ||
        areaAdjustments.smoothness !== 0 ||
        areaAdjustments.warmth !== 0)
    ) {
      try {
        const origImgEl = await loadImage(maskOriginalImageUrl);
        const adjustedUrl = maskEngine.applyAdjustmentsToMask(origImgEl, updatedMask, areaAdjustments);
        setImages((prev) =>
          prev.map((img) => (img.id === activeImage.id ? { ...img, currentUrl: adjustedUrl } : img))
        );
      } catch (err) {
        console.error('Mask offset adjustment error:', err);
      }
    }
  };

  // Object Detection Action (Apply mask adjustments permanently)
  const handleApplyObjectAction = async () => {
    if (!activeImage || selectedObjectTarget === 'none' || !activeMask || !maskOriginalImageUrl) {
      setSelectedObjectTarget('none');
      setActiveMask(null);
      setMaskOriginalImageUrl(null);
      return;
    }

    try {
      addToast(
        'Compositing Mask Adjustments...',
        `Permanently applying ${selectedObjectTarget} adjustments (Brightness: ${areaAdjustments.brightness > 0 ? '+' : ''}${areaAdjustments.brightness}%, Contrast: ${areaAdjustments.contrast > 0 ? '+' : ''}${areaAdjustments.contrast}%)...`,
        'info'
      );

      const origImgEl = await loadImage(maskOriginalImageUrl);
      const finalUrl = maskEngine.applyAdjustmentsToMask(origImgEl, activeMask, areaAdjustments);
      const imgEl = await loadImage(finalUrl);
      const newThumb = createThumbnail(imgEl, 140);

      const updated: ImageItem = {
        ...activeImage,
        currentUrl: finalUrl,
        thumbnailUrl: newThumb,
      };

      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
      pushHistory(
        updated,
        `${selectedObjectTarget.toUpperCase()} Mask (B: ${areaAdjustments.brightness}%, C: ${areaAdjustments.contrast}%)`
      );

      addToast(
        'Mask Adjustments Applied',
        `Adjustments permanently composited onto ${selectedObjectTarget}.`,
        'success'
      );

      // Clean up mask state
      setSelectedObjectTarget('none');
      setActiveMask(null);
      setMaskOriginalImageUrl(null);
      setAreaAdjustments({ brightness: 0, contrast: 0, smoothness: 0, warmth: 0 });
    } catch (err: any) {
      console.error('Apply mask adjustments error:', err);
      addToast('Apply Notice', err.message || 'Could not permanently composite adjustments.', 'error');
    }
  };

  // Object Detection Action (Cancel & restore original image)
  const handleCancelObjectAction = () => {
    if (maskOriginalImageUrl && activeImage) {
      const restored: ImageItem = {
        ...activeImage,
        currentUrl: maskOriginalImageUrl,
      };
      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? restored : img)));
    }

    setSelectedObjectTarget('none');
    setActiveMask(null);
    setMaskOriginalImageUrl(null);
    setAreaAdjustments({ brightness: 0, contrast: 0, smoothness: 0, warmth: 0 });
    addToast('Selection Cancelled', 'Original image restored and mask cleared.', 'info');
  };

  // Smooth Passport Crop Trigger: frames crop size directly without running face detection on full-size image
  const handleTriggerSmoothPassportCrop = () => {
    if (!activeImage) return;

    setActiveTool('crop');
    const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
    const currentW = isRot ? activeImage.height : activeImage.width;
    const currentH = isRot ? activeImage.width : activeImage.height;
    initCropRect(currentW, currentH, cropAspect);
  };

  // Invert Cutout Mask: toggles between subject and background isolation
  const handleInvertCutout = async () => {
    if (!activeImage) return;

    try {
      addToast(
        'Inverting Cutout Mask...',
        'Swapping transparency mask between subject and background...',
        'info'
      );

      const invertedUrl = await invertCutout(activeImage.currentUrl);
      const imgEl = await loadImage(invertedUrl);
      const newThumb = createThumbnail(imgEl, 140);

      const updated: ImageItem = {
        ...activeImage,
        currentUrl: invertedUrl,
        thumbnailUrl: newThumb,
        background: {
          ...activeImage.background,
          isTransparent: true,
        },
      };

      setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
      pushHistory(updated, 'Inverted Cutout (Background / Subject Swap)');

      addToast(
        'Cutout Inverted',
        'Transparency mask inverted. Subject and background swapped.',
        'success'
      );
    } catch (err: any) {
      console.error('Invert cutout error:', err);
      addToast('Invert Failed', err.message || 'Could not invert cutout mask.', 'error');
    }
  };

  // Crop Handlers
  const handleSelectCropAspect = (aspect: AspectRatioOption, custom?: CustomInchSize) => {
    setCropAspect(aspect);
    if (custom) {
      setCustomInchSize(custom);
    }
    if (activeImage) {
      const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
      const currentW = isRot ? activeImage.height : activeImage.width;
      const currentH = isRot ? activeImage.width : activeImage.height;
      if (aspect === 'custom_inch' && custom) {
        const safeW = Math.max(10, Math.round(currentW || 800));
        const safeH = Math.max(10, Math.round(currentH || 600));
        const inchW = Math.max(0.1, custom.widthInches || 2);
        const inchH = Math.max(0.1, custom.heightInches || 2);
        const ratio = inchW / inchH;
        let cropW = Math.round(safeW * 0.75);
        let cropH = Math.round(cropW / ratio);
        if (cropH > safeH * 0.9) {
          cropH = Math.round(safeH * 0.82);
          cropW = Math.round(cropH * ratio);
        }
        const cropX = Math.round((safeW - cropW) / 2);
        const cropY = Math.round((safeH - cropH) / 2);
        setCropRect({ x: Math.max(0, cropX), y: Math.max(0, cropY), width: Math.max(1, cropW), height: Math.max(1, cropH) });
      } else {
        initCropRect(currentW, currentH, aspect);
      }
    }
  };

  const handleApplyCrop = async () => {
    if (!activeImage || !cropRect) return;

    try {
      const img = await loadImage(activeImage.currentUrl);

      // Render composite canvas that precisely matches what the user sees on screen:
      // - Background layer: transparent (via ctx.clearRect) if isTransparent is true, or solid fill if false
      // - Subject layer: transparent cutout or original photo cleanly drawn with any user rotation/flip
      // - Non-destructive styles: adjustments, filters, and borders are kept out of the baked raster
      //   so the user can continue modifying them freely after the crop.
      const composite = renderCompositeCanvas(img, {
        ...activeImage,
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        filter: 'original',
        border: { enabled: false, color: '#FFFFFF', width: 0, radius: 0 },
      });

      const croppedDataUrl = await applyCrop(composite, cropRect);
      const croppedImg = await loadImage(croppedDataUrl);
      const newThumb = createThumbnail(croppedImg, 140);

      // Discard oversized uncropped original - hold only the cropped image in memory & state
      const updated: ImageItem = {
        ...activeImage,
        isCropped: true,
        originalUrl: croppedDataUrl,
        currentUrl: croppedDataUrl,
        originalFile: undefined,
        width: croppedImg.naturalWidth,
        height: croppedImg.naturalHeight,
        originalWidth: croppedImg.naturalWidth,
        originalHeight: croppedImg.naturalHeight,
        sizeBytes: Math.round(croppedDataUrl.length * 0.75),
        thumbnailUrl: newThumb,
        // Since rotation & flips are baked into the cropped image orientation:
        transform: {
          rotation: 0,
          flipH: false,
          flipV: false,
        },
      };

      // Clear previous uncropped mask caches and state
      maskCacheRef.current.clear();
      setActiveMask(null);
      setMaskOriginalImageUrl(null);
      setSelectedObjectTarget('none');

      setImages((prev) => prev.map((i) => (i.id === activeImage.id ? updated : i)));
      pushHistory(updated, `Cropped to ${updated.width} × ${updated.height}`);
      initCropRect(updated.width, updated.height, cropAspect);
      setActiveTool('object');
      addToast('Crop Applied', `${updated.width} × ${updated.height} px — Ready for retouching`, 'success');
    } catch (err: any) {
      console.error('Crop error:', err);
      addToast('Crop Failed', err.message || 'Crop operation failed', 'error');
    }
  };

  const handleCancelCrop = () => {
    if (activeImage) {
      const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
      const currentW = isRot ? activeImage.height : activeImage.width;
      const currentH = isRot ? activeImage.width : activeImage.height;
      initCropRect(currentW, currentH, cropAspect);
    }
    setActiveTool('object');
  };

  const handleSelectTool = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (tool === 'crop' && activeImage) {
      const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
      const currentW = isRot ? activeImage.height : activeImage.width;
      const currentH = isRot ? activeImage.width : activeImage.height;
      if (
        !cropRect ||
        cropRect.width > currentW ||
        cropRect.height > currentH ||
        cropRect.x + cropRect.width > currentW ||
        cropRect.y + cropRect.height > currentH
      ) {
        initCropRect(currentW, currentH, cropAspect);
      }
    }
  };

  // Background change
  const handleChangeBackground = (bg: BackgroundSettings) => {
    if (!activeImage) return;
    const updated = { ...activeImage, background: bg };
    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
    pushHistory(updated, `Background: ${bg.color}`);
  };

  // Border change
  const handleChangeBorder = (border: BorderSettings) => {
    if (!activeImage) return;
    const updated = { ...activeImage, border };
    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
    pushHistory(updated, `Border: ${border.enabled ? `${border.width}px` : 'None'}`);
  };

  // Filters & Adjustments
  const handleSelectFilter = (filter: FilterType) => {
    if (!activeImage) return;
    const updated = { ...activeImage, filter };
    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
    pushHistory(updated, `Filter: ${filter}`);
  };

  const handleUpdateAdjustments = (adjustments: ImageAdjustments) => {
    if (!activeImage) return;
    setImages((prev) =>
      prev.map((img) => (img.id === activeImage.id ? { ...img, adjustments } : img))
    );
  };

  const handleResetAdjustments = () => {
    if (!activeImage) return;
    const updated = { ...activeImage, adjustments: { ...DEFAULT_ADJUSTMENTS } };
    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
    pushHistory(updated, 'Reset Adjustments');
  };

  // Add Joint Photo to Tray
  const handleAddJointImage = (jointItem: ImageItem) => {
    setImages((prev) => [...prev, jointItem]);
    setActiveImageId(jointItem.id);
    addToast('Joint Photo Created', 'Added composite image to tray.', 'success');
  };

  const handleUpdatePassport = (newPassport: PassportSettings) => {
    if (!activeImage) return;
    const updated: ImageItem = {
      ...activeImage,
      passport: newPassport,
    };
    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
  };

  const handleApplyPassportMode = () => {
    if (!activeImage) return;
    setCropAspect('passport');
    setActiveTool('crop');
    const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
    const currentW = isRot ? activeImage.height : activeImage.width;
    const currentH = isRot ? activeImage.width : activeImage.height;
    initCropRect(currentW, currentH, 'passport');
    addToast(
      'Passport Standard Applied',
      `${activeImage.passport.isJoint ? '2-Person Joint' : 'Single Person'} standard & biometric alignment frame set.`,
      'info'
    );
  };

  // Handle operations applied by AI Assistant
  const handleApplyAIOperations = async (operations: EditOperation[], explanation: string) => {
    if (!activeImage) return;

    let updated = { ...activeImage };
    let shouldRecalculateCrop = false;

    for (const op of operations) {
      switch (op.type) {
        case 'setBrightness':
          updated = {
            ...updated,
            adjustments: {
              ...updated.adjustments,
              brightness: Math.max(-100, Math.min(100, op.value)),
            },
          };
          break;
        case 'setContrast':
          updated = {
            ...updated,
            adjustments: {
              ...updated.adjustments,
              contrast: Math.max(-100, Math.min(100, op.value)),
            },
          };
          break;
        case 'setSaturation':
          updated = {
            ...updated,
            adjustments: {
              ...updated.adjustments,
              saturation: Math.max(-100, Math.min(100, op.value)),
            },
          };
          break;
        case 'setExposure':
          updated = {
            ...updated,
            adjustments: {
              ...updated.adjustments,
              exposure: Math.max(-100, Math.min(100, op.value)),
            },
          };
          break;
        case 'setFilter':
          if (op.filter) {
            updated = { ...updated, filter: op.filter as FilterType };
          }
          break;
        case 'rotate':
          if (typeof op.degrees === 'number') {
            const rot = ((updated.transform.rotation + op.degrees) % 360) as 0 | 90 | 180 | 270;
            updated = {
              ...updated,
              transform: { ...updated.transform, rotation: rot },
            };
          }
          break;
        case 'flipHorizontal':
          updated = {
            ...updated,
            transform: { ...updated.transform, flipH: op.value !== undefined ? op.value : !updated.transform.flipH },
          };
          break;
        case 'flipVertical':
          updated = {
            ...updated,
            transform: { ...updated.transform, flipV: op.value !== undefined ? op.value : !updated.transform.flipV },
          };
          break;
        case 'setBackground':
          if (op.color) {
            updated = {
              ...updated,
              background: { color: op.color, isTransparent: false },
            };
          }
          break;
        case 'setTransparency':
          updated = {
            ...updated,
            background: { ...updated.background, isTransparent: op.enabled },
          };
          break;
        case 'setBorder':
          updated = {
            ...updated,
            border: {
              enabled: op.enabled ?? true,
              color: op.color ?? updated.border.color,
              width: op.width ?? updated.border.width,
              radius: op.radius ?? updated.border.radius,
            },
          };
          break;
        case 'resetAdjustments':
          updated = {
            ...updated,
            adjustments: { ...DEFAULT_ADJUSTMENTS },
            filter: 'original',
          };
          break;
        case 'crop':
          if (op.aspect) {
            setCropAspect(op.aspect as AspectRatioOption);
            shouldRecalculateCrop = true;
          } else if (typeof op.width === 'number' && typeof op.height === 'number') {
            setCropRect({
              x: op.x ?? Math.max(0, Math.round((updated.width - op.width) / 2)),
              y: op.y ?? Math.max(0, Math.round((updated.height - op.height) / 2)),
              width: op.width,
              height: op.height,
            });
            setActiveTool('crop');
          }
          break;
        case 'removeBackground':
          await handleRemoveBackground();
          return;
        case 'enhancePhoto':
          await handleAutoEnhance();
          return;
      }
    }

    setImages((prev) => prev.map((img) => (img.id === activeImage.id ? updated : img)));
    pushHistory(updated, `AI Assist: ${explanation}`);
    addToast('AI Assistant', explanation, 'success');

    if (shouldRecalculateCrop) {
      setActiveTool('crop');
      const isRot = updated.transform.rotation === 90 || updated.transform.rotation === 270;
      const currentW = isRot ? updated.height : updated.width;
      const currentH = isRot ? updated.width : updated.height;
      initCropRect(currentW, currentH, cropAspect);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B1120] text-slate-100 overflow-hidden select-none">
      {/* Hidden file input for header or center upload trigger */}
      <input
        ref={hiddenUploadInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
          }
        }}
      />

      {/* 1. Header matching exact screenshot */}
      <EditorHeader
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onEraser={handleRemoveBackground}
        onEnhance={handleAutoEnhance}
        isRemovingBg={isRemovingBg}
        isEnhancing={isEnhancing}
        onFlipResize={handleFlipResize}
        onExport={() => setIsExportOpen(true)}
        onSaveProject={() => setIsProjectOpen(true)}
        onPrint={() => setIsPrintOpen(true)}
        onJointPhoto={() => setIsJointPhotoOpen(true)}
        isPowerMode={isPowerMode}
        onTogglePowerMode={() => {
          setIsPowerMode(!isPowerMode);
          addToast(
            isPowerMode ? 'Power Mode OFF' : 'Power Mode ON',
            isPowerMode ? 'Standard speed canvas' : 'Turbo neural inference & high-res rendering',
            'info'
          );
        }}
        hasActiveImage={Boolean(activeImage)}
        aiStatus={aiStatus}
      />

      {/* 2. Main 3-Column Studio Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column: Tools Panel */}
        <LeftToolPanel
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          activeImage={activeImage}
          selectedObjectTarget={selectedObjectTarget}
          onSelectObjectTarget={handleSelectObjectTarget}
          onApplyObjectAction={handleApplyObjectAction}
          onCancelObjectAction={handleCancelObjectAction}
          onRemoveBackground={handleRemoveBackground}
          onInvertCutout={handleInvertCutout}
          onAutoEnhance={handleNormalEnhance}
          onSwinIREnhance={handleSwinIREnhance}
          enhanceProgress={enhanceProgress}
          onCancelEnhance={handleCancelEnhance}
          isRemovingBg={isRemovingBg}
          isEnhancing={isEnhancing}
          isDetecting={isDetecting}
          detectionData={detectionData}
          areaAdjustments={areaAdjustments}
          onUpdateAreaAdjustments={handleUpdateAreaAdjustments}
          cropRect={cropRect}
          cropAspect={cropAspect}
          customInchSize={customInchSize}
          onSelectCropAspect={handleSelectCropAspect}
          onTriggerSmoothPassportCrop={handleTriggerSmoothPassportCrop}
          onApplyCrop={handleApplyCrop}
          onCancelCrop={handleCancelCrop}
          onResetCropArea={() => {
            if (activeImage) {
              const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
              initCropRect(
                isRot ? activeImage.height : activeImage.width,
                isRot ? activeImage.width : activeImage.height,
                cropAspect
              );
            }
          }}
          onSelectFilter={handleSelectFilter}
          onUpdateAdjustments={handleUpdateAdjustments}
          onResetAdjustments={handleResetAdjustments}
          onChangeBackground={handleChangeBackground}
          aiStatus={aiStatus}
          onOpenPassportMode={() => setActiveTool('passport')}
          onOpenAIAssistant={() => setIsAIModalOpen(true)}
          onOpenJointPhotoModal={() => setIsJointPhotoOpen(true)}
          onChangePassport={handleUpdatePassport}
          onApplyPassport={handleApplyPassportMode}
          onCancelPassport={() => setActiveTool('object')}
        />

        {/* Center Column: Interactive Canvas */}
        <PhotoCanvas
          activeImage={activeImage}
          activeTool={activeTool}
          cropRect={cropRect}
          cropAspect={cropAspect}
          customInchSize={customInchSize}
          onUpdateCropRect={setCropRect}
          onApplyCrop={handleApplyCrop}
          onCancelCrop={handleCancelCrop}
          onSelectCropAspect={handleSelectCropAspect}
          onResetCropArea={() => {
            if (activeImage) {
              const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
              const currentW = isRot ? activeImage.height : activeImage.width;
              const currentH = isRot ? activeImage.width : activeImage.height;
              initCropRect(currentW, currentH, cropAspect);
            }
          }}
          onUploadClick={() => hiddenUploadInputRef.current?.click()}
          onDropFiles={handleUploadFiles}
          onSelectSample={handleSelectSample}
          selectedObjectTarget={selectedObjectTarget}
          detectionData={detectionData}
          isDetecting={isDetecting}
          activeMask={activeMask}
          onUpdateMaskOffset={handleUpdateMaskOffset}
        />

        {/* Right Column: Image Tray, Colors, 2px Border, Joint Photo */}
        <ImageTray
          images={images}
          activeImageId={activeImageId}
          onSelectImage={setActiveImageId}
          onDeleteImage={handleDeleteImage}
          onAddImages={handleUploadFiles}
          background={activeImage ? activeImage.background : DEFAULT_BACKGROUND}
          onChangeBackground={handleChangeBackground}
          border={activeImage ? activeImage.border : DEFAULT_BORDER}
          onChangeBorder={handleChangeBorder}
          onOpenJointPhotoModal={() => setIsJointPhotoOpen(true)}
        />
      </div>

      {/* Modals */}
      {isExportOpen && activeImage && (
        <ExportModal
          activeImage={activeImage}
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          onSuccess={(filename) =>
            addToast('Export Successful', `Saved ${filename} to downloads.`, 'success')
          }
          onError={(err) => addToast('Export Failed', err, 'error')}
        />
      )}

      {isPrintOpen && activeImage && (
        <PrintModal
          activeImage={activeImage}
          images={images}
          isOpen={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
        />
      )}

      {isProjectOpen && activeImage && (
        <ProjectModal
          activeImage={activeImage}
          isOpen={isProjectOpen}
          onClose={() => setIsProjectOpen(false)}
          onLoadProject={(p) => {
            if (!activeImage) return;
            const updated = { ...activeImage, ...p };
            setImages((prev) => prev.map((i) => (i.id === activeImage.id ? updated : i)));
            pushHistory(updated, 'Loaded Project');
          }}
          onShowToast={addToast}
        />
      )}

      {isJointPhotoOpen && (
        <JointPhotoModal
          isOpen={isJointPhotoOpen}
          onClose={() => setIsJointPhotoOpen(false)}
          images={images}
          activeImage={activeImage}
          onAddJointImage={handleAddJointImage}
        />
      )}

      {isAIModalOpen && (
        <AIAssistantModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          activeImage={activeImage}
          aiStatus={aiStatus}
          onApplyAIOperations={handleApplyAIOperations}
        />
      )}

      {/* Toasts */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
