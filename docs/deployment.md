# Deployment notes

## Cloudflare-compatible build

```bash
npm install
npm run build
```

The generated `dist/` contains the application shell, lazy JavaScript/CSS payloads, favicon, browser models/WASM files, and two split ONNX JSEP assets. The homepage references no model or OCR asset. Model fetches occur only after entering the relevant tool and using a model-backed feature.

## Temporary Cloudflare preview

Run from this project directory:

```bash
npx --yes wrangler@4.102.0 deploy --temporary
```

`wrangler.toml` configures Workers Static Assets and SPA fallback. It pins `compatibility_date` to `2026-06-24`, the newest date supported by Wrangler 4.102.0's bundled local runtime. The only Worker-first paths are ONNX Runtime's original `/ort-wasm-simd-threaded.jsep.wasm` URL (plus its generated asset URL variant). The Worker streams the two `<25 MiB` static pieces back as the original same-origin WebAssembly response; it does not process photos, store user data, or use credentials. The [Cloudflare Workers limit table](https://developers.cloudflare.com/workers/platform/limits/) specifies a 25 MiB maximum for each static asset file.

A temporary preview has no server-side credentials and does not execute the retained Express API servers. In that preview, A4's Gemini detector, Photo Studio's server AI assistant / remove.bg / server-provider routes, and server-only enhancement API routes are unavailable; original local CV, crop, OCR, image-editing and export fallbacks remain in the application. The optional NID external detection fallback, when allowed by the provider/browser, is unchanged from its source.

## Vercel static frontend

The root `vercel.json` selects Vite, runs `npm run build:vercel`, publishes `dist/`, and rewrites client-side routes to `/index.html`. The Vercel build intentionally runs Vite without `scripts/prepare-assets.mjs`: Vercel can serve ONNX Runtime's complete, hashed 28 MB JSEP WASM file directly, while the split pieces require the Cloudflare-only `src/worker.js` stream handler.

`.vercelignore` leaves the Windows archive and the duplicated `legacy/photo-studio/public/` source bundle in GitHub, but excludes them from Vercel uploads. The frontend uses the curated top-level `public/` assets instead; the resulting source upload is about 85 MB, below Vercel Hobby's 100 MB CLI source-upload limit. See [Vercel deployment limits](https://vercel.com/docs/limits).

This deployment is a static frontend; it does not run `server.ts` or the legacy Express APIs. Vercel Functions have a 4.5 MB request and response payload limit, while the existing photo/document endpoints accept large base64 images, so moving those endpoints into ordinary Vercel Functions would not preserve their behavior. For credential-backed provider features, deploy the retained A4 and Photo Studio Node APIs to a compatible Node host and route `/api/detect-corners` and `/api/ai/*` to those services. The app's browser-side CV, crop, OCR, editing, and export fallbacks remain available without those APIs. Never put provider keys in client-visible `VITE_*` variables; review each provider's data handling before enabling it for sensitive images.

## Static asset notes

The curated top-level `public/` directory contains the standard ONNX runtime WASM pair, local face landmark model, original upscaling models, and MediaPipe vision WASM variants. The full upstream Photo Studio public bundle remains preserved under `legacy/photo-studio/public/` for source history, but is not needed by the unified Vite build. The 28 MB JSEP asset is split only for the Cloudflare deployment; the Vercel build keeps the original Vite-emitted asset intact.
