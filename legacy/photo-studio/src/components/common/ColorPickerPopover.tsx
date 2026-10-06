import React, { useState, useEffect, useRef } from 'react';
import { Pipette, X, Check } from 'lucide-react';

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  isOpen: boolean;
  onClose: () => void;
  anchorSide?: 'left' | 'right' | 'inline';
  className?: string;
}

// Convert HSV to Hex
function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;
  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const num = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, num)).toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Convert Hex to HSV
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length !== 6) return { h: 200, s: 70, v: 90 };

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / d + 2) * 60;
    } else {
      h = ((r - g) / d + 4) * 60;
    }
  }

  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

// Quick Spectrum Tones
const SPECTRUM_SWATCHES = [
  '#FFFFFF', '#F8FAFC', '#E2E8F0', '#94A3B8', '#475569', '#1E293B', '#0F172A', '#000000',
  '#FEE2E2', '#F87171', '#EF4444', '#DC2626', '#991B1B', '#7F1D1D', '#581C28', '#450A0A',
  '#FEF3C7', '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#78350F', '#4A3B32', '#2E1065',
  '#DCFCE7', '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D', '#052E16',
  '#E0F2FE', '#7DD3FC', '#38BDF8', '#0EA5E9', '#0284C7', '#0369A1', '#075985', '#0C4A6E',
  '#F3E8FF', '#C084FC', '#A855F7', '#9333EA', '#7E22CE', '#6B21A8', '#581C87', '#3B0764',
  '#FCE7F3', '#F472B6', '#EC4899', '#DB2777', '#BE185D', '#9D174D', '#831843', '#500724',
];

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  onChange,
  isOpen,
  onClose,
  anchorSide = 'right',
  className = '',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const hexInputRef = useRef<HTMLInputElement>(null);
  const nativeColorInputRef = useRef<HTMLInputElement>(null);

  const initialHsv = hexToHsv(color.startsWith('#') ? color : '#38BDF8');
  const [hue, setHue] = useState<number>(initialHsv.h);
  const [saturation, setSaturation] = useState<number>(initialHsv.s);
  const [brightness, setBrightness] = useState<number>(initialHsv.v);
  const [hexInput, setHexInput] = useState<string>(color.startsWith('#') ? color : '#38BDF8');

  // Sync internal state when external color changes
  useEffect(() => {
    if (color && color.startsWith('#')) {
      const hsv = hexToHsv(color);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
      setHexInput(color.toUpperCase());
    }
  }, [color]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentColorHex = hsvToHex(hue, saturation, brightness);

  const handleHueChange = (newHue: number) => {
    setHue(newHue);
    const newHex = hsvToHex(newHue, saturation, brightness);
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleSaturationChange = (newSat: number) => {
    setSaturation(newSat);
    const newHex = hsvToHex(hue, newSat, brightness);
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleBrightnessChange = (newBri: number) => {
    setBrightness(newBri);
    const newHex = hsvToHex(hue, saturation, newBri);
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleHexSubmit = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) {
      clean = `#${clean}`;
    }
    setHexInput(clean.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      const hsv = hexToHsv(clean);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
      onChange(clean.toUpperCase());
    }
  };

  const handleEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const pickedHex = result.sRGBHex.toUpperCase();
          const hsv = hexToHsv(pickedHex);
          setHue(hsv.h);
          setSaturation(hsv.s);
          setBrightness(hsv.v);
          setHexInput(pickedHex);
          onChange(pickedHex);
        }
      } catch {
        // user cancelled eyedropper
      }
    } else {
      nativeColorInputRef.current?.click();
    }
  };

  // Determine positioning classes
  const positionClasses =
    anchorSide === 'inline'
      ? 'relative w-full mt-2'
      : anchorSide === 'left'
      ? 'absolute left-0 top-full mt-2 w-72'
      : 'absolute right-0 top-full mt-2 w-72';

  return (
    <div
      ref={popoverRef}
      id="custom-color-box-popover"
      className={`${positionClasses} z-40 bg-[#101827] border border-[#2A374F] rounded-2xl shadow-2xl p-3.5 flex flex-col gap-3 select-none text-slate-200 animate-in fade-in zoom-in-95 duration-150 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: currentColorHex }}
          />
          <span className="text-xs font-semibold text-slate-200">Custom Color</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Eyedropper Button */}
          <button
            type="button"
            onClick={handleEyeDropper}
            className="p-1 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
            title="Eyedropper: Pick color from screen"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Close color box"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hue Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Hue</span>
          <span>{hue}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={(e) => handleHueChange(Number(e.target.value))}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer border border-black/30 shadow-inner"
          style={{
            background:
              'linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
          }}
        />
      </div>

      {/* Saturation Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Saturation</span>
          <span>{saturation}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={saturation}
          onChange={(e) => handleSaturationChange(Number(e.target.value))}
          className="w-full h-2.5 rounded-lg appearance-none cursor-pointer border border-black/30 shadow-inner"
          style={{
            background: `linear-gradient(to right, ${hsvToHex(hue, 0, brightness)} 0%, ${hsvToHex(
              hue,
              100,
              brightness
            )} 100%)`,
          }}
        />
      </div>

      {/* Brightness Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Lightness / Tone</span>
          <span>{brightness}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness}
          onChange={(e) => handleBrightnessChange(Number(e.target.value))}
          className="w-full h-2.5 rounded-lg appearance-none cursor-pointer border border-black/30 shadow-inner"
          style={{
            background: `linear-gradient(to right, #000000 0%, ${hsvToHex(
              hue,
              saturation,
              100
            )} 100%)`,
          }}
        />
      </div>

      {/* Quick Spectrum Swatches Palette */}
      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[10px] text-slate-400 font-medium">Quick Tones</span>
        <div className="grid grid-cols-8 gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
          {SPECTRUM_SWATCHES.map((swatch, idx) => {
            const isSelected = currentColorHex.toLowerCase() === swatch.toLowerCase();
            return (
              <button
                key={`${swatch}-${idx}`}
                type="button"
                onClick={() => {
                  const hsv = hexToHsv(swatch);
                  setHue(hsv.h);
                  setSaturation(hsv.s);
                  setBrightness(hsv.v);
                  setHexInput(swatch);
                  onChange(swatch);
                }}
                className={`w-6 h-6 rounded-md border transition-transform hover:scale-115 active:scale-95 flex items-center justify-center ${
                  isSelected ? 'ring-2 ring-cyan-400 border-white scale-110' : 'border-black/20'
                }`}
                style={{ backgroundColor: swatch }}
                title={swatch}
              >
                {isSelected && (
                  <Check
                    className={`w-3 h-3 ${
                      swatch === '#FFFFFF' || swatch === '#F8FAFC' || swatch === '#E2E8F0'
                        ? 'text-black'
                        : 'text-white'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hex Input & Native Picker Row */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-[11px] font-medium text-slate-400">HEX:</span>
          <input
            ref={hexInputRef}
            type="text"
            value={hexInput}
            onChange={(e) => {
              setHexInput(e.target.value);
              handleHexSubmit(e.target.value);
            }}
            placeholder="#FFFFFF"
            maxLength={7}
            className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 uppercase tracking-wider focus:outline-none focus:border-cyan-400 text-center"
          />
        </div>

        {/* Anchor-safe native color input button (positioned physically right here) */}
        <div className="relative">
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 flex items-center gap-1.5 transition-all shadow-sm"
            title="Open system color picker directly at this position"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-white/30"
              style={{ backgroundColor: currentColorHex }}
            />
            <span>OS Picker</span>
          </button>
          <input
            ref={nativeColorInputRef}
            type="color"
            value={currentColorHex}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              const hsv = hexToHsv(val);
              setHue(hsv.h);
              setSaturation(hsv.s);
              setBrightness(hsv.v);
              setHexInput(val);
              onChange(val);
            }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
