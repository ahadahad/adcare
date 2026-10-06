import React from 'react';
import { SideId, CropData, Point, ImageSideState, ActiveTab } from '../types/image';
import { SingleSideCard } from './SingleSideCard';
import { ArrowRight, Printer, Sparkles, CheckCircle2 } from 'lucide-react';

interface ImageCanvasProps {
  viewMode: ActiveTab;
  frontSideState: ImageSideState;
  backSideState: ImageSideState;
  frontDisplayCanvas: HTMLCanvasElement | null;
  backDisplayCanvas: HTMLCanvasElement | null;
  onAutoSelect: (side: SideId) => void;
  onManualCrop: (side: SideId) => void;
  onCropFinal: (side: SideId) => void;
  onAutoColor: (side: SideId) => void;
  onToggleUpscale: (side: SideId) => void;
  onRotateSide: (side: SideId) => void;
  onDeleteSide: (side: SideId) => void;
  onUpdateCorner: (side: SideId, cornerKey: keyof CropData, point: Point) => void;
  onUploadClick: (side: SideId) => void;
  onDropFile: (side: SideId, file: File) => void;
  onNextStep: () => void;
  isProcessing: boolean;
  statusMessage?: string | null;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  viewMode,
  frontSideState,
  backSideState,
  frontDisplayCanvas,
  backDisplayCanvas,
  onAutoSelect,
  onManualCrop,
  onCropFinal,
  onAutoColor,
  onToggleUpscale,
  onRotateSide,
  onDeleteSide,
  onUpdateCorner,
  onUploadClick,
  onDropFile,
  onNextStep,
  isProcessing,
  statusMessage,
}) => {
  const hasFront = Boolean(frontSideState.sourceFile && frontSideState.workingCanvas);
  const hasBack = Boolean(backSideState.sourceFile && backSideState.workingCanvas);
  const bothCropped = frontSideState.isCropped && backSideState.isCropped;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden select-none relative font-sans">
      {/* WORKSPACE AREA: DUAL VIEW (BOTH SIDES) OR SINGLE VIEW */}
      <div className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col min-h-0">
        {viewMode === 'both' ? (
          /* ========================================================================= */
          /* 1. DUAL VIEW: BOTH SIDES DISPLAYED SIMULTANEOUSLY ON THE SAME PAGE */
          /* ========================================================================= */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 overflow-hidden min-h-0">
            {/* LEFT COLUMN: FRONT SIDE */}
            <SingleSideCard
              side="front"
              title="NID এর সামনের দিক (Front Side)"
              sideState={frontSideState}
              displayCanvas={frontDisplayCanvas}
              onAutoSelect={() => onAutoSelect('front')}
              onManualCrop={() => onManualCrop('front')}
              onCropFinal={() => onCropFinal('front')}
              onAutoColor={() => onAutoColor('front')}
              onToggleUpscale={() => onToggleUpscale('front')}
              onRotate={() => onRotateSide('front')}
              onDeleteImage={() => onDeleteSide('front')}
              onUpdateCorner={(cornerKey, pt) => onUpdateCorner('front', cornerKey, pt)}
              onUploadClick={() => onUploadClick('front')}
              onDropFile={(file) => onDropFile('front', file)}
              isProcessing={isProcessing}
              compactMode={true}
            />

            {/* RIGHT COLUMN: BACK SIDE */}
            <SingleSideCard
              side="back"
              title="NID এর পেছনের দিক (Back Side)"
              sideState={backSideState}
              displayCanvas={backDisplayCanvas}
              onAutoSelect={() => onAutoSelect('back')}
              onManualCrop={() => onManualCrop('back')}
              onCropFinal={() => onCropFinal('back')}
              onAutoColor={() => onAutoColor('back')}
              onToggleUpscale={() => onToggleUpscale('back')}
              onRotate={() => onRotateSide('back')}
              onDeleteImage={() => onDeleteSide('back')}
              onUpdateCorner={(cornerKey, pt) => onUpdateCorner('back', cornerKey, pt)}
              onUploadClick={() => onUploadClick('back')}
              onDropFile={(file) => onDropFile('back', file)}
              isProcessing={isProcessing}
              compactMode={true}
            />
          </div>
        ) : viewMode === 'front' ? (
          /* ========================================================================= */
          /* 2. SINGLE VIEW: FRONT SIDE ONLY */
          /* ========================================================================= */
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <SingleSideCard
              side="front"
              title="NID এর সামনের দিক (Front Side)"
              sideState={frontSideState}
              displayCanvas={frontDisplayCanvas}
              onAutoSelect={() => onAutoSelect('front')}
              onManualCrop={() => onManualCrop('front')}
              onCropFinal={() => onCropFinal('front')}
              onAutoColor={() => onAutoColor('front')}
              onToggleUpscale={() => onToggleUpscale('front')}
              onRotate={() => onRotateSide('front')}
              onDeleteImage={() => onDeleteSide('front')}
              onUpdateCorner={(cornerKey, pt) => onUpdateCorner('front', cornerKey, pt)}
              onUploadClick={() => onUploadClick('front')}
              onDropFile={(file) => onDropFile('front', file)}
              isProcessing={isProcessing}
              compactMode={false}
            />
          </div>
        ) : (
          /* ========================================================================= */
          /* 3. SINGLE VIEW: BACK SIDE ONLY */
          /* ========================================================================= */
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <SingleSideCard
              side="back"
              title="NID এর পেছনের দিক (Back Side)"
              sideState={backSideState}
              displayCanvas={backDisplayCanvas}
              onAutoSelect={() => onAutoSelect('back')}
              onManualCrop={() => onManualCrop('back')}
              onCropFinal={() => onCropFinal('back')}
              onAutoColor={() => onAutoColor('back')}
              onToggleUpscale={() => onToggleUpscale('back')}
              onRotate={() => onRotateSide('back')}
              onDeleteImage={() => onDeleteSide('back')}
              onUpdateCorner={(cornerKey, pt) => onUpdateCorner('back', cornerKey, pt)}
              onUploadClick={() => onUploadClick('back')}
              onDropFile={(file) => onDropFile('back', file)}
              isProcessing={isProcessing}
              compactMode={false}
            />
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="text-xs text-slate-600 font-bn flex items-center gap-2">
          {bothCropped ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>সামনের ও পেছনের দিক উভয়ই রেডি। 'NID তৈরি ও প্রিন্ট করুন' বাটনে ক্লিক করুন।</span>
            </span>
          ) : hasFront || hasBack ? (
            <span className="text-blue-700 font-medium">
              ★ উভয় পাশের ছবি নিশ্চিত করুন এবং প্রয়োজনমতো ক্রপ ফাইনাল করুন।
            </span>
          ) : (
            <span className="text-slate-500">
              উভয় পাশের ছবি আপলোড করে সহজে এডিট ও প্রিন্ট করুন।
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onNextStep}
          disabled={!hasFront && !hasBack}
          className="py-2.5 px-5 bg-[#2c3e50] hover:bg-[#1a252f] active:bg-[#121a22] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bn text-center flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>NID তৈরি ও প্রিন্ট করুন</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
