import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  X,
  Upload,
  Check,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  RotateCw,
} from 'lucide-react';
import {
  ImageItem,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_BORDER,
  DEFAULT_TRANSFORM,
} from '../../types/editor';
import { createThumbnail, loadImage } from '../../utils/canvas';

interface JointPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  activeImage: ImageItem | null;
  onAddJointImage: (item: ImageItem) => void;
}

// 5 Background Color Swatches
const BG_COLORS = [
  { id: 'white', hex: '#FFFFFF', label: 'White' },
  { id: 'ice_blue', hex: '#E0F2FE', label: 'Light Blue' },
  { id: 'sky_blue', hex: '#BAE6FD', label: 'Sky Blue' },
  { id: 'cyan_blue', hex: '#38BDF8', label: 'Cyan Blue' },
  { id: 'vivid_blue', hex: '#00A3FF', label: 'Vivid Blue' },
];

export interface JointSizeOption {
  id: string;
  label: string;
  name: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number;
  previewWidth: number;
  previewHeight: number;
  outputWidthPx: number;
  outputHeightPx: number;
}

export const JOINT_SIZE_OPTIONS: JointSizeOption[] = [
  {
    id: 'joint_70x45',
    label: '70×45 mm',
    name: 'Joint Passport (70 × 45 mm)',
    widthMm: 70,
    heightMm: 45,
    aspectRatio: 70 / 45,
    previewWidth: 840,
    previewHeight: 540,
    outputWidthPx: 1680,
    outputHeightPx: 1080,
  },
  {
    id: 'joint_4x6',
    label: '4 × 6 in (4R)',
    name: '4R Postcard (4 × 6 in)',
    widthMm: 152.4,
    heightMm: 101.6,
    aspectRatio: 6 / 4,
    previewWidth: 840,
    previewHeight: 560,
    outputWidthPx: 1800,
    outputHeightPx: 1200,
  },
  {
    id: 'joint_3.5x5',
    label: '3.5 × 5 in (3R)',
    name: '3R Print (3.5 × 5 in)',
    widthMm: 127,
    heightMm: 88.9,
    aspectRatio: 5 / 3.5,
    previewWidth: 840,
    previewHeight: 588,
    outputWidthPx: 1500,
    outputHeightPx: 1050,
  },
  {
    id: 'joint_3x2',
    label: '3 × 2 in',
    name: 'Landscape Joint (3 × 2 in)',
    widthMm: 76.2,
    heightMm: 50.8,
    aspectRatio: 3 / 2,
    previewWidth: 840,
    previewHeight: 560,
    outputWidthPx: 1800,
    outputHeightPx: 1200,
  },
  {
    id: 'joint_2x2',
    label: '2 × 2 in',
    name: 'Square Joint (2 × 2 in)',
    widthMm: 50.8,
    heightMm: 50.8,
    aspectRatio: 1,
    previewWidth: 640,
    previewHeight: 640,
    outputWidthPx: 1200,
    outputHeightPx: 1200,
  },
  {
    id: 'joint_custom',
    label: 'Custom',
    name: 'Custom Size',
    widthMm: 70,
    heightMm: 45,
    aspectRatio: 70 / 45,
    previewWidth: 840,
    previewHeight: 540,
    outputWidthPx: 1680,
    outputHeightPx: 1080,
  },
];

export interface CornerHandleInfo {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  x: number;
  y: number;
}

interface RenderJointParams {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  bgHex: string;
  img1: HTMLImageElement | null;
  img2: HTMLImageElement | null;
  zoom1: number;
  zoom2: number;
  rotate1: number;
  rotate2: number;
  drag1: { x: number; y: number };
  drag2: { x: number; y: number };
  showHandles: boolean;
  basePreviewW: number;
}

