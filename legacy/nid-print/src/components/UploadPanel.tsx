import React, { useRef } from 'react';
import { SideId } from '../types/image';
import { Upload, Clipboard, Trash2, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

interface UploadPanelProps {
  side: SideId;
  title: string;
  banglaTitle: string;
  previewUrl?: string;
  onFileSelected: (side: SideId, file: File) => void;
  onRemove: (side: SideId) => void;
  onSelectSideTab: (side: SideId) => void;
  isActive: boolean;
}

export const UploadPanelSlot: React.FC<UploadPanelProps> = ({
  side,
  title,
  banglaTitle,
  previewUrl,
  onFileSelected,
  onRemove,
  onSelectSideTab,
  isActive,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onFileSelected(side, file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(side, e.target.files[0]);
    }
  };

  const handlePasteClick = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], `pasted_${side}_${Date.now()}.png`, { type });
            onFileSelected(side, file);
            return;
          }
        }
      }
    } catch {
      alert('কীবোর্ডে Ctrl + V চেপে সরাসরি পেস্ট করুন');
    }
  };

  return (
    <div
      onClick={() => onSelectSideTab(side)}
      className={`rounded-xl border transition-all p-3 flex flex-col gap-2 cursor-pointer ${
        isActive
          ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-500/10 shadow-xs'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
      }`}
    >
      {/* Slot Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              previewUrl
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {previewUrl ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">{title}</h3>
              {previewUrl && (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">
                  রেডি
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-bn">{banglaTitle}</p>
          </div>
        </div>

        {previewUrl && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-all"
              title="Replace Image"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(side);
              }}
              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
              title="Remove Image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Upload Box or Preview Thumbnail */}
      {previewUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-32 flex items-center justify-center">
          <img
            src={previewUrl}
            alt={title}
            className="max-h-full max-w-full object-contain p-1"
          />
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-2.5 py-1 text-xs font-semibold bg-white text-slate-800 rounded shadow-md hover:bg-slate-100"
            >
              নতুন ছবি
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/20 rounded-lg p-3 text-center flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-xs group-hover:bg-blue-600 group-hover:text-white text-slate-500 flex items-center justify-center transition-all border border-slate-200">
            <Upload className="w-4 h-4" />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700">ছবি ড্রপ করুন বা ব্রাউজ করুন</p>
            <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP সমর্থিত</p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePasteClick();
            }}
            className="mt-0.5 px-3 py-1 text-[11px] font-medium text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Clipboard className="w-3 h-3 text-blue-600" />
            <span>Ctrl + V দিয়ে পেস্ট</span>
          </button>
        </div>
      )}
    </div>
  );
};
