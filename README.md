# Ahad Digital Care

A unified product shell for three existing image and document applications. The original editors, processors, OCR, crop-learning data, print components, and server-side API implementations are retained under `legacy/`; the shell adds consistent routing, navigation, help pages, page metadata, and lazy tool mounting.

## Project structure

```text
src/
  app/                 Route table, page metadata, shared tool switcher
  components/           Brand header, footer, icons, isolated tool stage
  config/               Brand name, logo path, palette and support details
  i18n.tsx              English/Bangla copy and persisted language provider
  pages/                Home, About/privacy, Help/FAQ and 404
  styles/               Product shell and landing-page design system
  tool-entries/         One lazy adapter per original application
  worker.js             Cloudflare-only same-origin ONNX kernel stream
legacy/
  a4-print/             Original A4 app, crop learning and Gemini server
  photo-studio/         Original passport studio, models and API server
  nid-print/            Original NID/ID application, OCR and export code
public/
  models/, wasm/         Browser-side photo models and MediaPipe files
  ort-wasm-simd-threaded.*  Default ONNX runtime WASM pair
scripts/
  prepare-assets.mjs    Split the optional 28 MB ONNX kernel for Cloudflare
```

`/photo-studio`, `/a4-print`, and `/nid-print` each dynamically import only their own application. The legacy editor and stylesheet are mounted together in an open Shadow DOM, isolating their Tailwind resets, classes, modals and control styles from the shared shell and from one another. Navigating away unmounts the current editor, so its React state is not reused by the next tool. Heavy models are separate public assets and are fetched by the original feature code when that feature initializes, not by the landing page.

## Development

```bash
npm install
cp .env.example .env   # optional; leave secrets blank unless configured
npm run dev
```

The product shell runs at `http://localhost:3000`. The preserved A4 API server runs on port 3001 and the preserved Photo Studio API server on port 3002; Vite proxies their original `/api/detect-corners` and `/api/ai/*` routes. The NID detector's original proxy target is retained. Browser processing works without optional API keys.

## Verification

```bash
npm run build
npm run typecheck
npm run test:a4-crop-learning
npm run preview
```

`npm run build` creates `dist/` for static hosting, then splits only ONNX Runtime's optional 28 MB WebGPU/JSEP kernel into two small static parts. The homepage references no model or OCR asset. The Cloudflare Worker streams those parts back at the runtime's original same-origin WASM URL. Tool code and models remain demand-loaded after entering the relevant tool and using a model-backed feature.

## Brand settings

Edit `src/config/brand.ts` to change the brand name, short name, tagline, support email, logo/favicon paths, accent colors, font stack, or social links. Update `public/favicon.svg` when replacing the mark. Page titles and descriptions read the same brand settings.

## Languages

The shared product shell includes an always-visible `EN` / `বাংলা` switch. The selected language is saved in browser local storage as `ahad-digital-care-language`; the document language, page titles, shared navigation, landing page, About/privacy page, Help/FAQ, tool switcher, and tool-loading/error states follow that selection. English is the default when no preference has been saved. Translation copy lives in `src/i18n.tsx`.

The three original editors remain isolated and unmodified to preserve their processing engines and workflows. Their internal controls stay in their supplied source languages (Photo Studio and A4 Print are primarily English; the NID editor is already largely Bangla), while the surrounding shared shell and tool labels switch languages.

## Environment variables

All credentials are server-only; do not expose them with a `VITE_` prefix.

- `GEMINI_API_KEY`: optional A4 Gemini document-corner detector and Photo Studio Gemini features.
- `TOKEN_HARBOR_API_KEY`, `TOKEN_HARBOR_BASE_URL`, `TOKEN_HARBOR_MODEL`: optional Photo Studio assistant/provider.
- `REMOVE_BG_API_KEY`: optional Photo Studio remove.bg integration.
- `REAL_ESRGAN_ENABLED`, `REAL_ESRGAN_MODEL`: optional original Photo Studio server enhancement settings.
- `A4_API_ORIGIN`, `PHOTO_API_ORIGIN`: informational settings for separately hosted original API services.

## Deploy

Build and temporarily deploy the shell in the requested isolated, unauthenticated CLI environment:

```bash
npm run build
npx --yes wrangler@4.102.0 deploy --temporary
```

`wrangler.toml` pins `compatibility_date` to `2026-06-24`, the latest date accepted by the required Wrangler 4.102.0 bundled local runtime. It configures the SPA fallback and sends only the large ONNX kernel URL through a tiny Worker that streams two individually deployable static assets as one response. This stays within Cloudflare's current [Workers file-size limits](https://developers.cloudflare.com/workers/platform/limits/). The Worker does not process images or call providers. The temporary deployment carries no saved CLI login and has no server-side credentials.

For a normal Vercel front-end deployment, import this directory, use `npm run build`, and publish `dist`; `vercel.json` rewrites direct product routes to the SPA entry. This configuration does not deploy the Cloudflare WASM streaming Worker or the preserved Express APIs. If the optional WebGPU/JSEP file is requested on that static host, its initialization can fail and the original enhancement engine falls back to its WASM provider. To activate the full server-backed AI endpoints in a regular production deployment, host the retained Node API services from `legacy/a4-print` and `legacy/photo-studio` with server-only environment variables and route `/api/detect-corners` and `/api/ai/*` to those services. Credential-backed provider features are intentionally inactive in the temporary preview; original local CV, crop, OCR, image-editing and export fallbacks remain in the applications.

## Source preservation

The three input archives were copied into `legacy/` before integration. Their browser processors and components remain in their original source structure. The copied A4 stylesheet has a corrected escaped print-hidden selector; the copied Photo Studio server accepts `PORT` and disables its unused HMR socket so all three apps can run together during local development. No processing algorithm or source archive was replaced.
