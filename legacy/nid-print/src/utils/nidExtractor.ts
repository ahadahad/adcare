/**
 * Utility to detect or generate the Bangladesh NID number for clean file naming:
 * e.g. "nid-1234567890", "nid-3768415358"
 */

/**
 * Extracts NID number candidates from a filename if the user named their photo
 * e.g. "3768415358.jpg", "nid_1234567890_front.png", "doc_9876543210.jpeg"
 */
export function extractNidFromFileName(fileName?: string): string | null {
  if (!fileName) return null;

  // Match 10-digit (Smart NID), 13-digit, or 17-digit numbers
  const matchStrict = fileName.match(/\b(\d{17}|\d{13}|\d{10})\b/);
  if (matchStrict) {
    return matchStrict[1];
  }

  // Match any sequence of 8 to 17 digits
  const matchLoose = fileName.match(/\b(\d{8,17})\b/);
  if (matchLoose) {
    return matchLoose[1];
  }

  return null;
}

/**
 * Attempts to detect barcode on front or back card using browser native BarcodeDetector
 */
export async function detectBarcodeNid(canvas: HTMLCanvasElement | null): Promise<string | null> {
  if (!canvas) return null;

  try {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const formats = ['pdf417', 'code_128', 'code_39', 'qr_code', 'ean_13'];
      const detector = new BarcodeDetectorClass({ formats });
      const barcodes = await detector.detect(canvas);

      for (const bc of barcodes) {
        if (bc.rawValue) {
          // Look for 10, 13, or 17 digit NID number inside barcode payload
          const match = bc.rawValue.match(/\b(\d{17}|\d{13}|\d{10})\b/);
          if (match) return match[1];

          // If rawValue is digits only
          const clean = bc.rawValue.replace(/\D/g, '');
          if (clean.length >= 8 && clean.length <= 17) {
            return clean;
          }
        }
      }
    }
  } catch {
    // Native BarcodeDetector not supported or errored
  }

  return null;
}

/**
 * Generates a standard default NID number format if none was detected:
 * e.g. "nid-1234567890"
 */
export function generateDefaultNidNumber(): string {
  // Use timestamp hash to produce a realistic 10-digit number like "3768415358"
  const now = Date.now().toString();
  // Take last 8 digits and prepend "10" or "37"
  const lastDigits = now.slice(-8);
  return `10${lastDigits}`;
}

/**
 * Formats full filename by NID number:
 * e.g. "nid-1234567890.pdf"
 */
export function formatNidFileName(nidNumber: string, ext: 'pdf' | 'png' | 'jpg'): string {
  const cleanNid = nidNumber.replace(/[^\w-]/g, '').trim() || generateDefaultNidNumber();
  const prefix = cleanNid.toLowerCase().startsWith('nid-') ? cleanNid : `nid-${cleanNid}`;
  return `${prefix}.${ext}`;
}
