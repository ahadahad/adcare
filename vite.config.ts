import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const jsepWasm = path.join(root, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm');

function originalAppAliases(): Plugin {
  const roots = [
    { marker: `${path.sep}legacy${path.sep}a4-print${path.sep}`, base: path.join(root, 'legacy/a4-print') },
    { marker: `${path.sep}legacy${path.sep}photo-studio${path.sep}`, base: path.join(root, 'legacy/photo-studio') },
    { marker: `${path.sep}legacy${path.sep}nid-print${path.sep}`, base: path.join(root, 'legacy/nid-print') },
  ];
  return {
    name: 'original-app-local-aliases',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.startsWith('@/') || !importer) return null;
      const app = roots.find(({ marker }) => importer.includes(marker));
      return app ? path.resolve(app.base, source.slice(2)) : null;
    },
  };
}

function serveJsepWasmInDevelopment(): Plugin {
  return {
    name: 'serve-ort-jsep-wasm-in-development',
    configureServer(server) {
      server.middlewares.use('/ort-wasm-simd-threaded.jsep.wasm', (request, response, next) => {
        if ((request.method !== 'GET' && request.method !== 'HEAD') || !existsSync(jsepWasm)) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/wasm');
        response.setHeader('Content-Length', statSync(jsepWasm).size);
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        createReadStream(jsepWasm).on('error', next).pipe(response);
      });
    },
  };
}

export default defineConfig({
  plugins: [originalAppAliases(), react(), tailwindcss(), serveJsepWasmInDevelopment()],
  publicDir: 'public',
  build: {
    target: 'es2022',
    sourcemap: false,
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
          if (id.includes('/node_modules/react-router')) return 'router-vendor';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['.us2.manus.computer'],
    proxy: {
      '/api/detect-corners': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/api/ai': { target: 'http://127.0.0.1:3002', changeOrigin: true },
      '/api/detect-nid': {
        target: 'https://docu.itlancerbd.com',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/detect-nid/, '/detect-nid'),
        secure: false,
      },
    },
  },
});
