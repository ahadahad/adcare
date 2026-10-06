import React from 'react';
import { Camera, Check, X, Info, Sliders, ShieldAlert } from 'lucide-react';
import { PassportSettings } from '../../types/editor';

interface PassportToolProps {
  passport: PassportSettings;
  onChange: (passport: PassportSettings) => void;
  onApplyPassportMode: () => void;
  onCancelPassportMode: () => void;
  onSelectBackground: (color: string) => void;
}

export const PassportTool: React.FC<PassportToolProps> = ({
  passport,
  onChange,
  onApplyPassportMode,
  onCancelPassportMode,
  onSelectBackground,
}) => {
  const standards = [
    {
      id: 'bd' as const,
      name: 'Bangladesh Passport (e-Passport & MRP)',
      dimensions: '45 × 55 mm',
      targetPx: '531 × 650 px',
      aspect: 45 / 55,
      w: 531,
      h: 650,
      widthMm: 45,
      heightMm: 55,
      isJoint: false,
      badge: 'Official BD',
    },
    {
      id: 'bd_standard' as const,
      name: 'Bangladesh Passport / Visa / Studio',
      dimensions: '40 × 50 mm (1.57 × 1.97 in)',
      targetPx: '472 × 591 px',
      aspect: 40 / 50,
      w: 472,
      h: 591,
      widthMm: 40,
      heightMm: 50,
      isJoint: false,
      badge: 'BD Standard',
    },
    {
      id: 'bd_stamp' as const,
      name: 'Bangladesh Stamp Size (Admit / KYC)',
      dimensions: '20 × 25 mm',
      targetPx: '236 × 295 px',
      aspect: 20 / 25,
      w: 236,
      h: 295,
      widthMm: 20,
      heightMm: 25,
      isJoint: false,
      badge: 'BD Stamp',
    },
    {
      id: 'us' as const,
      name: 'US Passport / Visa',
      dimensions: '2 × 2 in (51 × 51 mm)',
      targetPx: '600 × 600 px',
      aspect: 1,
      w: 600,
      h: 600,
      widthMm: 51,
      heightMm: 51,
      isJoint: false,
    },
    {
      id: 'uk' as const,
      name: 'UK / EU / Australia',
      dimensions: '35 × 45 mm',
      targetPx: '827 × 1063 px',
      aspect: 35 / 45,
      w: 827,
      h: 1063,
      widthMm: 35,
      heightMm: 45,
      isJoint: false,
    },
    {
      id: 'schengen' as const,
      name: 'Schengen Visa',
      dimensions: '35 × 45 mm',
      targetPx: '413 × 531 px',
      aspect: 35 / 45,
      w: 413,
      h: 531,
      widthMm: 35,
      heightMm: 45,
      isJoint: false,
    },
    {
      id: 'ca' as const,
      name: 'Canada Passport',
      dimensions: '50 × 70 mm',
      targetPx: '1200 × 1680 px',
      aspect: 50 / 70,
      w: 1200,
      h: 1680,
      widthMm: 50,
      heightMm: 70,
      isJoint: false,
    },
    {
      id: 'joint_bd' as const,
      name: 'BD Joint (Pension / Marriage / Bank)',
      dimensions: '75 × 50 mm (3 × 2 in)',
      targetPx: '900 × 600 px',
      aspect: 1.5,
      w: 900,
      h: 600,
      widthMm: 75,
      heightMm: 50,
      isJoint: true,
      badge: 'BD 2-Person',
    },
    {
      id: 'joint_pension' as const,
      name: 'Joint Pension / Marriage (2-Person)',
      dimensions: '75 × 50 mm (3 × 2 in)',
      targetPx: '900 × 600 px',
      aspect: 1.5,
      w: 900,
      h: 600,
      widthMm: 75,
      heightMm: 50,
      isJoint: true,
    },
    {
      id: 'joint_standard' as const,
      name: 'Joint Standard ID (2-Person)',
      dimensions: '35 × 45 mm (Dual ICAO)',
      targetPx: '700 × 900 px',
      aspect: 35 / 45,
      w: 700,
      h: 900,
      widthMm: 35,
      heightMm: 45,
      isJoint: true,
    },
    {
      id: 'joint_square' as const,
      name: 'Joint Square (2-Person)',
      dimensions: '51 × 51 mm (2 × 2 in Dual)',
      targetPx: '600 × 600 px',
      aspect: 1.0,
      w: 600,
      h: 600,
      widthMm: 51,
      heightMm: 51,
      isJoint: true,
    },
  ];

  const bgColors = [
    { label: 'Off White', hex: '#FFFFFF' },
    { label: 'Light Blue', hex: '#E0F2FE' },
    { label: 'Light Gray', hex: '#F1F5F9' },
  ];

  return (
    <div id="tool-passport" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Passport Photo Studio</h3>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Align head, eyes, and dimensions to government standards
        </p>
      </div>

      {/* Official Disclaimer requirement */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Photo requirements vary by application. Please verify the required specifications before submission.
        </span>
      </div>

      {/* Standard selector */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">Preset Country / Standard</label>
        <div className="grid grid-cols-1 gap-2">
          {standards.map((s) => {
            const isSelected = passport.standard === s.id;
            return (
              <button
                key={s.id}
                onClick={() =>
                  onChange({
                    ...passport,
                    standard: s.id,
                    aspectRatio: s.aspect,
                    targetWidthPx: s.w,
                    targetHeightPx: s.h,
                    widthMm: s.widthMm,
                    heightMm: s.heightMm,
                    isJoint: s.isJoint,
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{s.name}</span>
                    {s.badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">{s.targetPx}</span>
                </div>
                <div className="text-[11px] text-slate-400">{s.dimensions}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Guide Lines Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="text-xs font-semibold text-white">Visual Alignment Guides</div>
          <div className="text-[10px] text-slate-400">
            Shows head oval, eye level, and chin marker
          </div>
        </div>
        <button
          onClick={() => onChange({ ...passport, showGuides: !passport.showGuides })}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            passport.showGuides ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${
              passport.showGuides ? 'left-5' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Background Color for Passport */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-2">
          Required Background Color
        </label>
        <div className="grid grid-cols-3 gap-2">
          {bgColors.map((bg) => (
            <button
              key={bg.hex}
              onClick={() => onSelectBackground(bg.hex)}
              className="flex items-center justify-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
            >
              <div
                className="w-4 h-4 rounded-full border border-black/30"
                style={{ backgroundColor: bg.hex }}
              />
              <span className="text-[11px]">{bg.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Apply / Cancel */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          id="btn-apply-passport"
          onClick={onApplyPassportMode}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 transition-all shadow-md shadow-emerald-500/20"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>Apply Passport Crop & Size</span>
        </button>

        <button
          onClick={onCancelPassportMode}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit Passport Mode</span>
        </button>
      </div>
    </div>
  );
};
