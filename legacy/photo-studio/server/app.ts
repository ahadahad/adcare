import express from 'express';
import dotenv from 'dotenv';
import { aiRouter } from './routes/ai.js';

dotenv.config();

export function createApp() {
  const app = express();

  // Middlewares for high-resolution photo payloads
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ limit: '60mb', extended: true }));

  // API Health routes (compatible with both direct server and Vercel serverless rewrites)
  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({
      status: 'ok',
      app: 'ShebaFlow Photo Studio',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount AI endpoints at /api/ai, /ai, and /api for seamless routing on Vercel serverless and local Express
  app.use(['/api/ai', '/ai', '/api'], aiRouter);

  // Global error handling middleware for API routes and body-parser limits
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError')) {
      return res.status(413).json({
        error: 'Image payload is too large. ShebaFlow automatically optimizes high-resolution photos, or you can use an image under 50MB.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        error: 'Malformed JSON payload.',
        code: 'INVALID_JSON',
      });
    }
    if (err) {
      console.error('Unhandled server error:', err);
      return res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
      });
    }
    next();
  });

  return app;
}

export const app = createApp();
export default app;
