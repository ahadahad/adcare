# Deployment reference notes

Verified for the 2026-10-06 build:

- Cloudflare lists a maximum individual Workers Static Asset size of 25 MiB, which is why the 28,312,028-byte optional ONNX JSEP WASM is split into two pieces. Source: [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/).
- Workers Static Assets supports `not_found_handling = "single-page-application"` for SPA fallback and selective `run_worker_first` route patterns for a Worker-first WASM URL. Source: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
- The required Wrangler 4.102.0 local runtime reports its latest accepted compatibility date as 2026-06-24. The project pins to that date so the user-requested CLI version can run locally and deploy consistently.

The shell-hosted Worker only reassembles the byte-identical kernel stream. It does not handle user images or contact model/provider APIs.
