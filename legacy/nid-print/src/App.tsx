import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useImageProcessing } from './hooks/useImageProcessing';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { Sidebar } from './components/Sidebar';
import { MainAreaHeader } from './components/MainAreaHeader';
import { ImageCanvas } from './components/ImageCanvas';
import { PreviewModal } from './components/PreviewModal';
import { PrintLayout } from './components/PrintLayout';
import { SideId } from './types/image';
import { exportToImage } from './utils/imageExport';
import { exportToPdf } from './utils/pdfExport';
import {
  extractNidFromFileName,
  detectBarcodeNid,
  formatNidFileName,
  generateDefaultNidNumber,
} from './utils/nidExtractor';
import { readActualNidFromCanvas } from './utils/nidOcr';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    autoSelectEnabled,
    setAutoSelectEnabled,
    frontSide,
    backSide,
    frontDisplayCanvas,
    backDisplayCanvas,
    combinedCanvas,
    printSettings,
    setPrintSettings,
    previewOpen,
    setPreviewOpen,
    isProcessingGlobal,
    statusMessage,
    loadSideImage,
    loadMultipleImages,
    removeSideImage,
    swapSides,
    resetAll,
    resetSide,
    autoSelect,
    manualCrop,
    cropFinal,
    updateCorner,
    updateAdjustment,
    autoColorAdjust,
    toggleUpscale,
    rotateSide,
  } = useImageProcessing();

  const fileInputHiddenRef = useRef<HTMLInputElement>(null);
  const targetUploadSideRef = useRef<SideId>('front');

  // NID Number state for automatic file naming: e.g. "nid-1234567890"
  const [nidNumber, setNidNumber] = useState<string>('');
  const [isReadingNid, setIsReadingNid] = useState<boolean>(false);

  // Delete side image handler
  const handleDeleteSide = (side: SideId) => {
    removeSideImage(side);
    if (side === 'front' && !backSide.sourceFile) {
      setNidNumber('');
    } else if (side === 'back' && !frontSide.sourceFile) {
      setNidNumber('');
    }
  };

  // Auto-detect actual NID number directly from the photo canvas using OCR + Barcode
  useEffect(() => {
    let isCancelled = false;

    async function scanCardForNid() {
      // Prioritize the front card (either display canvas, cropped canvas, or working canvas)
      const targetCanvas = frontDisplayCanvas || frontSide.workingCanvas;
      if (targetCanvas && targetCanvas.width > 0 && targetCanvas.height > 0) {
        setIsReadingNid(true);
        try {
          const res = await readActualNidFromCanvas(targetCanvas);
          if (!isCancelled && res.nidNumber) {
            setNidNumber(res.nidNumber);
            setIsReadingNid(false);
            return;
          }
        } catch (e) {
          console.warn('Front OCR error:', e);
        } finally {
          if (!isCancelled) setIsReadingNid(false);
        }
      }

      // Check back side if front didn't yield number
      const backCanvas = backDisplayCanvas || backSide.workingCanvas;
      if (backCanvas && backCanvas.width > 0 && backCanvas.height > 0) {
        setIsReadingNid(true);
        try {
          const resBack = await readActualNidFromCanvas(backCanvas);
          if (!isCancelled && resBack.nidNumber) {
            setNidNumber(resBack.nidNumber);
          }
        } catch (e) {
          console.warn('Back OCR error:', e);
        } finally {
          if (!isCancelled) setIsReadingNid(false);
        }
      }
    }

    if (!nidNumber || nidNumber.length < 10) {
      scanCardForNid();
    }

    return () => {
      isCancelled = true;
    };
  }, [frontDisplayCanvas, frontSide.workingCanvas, frontSide.isCropped, backDisplayCanvas, backSide.workingCanvas, nidNumber]);

  // Handler to load image and extract potential NID number from file name
  const handleLoadImageWithNid = useCallback(
    (side: SideId, file: File) => {
      const extracted = extractNidFromFileName(file.name);
      if (extracted && !nidNumber) {
        setNidNumber(extracted);
      }
      loadSideImage(side, file);
    },
    [loadSideImage, nidNumber]
  );

  // Global clipboard paste handler (Ctrl + V)
  const handlePastedImage = useCallback(
    (file: File) => {
      const targetSide: SideId =
        !frontSide.sourceFile && backSide.sourceFile
          ? 'front'
          : activeTab === 'back'
          ? 'back'
          : 'front';
      handleLoadImageWithNid(targetSide, file);
    },
    [activeTab, frontSide.sourceFile, backSide.sourceFile, handleLoadImageWithNid]
  );

  useClipboardPaste(handlePastedImage, true);

  const hasBothSides = Boolean(frontSide.sourceFile && backSide.sourceFile);
  const [sidebarTarget, setSidebarTarget] = useState<SideId | 'both'>('both');

  // When both sides are available, default to 'both' so adjustments affect both sides!
  useEffect(() => {
    if (hasBothSides) {
      if (activeTab === 'both') {
        setSidebarTarget('both');
      } else if (activeTab === 'front') {
        setSidebarTarget('front');
      } else if (activeTab === 'back') {
        setSidebarTarget('back');
      }
    } else if (frontSide.sourceFile) {
      setSidebarTarget('front');
    } else if (backSide.sourceFile) {
      setSidebarTarget('back');
    }
  }, [hasBothSides, activeTab, frontSide.sourceFile, backSide.sourceFile]);

  const activeSideId: SideId = activeTab === 'back' ? 'back' : 'front';
  const sidebarAdjustments =
    sidebarTarget === 'back' ? backSide.adjustments : frontSide.adjustments;
  const hasImages = Boolean(frontSide.sourceFile || backSide.sourceFile);

  const handleUploadClick = (side: SideId) => {
    targetUploadSideRef.current = side;
    fileInputHiddenRef.current?.click();
  };

  const handleDirectPrint = () => {
    window.print();
  };

  // Determine clean active NID number (e.g. "3768415358" or "10345678")
  const activeNid = nidNumber.trim() || generateDefaultNidNumber();

  // Downloads strictly named by NID number (e.g. nid-123xxxxx.png, nid-123xxxxx.pdf)
  const handleDownloadPng = () => {
    if (combinedCanvas) {
      const fileName = formatNidFileName(activeNid, 'png');
      exportToImage(combinedCanvas, 'png', fileName);
    }
  };

  const handleDownloadJpeg = () => {
    if (combinedCanvas) {
      const fileName = formatNidFileName(activeNid, 'jpg');
      exportToImage(combinedCanvas, 'jpeg', fileName);
    }
  };

  const handleDownloadPdf = () => {
    if (combinedCanvas) {
      const fileName = formatNidFileName(activeNid, 'pdf');
      exportToPdf(combinedCanvas, printSettings, fileName);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans antialiased">
      {/* Hidden file input for quick picker */}
      <input
        ref={fileInputHiddenRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            if (e.target.files.length === 1) {
              handleLoadImageWithNid(targetUploadSideRef.current, e.target.files[0]);
            } else {
              // Check first file for NID digits
              const extracted = extractNidFromFileName(e.target.files[0].name);
              if (extracted && !nidNumber) {
                setNidNumber(extracted);
              }
              loadMultipleImages(e.target.files);
            }
          }
        }}
        className="hidden"
      />

      {/* 1. LEFT SIDEBAR */}
      <Sidebar
        autoSelect={autoSelectEnabled}
        onAutoSelectChange={setAutoSelectEnabled}
        onFilesSelected={(files) => {
          if (files.length > 0) {
            const extracted = extractNidFromFileName(files[0].name);
            if (extracted && !nidNumber) {
              setNidNumber(extracted);
            }
          }
          loadMultipleImages(files);
        }}
        onPasteClick={async () => {
          try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              for (const type of item.types) {
                if (type.startsWith('image/')) {
                  const blob = await item.getType(type);
                  const file = new File([blob], `pasted_${Date.now()}.png`, { type });
                  handlePastedImage(file);
                  return;
                }
              }
            }
          } catch {
            alert('কীবোর্ডে Ctrl + V চেপে সরাসরি পেস্ট করুন');
          }
        }}
        adjustments={sidebarAdjustments}
        onAdjustmentChange={(key, val, target) => {
          const effectiveTarget = target || (hasBothSides ? sidebarTarget : activeSideId);
          updateAdjustment(effectiveTarget, key, val);
        }}
        onAutoColor={(target) => {
          const effectiveTarget = target || (hasBothSides ? sidebarTarget : activeSideId);
          autoColorAdjust(effectiveTarget);
        }}
        onResetAdjustments={(target) => {
          const effectiveTarget = target || (hasBothSides ? sidebarTarget : activeSideId);
          updateAdjustment(effectiveTarget, 'brightness', 0);
          updateAdjustment(effectiveTarget, 'contrast', 0);
          updateAdjustment(effectiveTarget, 'saturation', 0);
          updateAdjustment(effectiveTarget, 'levels', 0);
          updateAdjustment(effectiveTarget, 'textDeepen', 0);
          updateAdjustment(effectiveTarget, 'sharpen', 0);
        }}
        onGenerateNid={() => setPreviewOpen(true)}
        hasImages={hasImages}
        hasBothSides={hasBothSides}
        targetSide={hasBothSides ? sidebarTarget : (frontSide.sourceFile ? 'front' : 'back')}
        onTargetSideChange={setSidebarTarget}
      />

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc]">
        {/* Top Area Header: Front / Back / Both Tabs + Reset All & Swap */}
        <MainAreaHeader
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onResetAll={() => {
            setNidNumber('');
            resetAll();
          }}
          onSwapSides={swapSides}
          onAutoColorBoth={() => autoColorAdjust('both')}
          hasFront={Boolean(frontSide.sourceFile)}
          hasBack={Boolean(backSide.sourceFile)}
        />

        {/* Center Interactive Perspective Crop Canvas: Shows BOTH sides or single side */}
        <ImageCanvas
          viewMode={activeTab}
          frontSideState={frontSide}
          backSideState={backSide}
          frontDisplayCanvas={frontDisplayCanvas}
          backDisplayCanvas={backDisplayCanvas}
          onAutoSelect={autoSelect}
          onManualCrop={manualCrop}
          onCropFinal={cropFinal}
          onAutoColor={autoColorAdjust}
          onToggleUpscale={toggleUpscale}
          onRotateSide={(side) => rotateSide(side, 'cw')}
          onDeleteSide={handleDeleteSide}
          onUpdateCorner={updateCorner}
          onUploadClick={handleUploadClick}
          onDropFile={(side, file) => handleLoadImageWithNid(side, file)}
          onNextStep={() => setPreviewOpen(true)}
          isProcessing={isProcessingGlobal}
          statusMessage={statusMessage}
        />
      </main>

      {/* 3. Final Print Preview Modal (Combined view, A4 layout, Copies, Adjustments) */}
      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        combinedCanvas={combinedCanvas}
        adjustments={frontSide.adjustments}
        frontAdjustments={frontSide.adjustments}
        backAdjustments={backSide.adjustments}
        printSettings={printSettings}
        nidNumber={activeNid}
        isReadingNid={isReadingNid}
        onNidNumberChange={setNidNumber}
        onAdjustmentChange={(key, val, target = 'both') => updateAdjustment(target, key, val)}
        onPrintSettingsChange={(settings) =>
          setPrintSettings((prev) => ({ ...prev, ...settings }))
        }
        onAutoColor={(target = 'both') => autoColorAdjust(target)}
        onDownloadPng={handleDownloadPng}
        onDownloadJpeg={handleDownloadJpeg}
        onDownloadPdf={handleDownloadPdf}
        onDirectPrint={handleDirectPrint}
      />

      {/* 4. Print Layout Container (Isolated @media print) */}
      <PrintLayout combinedCanvas={combinedCanvas} printSettings={printSettings} />
    </div>
  );
}
