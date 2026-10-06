import React from 'react';
import {
  Undo2,
  Redo2,
  Eraser,
  Sparkles,
  ArrowLeftRight,
  Download,
  FileText,
  Printer,
  Users,
} from 'lucide-react';
import { AIStatusInfo } from '../../types/editor';

interface EditorHeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onEraser: () => void;
  onEnhance: () => void;
  isRemovingBg?: boolean;
  isEnhancing?: boolean;
  onFlipResize: () => void;
  onExport: () => void;
  onSaveProject: () => void;
  onPrint: () => void;
  onJointPhoto?: () => void;
  isPowerMode: boolean;
  onTogglePowerMode: () => void;
  hasActiveImage: boolean;
  aiStatus: AIStatusInfo | null;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onEraser,
  onEnhance,
  isRemovingBg = false,
  isEnhancing = false,
  onFlipResize,
  onExport,
  onSaveProject,
  onPrint,
  onJointPhoto,
  isPowerMode,
  onTogglePowerMode,
  hasActiveImage,
  aiStatus,
}) => {
  return (
    <header
      id="shebaflow-header"
      className="h-16 bg-[#0B1120] border-b border-[#1E293B] px-6 flex items-center justify-between select-none z-30 shrink-0"
    >
      {/* Left: App Title & Power Mode Toggle & AI API Button */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-wide text-cyan-400">Photo Studio</h1>

        <button
          type="button"
          onClick={onTogglePowerMode}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-wider transition-all border ${
            isPowerMode
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'bg-[#151B28] border-[#2A3449] text-slate-300 hover:border-slate-600'
          }`}
          title="Toggle AI Turbo Power Mode"
        >
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              isPowerMode
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
            }`}
          />
          <span>{isPowerMode ? 'POWER MODE ON' : 'POWER MODE OFF'}</span>
        </button>
      </div>

      {/* Center Group of Action Buttons */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#131C2E] border border-[#233149] shadow-inner">
        {/* Undo */}
        <button
          id="btn-undo"
          onClick={onUndo}
          disabled={!canUndo || !hasActiveImage}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1E293B] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* Redo */}
        <button
          id="btn-redo"
          onClick={onRedo}
          disabled={!canRedo || !hasActiveImage}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1E293B] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* Eraser / Cutout Button (Crimson) */}
        <button
          id="btn-eraser"
          onClick={onEraser}
          disabled={!hasActiveImage || isRemovingBg}
          className="w-9 h-9 rounded-xl bg-[#881337] hover:bg-[#9F1239] border border-[#BE123C]/60 text-white flex items-center justify-center shadow-md shadow-rose-950/40 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          title="Remove Background / Subject Cutout"
        >
          <Eraser className={`w-4 h-4 stroke-[2.2] ${isRemovingBg ? 'animate-spin text-rose-300' : ''}`} />
        </button>

        {/* Enhance / Magic Wand Button (Blue) */}
        <button
          id="btn-enhance-header"
          onClick={onEnhance}
          disabled={!hasActiveImage || isEnhancing}
          className="w-9 h-9 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] border border-[#3B82F6]/60 text-white flex items-center justify-center shadow-md shadow-blue-950/40 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          title="Smart Auto-Enhance & Clarify"
        >
          <Sparkles className={`w-4 h-4 stroke-[2.2] ${isEnhancing ? 'animate-spin text-blue-200' : ''}`} />
        </button>

        {/* Flip / Resize Button (Amber) */}
        <button
          id="btn-flip-resize"
          onClick={onFlipResize}
          disabled={!hasActiveImage}
          className="w-9 h-9 rounded-xl bg-[#D97706] hover:bg-[#B45309] border border-[#F59E0B]/60 text-white flex items-center justify-center shadow-md shadow-amber-950/40 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          title="Flip & Transform Photo"
        >
          <ArrowLeftRight className="w-4 h-4 stroke-[2.2]" />
        </button>
      </div>

      {/* Right Group of Utility Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Download / Export Button (Emerald Green) */}
        <button
          id="btn-export"
          onClick={onExport}
          disabled={!hasActiveImage}
          className="w-10 h-10 rounded-xl bg-[#059669] hover:bg-[#10B981] border border-[#34D399]/40 text-white flex items-center justify-center shadow-lg shadow-emerald-950/30 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          title="Download / Export Image"
        >
          <Download className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Save Project File (Teal) */}
        <button
          id="btn-save-project"
          onClick={onSaveProject}
          disabled={!hasActiveImage}
          className="w-10 h-10 rounded-xl bg-[#0D9488] hover:bg-[#14B8A6] border border-[#2DD4BF]/40 text-white flex items-center justify-center shadow-lg shadow-teal-950/30 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          title="Save / Export Project"
        >
          <FileText className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Joint Photo Composer Button (Teal) */}
        {onJointPhoto && (
          <button
            id="btn-joint-photo"
            onClick={onJointPhoto}
            className="w-10 h-10 rounded-xl bg-[#0F766E] hover:bg-[#14B8A6] border border-[#2DD4BF]/40 text-white flex items-center justify-center shadow-lg shadow-teal-950/30 transition-all hover:scale-105 active:scale-95"
            title="Joint Photo Composer (2-Person Portrait)"
          >
            <Users className="w-5 h-5 stroke-[2.2]" />
          </button>
        )}

        {/* Print Button (Purple) */}
        <button
          id="btn-print"
          onClick={onPrint}
          disabled={!hasActiveImage}
          className="w-10 h-10 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] border border-[#818CF8]/40 text-white flex items-center justify-center shadow-lg shadow-indigo-950/30 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
          title="Print Photo Sheet"
        >
          <Printer className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>
    </header>
  );
};
