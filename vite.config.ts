import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
      if (source === 'react' || source.startsWith('react/')) {
        return path.resolve(root, 'node_modules', source);
      }
      if (source === 'react-dom' || source.startsWith('react-dom/')) {
        return path.resolve(root, 'node_modules', source);
      }
      if (!source.startsWith('@/') || !importer) return null;
      const app = roots.find(({ marker }) => importer.includes(marker));
      return app ? path.resolve(app.base, source.slice(2)) : null;
    },
  };
}

function serveJsepWasmAndApi(): Plugin {
  return {
    name: 'serve-wasm-and-api',
    async configureServer(server) {
      try {
        const expressModule = (await import('express')).default;
        const { apiRouter } = await import('./server/api.ts');
        const apiApp = expressModule();
        apiApp.use(apiRouter);
        server.middlewares.use('/api', (req, res, next) => {
          apiApp(req as any, res as any, next);
        });
      } catch (err) {
        console.warn('Could not mount /api in Vite dev server:', err);
      }

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

export default defineConfig(() => {
  return {
    plugins: [originalAppAliases(), react(), tailwindcss(), serveJsepWasmAndApi()],
    resolve: {
      alias: [
        { find: /^@\//, replacement: `${path.resolve(root, 'src')}/` },
        { find: /^react$/, replacement: path.resolve(root, 'node_modules/react') },
        { find: /^react\/(.*)$/, replacement: `${path.resolve(root, 'node_modules/react')}/$1` },
        { find: /^react-dom$/, replacement: path.resolve(root, 'node_modules/react-dom') },
        { find: /^react-dom\/(.*)$/, replacement: `${path.resolve(root, 'node_modules/react-dom')}/$1` },
      ],
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    publicDir: 'public',
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
