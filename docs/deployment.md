# Deployment notes

## Static build

```bash
npm install
npm run build
```

The generated `dist/` contains the application shell, lazy JavaScript/CSS payloads, favicon, browser models/WASM files, and the two split ONNX JSEP assets. The homepage references no model or OCR asset. Model fetches occur only after entering the relevant tool and using a model-backed feature.

## Temporary Cloudflare preview

Run from this project directory in the requested isolated, unauthenticated environment:

```bash
npx --yes wrangler@4.102.0 deploy --temporary
```

`wrangler.toml` configures Workers Static Assets and SPA fallback. It pins `compatibility_date` to `2026-06-24`, the newest date supported by Wrangler 4.102.0's bundled local runtime. The only Worker-first paths are ONNX Runtime's original `/ort-wasm-simd-threaded.jsep.wasm` URL (plus its generated asset URL variant). The Worker streams the two `<25 MiB` static pieces back as the original same-origin WebAssembly response; it does not process photos, store user data, or use credentials. The [Cloudflare Workers limit table](https://developers.cloudflare.com/workers/platform/limits/) specifies a 25 MiB maximum for each static asset file. The temporary deployment is not connected to a Cloudflare account and does not use the user's saved CLI logins.

A temporary preview has no server-side credentials and does not execute the retained Express API servers. In that preview, A4's Gemini detector, Photo Studio's server AI assistant / remove.bg / server-provider routes, and server-only enhancement API routes are unavailable; original local CV, crop, OCR, image-editing and export fallbacks remain in the application. The optional NID external detection fallback, when allowed by the provider/browser, is unchanged from its source.

## Vercel front end and optional API services

For a static shell deploy, select the project root, run `npm run build`, and publish `dist/`. `vercel.json` enables client-side route refreshes. This static configuration does not deploy the Cloudflare kernel-stream Worker or legacy Express API processes. Without equivalent Vercel routing for the two split JSEP pieces, WebGPU initialization can fall back to the original WASM backend; A4 and Photo Studio server-backed provider calls remain disabled until their original API services are deployed.

For production features that need the original APIs, deploy the A4 and Photo Studio Node services from `legacy/a4-print` and `legacy/photo-studio` to an appropriate Node runtime, set server-only environment variables there, and route:

- `/api/detect-corners` → A4 API service.
- `/api/ai/*` → Photo Studio API service.
- `/api/detect-nid` → original external detector proxy, if used.

Never put provider keys in client-visible `VITE_*` variables. Review each provider's data handling before enabling it for sensitive images.

## Static asset considerations

The original Photo Studio archive contains multiple ONNX Runtime WASM variants. `public/` stages the standard SIMD runtime pair, local face landmark model, original upscaling models, and MediaPipe vision WASM variants; the full source assets are also retained in `legacy/photo-studio/public/`. The Vite build emits ONNX Runtime's optional 28 MB JSEP WebGPU asset; `scripts/prepare-assets.mjs` splits that unchanged binary into two pieces, and the Worker reassembles it as a same-origin stream. The original processing engine and provider selection are unchanged.
