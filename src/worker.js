const JSEP_URL = '/ort-wasm-simd-threaded.jsep.wasm';
const PART_URLS = [
  '/ort-wasm-simd-threaded.jsep.part-0',
  '/ort-wasm-simd-threaded.jsep.part-1',
];
const jsepHeaders = {
  'Content-Type': 'application/wasm',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

function isJsepPath(pathname) {
  return pathname === JSEP_URL || /^\/assets\/ort-wasm-simd-threaded\.jsep-[\w-]+\.wasm$/.test(pathname);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!isJsepPath(url.pathname)) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: jsepHeaders });

    const responses = await Promise.all(PART_URLS.map((part) =>
      env.ASSETS.fetch(new Request(new URL(part, url.origin), { method: 'GET' })),
    ));
    const failed = responses.find((response) => !response.ok || !response.body);
    if (failed) {
      for (const response of responses) await response.body?.cancel();
      return new Response('WebAssembly asset is temporarily unavailable', { status: 502 });
    }

    const body = new ReadableStream({
      async start(controller) {
        try {
          for (const response of responses) {
            const reader = response.body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } finally {
              reader.releaseLock();
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel(reason) {
        await Promise.all(responses.map((response) => response.body?.cancel(reason)));
      },
    });
    return new Response(body, { status: 200, headers: jsepHeaders });
  },
};
