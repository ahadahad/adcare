import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Smile,
  User,
  Scissors,
  Sparkles,
  Check,
  Move,
  X,
  RotateCcw,
  Crosshair,
  Loader2,
} from 'lucide-react';
import {
  ImageItem,
  ActiveTool,
  CropRect,
  AspectRatioOption,
  ObjectDetectionTarget,
  AIDetectionData,
  CustomInchSize,
} from '../../types/editor';
import { renderCompositeCanvas, loadImageSource, isValidCanvasImageSource } from '../../utils/canvas';
import { sampleImages } from '../../utils/sampleImages';
import { MaskData } from '../../cv/segmentation/maskEngine';

interface PhotoCanvasProps {
  activeImage: ImageItem | null;
  activeTool: ActiveTool;
  cropRect: CropRect | null;
  cropAspect: AspectRatioOption;
  customInchSize?: CustomInchSize;
  onUpdateCropRect: (rect: CropRect) => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onSelectCropAspect?: (aspect: AspectRatioOption, custom?: CustomInchSize) => void;
  onResetCropArea?: () => void;
  onUploadClick: () => void;
  onDropFiles: (files: FileList) => void;
  onSelectSample: (sample: any) => void;
  selectedObjectTarget: ObjectDetectionTarget;
  detectionData?: AIDetectionData | null;
  isDetecting?: boolean;
  activeMask?: MaskData | null;
  onUpdateMaskOffset?: (offset: { x: number; y: number }) => void;
}

function getBiometricFacePath(width: number, height: number, face?: AIDetectionData['face']): string {
  if (face?.biometricContour?.svgPath) {
    return face.biometricContour.svgPath;
  }
  const xmin = ((face?.xmin ?? 28) / 100) * width;
  const xmax = ((face?.xmax ?? 72) / 100) * width;
  const ymin = ((face?.ymin ?? 18) / 100) * height;
  const ymax = ((face?.ymax ?? 68) / 100) * height;

  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  const rx = (xmax - xmin) / 2;
  const ry = (ymax - ymin) / 2;

  const topY = cy - ry * 0.95;
  const chinY = cy + ry * 1.05;
  const leftX = cx - rx * 0.92;
  const rightX = cx + rx * 0.92;
  const cheekY = cy - ry * 0.05;

  return `M ${cx} ${topY} C ${cx + rx * 0.65} ${topY}, ${rightX} ${cy - ry * 0.45}, ${rightX} ${cheekY} C ${rightX} ${cy + ry * 0.45}, ${cx + rx * 0.45} ${chinY - ry * 0.08}, ${cx} ${chinY} C ${cx - rx * 0.45} ${chinY - ry * 0.08}, ${leftX} ${cy + ry * 0.45}, ${leftX} ${cheekY} C ${leftX} ${cy - ry * 0.45}, ${cx - rx * 0.65} ${topY}, ${cx} ${topY} Z`;
}

function getBiometricSkinPath(width: number, height: number, skin?: AIDetectionData['skin']): string {
  if (skin?.svgPath) {
    return skin.svgPath;
  }
  const xmin = ((skin?.xmin ?? 24) / 100) * width;
  const xmax = ((skin?.xmax ?? 76) / 100) * width;
  const ymin = ((skin?.ymin ?? 16) / 100) * height;
  const ymax = ((skin?.ymax ?? 76) / 100) * height;

  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  const rx = (xmax - xmin) / 2;
  const ry = (ymax - ymin) / 2;

  return `M ${cx} ${cy - ry * 0.9} C ${cx + rx * 0.85} ${cy - ry * 0.9}, ${cx + rx} ${cy - ry * 0.3}, ${cx + rx} ${cy + ry * 0.1} C ${cx + rx * 0.85} ${cy + ry * 0.6}, ${cx + rx * 0.4} ${cy + ry}, ${cx} ${cy + ry} C ${cx - rx * 0.4} ${cy + ry}, ${cx - rx * 0.85} ${cy + ry * 0.6}, ${cx - rx} ${cy + ry * 0.1} C ${cx - rx} ${cy - ry * 0.3}, ${cx - rx * 0.85} ${cy - ry * 0.9}, ${cx} ${cy - ry * 0.9} Z`;
}

function getBiometricHairPath(width: number, height: number, hair?: AIDetectionData['hair']): string {
  if (hair?.svgPath) {
    return hair.svgPath;
  }
  const xmin = ((hair?.xmin ?? 18) / 100) * width;
  const xmax = ((hair?.xmax ?? 82) / 100) * width;
  const ymin = ((hair?.ymin ?? 8) / 100) * height;
  const ymax = ((hair?.ymax ?? 42) / 100) * height;

  const cx = (xmin + xmax) / 2;
  const rx = (xmax - xmin) / 2;
  const ry = (ymax - ymin) / 2;

  return `M ${xmin} ${ymin + ry * 0.8} C ${xmin - rx * 0.1} ${ymin + ry * 0.3}, ${cx - rx * 0.8} ${ymin}, ${cx} ${ymin} C ${cx + rx * 0.8} ${ymin}, ${xmax + rx * 0.1} ${ymin + ry * 0.3}, ${xmax} ${ymin + ry * 0.8} C ${xmax - rx * 0.15} ${ymax}, ${cx + rx * 0.5} ${ymax - ry * 0.3}, ${cx} ${ymax - ry * 0.25} C ${cx - rx * 0.5} ${ymax - ry * 0.3}, ${xmin + rx * 0.15} ${ymax}, ${xmin} ${ymin + ry * 0.8} Z`;
}