export function renderJointComposition(params: RenderJointParams): {
  p1Bounds: { x: number; y: number; width: number; height: number };
  p2Bounds: { x: number; y: number; width: number; height: number };
  p1Center: { x: number; y: number };
  p2Center: { x: number; y: number };
  p1Handles: CornerHandleInfo[];
  p2Handles: CornerHandleInfo[];
} {
  const {
    ctx,
    canvasW,
    canvasH,
    bgHex,
    img1,
    img2,
    zoom1,
    zoom2,
    rotate1,
    rotate2,
    drag1,
    drag2,
    showHandles,
    basePreviewW,
  } = params;

  // Solid Clean Background Color
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, canvasW, canvasH);

  let p1Bounds = { x: 0, y: 0, width: 0, height: 0 };
  let p2Bounds = { x: 0, y: 0, width: 0, height: 0 };
  let p1Center = { x: 0, y: 0 };
  let p2Center = { x: 0, y: 0 };
  const p1Handles: CornerHandleInfo[] = [];
  const p2Handles: CornerHandleInfo[] = [];

  const halfW = canvasW / 2;
  const renderScale = canvasW / (basePreviewW || 840);
  const handleSize = Math.max(9, 10 * renderScale);

  // Helper to compute rotated corner positions
  const computeCorners = (
    centerX: number,
    centerY: number,
    w: number,
    h: number,
    deg: number
  ): CornerHandleInfo[] => {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const corners: { corner: 'tl' | 'tr' | 'bl' | 'br'; ox: number; oy: number }[] = [
      { corner: 'tl', ox: -w / 2, oy: -h / 2 },
      { corner: 'tr', ox: w / 2, oy: -h / 2 },
      { corner: 'bl', ox: -w / 2, oy: h / 2 },
      { corner: 'br', ox: w / 2, oy: h / 2 },
    ];

    return corners.map((c) => ({
      corner: c.corner,
      x: centerX + (c.ox * cos - c.oy * sin),
      y: centerY + (c.ox * sin + c.oy * cos),
    }));
  };

  // Helper to draw corner handles on canvas
  const drawHandles = (handles: CornerHandleInfo[], centerX: number, centerY: number, w: number, h: number, deg: number) => {
    if (!showHandles) return;

    // Dashed border around photo
    ctx.save();
    ctx.translate(centerX, centerY);
    if (deg !== 0) ctx.rotate((deg * Math.PI) / 180);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    // Corner white square handles matching user's image
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    for (const hItem of handles) {
      ctx.fillRect(hItem.x - handleSize / 2, hItem.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(hItem.x - handleSize / 2, hItem.y - handleSize / 2, handleSize, handleSize);
    }
  };

  // 1. Draw Person 1 (Left Side)
  if (img1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, halfW, canvasH);
    ctx.clip();

    const naturalW = img1.naturalWidth || img1.width;
    const naturalH = img1.naturalHeight || img1.height;
    const baseScale = Math.max(halfW / naturalW, (canvasH * 0.90) / naturalH);
    const scale = baseScale * (zoom1 / 0.64);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;

    const centerX = halfW / 2 + drag1.x * renderScale;
    const centerY = canvasH - drawH / 2 + drag1.y * renderScale;
    p1Center = { x: centerX, y: centerY };

    ctx.translate(centerX, centerY);
    if (rotate1 !== 0) ctx.rotate((rotate1 * Math.PI) / 180);

    ctx.drawImage(img1, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const handles = computeCorners(centerX, centerY, drawW, drawH, rotate1);
    p1Handles.push(...handles);
    drawHandles(handles, centerX, centerY, drawW, drawH, rotate1);

    p1Bounds = {
      x: centerX - drawW / 2,
      y: centerY - drawH / 2,
      width: drawW,
      height: drawH,
    };
  }

  // 2. Draw Person 2 (Right Side)
  if (img2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(halfW, 0, halfW, canvasH);
    ctx.clip();

    const naturalW = img2.naturalWidth || img2.width;
    const naturalH = img2.naturalHeight || img2.height;
    const baseScale = Math.max(halfW / naturalW, (canvasH * 0.90) / naturalH);
    const scale = baseScale * (zoom2 / 0.64);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;

    const centerX = halfW + halfW / 2 + drag2.x * renderScale;
    const centerY = canvasH - drawH / 2 + drag2.y * renderScale;
    p2Center = { x: centerX, y: centerY };

    ctx.translate(centerX, centerY);
    if (rotate2 !== 0) ctx.rotate((rotate2 * Math.PI) / 180);

    ctx.drawImage(img2, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const handles = computeCorners(centerX, centerY, drawW, drawH, rotate2);
    p2Handles.push(...handles);
    drawHandles(handles, centerX, centerY, drawW, drawH, rotate2);

    p2Bounds = {
      x: centerX - drawW / 2,
      y: centerY - drawH / 2,
      width: drawW,
      height: drawH,
    };
  }

  return { p1Bounds, p2Bounds, p1Center, p2Center, p1Handles, p2Handles };
}

/**
 * Vertical Zoom Slider Component matching studio design
 */
const VerticalZoomSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}> = ({ value, min, max, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isSliding, setIsSliding] = useState(false);

  const calculateValueFromPointer = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      const newVal = min + ratio * (max - min);
      onChange(parseFloat(newVal.toFixed(2)));
    },
    [min, max, onChange]
  );

  const handlePlus = () => {
    onChange(parseFloat(Math.min(max, value + 0.05).toFixed(2)));
  };

  const handleMinus = () => {
    onChange(parseFloat(Math.max(min, value - 0.05).toFixed(2)));
  };

  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="flex flex-col items-center gap-1.5 select-none w-12 sm:w-14 shrink-0">
      <span className="text-[11px] font-semibold text-slate-300 tracking-wide">Zoom</span>

      {/* Plus Button */}
      <button
        type="button"
        onClick={handlePlus}
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow transition-all cursor-pointer"
        title="Zoom In"
      >
        +
      </button>

      {/* Vertical Slider Track */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          setIsSliding(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          calculateValueFromPointer(e.clientY);
        }}
        onPointerMove={(e) => {
          if (isSliding) calculateValueFromPointer(e.clientY);
        }}
        onPointerUp={() => setIsSliding(false)}
        className="relative w-1.5 h-32 sm:h-40 bg-slate-700/90 rounded-full cursor-pointer flex flex-col justify-end items-center my-0.5"
      >
        <div
          className="w-full bg-[#3B82F6]/60 rounded-full pointer-events-none"
          style={{ height: `${percent}%` }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-[#3B82F6] border border-white shadow-md pointer-events-none -translate-y-1/2"
          style={{ bottom: `calc(${percent}% - 7px)` }}
        />
      </div>

      {/* Minus Button */}
      <button
        type="button"
        onClick={handleMinus}
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] active:scale-95 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow transition-all cursor-pointer"
        title="Zoom Out"
      >
        -
      </button>

      {/* Zoom Value */}
      <span className="text-[11px] font-mono font-semibold text-blue-400 mt-0.5">
        {value.toFixed(2)}
      </span>
    </div>
  );
};

