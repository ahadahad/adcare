import React, { useEffect, useState } from 'react';
import { PrintSettings } from '../types/print';

interface PrintLayoutProps {
  combinedCanvas: HTMLCanvasElement | null;
  printSettings: PrintSettings;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({
  combinedCanvas,
  printSettings,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (combinedCanvas) {
      setDataUrl(combinedCanvas.toDataURL('image/jpeg', 0.95));
    } else {
      setDataUrl(null);
    }
  }, [combinedCanvas]);

  if (!dataUrl) return null;

  const isLandscape = printSettings.copies === 2;
  const pageLayout = isLandscape ? 'landscape' : 'portrait';
  const widthMm = printSettings.cardWidthMm || 85.6;

  return (
    <div
      id="print-media-container"
      className="hidden print:block fixed inset-0 bg-white z-[9999] m-0 p-0 text-black font-sans"
    >
      <style>{`
        @page {
          size: A4 ${pageLayout};
          margin: 1cm;
        }

        @media print {
          html, body {
            width: ${isLandscape ? '297mm' : '210mm'};
            height: ${isLandscape ? '210mm' : '297mm'};
            background: #ffffff !important;
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          body > div:not(#print-media-container) {
            display: none !important;
          }

          #print-media-container {
            display: flex !important;
            position: fixed !important;
            inset: 0 !important;
            justify-content: ${isLandscape ? 'space-around' : 'center'} !important;
            align-items: center !important;
            width: 100% !important;
            height: 100% !important;
            background: #ffffff !important;
          }

          .print-nid-image {
            width: ${widthMm}mm !important;
            height: auto !important;
            object-fit: contain !important;
            display: block !important;
          }
        }
      `}</style>

      {/* Container matching itlancerbd print-container */}
      <div
        style={{
          display: 'flex',
          justifyContent: isLandscape ? 'space-around' : 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
        }}
      >
        <img
          src={dataUrl}
          className="print-nid-image"
          alt="Generated NID Card Copy 1"
          style={{ width: `${widthMm}mm`, height: 'auto' }}
        />

        {isLandscape && (
          <img
            src={dataUrl}
            className="print-nid-image"
            alt="Generated NID Card Copy 2"
            style={{ width: `${widthMm}mm`, height: 'auto' }}
          />
        )}
      </div>
    </div>
  );
};
