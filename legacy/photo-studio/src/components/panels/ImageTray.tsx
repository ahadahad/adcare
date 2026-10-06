import React, { useRef, useState } from 'react';
import { Upload, Users, Trash2, Check, Pipette } from 'lucide-react';
import { ImageItem, BackgroundSettings, BorderSettings } from '../../types/editor';
import { QUICK_COLOR_SWATCHES } from '../../data/backgroundColors';
import { ColorPickerPopover } from '../common/ColorPickerPopover';

interface ImageTrayProps {
  images: ImageItem[];
  activeImageId: string | null;
  onSelectImage: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onAddImages: (files: FileList | File[]) => void;
  background: BackgroundSettings;
  onChangeBackground: (bg: BackgroundSettings) => void;
  border: BorderSettings;
  onChangeBorder: (border: BorderSettings) => void;
  onOpenJointPhotoModal: () => void;
}

export const ImageTray: React.FC<ImageTrayProps> = ({
  images,
  activeImageId,
  onSelectImage,
  onDeleteImage,
  onAddImages,
  background,
  onChangeBackground,
  border,
  onChangeBorder,
  onOpenJointPhotoModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCustomColorBox, setShowCustomColorBox] = useState(false);

  return (
    <aside
      id="shebaflow-right-panel"
      onWheel={(e) => e.stopPropagation()}
      className="w-64 lg:w-72 h-[calc(100%-2rem)] max-h-[calc(100%-2rem)] bg-[#131C2E] border border-[#212F47] rounded-2xl p-4 flex flex-col gap-6 select-none shrink-0 shadow-xl m-4 ml-0 z-20 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-700"
    >
      {/* 1. Image Tray Section */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold text-slate-200">Image Tray</h3>

        {/* Upload Tile & Thumbnails */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Main Upload Box Tile (Blue square with upload icon) */}
          <button
            id="btn-tray-upload-tile"
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] border border-[#3B82F6] flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-950/40 hover:scale-105 active:scale-95 transition-all"
            title="Upload photo"
          >
            <Upload className="w-6 h-6 stroke-[2.5]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onAddImages(e.target.files);
              }
            }}
          />

          {/* Uploaded Thumbnails */}
          {images.map((item) => {
            const isSelected = item.id === activeImageId;
            return (
              <div
                key={item.id}
                onClick={() => onSelectImage(item.id)}
                className={`relative w-14 h-14 rounded-xl overflow-hidden cursor-pointer shrink-0 border transition-all ${
                  isSelected
                    ? 'ring-2 ring-cyan-400 border-transparent shadow-md'
                    : 'border-slate-700/80 hover:border-slate-500 opacity-80 hover:opacity-100'
                }`}
              >
                <img
                  src={item.thumbnailUrl || item.currentUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteImage(item.id);
                  }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white/80 hover:text-rose-400 hover:bg-black flex items-center justify-center text-[10px]"
                  title="Remove image"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Colors Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">Backdrop Colors</h3>
          <span className="text-[10px] text-cyan-400 font-mono">
            {background.isTransparent
              ? 'Transparent'
              : background.color.includes('gradient')
              ? 'Gradient'
              : background.color}
          </span>
        </div>

        {/* Color Swatches Grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_COLOR_SWATCHES.map((swatch) => {
            const isSelected = swatch.isTransparent
              ? background.isTransparent
              : !background.isTransparent &&
                (background.color.toLowerCase() === swatch.value.toLowerCase() ||
                  (swatch.isGradient && background.color.includes('gradient')));

            if (swatch.isTransparent) {
              return (
                <button
                  key={swatch.id}
                  id="tray-color-transparent"
                  onClick={() => onChangeBackground({ isTransparent: true, color: '#FFFFFF' })}
                  className={`relative w-8 h-8 rounded-lg border transition-all hover:scale-105 active:scale-95 flex items-center justify-center overflow-hidden ${
                    isSelected ? 'ring-2 ring-cyan-400 border-white shadow-md' : 'border-slate-700/60'
                  }`}
                  title="Transparent Background (Alpha)"
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `linear-gradient(45deg, #334155 25%, transparent 25%), 
                                        linear-gradient(-45deg, #334155 25%, transparent 25%), 
                                        linear-gradient(45deg, transparent 75%, #334155 75%), 
                                        linear-gradient(-45deg, transparent 75%, #334155 75%)`,
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                      backgroundColor: '#1E293B',
                    }}
                  />
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-cyan-400 absolute stroke-[2.5]" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={swatch.id}
                id={`tray-color-${swatch.id}`}
                onClick={() =>
                  onChangeBackground({
                    isTransparent: false,
                    color: swatch.value,
                  })
                }
                className={`relative w-8 h-8 rounded-lg border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
                  isSelected ? 'ring-2 ring-cyan-400 border-white shadow-md' : 'border-slate-700/60'
                }`}
                style={
                  swatch.isGradient
                    ? { background: swatch.value }
                    : { backgroundColor: swatch.value }
                }
                title={`${swatch.label} (${swatch.value})`}
              >
                {isSelected && (
                  <Check
                    className={`w-3.5 h-3.5 stroke-[2.5] ${
                      swatch.value === '#FFFFFF' ||
                      swatch.value === '#F8FAFC' ||
                      swatch.value === '#E2E8F0' ||
                      swatch.value === '#BAE6FD' ||
                      swatch.value === '#FFEDD5' ||
                      swatch.value === '#FCE7F3' ||
                      swatch.value === '#E2E8DF'
                        ? 'text-slate-950'
                        : 'text-white'
                    }`}
                  />
                )}
              </button>
            );
          })}

          {/* Direct Custom Color Picker Pipette button */}
          <button
            type="button"
            id="btn-tray-custom-color"
            onClick={() => setShowCustomColorBox((prev) => !prev)}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm ${
              showCustomColorBox
                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 ring-2 ring-cyan-400/50'
                : 'border-slate-700/80 bg-slate-850 hover:bg-slate-750 text-cyan-400'
            }`}
            title="Open custom color box in panel"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Custom Color Box Popover (Opens right on color side) */}
        <ColorPickerPopover
          color={
            background.isTransparent || background.color.includes('gradient')
              ? '#FFFFFF'
              : background.color
          }
          onChange={(newColor) =>
            onChangeBackground({
              isTransparent: false,
              color: newColor,
            })
          }
          isOpen={showCustomColorBox}
          onClose={() => setShowCustomColorBox(false)}
          anchorSide="inline"
        />
      </div>

      {/* 3. Border Option with Color Select Option */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200 select-none">
            <input
              id="checkbox-border-enable"
              type="checkbox"
              checked={border.enabled}
              onChange={(e) =>
                onChangeBorder({
                  ...border,
                  enabled: e.target.checked,
                  color: border.color || '#FFFFFF',
                  width: border.width || 2,
                })
              }
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
            />
            <span>Photo Border</span>
          </label>
          {border.enabled && (
            <span className="text-[10px] font-mono text-cyan-400">
              {border.width || 2}px
            </span>
          )}
        </div>

        {border.enabled && (
          <div className="pl-6 flex flex-col gap-2 pt-0.5 animate-in fade-in duration-150">
            {/* Color Swatches */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'White', hex: '#FFFFFF' },
                { label: 'Black', hex: '#000000' },
                { label: 'Light Gray', hex: '#CBD5E1' },
                { label: 'Slate', hex: '#475569' },
                { label: 'Cyan', hex: '#06B6D4' },
                { label: 'Emerald', hex: '#10B981' },
              ].map((swatch) => {
                const isSelected = (border.color || '#FFFFFF').toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() =>
                      onChangeBorder({
                        ...border,
                        color: swatch.hex,
                      })
                    }
                    className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
                      isSelected
                        ? 'scale-110 ring-2 ring-cyan-400 border-white'
                        : 'border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                    title={`${swatch.label} (${swatch.hex})`}
                  >
                    {isSelected && (
                      <Check
                        className={`w-3 h-3 stroke-[3] ${
                          swatch.hex === '#FFFFFF' || swatch.hex === '#CBD5E1'
                            ? 'text-slate-900'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                );
              })}

              {/* Custom Color Input */}
              <label
                className="w-6 h-6 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 relative overflow-hidden"
                title="Pick Custom Border Color"
              >
                <Pipette className="w-3 h-3 text-cyan-400" />
                <input
                  type="color"
                  value={border.color || '#FFFFFF'}
                  onChange={(e) =>
                    onChangeBorder({
                      ...border,
                      color: e.target.value,
                    })
                  }
                  className="absolute opacity-0 w-0 h-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Width Selector */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[10px] text-slate-400">Width:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 4, 8].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() =>
                      onChangeBorder({
                        ...border,
                        width: w,
                      })
                    }
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all border ${
                      (border.width || 2) === w
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Joint Passport Photo Button */}
      <div className="mt-auto pt-2">
        <button
          id="btn-joint-photo"
          onClick={onOpenJointPhotoModal}
          className="w-full flex flex-col items-center justify-center py-2.5 px-3 rounded-xl font-bold text-xs tracking-wide text-white bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-500 hover:from-teal-500 hover:to-emerald-500 shadow-lg shadow-teal-950/50 active:scale-98 transition-all border border-teal-400/30 group"
          title="Create official 2-person Joint Passport Photo with matching head sizes and eye alignment"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 stroke-[2.5] text-teal-200 group-hover:scale-110 transition-transform" />
            <span className="text-white text-xs font-bold">Joint Passport Photo</span>
          </div>
          <span className="text-[10px] text-teal-200/80 font-normal">2-Person Official ID & Pension</span>
        </button>
      </div>
    </aside>
  );
};
