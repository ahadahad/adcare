# ShebaFlow Photo Studio — Computer Vision Architecture

A production-quality, privacy-preserving biometric photo studio with fully client-side computer vision algorithms running entirely in the browser.

## Core Capabilities

1. **Local Face & Landmark Detection (`/src/cv/face/detector.ts`)**
   - Leverages high-performance native browser `FaceDetector` API when present.
   - Robust offline fallback using YCbCr/HSV skin locus modeling, integral projections, and facial geometry heuristics.
   - Extracts bounding boxes, eye centers, nose tip, mouth curve, chin line, and head tilt degrees.

2. **Subject & Background Segmentation (`/src/cv/segmentation/background.ts`)**
   - 100% browser-based foreground matting.
   - Samples border perimeter pixels to model background chrominance clusters without transmitting photos to third-party endpoints.
   - Protects facial skin tones and center portrait prior for sharp hair/shoulder contours.

3. **Semantic Skin & Hair Segmentation (`/src/cv/segmentation/skin.ts`)**
   - Isolates facial skin, body skin, and hair contours for localized portrait retouching and blemish reduction.

4. **Biometric Passport Cropping & Standards Registry (`/src/cv/passport/`)**
   - Registry covering US, UK, Schengen, Canada, Australia, India, China, and dual-person Joint Passport standards.
   - Computes millimeter-calibrated eye-line positions, chin anchors, and minimum/maximum head size ratios.

5. **Multi-Copy 300 DPI Print Engine & PDF Export (`/src/cv/passport/printEngine.ts`)**
   - Generates pixel-calibrated print layouts for 4×6, 5×7, US Letter, and A4 paper.
   - Produces high-resolution vector PDF documents using `jspdf` and optional dashed cut guidelines for scissors/guillotine trimming.

6. **Web Worker Offloading (`/src/cv/workers/`)**
   - Dispatches heavy histogram calculations and luminance variances to background threads to prevent UI stutters.