export const JointPhotoModal: React.FC<JointPhotoModalProps> = ({
  isOpen,
  onClose,
  images,
  activeImage,
  onAddJointImage,
}) => {
  // Selected Background Color
  const [selectedBg, setSelectedBg] = useState<string>('#00A3FF');

  // Selected Joint Size
  const [selectedSizeId, setSelectedSizeId] = useState<string>('joint_70x45');
  const [customWidthIn, setCustomWidthIn] = useState<number>(2.76);
  const [customHeightIn, setCustomHeightIn] = useState<number>(1.77);

  // Compute active size spec
  const currentSpec = (() => {
    const found = JOINT_SIZE_OPTIONS.find((s) => s.id === selectedSizeId);
    if (selectedSizeId === 'joint_custom') {
      const wIn = Math.max(1, customWidthIn);
      const hIn = Math.max(1, customHeightIn);
      const ratio = wIn / hIn;
      const previewW = ratio >= 1 ? 840 : Math.round(540 * ratio);
      const previewH = ratio >= 1 ? Math.round(840 / ratio) : 540;
      return {
        id: 'joint_custom',
        label: 'Custom',
        name: `Custom (${wIn} × ${hIn} in)`,
        widthMm: Math.round(wIn * 25.4),
        heightMm: Math.round(hIn * 25.4),
        aspectRatio: ratio,
        previewWidth: previewW,
        previewHeight: previewH,
        outputWidthPx: Math.round(wIn * 300),
        outputHeightPx: Math.round(hIn * 300),
      };
    }
    return found || JOINT_SIZE_OPTIONS[0];
  })();

  // Person 1 & Person 2 Source URLs
  const [photo1Url, setPhoto1Url] = useState<string>('');
  const [photo2Url, setPhoto2Url] = useState<string>('');

  // Loaded original images
  const [loadedImg1, setLoadedImg1] = useState<HTMLImageElement | null>(null);
  const [loadedImg2, setLoadedImg2] = useState<HTMLImageElement | null>(null);

  // Zoom Controls: range 0.10 to 2.50
  const [zoomP1, setZoomP1] = useState<number>(0.64);
  const [zoomP2, setZoomP2] = useState<number>(0.64);

  // Rotate Controls: range -45 to +45 deg
  const [rotateP1, setRotateP1] = useState<number>(0);
  const [rotateP2, setRotateP2] = useState<number>(0);

  // Drag Positions (offsets in canvas coordinates)
  const [dragP1, setDragP1] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragP2, setDragP2] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Rendered Person Bounding Boxes & Corner Handles for accurate interaction
  const person1BoundsRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
  const person2BoundsRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
  const p1CenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const p2CenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const p1HandlesRef = useRef<CornerHandleInfo[]>([]);
  const p2HandlesRef = useRef<CornerHandleInfo[]>([]);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // File Input Refs
  const fileP1Ref = useRef<HTMLInputElement>(null);
  const fileP2Ref = useRef<HTMLInputElement>(null);

  // Final Generated State
  const [finalDataUrl, setFinalDataUrl] = useState<string | null>(null);

  // Active Drag / Resize State
  const [isInteracting, setIsInteracting] = useState(false);
  const dragTypeRef = useRef<'move' | 'resize' | null>(null);
  const activeDragPersonRef = useRef<'p1' | 'p2' | null>(null);
  const resizeStartRef = useRef<{
    centerX: number;
    centerY: number;
    startDist: number;
    startZoom: number;
  }>({ centerX: 0, centerY: 0, startDist: 1, startZoom: 0.64 });
  const dragStartRef = useRef<{ clientX: number; clientY: number; initX: number; initY: number }>({
    clientX: 0,
    clientY: 0,
    initX: 0,
    initY: 0,
  });
  const animFrameRef = useRef<number | null>(null);

  // Initialize photos when modal opens
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const p1 = activeImage || images[0] || null;
      const p2 = images.find((i) => i.id !== p1?.id) || images[1] || null;

      if (p1) setPhoto1Url(p1.currentUrl);
      if (p2) setPhoto2Url(p2.currentUrl);

      setSelectedBg('#00A3FF');
      setSelectedSizeId('joint_70x45');
      setZoomP1(0.64);
      setZoomP2(0.64);
      setRotateP1(0);
      setRotateP2(0);
      setDragP1({ x: 0, y: 0 });
      setDragP2({ x: 0, y: 0 });
      setFinalDataUrl(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, activeImage, images]);

  // Load Person 1 Original Image
  useEffect(() => {
    if (!isOpen || !photo1Url) {
      setLoadedImg1(null);
      return;
    }
    let isCancelled = false;
    loadImage(photo1Url)
      .then((img) => {
        if (!isCancelled) setLoadedImg1(img);
      })
      .catch((err) => {
        console.warn('Failed to load Person 1 image:', err);
      });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, photo1Url]);

  // Load Person 2 Original Image
  useEffect(() => {
    if (!isOpen || !photo2Url) {
      setLoadedImg2(null);
      return;
    }
    let isCancelled = false;
    loadImage(photo2Url)
      .then((img) => {
        if (!isCancelled) setLoadedImg2(img);
      })
      .catch((err) => {
        console.warn('Failed to load Person 2 image:', err);
      });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, photo2Url]);

  // Render on canvas when state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const result = renderJointComposition({
      ctx,
      canvasW: canvas.width,
      canvasH: canvas.height,
      bgHex: selectedBg,
      img1: loadedImg1,
      img2: loadedImg2,
      zoom1: zoomP1,
      zoom2: zoomP2,
      rotate1: rotateP1,
      rotate2: rotateP2,
      drag1: dragP1,
      drag2: dragP2,
      showHandles: true,
      basePreviewW: currentSpec.previewWidth,
    });

    person1BoundsRef.current = result.p1Bounds;
    person2BoundsRef.current = result.p2Bounds;
    p1CenterRef.current = result.p1Center;
    p2CenterRef.current = result.p2Center;
    p1HandlesRef.current = result.p1Handles;
    p2HandlesRef.current = result.p2Handles;
  }, [
    selectedBg,
    currentSpec,
    loadedImg1,
    loadedImg2,
    zoomP1,
    zoomP2,
    rotateP1,
    rotateP2,
    dragP1,
    dragP2,
  ]);

  // Swap Sides: Swaps Person 1 and Person 2 (Left ⇄ Right)
  const handleSwapSides = () => {
    const tempUrl = photo1Url;
    setPhoto1Url(photo2Url);
    setPhoto2Url(tempUrl);

    const tempImg = loadedImg1;
    setLoadedImg1(loadedImg2);
    setLoadedImg2(tempImg);

    const tempZoom = zoomP1;
    setZoomP1(zoomP2);
    setZoomP2(tempZoom);

    const tempRotate = rotateP1;
    setRotateP1(rotateP2);
    setRotateP2(tempRotate);

    const tempDrag = dragP1;
    setDragP1(dragP2);
    setDragP2(tempDrag);

    setFinalDataUrl(null);
  };

  // Nudge Side / Position Helper
  const nudgePhoto = (person: 'p1' | 'p2', dx: number, dy: number) => {
    if (person === 'p1') {
      setDragP1((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      setDragP2((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const centerPhoto = (person: 'p1' | 'p2') => {
    if (person === 'p1') {
      setDragP1({ x: 0, y: 0 });
    } else {
      setDragP2({ x: 0, y: 0 });
    }
  };

  // Pointer Down on Canvas (Detects Corner Dots to Zoom or Body to Move)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleFactorX;
    const clickY = (e.clientY - rect.top) * scaleFactorY;

    // Generous hit radius for corner dots (approx 20px on screen)
    const hitRadius = 22 * (canvas.width / 840);

    // 1. Check if user clicked Person 1's corner dot
    for (const h of p1HandlesRef.current) {
      if (Math.hypot(clickX - h.x, clickY - h.y) <= hitRadius) {
        dragTypeRef.current = 'resize';
        activeDragPersonRef.current = 'p1';
        const center = p1CenterRef.current;
        resizeStartRef.current = {
          centerX: center.x,
          centerY: center.y,
          startDist: Math.max(10, Math.hypot(clickX - center.x, clickY - center.y)),
          startZoom: zoomP1,
        };
        setIsInteracting(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Check if user clicked Person 2's corner dot
    for (const h of p2HandlesRef.current) {
      if (Math.hypot(clickX - h.x, clickY - h.y) <= hitRadius) {
        dragTypeRef.current = 'resize';
        activeDragPersonRef.current = 'p2';
        const center = p2CenterRef.current;
        resizeStartRef.current = {
          centerX: center.x,
          centerY: center.y,
          startDist: Math.max(10, Math.hypot(clickX - center.x, clickY - center.y)),
          startZoom: zoomP2,
        };
        setIsInteracting(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    // 3. Otherwise, user is clicking to Move/Pan the photo
    const inRect = (ptX: number, ptY: number, r: { x: number; y: number; width: number; height: number }) => {
      return ptX >= r.x && ptX <= r.x + r.width && ptY >= r.y && ptY <= r.y + r.height;
    };

    let targetPerson: 'p1' | 'p2' | null = null;
    if (inRect(clickX, clickY, person2BoundsRef.current)) {
      targetPerson = 'p2';
    } else if (inRect(clickX, clickY, person1BoundsRef.current)) {
      targetPerson = 'p1';
    } else {
      // Fallback: Left half vs Right half
      targetPerson = clickX < canvas.width / 2 ? 'p1' : 'p2';
    }

    if (targetPerson) {
      dragTypeRef.current = 'move';
      activeDragPersonRef.current = targetPerson;
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        initX: targetPerson === 'p1' ? dragP1.x : dragP2.x,
        initY: targetPerson === 'p1' ? dragP1.y : dragP2.y,
      };
      setIsInteracting(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  // Pointer Move on Canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Hover Cursor Handling when NOT dragging
    if (!dragTypeRef.current) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const curX = (e.clientX - rect.left) * scaleX;
      const curY = (e.clientY - rect.top) * scaleY;
      const hitRadius = 22 * (canvas.width / 840);

      let foundCorner: 'tl' | 'tr' | 'bl' | 'br' | null = null;
      for (const h of [...p1HandlesRef.current, ...p2HandlesRef.current]) {
        if (Math.hypot(curX - h.x, curY - h.y) <= hitRadius) {
          foundCorner = h.corner;
          break;
        }
      }

      if (foundCorner === 'tl' || foundCorner === 'br') {
        canvas.style.cursor = 'nwse-resize';
      } else if (foundCorner === 'tr' || foundCorner === 'bl') {
        canvas.style.cursor = 'nesw-resize';
      } else {
        canvas.style.cursor = 'grab';
      }
      return;
    }

    // Active Dragging / Resizing
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    animFrameRef.current = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = canvasRef.current.width / rect.width;

      if (dragTypeRef.current === 'resize' && activeDragPersonRef.current) {
        // CORNER DOT ZOOM IN / OUT
        const curCanvasX = (clientX - rect.left) * scaleFactor;
        const curCanvasY = (clientY - rect.top) * scaleFactor;
        const curDist = Math.hypot(
          curCanvasX - resizeStartRef.current.centerX,
          curCanvasY - resizeStartRef.current.centerY
        );
        const ratio = curDist / Math.max(1, resizeStartRef.current.startDist);
        const newZoom = Math.max(0.1, Math.min(2.5, resizeStartRef.current.startZoom * ratio));

        if (activeDragPersonRef.current === 'p1') {
          setZoomP1(parseFloat(newZoom.toFixed(2)));
        } else {
          setZoomP2(parseFloat(newZoom.toFixed(2)));
        }
      } else if (dragTypeRef.current === 'move' && activeDragPersonRef.current) {
        // MOVE PHOTO SIDE TO SIDE / UP AND DOWN
        const dx = (clientX - dragStartRef.current.clientX) * scaleFactor;
        const dy = (clientY - dragStartRef.current.clientY) * scaleFactor;

        if (activeDragPersonRef.current === 'p1') {
          setDragP1({
            x: Math.round(dragStartRef.current.initX + dx),
            y: Math.round(dragStartRef.current.initY + dy),
          });
        } else {
          setDragP2({
            x: Math.round(dragStartRef.current.initX + dx),
            y: Math.round(dragStartRef.current.initY + dy),
          });
        }
      }
      animFrameRef.current = null;
    });
  };

  const handlePointerUp = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    dragTypeRef.current = null;
    activeDragPersonRef.current = null;
    setIsInteracting(false);
  };

  // Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'p1' | 'p2') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const url = evt.target?.result as string;
      if (!url) return;

      if (target === 'p1') {
        setPhoto1Url(url);
      } else {
        setPhoto2Url(url);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // MAKE JOINT PHOTO Action (High-Resolution Output with No UI Elements)
  const handleMakeJointPhoto = async () => {
    if (!photo1Url || !photo2Url || !loadedImg1 || !loadedImg2) return;

    try {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = currentSpec.outputWidthPx;
      outCanvas.height = currentSpec.outputHeightPx;
      const ctx = outCanvas.getContext('2d');
      if (!ctx) return;

      // Render pristine composition without editor handles
      renderJointComposition({
        ctx,
        canvasW: outCanvas.width,
        canvasH: outCanvas.height,
        bgHex: selectedBg,
        img1: loadedImg1,
        img2: loadedImg2,
        zoom1: zoomP1,
        zoom2: zoomP2,
        rotate1: rotateP1,
        rotate2: rotateP2,
        drag1: dragP1,
        drag2: dragP2,
        showHandles: false,
        basePreviewW: currentSpec.previewWidth,
      });

      const highResDataUrl = outCanvas.toDataURL('image/jpeg', 0.98);
      setFinalDataUrl(highResDataUrl);

      // Add to Studio Tray as master Joint Photo
      const loadedImg = await loadImage(highResDataUrl);
      const thumb = createThumbnail(loadedImg, 140);

      const newItem: ImageItem = {
        id: `joint-photo-${Date.now()}`,
        name: `Joint-Photo-${currentSpec.label.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.jpg`,
        originalUrl: highResDataUrl,
        currentUrl: highResDataUrl,
        width: outCanvas.width,
        height: outCanvas.height,
        originalWidth: outCanvas.width,
        originalHeight: outCanvas.height,
        thumbnailUrl: thumb,
        sizeBytes: Math.round(highResDataUrl.length * 0.75),
        mimeType: 'image/jpeg',
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        filter: 'original',
        background: { isTransparent: false, color: selectedBg },
        border: { enabled: false, color: '#FFFFFF', width: 0, radius: 0 },
        transform: { ...DEFAULT_TRANSFORM },
        passport: {
          active: true,
          standard: 'joint_bd',
          widthMm: currentSpec.widthMm,
          heightMm: currentSpec.heightMm,
          aspectRatio: currentSpec.aspectRatio,
          showGuides: false,
          targetWidthPx: currentSpec.outputWidthPx,
          targetHeightPx: currentSpec.outputHeightPx,
          isJoint: true,
        },
      };

      outCanvas.width = 1;
      outCanvas.height = 1;

      onAddJointImage(newItem);
    } catch (err) {
      console.error('Error making joint photo:', err);
    }
  };

  // Direct Download JPG
  const handleDownload = () => {
    if (!loadedImg1 || !loadedImg2) return;

    if (finalDataUrl) {
      const link = document.createElement('a');
      link.download = `Joint-Photo-${Date.now()}.jpg`;
      link.href = finalDataUrl;
      link.click();
      return;
    }

    // Export clean high-res without handles on the fly
    const outCanvas = document.createElement('canvas');
    outCanvas.width = currentSpec.outputWidthPx;
    outCanvas.height = currentSpec.outputHeightPx;
    const ctx = outCanvas.getContext('2d');
    if (ctx) {
      renderJointComposition({
        ctx,
        canvasW: outCanvas.width,
        canvasH: outCanvas.height,
        bgHex: selectedBg,
        img1: loadedImg1,
        img2: loadedImg2,
        zoom1: zoomP1,
        zoom2: zoomP2,
        rotate1: rotateP1,
        rotate2: rotateP2,
        drag1: dragP1,
        drag2: dragP2,
        showHandles: false,
        basePreviewW: currentSpec.previewWidth,
      });

      const urlToDownload = outCanvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      link.download = `Joint-Photo-${Date.now()}.jpg`;
      link.href = urlToDownload;
      link.click();

      outCanvas.width = 1;
      outCanvas.height = 1;
    }
  };

  // Reset to default
  const handleReset = () => {
    setSelectedBg('#00A3FF');
    setZoomP1(0.64);
    setZoomP2(0.64);
    setRotateP1(0);
    setRotateP2(0);
    setDragP1({ x: 0, y: 0 });
    setDragP2({ x: 0, y: 0 });
    setFinalDataUrl(null);
  };

  const canMakeJoint = Boolean(photo1Url && photo2Url && loadedImg1 && loadedImg2);
  const canDownload = Boolean(finalDataUrl || (loadedImg1 && loadedImg2));

  if (!isOpen) return null;

  return (
    <div
      id="joint-photo-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm select-none animate-in fade-in"
    >
      {/* Hidden File Inputs for Person 1 & Person 2 */}
      <input
        ref={fileP1Ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'p1')}
      />
      <input
        ref={fileP2Ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'p2')}
      />

      {/* Main Modal Card */}
      <div
        id="joint-photo-modal-card"
        className="w-full max-w-[780px] max-h-[95vh] overflow-y-auto bg-[#1A2332] border border-[#2B384E] rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 shadow-2xl shadow-black/60 text-white"
      >
        {/* TOP BAR: Size Presets & Action Buttons */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-700/60">
          {/* Joint Photo Size Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-300 mr-0.5">Size:</span>
            <div className="flex items-center gap-1 bg-[#101726] p-0.5 rounded-lg border border-slate-700/70">
              {JOINT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedSizeId(opt.id)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    selectedSizeId === opt.id
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title={opt.name}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom Size Inputs */}
            {selectedSizeId === 'joint_custom' && (
              <div className="flex items-center gap-1 bg-[#101726] px-2 py-0.5 rounded-lg border border-cyan-500/50 text-xs">
                <span className="text-[11px] text-slate-400">W:</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="20"
                  value={customWidthIn}
                  onChange={(e) => setCustomWidthIn(Math.max(0.5, parseFloat(e.target.value) || 2))}
                  className="w-12 bg-[#080D18] border border-slate-700 rounded px-1 text-center font-mono text-white text-xs focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500">in</span>
                <span className="text-slate-500 font-bold">×</span>
                <span className="text-[11px] text-slate-400">H:</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="20"
                  value={customHeightIn}
                  onChange={(e) => setCustomHeightIn(Math.max(0.5, parseFloat(e.target.value) || 2))}
                  className="w-12 bg-[#080D18] border border-slate-700 rounded px-1 text-center font-mono text-white text-xs focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500">in</span>
              </div>
            )}
          </div>

          {/* Action Buttons: Swap Sides, Download, Reset, Close */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              id="btn-joint-swap"
              onClick={handleSwapSides}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Swap Person 1 and Person 2 (Left ⇄ Right)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Swap Sides</span>
            </button>

            <button
              type="button"
              id="btn-joint-download"
              onClick={handleDownload}
              disabled={!canDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-600 hover:border-slate-400 bg-transparent hover:bg-slate-800 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              title="Download Joint Photo JPG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              id="btn-joint-reset"
              onClick={handleReset}
              className="px-2.5 py-1 rounded-lg border border-slate-600 hover:border-slate-400 bg-transparent hover:bg-slate-800 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Reset positions and adjustments"
            >
              Reset
            </button>

            <button
              type="button"
              id="btn-joint-close"
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-slate-600 hover:border-slate-400 bg-transparent hover:bg-slate-800 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Close Joint Photo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUB BAR: 5 Backdrop Swatches & Interactive Dot Hint */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Background Color Swatches */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-300 mr-1">Backdrop:</span>
            {BG_COLORS.map((bg) => {
              const isSelected = selectedBg.toLowerCase() === bg.hex.toLowerCase();
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setSelectedBg(bg.hex)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-white scale-105 shadow-md shadow-cyan-900/40 ring-2 ring-white/60'
                      : 'border-transparent hover:scale-105 opacity-90 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: bg.hex }}
                  title={bg.label}
                />
              );
            })}
          </div>

          {/* Quick Tip on moving and corner dots */}
          <div className="text-[11px] text-cyan-300/90 font-medium hidden sm:block">
            Tip: Drag corner dots to zoom in/out • Drag inside photo to move side-to-side
          </div>
        </div>

        {/* CENTER ROW: Person 1 Zoom | Canvas | Person 2 Zoom */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 py-0.5">
          {/* Person 1 Zoom (Left) */}
          <VerticalZoomSlider
            value={zoomP1}
            min={0.1}
            max={2.5}
            onChange={setZoomP1}
          />

          {/* Central Joint Photo Canvas */}
          <div
            className="flex-1 flex items-center justify-center relative rounded-xl overflow-hidden shadow-2xl bg-black/40 border border-slate-700/50 max-h-[360px]"
            style={{ aspectRatio: `${currentSpec.aspectRatio}` }}
          >
            <canvas
              ref={canvasRef}
              width={currentSpec.previewWidth}
              height={currentSpec.previewHeight}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`w-full h-full object-contain ${
                isInteracting ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              title="Drag corner dots to zoom in/out • Drag photo body to move side-to-side"
            />

            {/* Empty Upload Targets if photos are missing */}
            {!photo1Url && (
              <div
                onClick={() => fileP1Ref.current?.click()}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-36 h-48 border-2 border-dashed border-white/40 hover:border-white rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-black/30 hover:bg-black/40 transition-all p-3 text-center"
              >
                <Upload className="w-6 h-6 text-white/80" />
                <span className="text-xs font-semibold text-white">Upload Person 1</span>
              </div>
            )}

            {!photo2Url && (
              <div
                onClick={() => fileP2Ref.current?.click()}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-36 h-48 border-2 border-dashed border-white/40 hover:border-white rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-black/30 hover:bg-black/40 transition-all p-3 text-center"
              >
                <Upload className="w-6 h-6 text-white/80" />
                <span className="text-xs font-semibold text-white">Upload Person 2</span>
              </div>
            )}
          </div>

          {/* Person 2 Zoom (Right) */}
          <VerticalZoomSlider
            value={zoomP2}
            min={0.1}
            max={2.5}
            onChange={setZoomP2}
          />
        </div>

        {/* SIDE-TO-SIDE POSITION & ROTATE CONTROLS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#121A28] p-2.5 rounded-xl border border-slate-700/60 text-xs">
          {/* Person 1 Controls (Left Person) */}
          <div className="flex flex-col gap-1.5 border-b sm:border-b-0 sm:border-r border-slate-700/60 pb-2 sm:pb-0 sm:pr-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs">Person 1 (Left)</span>
              <button
                type="button"
                onClick={() => fileP1Ref.current?.click()}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Change Photo
              </button>
            </div>

            {/* Move Photo Side-to-Side Nudge Buttons */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Move Side:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudgePhoto('p1', -12, 0)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Left (Nudge)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto('p1', 12, 0)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Right (Nudge)"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto('p1', 0, -12)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Up (Nudge)"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto('p1', 0, 12)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Down (Nudge)"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => centerPhoto('p1')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-[11px] border border-slate-600 transition-all cursor-pointer"
                  title="Center Position"
                >
                  Center
                </button>
              </div>
            </div>

            {/* Rotate Person 1 */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium w-12">Rotate:</span>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={rotateP1}
                onChange={(e) => setRotateP1(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#38BDF8]"
              />
              <span className="text-[11px] font-mono font-semibold text-blue-400 w-7 text-right">
                {rotateP1}°
              </span>
            </div>
          </div>

          {/* Person 2 Controls (Right Person) */}
          <div className="flex flex-col gap-1.5 sm:pl-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs">Person 2 (Right)</span>
              <button
                type="button"
                onClick={() => fileP2Ref.current?.click()}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Change Photo
              </button>
            </div>

            {/* Move Photo Side-to-Side Nudge Buttons */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Move Side:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudgePhoto('p2', -12, 0)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Left (Nudge)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto('p2', 12, 0)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Right (Nudge)"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto('p2', 0, -12)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Up (Nudge)"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudgePhoto('p2', 0, 12)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  title="Move Down (Nudge)"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => centerPhoto('p2')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-[11px] border border-slate-600 transition-all cursor-pointer"
                  title="Center Position"
                >
                  Center
                </button>
              </div>
            </div>

            {/* Rotate Person 2 */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium w-12">Rotate:</span>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={rotateP2}
                onChange={(e) => setRotateP2(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#38BDF8]"
              />
              <span className="text-[11px] font-mono font-semibold text-blue-400 w-7 text-right">
                {rotateP2}°
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM: Full Width Green "MAKE JOINT PHOTO" Button */}
        <button
          type="button"
          id="btn-make-joint-photo"
          onClick={handleMakeJointPhoto}
          disabled={!canMakeJoint}
          className="w-full py-2.5 sm:py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white font-bold text-xs sm:text-sm tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 uppercase disabled:opacity-50 cursor-pointer"
        >
          {finalDataUrl ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>JOINT PHOTO READY — ADDED TO STUDIO & CLICK DOWNLOAD</span>
            </>
          ) : (
            <span>MAKE JOINT PHOTO ({currentSpec.label})</span>
          )}
        </button>
      </div>
    </div>
  );
};
