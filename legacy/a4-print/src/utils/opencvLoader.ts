/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    cv: any;
  }
}

let opencvPromise: Promise<any> | null = null;

export function loadOpenCV(timeoutMs = 600): Promise<any> {
  // If window.cv is already fully initialized
  if (window.cv && window.cv.Mat && window.cv.getPerspectiveTransform) {
    return Promise.resolve(window.cv);
  }

  if (opencvPromise) {
    return opencvPromise;
  }

  opencvPromise = new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (res: any) => {
      if (!resolved) {
        resolved = true;
        resolve(res);
      }
    };

    const checkReady = () => {
      if (window.cv && window.cv.Mat && window.cv.getPerspectiveTransform) {
        safeResolve(window.cv);
        return true;
      }
      return false;
    };

    if (checkReady()) return;

    // Timeout: NEVER hang longer than timeoutMs
    const timer = setTimeout(() => {
      safeResolve(window.cv && window.cv.Mat ? window.cv : null);
    }, timeoutMs);

    // Watch for runtime initialization
    const hookRuntime = () => {
      if (window.cv) {
        if (typeof window.cv.onRuntimeInitialized !== 'undefined') {
          const prev = window.cv.onRuntimeInitialized;
          window.cv.onRuntimeInitialized = () => {
            if (typeof prev === 'function') prev();
            clearTimeout(timer);
            safeResolve(window.cv);
          };
        } else if (typeof window.cv.then === 'function') {
          window.cv.then((cvInstance: any) => {
            window.cv = cvInstance;
            clearTimeout(timer);
            safeResolve(cvInstance);
          });
        }
      }
    };

    hookRuntime();

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      hookRuntime();
      if (checkReady() || attempts > 15) {
        clearInterval(interval);
        clearTimeout(timer);
        safeResolve(window.cv && window.cv.Mat ? window.cv : null);
      }
    }, 40);

    let script = document.getElementById('opencv-js-script') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'opencv-js-script';
      script.async = true;
      script.src = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js';
      script.onload = () => {
        hookRuntime();
      };
      document.head.appendChild(script);
    }
  });

  return opencvPromise;
}

export function isOpenCVLoaded(): boolean {
  return Boolean(window.cv && window.cv.Mat && window.cv.getPerspectiveTransform);
}
