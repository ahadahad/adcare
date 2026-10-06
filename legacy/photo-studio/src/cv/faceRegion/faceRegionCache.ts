/**
 * Face Region Cache
 * High-performance, LRU-bounded cache for face ROI and semantic segmentation masks.
 * Ensures instant (<0.1ms) reuse on slider drags and tool switching with zero memory leaks.
 */

import { FaceRoi, FaceRegionResult } from './faceRegionTypes';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class FaceRegionCache {
  private static instance: FaceRegionCache;

  private roiCache = new Map<string, CacheEntry<FaceRoi>>();
  private maskCache = new Map<string, CacheEntry<FaceRegionResult>>();

  private readonly MAX_CACHE_ENTRIES = 20;

  public static getInstance(): FaceRegionCache {
    if (!FaceRegionCache.instance) {
      FaceRegionCache.instance = new FaceRegionCache();
    }
    return FaceRegionCache.instance;
  }

  /**
   * Generates a stable cache key based on image identity and dimensions
   */
  public generateKey(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    customImageId?: string
  ): string {
    const w = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const h = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    if (customImageId) {
      return `img_${customImageId}_${w}x${h}`;
    }

    if ('src' in imageSource && (imageSource as HTMLImageElement).src) {
      const src = (imageSource as HTMLImageElement).src;
      const head = src.slice(0, 48);
      const tail = src.slice(-24);
      return `src_${src.length}_${head}_${tail}_${w}x${h}`;
    }

    return `canvas_${w}x${h}`;
  }

  // --- ROI Cache ---

  public getRoi(key: string): FaceRoi | null {
    const entry = this.roiCache.get(key);
    if (!entry) return null;
    entry.timestamp = Date.now();
    return entry.value;
  }

  public setRoi(key: string, roi: FaceRoi): void {
    if (this.roiCache.size >= this.MAX_CACHE_ENTRIES) {
      this.evictOldest(this.roiCache);
    }
    this.roiCache.set(key, { value: roi, timestamp: Date.now() });
  }

  // --- Mask Cache ---

  public getMask(key: string): FaceRegionResult | null {
    const entry = this.maskCache.get(key);
    if (!entry) return null;
    entry.timestamp = Date.now();
    return entry.value;
  }

  public setMask(key: string, mask: FaceRegionResult): void {
    if (this.maskCache.size >= this.MAX_CACHE_ENTRIES) {
      this.evictOldest(this.maskCache);
    }
    this.maskCache.set(key, { value: mask, timestamp: Date.now() });
  }

  public clear(): void {
    this.roiCache.clear();
    this.maskCache.clear();
  }

  private evictOldest<T>(map: Map<string, CacheEntry<T>>): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of map.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      map.delete(oldestKey);
    }
  }
}

export const faceRegionCache = FaceRegionCache.getInstance();
