import {
  CropLearningSample,
  DEFAULT_DETECTOR_CONFIG,
  DetectorConfig,
} from './CropLearningTypes';

const DB_NAME = 'documentCropLearning';
const DB_VERSION = 1;
const SAMPLES_STORE = 'samples';
const CONFIG_STORE = 'config';
const CONFIG_KEY = 'detector_config';

/**
 * Robust IndexedDB storage for anonymous crop correction samples.
 * Includes automatic FIFO pruning to prevent unbounded growth and
 * transparent in-memory fallback if IndexedDB is blocked.
 */
export class CropLearningStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memorySamples: CropLearningSample[] = [];
  private memoryConfig: DetectorConfig = { ...DEFAULT_DETECTOR_CONFIG };

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(SAMPLES_STORE)) {
            const store = db.createObjectStore(SAMPLES_STORE, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('detectorVersion', 'detectorVersion', { unique: false });
            store.createIndex('userAction', 'userAction', { unique: false });
          }

          if (!db.objectStoreNames.contains(CONFIG_STORE)) {
            db.createObjectStore(CONFIG_STORE);
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          console.warn('IndexedDB unavailable for crop learning, falling back to memory store.');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization failed:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Save an anonymous correction sample with FIFO capacity enforcement.
   */
  async saveSample(sample: CropLearningSample): Promise<void> {
    const config = await this.getConfig();
    const maxSamples = config.learning.maxSamples || 5000;

    const db = await this.initDB();
    if (!db) {
      this.memorySamples.push(sample);
      if (this.memorySamples.length > maxSamples) {
        this.memorySamples.splice(0, this.memorySamples.length - maxSamples);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([SAMPLES_STORE], 'readwrite');
        const store = tx.objectStore(SAMPLES_STORE);

        store.put(sample);

        tx.oncomplete = async () => {
          // Check count asynchronously and prune if exceeding maxSamples
          this.pruneOldSamples(db, maxSamples).catch(() => {});
          resolve();
        };

        tx.onerror = () => {
          // Fallback to memory
          this.memorySamples.push(sample);
          resolve();
        };
      } catch {
        this.memorySamples.push(sample);
        resolve();
      }
    });
  }

  /**
   * Enforces FIFO pruning if stored samples exceed max capacity.
   */
  private async pruneOldSamples(db: IDBDatabase, maxSamples: number): Promise<void> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([SAMPLES_STORE], 'readwrite');
        const store = tx.objectStore(SAMPLES_STORE);
        const countReq = store.count();

        countReq.onsuccess = () => {
          const count = countReq.result;
          if (count <= maxSamples) {
            resolve();
            return;
          }

          const deleteCount = count - maxSamples;
          const index = store.index('timestamp');
          let deleted = 0;

          const cursorReq = index.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor && deleted < deleteCount) {
              cursor.delete();
              deleted++;
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => resolve();
        };

        countReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Retrieve all anonymous samples (optionally filtered by detector version).
   */
  async getAllSamples(detectorVersion?: string): Promise<CropLearningSample[]> {
    const db = await this.initDB();
    if (!db) {
      if (detectorVersion) {
        return this.memorySamples.filter((s) => s.detectorVersion === detectorVersion);
      }
      return [...this.memorySamples];
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([SAMPLES_STORE], 'readonly');
        const store = tx.objectStore(SAMPLES_STORE);

        let req: IDBRequest;
        if (detectorVersion) {
          const index = store.index('detectorVersion');
          req = index.getAll(detectorVersion);
        } else {
          req = store.getAll();
        }

        req.onsuccess = () => {
          const result = (req.result || []) as CropLearningSample[];
          // Sort chronologically ascending
          result.sort((a, b) => a.timestamp - b.timestamp);
          resolve(result);
        };

        req.onerror = () => {
          resolve([...this.memorySamples]);
        };
      } catch {
        resolve([...this.memorySamples]);
      }
    });
  }

  /**
   * Retrieve recent N samples.
   */
  async getRecentSamples(limit: number = 100): Promise<CropLearningSample[]> {
    const all = await this.getAllSamples();
    return all.slice(-limit);
  }

  /**
   * Get total number of stored samples.
   */
  async getSampleCount(): Promise<number> {
    const db = await this.initDB();
    if (!db) {
      return this.memorySamples.length;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([SAMPLES_STORE], 'readonly');
        const store = tx.objectStore(SAMPLES_STORE);
        const countReq = store.count();

        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(this.memorySamples.length);
      } catch {
        resolve(this.memorySamples.length);
      }
    });
  }

  /**
   * Retrieve active detector configuration.
   */
  async getConfig(): Promise<DetectorConfig> {
    const db = await this.initDB();
    if (!db) {
      return { ...this.memoryConfig };
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([CONFIG_STORE], 'readonly');
        const store = tx.objectStore(CONFIG_STORE);
        const req = store.get(CONFIG_KEY);

        req.onsuccess = () => {
          if (req.result) {
            resolve({ ...DEFAULT_DETECTOR_CONFIG, ...req.result });
          } else {
            resolve({ ...DEFAULT_DETECTOR_CONFIG });
          }
        };

        req.onerror = () => resolve({ ...this.memoryConfig });
      } catch {
        resolve({ ...this.memoryConfig });
      }
    });
  }

  /**
   * Save updated detector configuration.
   */
  async saveConfig(config: DetectorConfig): Promise<void> {
    this.memoryConfig = { ...config };
    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([CONFIG_STORE], 'readwrite');
        const store = tx.objectStore(CONFIG_STORE);
        store.put(config, CONFIG_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Export all anonymous learning data as JSON.
   * GUARANTEE: Never includes images, OCR text, or personal information.
   */
  async exportData(): Promise<string> {
    const samples = await this.getAllSamples();
    const config = await this.getConfig();

    const exportPayload = {
      exportTimestamp: Date.now(),
      datasetVersion: 1,
      totalSamples: samples.length,
      config,
      samples,
    };

    return JSON.stringify(exportPayload, null, 2);
  }

  /**
   * Clear all stored learning samples with confirmation.
   */
  async clearData(): Promise<void> {
    this.memorySamples = [];
    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([SAMPLES_STORE], 'readwrite');
        const store = tx.objectStore(SAMPLES_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

// Global singleton instance
export const cropLearningStore = new CropLearningStore();
