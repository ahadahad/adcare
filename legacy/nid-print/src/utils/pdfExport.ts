import { jsPDF } from 'jspdf';
import { PrintSettings } from '../types/print';

/**
 * Exports NID Document to PDF with official Bangladesh NID card dimensions:
 * - Length / Width (দৈর্ঘ্য): 8.6 cm / 3.38 in (85.6 mm)
 * - Breadth / Height (প্রস্থ): 5.4 cm / 2.13 in (54.0 mm)
 *
 * Layout modes:
 * - 1 Copy: A4 Portrait, centered (Front on top, Back on bottom)
 * - 2 Copies: A4 Landscape, side-by-side (2 full cards spaced across the page)
 *
 * Supports optional custom file name.
 */
export function exportToPdf(
  combinedCanvas: HTMLCanvasElement,
  settings: PrintSettings,
  customFileName?: string
): void {
  const { copies, cardWidthMm = 85.6 } = settings;
  const isLandscape = copies === 2;

  // A4 dimensions in mm: Portrait 210 x 297, Landscape 297 x 210
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = isLandscape ? 297 : 210;
  const pageH = isLandscape ? 210 : 297;

  // Exact Bangladesh NID card width in mm (default: 85.6mm)
  const docWMm = cardWidthMm;
  const canvasAspect = combinedCanvas.height / combinedCanvas.width;
  const docHMm = docWMm * canvasAspect;

  const imgData = combinedCanvas.toDataURL('image/jpeg', 0.95);

  const defaultName = `NID_Print_85.6mm_${copies === 1 ? '1_Copy' : '2_Copies'}_${Date.now()}.pdf`;
  const finalFileName = customFileName && customFileName.trim()
    ? (customFileName.trim().endsWith('.pdf') ? customFileName.trim() : `${customFileName.trim()}.pdf`)
    : defaultName;

  if (copies === 1) {
    // 1 Copy: A4 Portrait, centered
    const x = (pageW - docWMm) / 2;
    const y = (pageH - docHMm) / 2;

    doc.addImage(imgData, 'JPEG', x, y, docWMm, docHMm, undefined, 'FAST');
    doc.save(finalFileName);
  } else {
    // 2 Copies: A4 Landscape, spaced side by side
    const marginSide = (pageW - docWMm * 2) / 3;
    const x1 = marginSide;
    const x2 = marginSide * 2 + docWMm;
    const y = (pageH - docHMm) / 2;

    doc.addImage(imgData, 'JPEG', x1, y, docWMm, docHMm, undefined, 'FAST');
    doc.addImage(imgData, 'JPEG', x2, y, docWMm, docHMm, undefined, 'FAST');
    doc.save(finalFileName);
  }
}
