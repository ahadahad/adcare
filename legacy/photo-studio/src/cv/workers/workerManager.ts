/**
 * Worker Manager for Computer Vision Operations
 * Dispatches heavy tasks to Web Workers and safely falls back to synchronous main thread execution if Web Workers are restricted.
 */

export class CVWorkerManager {
  private worker: Worker | null = null;
  private messageIdCounter = 0;
  private pendingCallbacks = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('./cvWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e: MessageEvent) => {
          const { id, type, result, error } = e.data;
          const handler = this.pendingCallbacks.get(id);
          if (!handler) return;

          this.pendingCallbacks.delete(id);
          if (type === 'SUCCESS') {
            handler.resolve(result);
          } else {
            handler.reject(new Error(error || 'Worker task failed'));
          }
        };
        this.worker.onerror = (err) => {
          console.warn('CV Worker error:', err);
        };
      }
    } catch (err) {
      console.warn('Web Worker initialization skipped (fallback enabled):', err);
      this.worker = null;
    }
  }

  /**
   * Offloads luminance analysis to worker
   */
  public async analyzeHistogram(
    imageData: ImageData
  ): Promise<{ meanLuminance: number; stdDev: number }> {
    if (!this.worker) {
      // Fallback: execute inline
      const { data, width, height } = imageData;
      const totalPixels = width * height;
      let totalLuminance = 0;
      const hist = new Int32Array(256);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        hist[lum]++;
        totalLuminance += lum;
      }

      const meanLuminance = totalLuminance / totalPixels;
      let variance = 0;
      for (let i = 0; i < 256; i++) {
        const diff = i - meanLuminance;
        variance += hist[i] * diff * diff;
      }
      return { meanLuminance, stdDev: Math.sqrt(variance / totalPixels) };
    }

    const id = ++this.messageIdCounter;
    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(id, { resolve, reject });
      this.worker!.postMessage({
        id,
        type: 'ANALYZE_HISTOGRAM',
        payload: {
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
        },
      });
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCallbacks.clear();
  }
}

export const cvWorkerManager = new CVWorkerManager();
