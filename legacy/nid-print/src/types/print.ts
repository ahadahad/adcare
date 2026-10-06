export type PaperOrientation = 'portrait' | 'landscape';
export type FitMode = 'nid_standard' | 'fit_width' | 'fit_height' | 'contain';

export interface PrintSettings {
  paperSize: 'a4';
  orientation: PaperOrientation;
  copies: 1 | 2;
  printGapMm: number;        // Vertical gap between front & back image (in mm)
  horizontalGapMm: number;   // Horizontal gap between 2 copies (in mm)
  verticalGapMm: number;     // Vertical gap between copies if stacked (in mm)
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  cardWidthMm: number;       // Bangladesh Standard NID Print Width: 85.6mm (8.6 cm / 3.38 in)
  cardHeightMm: number;      // Bangladesh Standard NID Print Height: 54.0mm (5.4 cm / 2.13 in)
  fitMode: FitMode;
  scalePercent: number;      // 50% - 150% custom scaling
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'a4',
  orientation: 'portrait',
  copies: 1,
  printGapMm: 4,
  horizontalGapMm: 16,
  verticalGapMm: 15,
  marginTopMm: 10,
  marginBottomMm: 10,
  marginLeftMm: 10,
  marginRightMm: 10,
  cardWidthMm: 85.6,
  cardHeightMm: 54.0,
  fitMode: 'nid_standard',
  scalePercent: 100,
};
