import React, { useState } from 'react';
import { Printer, FileText, Grid, Check } from 'lucide-react';
import { ImageItem } from '../../types/editor';

interface PrintToolProps {
  activeImage: ImageItem;
  onOpenPrintModal: () => void;
}

export const PrintTool: React.FC<PrintToolProps> = ({ activeImage, onOpenPrintModal }) => {
  return (
    <div id="tool-print" className="flex flex-col gap-4 text-slate-200">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Print Studio</h3>
        <p className="text-xs text-slate-400">Generate high-DPI print sheets and passport strips</p>
      </div>

      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Print-Ready Layout</h4>
            <p className="text-[11px] text-slate-400">
              Arrange multiple copies on Letter, A4, or 4×6 photo paper with cut alignment guides.
            </p>
          </div>
        </div>

        <button
          id="btn-open-print-dialog"
          onClick={onOpenPrintModal}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 transition-all shadow-md shadow-emerald-500/20"
        >
          <Printer className="w-4 h-4 stroke-[2.5]" />
          <span>Configure & Print Sheet</span>
        </button>
      </div>

      <div className="space-y-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Supports 300 DPI high-resolution output</span>
        </div>
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Grid arrangement for multiple passport copies</span>
        </div>
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Built-in paper cutting guidelines</span>
        </div>
      </div>
    </div>
  );
};