export const PhotoCanvas: React.FC<PhotoCanvasProps> = ({
  activeImage,
  activeTool,
  cropRect,
  cropAspect,
  customInchSize,
  onUpdateCropRect,
  onApplyCrop,
  onCancelCrop,
  onSelectCropAspect,
  onResetCropArea,
  onUploadClick,
  onDropFiles,
  onSelectSample,
  selectedObjectTarget,
  detectionData = null,
  isDetecting = false,
  activeMask = null,
  onUpdateMaskOffset,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Viewport Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const isUserZoomedRef = useRef<boolean>(false);

  // Custom size values for inline editing under the photo
  const [customW, setCustomW] = useState<number>(() => customInchSize?.widthInches || 2);
  const [customH, setCustomH] = useState<number>(() => customInchSize?.heightInches || 2);

  useEffect(() => {
    if (customInchSize) {
      if (customInchSize.widthInches) setCustomW(customInchSize.widthInches);
      if (customInchSize.heightInches) setCustomH(customInchSize.heightInches);
    }
  }, [customInchSize]);

  // Active sync refs for zero-latency transform calculations
  const zoomRef = useRef<number>(zoom);
  const panRef = useRef<{ x: number; y: number }>(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const updateZoomAndPan = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  // Track keyboard shortcuts: Space for panning, Arrow keys for crop nudging, Enter/Esc for crop actions, Ctrl +/- for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (isInput) return;

      // Spacebar for panning
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Crop-specific keyboard controls when crop is active
      if (activeTool === 'crop' && cropRect && activeImage) {
        const step = e.shiftKey ? 10 : 1;
        const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
        const maxW = isRot ? activeImage.height : activeImage.width;
        const maxH = isRot ? activeImage.width : activeImage.height;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onUpdateCropRect({
            ...cropRect,
            x: Math.max(0, cropRect.x - step),
          });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onUpdateCropRect({
            ...cropRect,
            x: Math.min(maxW - cropRect.width, cropRect.x + step),
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          onUpdateCropRect({
            ...cropRect,
            y: Math.max(0, cropRect.y - step),
          });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          onUpdateCropRect({
            ...cropRect,
            y: Math.min(maxH - cropRect.height, cropRect.y + step),
          });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onApplyCrop();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancelCrop();
        }
      }

      // Viewport Zoom shortcuts (Ctrl/Cmd + Plus / Minus / 0)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          isUserZoomedRef.current = true;
          const currentZ = zoomRef.current;
          const currentP = panRef.current;
          const nextZ = Math.min(8.0, parseFloat((currentZ * 1.25).toFixed(3)));
          const ratio = nextZ / currentZ;
          updateZoomAndPan(nextZ, {
            x: parseFloat((currentP.x * ratio).toFixed(1)),
            y: parseFloat((currentP.y * ratio).toFixed(1)),
          });
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          isUserZoomedRef.current = true;
          const currentZ = zoomRef.current;
          const currentP = panRef.current;
          const nextZ = Math.max(0.05, parseFloat((currentZ / 1.25).toFixed(3)));
          const ratio = nextZ / currentZ;
          updateZoomAndPan(nextZ, {
            x: parseFloat((currentP.x * ratio).toFixed(1)),
            y: parseFloat((currentP.y * ratio).toFixed(1)),
          });
        } else if (e.key === '0') {
          e.preventDefault();
          isUserZoomedRef.current = false;
          fitToScreen();
        } else if (e.key === '1') {
          e.preventDefault();
          isUserZoomedRef.current = true;
          updateZoomAndPan(1.0, { x: 0, y: 0 });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, cropRect, activeImage, onUpdateCropRect, onApplyCrop, onCancelCrop, updateZoomAndPan]);

  // Cropping Drag Interaction State
  type DragMode = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | null;
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartRect, setDragStartRect] = useState<CropRect | null>(null);

  const currentImageIdRef = useRef<string | null>(null);

  // Load and cache active image HTMLImageElement
  useEffect(() => {
    if (!activeImage) {
      imageElementRef.current = null;
      currentImageIdRef.current = null;
      return;
    }

    const isDifferentImage = currentImageIdRef.current !== activeImage.id;
    currentImageIdRef.current = activeImage.id;

    let isCancelled = false;

    loadImageSource(activeImage.currentUrl)
      .then((source) => {
        if (isCancelled) return;
        if (source instanceof HTMLImageElement) {
          imageElementRef.current = source;
          renderImage();
          // Only auto-fit when switching to a completely different photo ID, never when URL changes (e.g. bg removal, enhance)
          if (isDifferentImage) {
            fitToScreen();
          }
        } else {
          // If another CanvasImageSource (e.g. Canvas or ImageBitmap), wrap into HTMLImageElement
          const canvas = document.createElement('canvas');
          canvas.width = (source as any).width || 1;
          canvas.height = (source as any).height || 1;
          const cCtx = canvas.getContext('2d');
          if (cCtx) cCtx.drawImage(source, 0, 0);
          const img = new Image();
          img.onload = () => {
            if (!isCancelled) {
              imageElementRef.current = img;
              renderImage();
              if (isDifferentImage) {
                fitToScreen();
              }
            }
          };
          img.src = canvas.toDataURL();
        }
      })
      .catch((err) => {
        console.error('Failed to load active image for canvas:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeImage?.id, activeImage?.currentUrl]);

  // Re-render when image parameters change
  const renderImage = useCallback(() => {
    if (!canvasRef.current || !imageElementRef.current || !activeImage) return;

    const img = imageElementRef.current;
    if (!isValidCanvasImageSource(img)) return;

    const offscreen = renderCompositeCanvas(img, activeImage);

    const canvas = canvasRef.current;
    canvas.width = offscreen.width;
    canvas.height = offscreen.height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0);
    }
  }, [activeImage]);

  useEffect(() => {
    renderImage();
  }, [renderImage]);

  // Fit image inside container on mount or resize
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !activeImage) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 56;
    const availableW = Math.max(100, rect.width - padding);
    const availableH = Math.max(100, rect.height - padding);

    const isRotated = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
    const imgW = isRotated ? activeImage.height : activeImage.width;
    const imgH = isRotated ? activeImage.width : activeImage.height;

    const scaleW = availableW / imgW;
    const scaleH = availableH / imgH;
    const bestScale = Math.min(scaleW, scaleH, 1.0);

    const nextZ = parseFloat(bestScale.toFixed(3));
    updateZoomAndPan(nextZ, { x: 0, y: 0 });
    isUserZoomedRef.current = false;
  }, [activeImage, updateZoomAndPan]);

  const stepZoom = useCallback((factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const currentZ = zoomRef.current;
    const currentPan = panRef.current;
    const newZ = Math.max(0.05, Math.min(8.0, currentZ * factor));
    const roundedZ = parseFloat(newZ.toFixed(3));

    // Keep center of the viewport fixed during button zoom
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = cx - (rect.width / 2 + currentPan.x);
    const dy = cy - (rect.height / 2 + currentPan.y);
    const scaleRatio = roundedZ / currentZ;

    const newPan = {
      x: Math.round(currentPan.x - dx * (scaleRatio - 1)),
      y: Math.round(currentPan.y - dy * (scaleRatio - 1)),
    };

    isUserZoomedRef.current = true;
    updateZoomAndPan(roundedZ, newPan);
  }, [updateZoomAndPan]);

  const resetZoom100 = useCallback(() => {
    isUserZoomedRef.current = true;
    updateZoomAndPan(1.0, { x: 0, y: 0 });
  }, [updateZoomAndPan]);

  useEffect(() => {
    const handleResize = () => {
      if (!isUserZoomedRef.current) {
        fitToScreen();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitToScreen]);

  // Calibrated Smooth Mouse Wheel and Trackpad Pinch Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser native page zoom (Ctrl+wheel / trackpad pinch) and window scrolling
      e.preventDefault();
      e.stopPropagation();

      if (!activeImage) return;

      isUserZoomedRef.current = true;

      const containerRect = container.getBoundingClientRect();
      const cursorX = e.clientX - containerRect.left - containerRect.width / 2;
      const cursorY = e.clientY - containerRect.top - containerRect.height / 2;

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 24;
      else if (e.deltaMode === 2) delta *= 300;

      // Sensitivity calculation: smooth trackpad pinch (ctrlKey) vs standard mouse wheel
      let zoomFactor: number;
      if (e.ctrlKey) {
        const clampedDelta = Math.max(-60, Math.min(60, delta));
        zoomFactor = Math.pow(0.993, clampedDelta);
      } else {
        const clampedDelta = Math.max(-100, Math.min(100, delta));
        zoomFactor = Math.pow(0.998, clampedDelta);
      }

      const currentZ = zoomRef.current;
      const currentP = panRef.current;

      const nextZoom = Math.min(8.0, Math.max(0.05, parseFloat((currentZ * zoomFactor).toFixed(4))));
      if (Math.abs(nextZoom - currentZ) < 0.0005) return;

      const ratio = nextZoom / currentZ;
      const nextPan = {
        x: parseFloat((cursorX - (cursorX - currentP.x) * ratio).toFixed(1)),
        y: parseFloat((cursorY - (cursorY - currentP.y) * ratio).toFixed(1)),
      };

      updateZoomAndPan(nextZoom, nextPan);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [activeImage, updateZoomAndPan]);

  // Center Image: Resets pan to (0, 0) keeping current zoom level
  const centerImage = useCallback(() => {
    isUserZoomedRef.current = true;
    updateZoomAndPan(zoomRef.current, { x: 0, y: 0 });
  }, [updateZoomAndPan]);

  // Touch Pinch-to-Zoom & Single-Touch Pan State
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);
  const touchPanStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement)?.closest('button, input, select, textarea, #crop-bounding-box, .group\\/handle')) {
      return;
    }

    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoomRef.current;
      isUserZoomedRef.current = true;
      setIsPanning(false);
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      isUserZoomedRef.current = true;
      touchPanStartRef.current = {
        x: e.touches[0].clientX - panRef.current.x,
        y: e.touches[0].clientY - panRef.current.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartDistRef.current;
      const nextZoom = Math.min(8.0, Math.max(0.05, parseFloat((touchStartZoomRef.current * scale).toFixed(3))));
      const currentZ = zoomRef.current;
      const currentP = panRef.current;
      const ratio = nextZoom / currentZ;
      updateZoomAndPan(nextZoom, {
        x: parseFloat((currentP.x * ratio).toFixed(1)),
        y: parseFloat((currentP.y * ratio).toFixed(1)),
      });
    } else if (e.touches.length === 1 && isPanning) {
      const nextPan = {
        x: Math.round(e.touches[0].clientX - touchPanStartRef.current.x),
        y: Math.round(e.touches[0].clientY - touchPanStartRef.current.y),
      };
      panRef.current = nextPan;
      setPan(nextPan);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    setIsPanning(false);
  };

  // Effortless Mouse Pan interaction: LeftClick (0) or MiddleClick (1) anywhere on workspace/canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement)?.closest('button, input, select, textarea, #crop-bounding-box, .group\\/handle')) {
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      isUserZoomedRef.current = true;
      setPanStart({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const nextPan = { x: Math.round(e.clientX - panStart.x), y: Math.round(e.clientY - panStart.y) };
      panRef.current = nextPan;
      setPan(nextPan);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Window-level smooth mouse tracking so panning continues smoothly even when cursor leaves canvas
  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const nextPan = {
        x: Math.round(e.clientX - panStart.x),
        y: Math.round(e.clientY - panStart.y),
      };
      panRef.current = nextPan;
      setPan(nextPan);
    };

    const handleWindowMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isPanning, panStart]);

  // Crop Dragging & Resizing Logic
  const handleCropMouseDown = (e: React.MouseEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropRect) return;

    setDragMode(mode);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartRect({ ...cropRect });
  };

  const handleCropTouchStart = (e: React.TouchEvent, mode: DragMode) => {
    e.stopPropagation();
    if (!cropRect || e.touches.length === 0) return;

    setDragMode(mode);
    setDragStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setDragStartRect({ ...cropRect });
  };

  useEffect(() => {
    if (!dragMode || !dragStartRect || !activeImage) return;

    const onPointerMove = (clientX: number, clientY: number) => {
      const currentZ = zoomRef.current || 1;
      const deltaScreenX = clientX - dragStartPos.x;
      const deltaScreenY = clientY - dragStartPos.y;

      const deltaX = deltaScreenX / currentZ;
      const deltaY = deltaScreenY / currentZ;

      let newRect = { ...dragStartRect };
      const isRotated = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;
      const maxW = isRotated ? activeImage.height : activeImage.width;
      const maxH = isRotated ? activeImage.width : activeImage.height;

      // Aspect ratio multiplier (width / height)
      let ratio: number | null = null;
      if (cropAspect === '2x2' || cropAspect === '1:1') ratio = 1;
      else if (cropAspect === '1.4x1.8') ratio = 1.4 / 1.8;
      else if (cropAspect === 'custom' || cropAspect === 'custom_inch') {
        const w = Math.max(0.1, customInchSize?.widthInches || 2);
        const h = Math.max(0.1, customInchSize?.heightInches || 2);
        ratio = w / h;
      }
      else if (cropAspect === 'passport') ratio = activeImage.passport?.aspectRatio || (35 / 45);
      else if (cropAspect === 'bd_passport') ratio = 45 / 55;
      else if (cropAspect === 'bd_stamp') ratio = 20 / 25;
      else if (cropAspect === '4:5') ratio = 4 / 5;
      else if (cropAspect === '3:4') ratio = 3 / 4;
      else if (cropAspect === '4:3') ratio = 4 / 3;
      else if (cropAspect === '16:9') ratio = 16 / 9;

      if (dragMode === 'move') {
        const nextX = Math.max(0, Math.min(maxW - dragStartRect.width, dragStartRect.x + deltaX));
        const nextY = Math.max(0, Math.min(maxH - dragStartRect.height, dragStartRect.y + deltaY));
        newRect = {
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: dragStartRect.width,
          height: dragStartRect.height,
        };
      } else {
        const anchorRight = dragStartRect.x + dragStartRect.width;
        const anchorBottom = dragStartRect.y + dragStartRect.height;
        const minSize = 24;

        if (ratio !== null) {
          // Locked Aspect Ratio Handling: project both horizontal and vertical mouse pull smoothly!
          if (dragMode === 'se') {
            const anchorX = dragStartRect.x;
            const anchorY = dragStartRect.y;

            // Project dominant displacement vector
            const deltaMagnitude = Math.abs(deltaX) >= Math.abs(deltaY * ratio) ? deltaX : deltaY * ratio;
            let targetW = dragStartRect.width + deltaMagnitude;
            let targetH = targetW / ratio;

            if (anchorX + targetW > maxW) {
              targetW = maxW - anchorX;
              targetH = targetW / ratio;
            }
            if (anchorY + targetH > maxH) {
              targetH = maxH - anchorY;
              targetW = targetH * ratio;
            }
            if (targetW < minSize || targetH < minSize) {
              targetW = Math.max(minSize, minSize * ratio);
              targetH = targetW / ratio;
            }

            newRect = {
              x: Math.round(anchorX),
              y: Math.round(anchorY),
              width: Math.round(targetW),
              height: Math.round(targetH),
            };
          } else if (dragMode === 'sw') {
            const anchorX = anchorRight;
            const anchorY = dragStartRect.y;

            const deltaMagnitude = Math.abs(deltaX) >= Math.abs(deltaY * ratio) ? -deltaX : deltaY * ratio;
            let targetW = dragStartRect.width + deltaMagnitude;
            let targetH = targetW / ratio;

            if (targetW > anchorX) {
              targetW = anchorX;
              targetH = targetW / ratio;
            }
            if (anchorY + targetH > maxH) {
              targetH = maxH - anchorY;
              targetW = targetH * ratio;
            }
            if (targetW < minSize || targetH < minSize) {
              targetW = Math.max(minSize, minSize * ratio);
              targetH = targetW / ratio;
            }

            newRect = {
              x: Math.round(anchorX - targetW),
              y: Math.round(anchorY),
              width: Math.round(targetW),
              height: Math.round(targetH),
            };
          } else if (dragMode === 'ne') {
            const anchorX = dragStartRect.x;
            const anchorY = anchorBottom;

            const deltaMagnitude = Math.abs(deltaX) >= Math.abs(deltaY * ratio) ? deltaX : -deltaY * ratio;
            let targetW = dragStartRect.width + deltaMagnitude;
            let targetH = targetW / ratio;

            if (anchorX + targetW > maxW) {
              targetW = maxW - anchorX;
              targetH = targetW / ratio;
            }
            if (targetH > anchorY) {
              targetH = anchorY;
              targetW = targetH * ratio;
            }
            if (targetW < minSize || targetH < minSize) {
              targetW = Math.max(minSize, minSize * ratio);
              targetH = targetW / ratio;
            }

            newRect = {
              x: Math.round(anchorX),
              y: Math.round(anchorY - targetH),
              width: Math.round(targetW),
              height: Math.round(targetH),
            };
          } else if (dragMode === 'nw') {
            const anchorX = anchorRight;
            const anchorY = anchorBottom;

            const deltaMagnitude = Math.abs(deltaX) >= Math.abs(deltaY * ratio) ? -deltaX : -deltaY * ratio;
            let targetW = dragStartRect.width + deltaMagnitude;
            let targetH = targetW / ratio;

            if (targetW > anchorX) {
              targetW = anchorX;
              targetH = targetW / ratio;
            }
            if (targetH > anchorY) {
              targetH = anchorY;
              targetW = targetH * ratio;
            }
            if (targetW < minSize || targetH < minSize) {
              targetW = Math.max(minSize, minSize * ratio);
              targetH = targetW / ratio;
            }

            newRect = {
              x: Math.round(anchorX - targetW),
              y: Math.round(anchorY - targetH),
              width: Math.round(targetW),
              height: Math.round(targetH),
            };
          } else if (dragMode === 'e' || dragMode === 'w') {
            let targetW = dragMode === 'e' ? dragStartRect.width + deltaX : dragStartRect.width - deltaX;
            targetW = Math.max(minSize, targetW);
            let targetH = targetW / ratio;
            if (targetH > maxH) {
              targetH = maxH;
              targetW = targetH * ratio;
            }
            let targetX = dragMode === 'e' ? dragStartRect.x : anchorRight - targetW;
            targetX = Math.max(0, Math.min(maxW - targetW, targetX));
            const midY = dragStartRect.y + dragStartRect.height / 2;
            let targetY = Math.max(0, Math.min(maxH - targetH, midY - targetH / 2));

            newRect = {
              x: Math.round(targetX),
              y: Math.round(targetY),
              width: Math.round(targetW),
              height: Math.round(targetH),
            };
          } else if (dragMode === 'n' || dragMode === 's') {
            let targetH = dragMode === 's' ? dragStartRect.height + deltaY : dragStartRect.height - deltaY;
            targetH = Math.max(minSize, targetH);
            let targetW = targetH * ratio;
            if (targetW > maxW) {
              targetW = maxW;
              targetH = targetW / ratio;
            }
            let targetY = dragMode === 's' ? dragStartRect.y : anchorBottom - targetH;
            targetY = Math.max(0, Math.min(maxH - targetH, targetY));
            const midX = dragStartRect.x + dragStartRect.width / 2;
            let targetX = Math.max(0, Math.min(maxW - targetW, midX - targetW / 2));

            newRect = {
              x: Math.round(targetX),
              y: Math.round(targetY),
              width: Math.round(targetW),
              height: Math.round(targetH),
            };
          }
        } else {
          // Freeform Resizing (ratio === null)
          let newX = dragStartRect.x;
          let newY = dragStartRect.y;
          let newW = dragStartRect.width;
          let newH = dragStartRect.height;

          if (dragMode === 'se' || dragMode === 'e') {
            newW = Math.max(minSize, Math.min(maxW - dragStartRect.x, dragStartRect.width + deltaX));
          }
          if (dragMode === 'se' || dragMode === 's') {
            newH = Math.max(minSize, Math.min(maxH - dragStartRect.y, dragStartRect.height + deltaY));
          }
          if (dragMode === 'nw' || dragMode === 'w') {
            const proposedX = Math.max(0, Math.min(anchorRight - minSize, dragStartRect.x + deltaX));
            newW = anchorRight - proposedX;
            newX = proposedX;
          }
          if (dragMode === 'nw' || dragMode === 'n') {
            const proposedY = Math.max(0, Math.min(anchorBottom - minSize, dragStartRect.y + deltaY));
            newH = anchorBottom - proposedY;
            newY = proposedY;
          }
          if (dragMode === 'ne') {
            newW = Math.max(minSize, Math.min(maxW - dragStartRect.x, dragStartRect.width + deltaX));
            const proposedY = Math.max(0, Math.min(anchorBottom - minSize, dragStartRect.y + deltaY));
            newH = anchorBottom - proposedY;
            newY = proposedY;
          }
          if (dragMode === 'sw') {
            const proposedX = Math.max(0, Math.min(anchorRight - minSize, dragStartRect.x + deltaX));
            newW = anchorRight - proposedX;
            newX = proposedX;
            newH = Math.max(minSize, Math.min(maxH - dragStartRect.y, dragStartRect.height + deltaY));
          }

          newRect = {
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newW),
            height: Math.round(newH),
          };
        }
      }

      onUpdateCropRect(newRect);
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      onPointerMove(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowEnd = () => {
      setDragMode(null);
      setDragStartRect(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchmove', handleWindowTouchMove);
    window.addEventListener('touchend', handleWindowEnd);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [dragMode, dragStartPos, dragStartRect, zoom, activeImage, cropAspect, onUpdateCropRect]);

  // Draw feathered mask overlay on maskCanvasRef whenever activeMask, offset, or activeImage changes
  useEffect(() => {
    if (!maskCanvasRef.current || !activeImage) return;
    const canvas = maskCanvasRef.current;
    const isRot = activeImage.transform.rotation === 90 || activeImage.transform.rotation === 270;

    // Cap canvas backing store to max 1536px to prevent GPU RAM exhaustion on 4K/6K images while preserving crispness
    const imgW = isRot ? activeImage.height : activeImage.width;
    const imgH = isRot ? activeImage.width : activeImage.height;
    const maxCanvasDim = 1536;
    const maxDim = Math.max(imgW, imgH);
    const bufferScale = maxDim > maxCanvasDim ? maxCanvasDim / maxDim : 1.0;

    canvas.width = Math.max(1, Math.round(imgW * bufferScale));
    canvas.height = Math.max(1, Math.round(imgH * bufferScale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeMask && selectedObjectTarget !== 'none') {
      ctx.save();
      // Translate to canvas center to apply identical transform as renderCompositeCanvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (activeImage.transform.rotation !== 0) {
        ctx.rotate((activeImage.transform.rotation * Math.PI) / 180);
      }
      const scaleX = activeImage.transform.flipH ? -1 : 1;
      const scaleY = activeImage.transform.flipV ? -1 : 1;
      ctx.scale(scaleX, scaleY);

      const destW = isRot ? canvas.height : canvas.width;
      const destH = isRot ? canvas.width : canvas.height;

      // Render ONLY the crisp, thin cyan outline (like hair selection) with zero interior mask fill
      if (activeMask.contourPoints && activeMask.contourPoints.length > 2) {
        const pts = activeMask.contourPoints;
        const offX = -destW / 2 + (activeMask.offset?.x || 0) * bufferScale;
        const offY = -destH / 2 + (activeMask.offset?.y || 0) * bufferScale;
        ctx.beginPath();
        ctx.moveTo(pts[0].x * bufferScale + offX, pts[0].y * bufferScale + offY);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * bufferScale + offX, pts[i].y * bufferScale + offY);
        }
        ctx.closePath();
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(6, 182, 212, 0.45)';
        ctx.shadowBlur = 2;
        ctx.stroke();
      } else if (activeMask.overlayCanvas) {
        ctx.drawImage(
          activeMask.overlayCanvas,
          -destW / 2 + (activeMask.offset?.x || 0) * bufferScale,
          -destH / 2 + (activeMask.offset?.y || 0) * bufferScale,
          destW,
          destH
        );
      }
      ctx.restore();
    }
  }, [activeMask, activeImage, selectedObjectTarget]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  // If no active image: render the exact center state from the user's screenshot!
  if (!activeImage) {
    return (
      <div
        id="shebaflow-center-canvas-container"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="flex-1 h-full bg-[#182337] border border-[#233149] rounded-2xl m-4 flex flex-col items-center justify-center select-none shadow-2xl relative overflow-hidden"
      >
        <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
          {/* Exact blue pill button matching screenshot */}
          <button
            id="btn-center-upload-image"
            onClick={onUploadClick}
            className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full font-bold text-sm tracking-wide text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-xl shadow-blue-950/50 hover:scale-105 active:scale-95 transition-all"
          >
            <Upload className="w-5 h-5 stroke-[2.5]" />
            <span>Upload image</span>
          </button>

          {/* Subtitle text matching screenshot */}
          <p className="text-xs text-[#64748B] mt-4 font-medium">Or just drop image here</p>

          {/* Sample quick loader chips for immediate testing */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Or try a sample photo:</span>
            <div className="flex items-center gap-2">
              {sampleImages.slice(0, 3).map((sample) => (
                <button
                  key={sample.name}
                  onClick={() => onSelectSample(sample)}
                  className="px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] border border-slate-700 text-xs text-cyan-300 transition-colors"
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCropActive = activeTool === 'crop' && cropRect !== null;
  const isPassportMode = activeImage.passport.active || activeTool === 'passport';
  const showPassportGuides = isPassportMode && activeImage.passport.showGuides;

  return (
    <div
      ref={containerRef}
      id="shebaflow-center-canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement)?.closest('button, input, select, #crop-bounding-box, .group\\/handle')) {
          return;
        }
        if (Math.abs(pan.x) > 4 || Math.abs(pan.y) > 4) {
          centerImage();
        } else {
          fitToScreen();
        }
      }}
      className={`relative flex-1 h-full bg-[#182337] border border-[#233149] rounded-2xl m-4 overflow-hidden flex items-center justify-center select-none shadow-2xl ${
        isPanning ? 'cursor-grabbing' : isCropActive ? 'cursor-default' : 'cursor-grab'
      }`}
    >
      {/* Zoomed & Panned Canvas Viewport */}
      <div
        className="relative origin-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          willChange: 'transform',
        }}
      >
        {/* Checkerboard Backdrop for Transparent Canvas */}
        <div
          ref={imageContainerRef}
          className="shadow-2xl rounded-sm overflow-hidden relative"
          style={{
            backgroundImage: `linear-gradient(45deg, #1E293B 25%, transparent 25%), 
                              linear-gradient(-45deg, #1E293B 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #1E293B 75%), 
                              linear-gradient(-45deg, transparent 75%, #1E293B 75%)`,
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            backgroundColor: '#0F172A',
          }}
        >
          {/* Main Rendering Canvas */}
          <canvas
            ref={canvasRef}
            id="shebaflow-main-canvas"
            className={`block max-w-none ${isPanning ? 'cursor-grabbing' : isCropActive ? 'cursor-default' : 'cursor-grab'}`}
          />

          {/* Interactive Crop Overlay */}
          {isCropActive && cropRect && (
            <div
              id="crop-bounding-box"
              onMouseDown={(e) => handleCropMouseDown(e, 'move')}
              onTouchStart={(e) => handleCropTouchStart(e, 'move')}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onApplyCrop();
              }}
              style={{
                position: 'absolute',
                left: `${cropRect.x}px`,
                top: `${cropRect.y}px`,
                width: `${cropRect.width}px`,
                height: `${cropRect.height}px`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
                cursor: 'move',
              }}
              className="border-2 border-cyan-400 group z-30 select-none"
            >
              {/* Rule of Thirds Grid Lines */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-40 group-hover:opacity-60 transition-opacity">
                <div className="border-r border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div className="border-r border-b border-white/40" />
                <div />
              </div>

              {/* 4 Draggable Perimeter Edge Hit Strips for effortless edge grabbing */}
              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'n')}
                onTouchStart={(e) => handleCropTouchStart(e, 'n')}
                className="absolute -top-2 left-6 right-6 h-4 cursor-ns-resize hover:bg-cyan-400/25 transition-colors z-10"
                title="Drag Top Edge"
              />
              <div
                onMouseDown={(e) => handleCropMouseDown(e, 's')}
                onTouchStart={(e) => handleCropTouchStart(e, 's')}
                className="absolute -bottom-2 left-6 right-6 h-4 cursor-ns-resize hover:bg-cyan-400/25 transition-colors z-10"
                title="Drag Bottom Edge"
              />
              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'w')}
                onTouchStart={(e) => handleCropTouchStart(e, 'w')}
                className="absolute top-6 bottom-6 -left-2 w-4 cursor-ew-resize hover:bg-cyan-400/25 transition-colors z-10"
                title="Drag Left Edge"
              />
              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'e')}
                onTouchStart={(e) => handleCropTouchStart(e, 'e')}
                className="absolute top-6 bottom-6 -right-2 w-4 cursor-ew-resize hover:bg-cyan-400/25 transition-colors z-10"
                title="Drag Right Edge"
              />

              {/* 4 Corner L-Bracket Accents for Visual Anchoring */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-[3px] border-l-[3px] border-white pointer-events-none" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-[3px] border-r-[3px] border-white pointer-events-none" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-[3px] border-r-[3px] border-white pointer-events-none" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-[3px] border-l-[3px] border-white pointer-events-none" />

              {/* 8 Big Ergonomic Resizing Handles with Generous 48px Hit Boxes */}
              {/* Corner Dots - Large, prominent 24px tactile grab circles */}
              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
                onTouchStart={(e) => handleCropTouchStart(e, 'nw')}
                className="absolute -top-6 -left-6 w-12 h-12 flex items-center justify-center cursor-nwse-resize z-20 group/handle"
                title="Resize Top-Left"
              >
                <div className="w-6 h-6 bg-white border-[3.5px] border-cyan-400 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.85)] group-hover/handle:scale-125 group-hover/handle:border-white group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
                onTouchStart={(e) => handleCropTouchStart(e, 'ne')}
                className="absolute -top-6 -right-6 w-12 h-12 flex items-center justify-center cursor-nesw-resize z-20 group/handle"
                title="Resize Top-Right"
              >
                <div className="w-6 h-6 bg-white border-[3.5px] border-cyan-400 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.85)] group-hover/handle:scale-125 group-hover/handle:border-white group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'se')}
                onTouchStart={(e) => handleCropTouchStart(e, 'se')}
                className="absolute -bottom-6 -right-6 w-12 h-12 flex items-center justify-center cursor-nwse-resize z-20 group/handle"
                title="Resize Bottom-Right"
              >
                <div className="w-6 h-6 bg-white border-[3.5px] border-cyan-400 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.85)] group-hover/handle:scale-125 group-hover/handle:border-white group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
                onTouchStart={(e) => handleCropTouchStart(e, 'sw')}
                className="absolute -bottom-6 -left-6 w-12 h-12 flex items-center justify-center cursor-nesw-resize z-20 group/handle"
                title="Resize Bottom-Left"
              >
                <div className="w-6 h-6 bg-white border-[3.5px] border-cyan-400 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.85)] group-hover/handle:scale-125 group-hover/handle:border-white group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              {/* Edge Midpoint Dots - Tactile pills */}
              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'n')}
                onTouchStart={(e) => handleCropTouchStart(e, 'n')}
                className="absolute -top-5 left-1/2 -translate-x-1/2 w-14 h-10 flex items-center justify-center cursor-ns-resize z-20 group/handle"
                title="Resize Height (Top)"
              >
                <div className="w-8 h-3 bg-white border-2 border-cyan-400 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover/handle:scale-115 group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              <div
                onMouseDown={(e) => handleCropMouseDown(e, 's')}
                onTouchStart={(e) => handleCropTouchStart(e, 's')}
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-14 h-10 flex items-center justify-center cursor-ns-resize z-20 group/handle"
                title="Resize Height (Bottom)"
              >
                <div className="w-8 h-3 bg-white border-2 border-cyan-400 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover/handle:scale-115 group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'w')}
                onTouchStart={(e) => handleCropTouchStart(e, 'w')}
                className="absolute top-1/2 -translate-y-1/2 -left-5 w-10 h-14 flex items-center justify-center cursor-ew-resize z-20 group/handle"
                title="Resize Width (Left)"
              >
                <div className="h-8 w-3 bg-white border-2 border-cyan-400 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover/handle:scale-115 group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>

              <div
                onMouseDown={(e) => handleCropMouseDown(e, 'e')}
                onTouchStart={(e) => handleCropTouchStart(e, 'e')}
                className="absolute top-1/2 -translate-y-1/2 -right-5 w-10 h-14 flex items-center justify-center cursor-ew-resize z-20 group/handle"
                title="Resize Width (Right)"
              >
                <div className="h-8 w-3 bg-white border-2 border-cyan-400 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover/handle:scale-115 group-hover/handle:bg-cyan-300 transition-all duration-150" />
              </div>
            </div>
          )}

          {/* Buffering / Loading Indicator on Photo when Detecting */}
          {isDetecting && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-slate-950/25 backdrop-blur-[2px] rounded-lg transition-all duration-200 animate-in fade-in">
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#090F1C]/90 border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 backdrop-blur-md">
                <div className="relative flex items-center justify-center w-8 h-8">
                  <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping" />
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-medium text-cyan-200 tracking-wide font-mono">
                  Detecting...
                </span>
              </div>
            </div>
          )}

          {/* Biometric Organic Face, Skin & Hair Detection Overlay + Feathered Pixel Mask Canvas */}
          {selectedObjectTarget !== 'none' && activeImage && (
            <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
              {/* Pixel-Level Feathered Semi-Transparent Selection Outline Mask Canvas */}
              <canvas
                ref={maskCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          )}

          {/* Passport Visual Alignment Overlay Guides */}
          {showPassportGuides && (
            <div
              id="passport-alignment-guides"
              className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center overflow-hidden"
            >
              {activeImage.passport.isJoint || activeImage.passport.standard.startsWith('joint_') ? (
                // Dual-Person Biometric Alignment Guides for Joint Passport
                <>
                  {/* Center Partition Guide */}
                  <div className="absolute top-0 bottom-0 w-px bg-cyan-400/60 border-r border-dashed border-cyan-300" />
                  
                  {/* Person 1 Head Oval (Left) */}
                  <div
                    className="absolute border-2 border-dashed border-cyan-400/80 rounded-full"
                    style={{ width: '36%', height: '54%', top: '18%', left: '12%' }}
                  />

                  {/* Person 2 Head Oval (Right) */}
                  <div
                    className="absolute border-2 border-dashed border-cyan-400/80 rounded-full"
                    style={{ width: '36%', height: '54%', top: '18%', right: '12%' }}
                  />

                  {/* Shared Eye Level Line across both persons */}
                  <div
                    className="absolute left-0 right-0 h-px bg-emerald-400/70 border-b border-dashed border-emerald-300"
                    style={{ top: '42%' }}
                  />

                  {/* Shared Chin Line across both persons */}
                  <div
                    className="absolute left-0 right-0 h-px bg-amber-400/70 border-b border-dashed border-amber-300"
                    style={{ top: '68%' }}
                  />
                </>
              ) : (
                // Single Person Biometric Guides
                <>
                  <div className="absolute top-0 bottom-0 w-px bg-cyan-400/60 border-r border-dashed border-cyan-300" />
                  <div
                    className="absolute border-2 border-dashed border-cyan-400/80 rounded-full"
                    style={{ width: '42%', height: '56%', top: '18%' }}
                  />
                  <div
                    className="absolute left-0 right-0 h-px bg-emerald-400/70 border-b border-dashed border-emerald-300"
                    style={{ top: '42%' }}
                  />
                  <div
                    className="absolute left-0 right-0 h-px bg-amber-400/70 border-b border-dashed border-amber-300"
                    style={{ top: '68%' }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Canvas Controls (Zoom, Fit, 100%, Shortcuts) - when not cropping */}
      {activeTool !== 'crop' && (
        <div
          id="canvas-viewport-controls"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0F172A]/90 backdrop-blur-md border border-cyan-500/30 text-slate-300 shadow-2xl transition-all hover:border-cyan-400/60 select-none"
        >
          <button
            id="btn-zoom-out"
            onClick={() => stepZoom(0.8)}
            className="p-1.5 rounded-full hover:bg-slate-800 hover:text-cyan-300 text-slate-300 transition-colors"
            title="Zoom Out (Ctrl - / Wheel down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={resetZoom100}
            className="px-2 py-0.5 rounded text-xs font-mono font-medium text-cyan-200 hover:bg-slate-800 hover:text-white transition-colors"
            title="Zoom to 100% (Ctrl 1)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            id="btn-zoom-in"
            onClick={() => stepZoom(1.25)}
            className="p-1.5 rounded-full hover:bg-slate-800 hover:text-cyan-300 text-slate-300 transition-colors"
            title="Zoom In (Ctrl + / Wheel up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Center Image Button */}
          <button
            id="btn-zoom-center"
            onClick={centerImage}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
              pan.x !== 0 || pan.y !== 0
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Center Image (Reset position • Click & drag to pan)"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">Center</span>
          </button>

          <button
            id="btn-zoom-fit"
            onClick={fitToScreen}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fit to Workspace (Ctrl 0 or Double-click background)"
          >
            <Maximize className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px]">Fit</span>
          </button>
        </div>
      )}

      {/* CROP CONTROLS DIRECTLY UNDER THE PHOTO (Active when activeTool === 'crop') */}
      {activeTool === 'crop' && (
        <div
          id="canvas-crop-toolbar"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0B132B]/95 backdrop-blur-md border border-cyan-500/40 text-slate-200 shadow-2xl select-none max-w-[96vw] flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {/* 4 Size Options: Free, 2*2, 1.4*1.8, Custom */}
          <div className="flex items-center gap-0.5 bg-[#141E33] p-0.5 rounded-lg border border-slate-700/80 shrink-0">
            <button
              type="button"
              id="crop-under-free"
              onClick={() => onSelectCropAspect?.('free')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                cropAspect === 'free'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Free
            </button>

            <button
              type="button"
              id="crop-under-2x2"
              onClick={() => onSelectCropAspect?.('2x2')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                cropAspect === '2x2' || cropAspect === '1:1'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              2*2
            </button>

            <button
              type="button"
              id="crop-under-1.4x1.8"
              onClick={() => onSelectCropAspect?.('1.4x1.8')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                cropAspect === '1.4x1.8' || cropAspect === 'passport' || cropAspect === 'bd_passport'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              1.4*1.8
            </button>

            <button
              type="button"
              id="crop-under-custom"
              onClick={() => onSelectCropAspect?.('custom', { widthInches: customW, heightInches: customH, dpi: 300 })}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                cropAspect === 'custom' || cropAspect === 'custom_inch'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Custom
            </button>
          </div>

          {/* If Custom is selected, show inline Width & Height inputs */}
          {(cropAspect === 'custom' || cropAspect === 'custom_inch') && (
            <div className="flex items-center gap-1 bg-[#141E33] px-2 py-0.5 rounded-lg border border-cyan-500/50 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">W:</span>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="40"
                value={customW}
                onChange={(e) => {
                  const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                  setCustomW(val);
                  onSelectCropAspect?.('custom', { widthInches: val, heightInches: customH, dpi: 300 });
                }}
                className="w-12 bg-[#0A101D] border border-slate-700 rounded px-1 py-0.5 text-xs text-white font-mono text-center focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono">in</span>
              <span className="text-slate-500 font-bold mx-0.5">×</span>
              <span className="text-[11px] text-slate-400 font-medium">H:</span>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="40"
                value={customH}
                onChange={(e) => {
                  const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                  setCustomH(val);
                  onSelectCropAspect?.('custom', { widthInches: customW, heightInches: val, dpi: 300 });
                }}
                className="w-12 bg-[#0A101D] border border-slate-700 rounded px-1 py-0.5 text-xs text-white font-mono text-center focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono">in</span>
            </div>
          )}

          {/* Crop Size Badge */}
          {cropRect && (
            <span className="text-[11px] font-mono font-medium text-emerald-400 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-700 shrink-0">
              {Math.round(cropRect.width)} × {Math.round(cropRect.height)} px
            </span>
          )}

          <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />

          {/* Reset Box Button */}
          {onResetCropArea && (
            <button
              type="button"
              onClick={onResetCropArea}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer shrink-0"
              title="Reset crop area to fit photo"
            >
              Reset Box
            </button>
          )}

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancelCrop}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Cancel Cropping"
          >
            Cancel
          </button>

          {/* APPLY CROP BUTTON */}
          <button
            type="button"
            id="btn-apply-crop"
            onClick={onApplyCrop}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/25 transition-all cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Apply Crop</span>
          </button>
        </div>
      )}
    </div>
  );
};
