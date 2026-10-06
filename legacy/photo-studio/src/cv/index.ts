/**
 * Central Computer Vision Facade Service
 * Modular service orchestrating local face detection, segmentation, passport positioning, and enhancement.
 */

import { LocalFaceDetector, localFaceDetector } from './face/detector';
import { LocalBackgroundSegmenter, localBackgroundSegmenter } from './segmentation/background';
import { LocalSkinHairSegmenter, localSkinHairSegmenter } from './segmentation/skin';
import { LocalImageEnhancer, localImageEnhancer } from './enhancement/enhance';
import { PassportPositioningEngine, passportPositioningEngine } from './passport/positioning';
import { PASSPORT_SPECIFICATIONS, findPassportSpecification } from './passport/specifications';
import { PrintEngine, printEngine } from './passport/printEngine';
import {
  FaceDetectionResult,
  SegmentationResult,
  HairSkinSegmentationResult,
  PassportCropResult,
  PhotoSpecification,
  EnhancementParameters,
} from './types';

export class ComputerVisionService {
  private faceDetector: LocalFaceDetector = localFaceDetector;
  private bgSegmenter: LocalBackgroundSegmenter = localBackgroundSegmenter;
  private skinSegmenter: LocalSkinHairSegmenter = localSkinHairSegmenter;
  private enhancer: LocalImageEnhancer = localImageEnhancer;
  private passportEngine: PassportPositioningEngine = passportPositioningEngine;
  private printer: PrintEngine = printEngine;

  /**
   * 1. Detect faces & extract biometric landmarks
   */
  public async detectFaces(imageSource: HTMLImageElement | HTMLCanvasElement): Promise<FaceDetectionResult[]> {
    return this.faceDetector.detectFaces(imageSource);
  }

  /**
   * 2. Remove background and extract foreground cutout locally
   */
  public async removeBackground(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    options?: { tolerance?: number; featherRadius?: number }
  ): Promise<SegmentationResult> {
    return this.bgSegmenter.segmentForeground(imageSource, options);
  }

  /**
   * 3. Segment skin and hair semantic masks
   */
  public async segmentSkinAndHair(
    imageSource: HTMLImageElement | HTMLCanvasElement
  ): Promise<HairSkinSegmentationResult> {
    return this.skinSegmenter.segmentSkinAndHair(imageSource);
  }

  /**
   * 4. Calculate automatic passport crop for a given country specification
   */
  public calculatePassportCrop(
    imageWidth: number,
    imageHeight: number,
    face: FaceDetectionResult,
    specId = 'bd'
  ): PassportCropResult {
    const spec = findPassportSpecification(specId);
    return this.passportEngine.calculateCrop(imageWidth, imageHeight, face, spec);
  }

  /**
   * 5. Analyze optimal AI enhancement parameters
   */
  public analyzeEnhancement(imageSource: HTMLImageElement | HTMLCanvasElement): EnhancementParameters {
    return this.enhancer.analyzeOptimalEnhancements(imageSource);
  }

  /**
   * 6. Render high-resolution print sheet
   */
  public renderPrintSheet(
    singlePhotoCanvas: HTMLCanvasElement,
    options: Parameters<PrintEngine['renderPrintSheetCanvas']>[1]
  ): HTMLCanvasElement {
    return this.printer.renderPrintSheetCanvas(singlePhotoCanvas, options);
  }

  /**
   * 7. Export print sheet to official PDF document
   */
  public async exportPrintSheetToPdf(
    singlePhotoCanvas: HTMLCanvasElement,
    options: Parameters<PrintEngine['exportPrintSheetToPdf']>[1],
    filename?: string
  ): Promise<void> {
    return this.printer.exportPrintSheetToPdf(singlePhotoCanvas, options, filename);
  }

  /**
   * 8. Generate exact physical dimension HTML for browser printing
   */
  public generateBrowserPrintHtml(
    singlePhotoCanvas: HTMLCanvasElement,
    options: Parameters<PrintEngine['generateBrowserPrintHtml']>[1]
  ): string {
    return this.printer.generateBrowserPrintHtml(singlePhotoCanvas, options);
  }

  /**
   * Get all registered passport specifications
   */
  public getSpecifications(): PhotoSpecification[] {
    return PASSPORT_SPECIFICATIONS;
  }
}

export const cvService = new ComputerVisionService();
export * from './types';
export { PASSPORT_SPECIFICATIONS, findPassportSpecification } from './passport/specifications';
export {
  printEngine,
  PAPER_SIZES,
  calculatePrintLayout,
  arrangePhotoItems,
  DEFAULT_PAGE_SETTINGS,
  type PrintLayout,
  type PaperSizeKey,
  type PrintPhotoItem,
  type PageSettings,
} from './passport/printEngine';
export { PHOTO_PRESETS } from './passport/printLayout';
export { cvWorkerManager } from './workers/workerManager';
export {
  enhanceImageWithBrowserSwinIR,
  detectWebGPUSupport,
  getActiveBackend,
  getSwinIRSession,
  type InferenceBackend,
  type BrowserSwinIROptions,
  type BrowserSwinIRResult,
  type SwinIRProgress,
} from './enhancement/browserSwinIR';
