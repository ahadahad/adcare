/**
 * Dedicated Web Worker for Computer Vision Tasks
 * Executes heavy pixel loops, histogram calculations, and YCbCr skin locus tests off the main UI thread.
 */

self.onmessage = (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'ANALYZE_HISTOGRAM': {
        const { data, width, height } = payload;
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
        const stdDev = Math.sqrt(variance / totalPixels);

        self.postMessage({
          id,
          type: 'SUCCESS',
          result: { meanLuminance, stdDev },
        });
        break;
      }

      case 'COMPUTE_SKIN_LOCUS': {
        const { data, width, height } = payload;
        let skinCount = 0;
        let sumX = 0;
        let sumY = 0;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const Y = 0.299 * r + 0.587 * g + 0.114 * b;
            const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
            const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

            if (Cb >= 77 && Cb <= 127 && Cr >= 133 && Cr <= 173 && Y >= 40 && Y <= 245) {
              skinCount++;
              sumX += x;
              sumY += y;
            }
          }
        }

        self.postMessage({
          id,
          type: 'SUCCESS',
          result: {
            skinCount,
            centerX: skinCount > 0 ? sumX / skinCount : width / 2,
            centerY: skinCount > 0 ? sumY / skinCount : height / 2,
          },
        });
        break;
      }

      default:
        self.postMessage({ id, type: 'ERROR', error: `Unknown task: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({ id, type: 'ERROR', error: err?.message || String(err) });
  }
};
