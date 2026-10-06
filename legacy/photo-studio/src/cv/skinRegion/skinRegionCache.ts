/**
 * Skin Region Cache (LRU)
 * Caches semantic skin masks and calibrated models.
 * Zero-latency (<0.1ms) reuse on slider drags and tool switching.
 */

import { SkinRegionResult } from './skinRegionTypes';

const MAX_CACHE_ENTRIES = 20;

export class SkinRegionCache {
  private static instance: SkinRegionCache;
  private maskCache = new Map<string, { result: SkinRegionResult; timestamp: number }>();

  public static getInstance(): SkinRegionCache {
    if (!SkinRegionCache.instance) {
      SkinRegionCache.instance = new SkinRegionCache();
    }
    return SkinRegionCache.instance;
  }

  public generateKey(
    imageSource: HTMLImageElement | HTMLCanvasElement,
    customImageId?: string
  ): string {
    if (customImageId) return `skin_${customImageId}`;
    if ('src' in imageSource && imageSource.src) {
      const src = imageSource.src;
      return `skin_${src.slice(0, 100)}_${imageSource.width}x${imageSource.height}`;
    }
    return `skin_${imageSource.width}x${imageSource.height}_${Date.now()}`;
  }

  public getMask(key: string): SkinRegionResult | null {
    const entry = this.maskCache.get(key);
    if (!entry) return null;
    entry.timestamp = Date.now();
    return entry.result;
  }

  public setMask(key: string, result: SkinRegionResult): void {
    if (this.maskCache.size >= MAX_CACHE_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.maskCache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.maskCache.delete(oldestKey);
      }
    }
    this.maskCache.set(key, { result, timestamp: Date.now() });
  }

  public clear(): void {
    this.maskCache.clear();
  }
}

export const skinRegionCache = SkinRegionCache.getInstance();
