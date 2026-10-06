/**
 * Safe Image Source Loader & Validator
 * Converts strings (URLs, Data URLs, Blob URLs, CSS url(...) values), Blobs,
 * and image objects into valid, fully-loaded CanvasImageSources for 2D Canvas operations.
 */

export type SupportedImageSource =
  | string
  | Blob
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas
  | SVGImageElement
  | HTMLVideoElement
  | any;

/**
 * Checks if a value is already a valid CanvasImageSource
 */
export function isValidCanvasImageSource(source: any): source is CanvasImageSource {
  if (!source) return false;
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return source.complete && source.naturalWidth > 0;
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return source.width > 0 && source.height > 0;
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return source.width > 0 && source.height > 0;
  }
  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
    return source.width > 0 && source.height > 0;
  }
  if (typeof SVGImageElement !== 'undefined' && source instanceof SVGImageElement) {
    return true;
  }
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return source.readyState >= 2;
  }
  return false;
}

/**
 * Robustly converts any supported image source (string URL, Data URL, Blob,
 * CSSImageValue, or Image element) into a valid, fully-loaded CanvasImageSource.
 */
export async function loadImageSource(
  source: SupportedImageSource
): Promise<CanvasImageSource> {
  if (!source) {
    throw new Error('Enhance image source is missing');
  }

  // 1. Direct valid CanvasImageSource types (Canvas, Bitmap, Offscreen, SVG, Video)
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return source;
  }

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return source;
  }

  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
    return source;
  }

  if (typeof SVGImageElement !== 'undefined' && source instanceof SVGImageElement) {
    return source;
  }

  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return source;
  }

  // 2. HTMLImageElement: ensure fully loaded before returning
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    if (source.complete && source.naturalWidth > 0) {
      return source;
    }

    await new Promise<void>((resolve, reject) => {
      const onDone = () => {
        source.removeEventListener('load', onDone);
        source.removeEventListener('error', onErr);
        resolve();
      };
      const onErr = () => {
        source.removeEventListener('load', onDone);
        source.removeEventListener('error', onErr);
        reject(new Error('Failed to load HTMLImageElement source'));
      };

      source.addEventListener('load', onDone);
      source.addEventListener('error', onErr);

      if (source.complete) {
        if (source.naturalWidth > 0) onDone();
        else onErr();
      }
    });

    return source;
  }

  // 3. Blob / File
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    const url = URL.createObjectURL(source);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image from Blob'));
        img.src = url;
      });

      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // 4. String or CSS computed value extraction
  let urlString: string | null = null;

  if (typeof source === 'string') {
    urlString = source.trim();
  } else if (typeof source === 'object' && source !== null) {
    // Check common image object properties: currentUrl, src, url
    if (typeof source.currentUrl === 'string' && source.currentUrl.trim()) {
      urlString = source.currentUrl.trim();
    } else if (typeof source.src === 'string' && source.src.trim()) {
      urlString = source.src.trim();
    } else if (typeof source.url === 'string' && source.url.trim()) {
      urlString = source.url.trim();
    } else if (typeof source.toString === 'function') {
      const stringified = source.toString();
      if (stringified && stringified !== '[object Object]') {
        urlString = stringified.trim();
      }
    }
  }

  if (urlString) {
    // If CSS background-image syntax like url("..."), extract the clean URL
    const cssUrlMatch = urlString.match(/^url\(['"]?(.*?)['"]?\)$/i);
    if (cssUrlMatch && cssUrlMatch[1]) {
      urlString = cssUrlMatch[1].trim();
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image from string URL'));
      img.src = urlString!;
    });

    return img;
  }

  throw new Error('Unsupported image source for canvas drawing');
}

/**
 * Helper to get intrinsic dimensions of any CanvasImageSource safely
 */
export function getImageDimensions(source: CanvasImageSource): { width: number; height: number } {
  if ('naturalWidth' in source && typeof source.naturalWidth === 'number' && source.naturalWidth > 0) {
    return {
      width: source.naturalWidth,
      height: (source as HTMLImageElement).naturalHeight || (source as HTMLImageElement).height || 1,
    };
  }
  if ('width' in source && typeof source.width === 'number') {
    return {
      width: source.width,
      height: (source as any).height || 1,
    };
  }
  return { width: 1, height: 1 };
}
