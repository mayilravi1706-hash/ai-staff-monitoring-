import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { securityHeaders, corsMiddleware } from './middleware/security';
import { notFoundHandler, centralErrorHandler } from './middleware/errorHandler';
import apiRouter from './routes';

export function createApp(): Express {
  const app = express();

  // Trust reverse proxy for accurate IP and protocol headers
  app.set('trust proxy', 1);

  // 1. Security & Parsing Middleware
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 2. Request Logging in non-test mode
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const startTime = Date.now();
      res.on('finish', () => {
        const durationMs = Date.now() - startTime;
        if (res.statusCode >= 400) {
          // Handled by central error handler
        }
      });
      next();
    });
  }

  // 3. API Routes mounted under /api
  app.use('/api', apiRouter);

  // 4. Serve built frontend static files
  const distFrontendPath = path.resolve(process.cwd(), 'dist/frontend');
  const publicPath = path.resolve(process.cwd(), 'public');

  if (fs.existsSync(distFrontendPath)) {
    app.use(express.static(distFrontendPath, { index: false }));
  }
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath, { index: false }));
  }

  // Root endpoint:
  // - Serves SPA index.html when a browser requests HTML (text/html)
  // - Serves JSON platform metadata for API / testing clients
  app.get('/', (req, res) => {
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');

    if (acceptsHtml) {
      const indexPath = path.join(distFrontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }

    return res.json({
      name: 'AI STAFF OPERATIONS INTELLIGENCE PLATFORM',
      phase: 'Phase 12 - Final Integration & Production Release',
      status: 'operational',
      docs: '/api/health',
    });
  });

  // SPA fallback for all sub-route browser navigations (e.g. /login, /admin/*, /staff/*)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    const indexPath = path.join(distFrontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    next();
  });

  // 5. 404 handler for unrecognized /api routes
  app.use(notFoundHandler);

  // 6. Central Error Handler
  app.use(centralErrorHandler);

  return app;
}

export const app = createApp();
